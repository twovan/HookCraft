export const ADVANCED_ARRANGEMENT_AUDIO_BUCKET = 'generations';
export const ADVANCED_ARRANGEMENT_MAX_FILE_SIZE = 100 * 1024 * 1024;

const ALLOWED_TYPES = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/wave'];
const ALLOWED_EXTENSIONS = ['mp3', 'wav'];

interface UploadMetadataInput {
  fileName: string;
  contentType?: string | null;
  size: number;
}

type UploadValidationResult =
  | { valid: true; extension: string; contentType: string; size: number }
  | { valid: false; error: string };

export function validateAdvancedArrangementUploadMetadata(input: UploadMetadataInput): UploadValidationResult {
  const fileName = input.fileName.trim();
  const extension = fileName.split('.').pop()?.toLowerCase() || '';
  const contentType = (input.contentType || '').trim();
  const hasAllowedMime = !contentType || contentType === 'application/octet-stream' || ALLOWED_TYPES.includes(contentType);
  const hasAllowedExtension = ALLOWED_EXTENSIONS.includes(extension);

  if (!fileName) {
    return { valid: false, error: '请先上传参考音频' };
  }

  if (!hasAllowedMime || !hasAllowedExtension) {
    return { valid: false, error: '仅支持 MP3/WAV 音频文件' };
  }

  if (!Number.isFinite(input.size) || input.size <= 0) {
    return { valid: false, error: '音频文件大小无效' };
  }

  if (input.size > ADVANCED_ARRANGEMENT_MAX_FILE_SIZE) {
    return { valid: false, error: '音频文件不能超过 100MB' };
  }

  return {
    valid: true,
    extension,
    contentType: contentType || inferAudioContentType(extension),
    size: input.size,
  };
}

export function buildAdvancedArrangementStoragePath(input: {
  userId: string;
  fileName: string;
  now?: number;
  randomId?: string;
}): string {
  const extension = input.fileName.split('.').pop()?.toLowerCase() || 'mp3';
  const now = input.now ?? Date.now();
  const randomId = input.randomId ?? crypto.randomUUID();
  return `${input.userId}/kie/uploads/${now}-${randomId}.${extension}`;
}

export function validateAdvancedArrangementStoredAudio(input: UploadMetadataInput & {
  userId: string;
  path: string;
}): UploadValidationResult {
  const validation = validateAdvancedArrangementUploadMetadata(input);
  if (!validation.valid) return validation;

  const expectedPrefix = `${input.userId}/kie/uploads/`;
  if (!input.path.startsWith(expectedPrefix)) {
    return { valid: false, error: '上传音频路径无效，请重新选择文件' };
  }

  return validation;
}

export function inferAudioContentType(extension: string): string {
  return extension === 'wav' ? 'audio/wav' : 'audio/mpeg';
}
