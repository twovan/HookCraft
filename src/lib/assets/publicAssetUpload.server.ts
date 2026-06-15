import { supabaseAdmin } from '@/lib/supabase/server';

export const PUBLIC_ASSETS_BUCKET = 'site-assets';
export const AVATAR_ASSETS_BUCKET = 'avatars';
export const TEMPLATE_ASSETS_BUCKET = 'template-assets';
export const MAX_PUBLIC_IMAGE_UPLOAD_BYTES = 5 * 1024 * 1024;
export const PUBLIC_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
export const TEMPLATE_COVER_IMAGE_MIME_TYPES = new Set([...PUBLIC_IMAGE_MIME_TYPES, 'image/gif']);
const TEMPLATE_ASSET_AUDIO_MIME_TYPES = new Set(['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4', 'audio/flac']);
const TEMPLATE_ASSETS_BUCKET_MIN_BYTES = 20 * 1024 * 1024;

export function isPublicImageMimeType(type: string, allowedMimeTypes = PUBLIC_IMAGE_MIME_TYPES) {
  return allowedMimeTypes.has(type);
}

export function getPublicImageExtension(type: string): string {
  if (type === 'image/png') return 'png';
  if (type === 'image/webp') return 'webp';
  if (type === 'image/gif') return 'gif';
  return 'jpg';
}

async function ensurePublicImageBucket(
  bucketName: string,
  maxBytes: number,
  allowedMimeTypes: Set<string>,
) {
  const bucketAllowedMimeTypes = bucketName === TEMPLATE_ASSETS_BUCKET
    ? new Set([...allowedMimeTypes, ...TEMPLATE_ASSET_AUDIO_MIME_TYPES])
    : allowedMimeTypes;
  const bucketFileSizeLimit = bucketName === TEMPLATE_ASSETS_BUCKET
    ? Math.max(maxBytes, TEMPLATE_ASSETS_BUCKET_MIN_BYTES)
    : maxBytes;
  const { data: bucket } = await supabaseAdmin.storage.getBucket(bucketName);
  if (bucket) {
    const { error } = await supabaseAdmin.storage.updateBucket(bucketName, {
      public: true,
      fileSizeLimit: bucketFileSizeLimit,
      allowedMimeTypes: Array.from(bucketAllowedMimeTypes),
    });
    if (error) console.error('[Public Assets Bucket Update Error]', error);
    return;
  }

  await supabaseAdmin.storage.createBucket(bucketName, {
    public: true,
    fileSizeLimit: bucketFileSizeLimit,
    allowedMimeTypes: Array.from(bucketAllowedMimeTypes),
  });
}

export async function uploadPublicImageAsset(
  file: File,
  options: {
    path: string;
    bucket?: string;
    maxBytes?: number;
    allowedMimeTypes?: Set<string>;
    cacheBustParam?: string;
  },
) {
  const bucket = options.bucket ?? PUBLIC_ASSETS_BUCKET;
  const maxBytes = options.maxBytes ?? MAX_PUBLIC_IMAGE_UPLOAD_BYTES;
  const allowedMimeTypes = options.allowedMimeTypes ?? PUBLIC_IMAGE_MIME_TYPES;

  await ensurePublicImageBucket(bucket, maxBytes, allowedMimeTypes);

  const buffer = Buffer.from(await file.arrayBuffer());
  const { error } = await supabaseAdmin.storage
    .from(bucket)
    .upload(options.path, buffer, {
      contentType: file.type,
      upsert: true,
    });

  if (error) throw error;

  const { data } = supabaseAdmin.storage.from(bucket).getPublicUrl(options.path);
  const cacheBustParam = options.cacheBustParam ?? 'v';
  return {
    path: options.path,
    publicUrl: `${data.publicUrl}?${cacheBustParam}=${Date.now()}`,
    size: file.size,
  };
}
