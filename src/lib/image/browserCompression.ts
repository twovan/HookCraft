export interface CompressImageToWebpOptions {
  maxEdge: number;
  targetBytes: number;
  maxBytes: number;
  qualities?: number[];
  outputName?: string;
}

export interface CompressImageForUploadOptions {
  maxBytes: number;
  outputName: string;
  maxEdge?: number;
  targetBytes?: number;
}

export function formatBytes(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)}MB`;
  return `${Math.round(bytes / 1024)}KB`;
}

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('图片读取失败，请换一张图片重试'));
    };
    image.src = url;
  });
}

export async function compressImageToWebp(file: File, options: CompressImageToWebpOptions): Promise<File> {
  if (!file.type.startsWith('image/')) throw new Error('请选择图片文件');

  const image = await loadImageFromFile(file);
  const scale = Math.min(1, options.maxEdge / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('当前浏览器不支持图片压缩');
  context.drawImage(image, 0, 0, width, height);

  const qualities = options.qualities ?? [0.82, 0.76, 0.68, 0.6, 0.52];
  for (const quality of qualities) {
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', quality));
    if (!blob) continue;
    if (blob.size <= options.targetBytes || quality === qualities[qualities.length - 1]) {
      if (blob.size > options.maxBytes) {
        throw new Error(`图片压缩后仍有 ${formatBytes(blob.size)}，请换一张更小的图片`);
      }
      return new File([blob], options.outputName ?? 'compressed-image.webp', { type: 'image/webp' });
    }
  }

  throw new Error('图片压缩失败，请重试');
}

export async function compressImageForUpload(file: File, options: CompressImageForUploadOptions): Promise<File> {
  if (file.type === 'image/gif') return file;

  return compressImageToWebp(file, {
    maxEdge: options.maxEdge ?? 1920,
    targetBytes: options.targetBytes ?? 1200 * 1024,
    maxBytes: options.maxBytes,
    outputName: options.outputName,
  });
}
