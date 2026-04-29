import { supabaseAdmin } from './server';

/**
 * Storage 工具函数
 * 管理 audio-files 和 template-assets 两个存储桶的文件上传与 URL 生成
 */

const AUDIO_FILES_BUCKET = 'audio-files';
const TEMPLATE_ASSETS_BUCKET = 'template-assets';

/** 签名 URL 有效期：1 小时（3600 秒） */
const SIGNED_URL_EXPIRY = 3600;

/**
 * 上传 AI 生成的音频文件到 audio-files 桶
 * 文件路径格式: {user_id}/{task_id}/{filename}
 *
 * @param userId - 用户 ID
 * @param taskId - 生成任务 ID
 * @param file - 要上传的文件（Buffer 或 Blob）
 * @param filename - 文件名（含扩展名）
 * @returns 上传后的文件路径
 */
export async function uploadAudioFile(
  userId: string,
  taskId: string,
  file: Buffer | Blob,
  filename: string
): Promise<string> {
  const path = `${userId}/${taskId}/${filename}`;

  const { data, error } = await supabaseAdmin.storage
    .from(AUDIO_FILES_BUCKET)
    .upload(path, file, {
      upsert: true,
      contentType: getAudioContentType(filename),
    });

  if (error) {
    throw new Error(`音频文件上传失败: ${error.message}`);
  }

  return data.path;
}

/**
 * 上传模板资源文件到 template-assets 桶
 * - 参考音频路径: templates/{template_id}/reference-audio/{filename}
 * - 封面图片路径: templates/{template_id}/cover/{filename}
 *
 * @param templateId - 模板 ID
 * @param type - 资源类型: 'reference-audio' | 'cover'
 * @param file - 要上传的文件（Buffer 或 Blob）
 * @param filename - 文件名（含扩展名）
 * @returns 上传后的文件路径
 */
export async function uploadTemplateAsset(
  templateId: string,
  type: 'reference-audio' | 'cover',
  file: Buffer | Blob,
  filename: string
): Promise<string> {
  const path = `templates/${templateId}/${type}/${filename}`;

  const contentType =
    type === 'cover' ? getImageContentType(filename) : getAudioContentType(filename);

  const { data, error } = await supabaseAdmin.storage
    .from(TEMPLATE_ASSETS_BUCKET)
    .upload(path, file, {
      upsert: true,
      contentType,
    });

  if (error) {
    throw new Error(`模板资源上传失败: ${error.message}`);
  }

  return data.path;
}

/**
 * 生成音频文件的签名 URL（1 小时有效期）
 * 用于用户下载或播放自己的音频文件
 *
 * @param path - 文件在 audio-files 桶中的路径
 * @returns 带有过期时间的签名 URL
 */
export async function getSignedAudioUrl(path: string): Promise<string> {
  const { data, error } = await supabaseAdmin.storage
    .from(AUDIO_FILES_BUCKET)
    .createSignedUrl(path, SIGNED_URL_EXPIRY);

  if (error) {
    throw new Error(`生成签名 URL 失败: ${error.message}`);
  }

  return data.signedUrl;
}

/**
 * 获取模板封面图片的公开 URL
 * 封面图片设置为公开访问，无需签名
 *
 * @param path - 文件在 template-assets 桶中的路径
 * @returns 公开访问的 URL
 */
export function getPublicCoverUrl(path: string): string {
  const { data } = supabaseAdmin.storage
    .from(TEMPLATE_ASSETS_BUCKET)
    .getPublicUrl(path);

  return data.publicUrl;
}

/**
 * 根据文件扩展名推断音频 MIME 类型
 */
function getAudioContentType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  const mimeTypes: Record<string, string> = {
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    ogg: 'audio/ogg',
    flac: 'audio/flac',
    aac: 'audio/aac',
    m4a: 'audio/mp4',
    webm: 'audio/webm',
  };
  return mimeTypes[ext ?? ''] ?? 'audio/mpeg';
}

/**
 * 根据文件扩展名推断图片 MIME 类型
 */
function getImageContentType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  const mimeTypes: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
    svg: 'image/svg+xml',
  };
  return mimeTypes[ext ?? ''] ?? 'image/jpeg';
}
