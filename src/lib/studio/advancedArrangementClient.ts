import { supabase } from '@/lib/supabase/client';

interface UploadedAdvancedArrangementAudio {
  bucket: string;
  path: string;
  fileName: string;
  contentType: string;
  size: number;
}

export async function fetchAdvancedArrangementStatus(params: URLSearchParams) {
  return fetch(`/api/kie/upload-cover/status?${params.toString()}`);
}

export async function createAdvancedArrangementTask(formData: FormData, instrumentalOnly: boolean) {
  return fetch(instrumentalOnly ? '/api/kie/add-instrumental' : '/api/kie/upload-cover', {
    method: 'POST',
    body: formData,
  });
}

export async function uploadAdvancedArrangementAudio(file: File): Promise<UploadedAdvancedArrangementAudio> {
  const contentType = file.type || 'application/octet-stream';
  const signResponse = await fetch('/api/kie/audio-upload-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fileName: file.name,
      contentType,
      size: file.size,
    }),
  });
  const signData = await signResponse.json().catch(() => ({ error: '创建音频上传地址失败，请稍后重试' }));

  if (!signResponse.ok) {
    throw new Error(signData.error || '创建音频上传地址失败，请稍后重试');
  }

  const { error } = await supabase.storage
    .from(signData.bucket)
    .uploadToSignedUrl(signData.path, signData.token, file, {
      contentType,
      upsert: false,
    });

  if (error) {
    throw new Error(error.message || '音频上传失败，请重试');
  }

  return {
    bucket: signData.bucket,
    path: signData.path,
    fileName: file.name,
    contentType,
    size: file.size,
  };
}
