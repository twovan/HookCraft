import type { KieSunoProvider } from '@/lib/generation/KieSunoProvider';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import {
  ADVANCED_ARRANGEMENT_AUDIO_BUCKET,
  inferAudioContentType,
  validateAdvancedArrangementStoredAudio,
  validateAdvancedArrangementUploadMetadata,
} from './advancedArrangementUpload';

export class AdvancedArrangementAudioUploadError extends Error {
  statusCode = 400;
}

export async function resolveAdvancedArrangementAudioUpload(input: {
  formData: FormData;
  userId: string;
  provider: KieSunoProvider;
  supabaseAdmin: SupabaseClient<Database>;
}): Promise<string> {
  const file = input.formData.get('file') as File | null;

  if (file) {
    const validation = validateAdvancedArrangementUploadMetadata({
      fileName: file.name,
      contentType: file.type,
      size: file.size,
    });

    if (!validation.valid) {
      throw new AdvancedArrangementAudioUploadError(validation.error);
    }

    return input.provider.uploadAudioFile(file, input.userId);
  }

  const bucket = String(input.formData.get('uploadedBucket') || ADVANCED_ARRANGEMENT_AUDIO_BUCKET);
  const path = String(input.formData.get('uploadedPath') || '').trim();
  const fileName = String(input.formData.get('fileName') || path.split('/').pop() || '').trim();
  const contentType = String(input.formData.get('contentType') || '').trim();
  const claimedSize = Number(input.formData.get('fileSize') || 0);

  if (bucket !== ADVANCED_ARRANGEMENT_AUDIO_BUCKET) {
    throw new AdvancedArrangementAudioUploadError('上传音频路径无效，请重新选择文件');
  }

  const metadataValidation = validateAdvancedArrangementStoredAudio({
    userId: input.userId,
    path,
    fileName,
    contentType,
    size: claimedSize,
  });

  if (!metadataValidation.valid) {
    throw new AdvancedArrangementAudioUploadError(metadataValidation.error);
  }

  const { data: blob, error } = await input.supabaseAdmin.storage
    .from(ADVANCED_ARRANGEMENT_AUDIO_BUCKET)
    .download(path);

  if (error || !blob) {
    console.error('[kie/advanced-arrangement] Download uploaded audio failed:', error);
    throw new AdvancedArrangementAudioUploadError('读取上传音频失败，请重新选择文件');
  }

  const actualValidation = validateAdvancedArrangementStoredAudio({
    userId: input.userId,
    path,
    fileName,
    contentType: blob.type || metadataValidation.contentType,
    size: blob.size,
  });

  if (!actualValidation.valid) {
    throw new AdvancedArrangementAudioUploadError(actualValidation.error);
  }

  const audioFile = new File([blob], fileName, {
    type: blob.type || inferAudioContentType(actualValidation.extension),
  });

  return input.provider.uploadAudioFile(audioFile, input.userId);
}
