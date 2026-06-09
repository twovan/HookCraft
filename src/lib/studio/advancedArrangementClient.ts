interface UploadedAdvancedArrangementAudio {
  bucket: string;
  path: string;
  fileName: string;
  contentType: string;
  size: number;
}

export interface AdvancedArrangementUploadProgress {
  phase: 'signing' | 'uploading' | 'uploaded';
  percent: number;
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

export async function uploadAdvancedArrangementAudio(
  file: File,
  onProgress?: (progress: AdvancedArrangementUploadProgress) => void
): Promise<UploadedAdvancedArrangementAudio> {
  const contentType = file.type || 'application/octet-stream';
  onProgress?.({ phase: 'signing', percent: 3 });

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

  if (!signData.signedUrl) {
    throw new Error('创建音频上传地址失败，请稍后重试');
  }

  await uploadFileToSignedUrl(signData.signedUrl, file, onProgress);
  onProgress?.({ phase: 'uploaded', percent: 100 });

  return {
    bucket: signData.bucket,
    path: signData.path,
    fileName: file.name,
    contentType,
    size: file.size,
  };
}

function uploadFileToSignedUrl(
  signedUrl: string,
  file: File,
  onProgress?: (progress: AdvancedArrangementUploadProgress) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append('cacheControl', '3600');
    formData.append('', file);

    xhr.open('PUT', signedUrl);
    xhr.setRequestHeader('x-upsert', 'false');

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) {
        onProgress?.({ phase: 'uploading', percent: 10 });
        return;
      }
      const percent = Math.min(99, Math.max(5, Math.round((event.loaded / event.total) * 100)));
      onProgress?.({ phase: 'uploading', percent });
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
        return;
      }
      reject(new Error(parseStorageUploadError(xhr.responseText) || `音频上传失败 (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error('音频上传失败，请检查网络后重试'));
    xhr.ontimeout = () => reject(new Error('音频上传超时，请检查网络后重试'));

    onProgress?.({ phase: 'uploading', percent: 5 });
    xhr.send(formData);
  });
}

function parseStorageUploadError(responseText: string): string | null {
  if (!responseText) return null;
  try {
    const data = JSON.parse(responseText) as { message?: string; error?: string };
    return data.message || data.error || null;
  } catch {
    return null;
  }
}
