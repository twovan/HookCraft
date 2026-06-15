import { supabaseAdmin } from '@/lib/supabase/server';

export const PUBLIC_ASSETS_BUCKET = 'site-assets';
export const MAX_PUBLIC_IMAGE_UPLOAD_BYTES = 5 * 1024 * 1024;
export const PUBLIC_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export function isPublicImageMimeType(type: string) {
  return PUBLIC_IMAGE_MIME_TYPES.has(type);
}

function getImageExtension(type: string): string {
  if (type === 'image/png') return 'png';
  if (type === 'image/webp') return 'webp';
  return 'jpg';
}

async function ensurePublicAssetsBucket() {
  const { data: bucket } = await supabaseAdmin.storage.getBucket(PUBLIC_ASSETS_BUCKET);
  if (bucket) {
    const { error } = await supabaseAdmin.storage.updateBucket(PUBLIC_ASSETS_BUCKET, {
      public: true,
      fileSizeLimit: MAX_PUBLIC_IMAGE_UPLOAD_BYTES,
      allowedMimeTypes: Array.from(PUBLIC_IMAGE_MIME_TYPES),
    });
    if (error) console.error('[Public Assets Bucket Update Error]', error);
    return;
  }

  await supabaseAdmin.storage.createBucket(PUBLIC_ASSETS_BUCKET, {
    public: true,
    fileSizeLimit: MAX_PUBLIC_IMAGE_UPLOAD_BYTES,
    allowedMimeTypes: Array.from(PUBLIC_IMAGE_MIME_TYPES),
  });
}

export async function uploadPublicImageAsset(file: File, folder: string, filenamePrefix: string) {
  await ensurePublicAssetsBucket();

  const extension = getImageExtension(file.type);
  const path = `${folder}/${filenamePrefix}-${Date.now()}.${extension}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const { error } = await supabaseAdmin.storage
    .from(PUBLIC_ASSETS_BUCKET)
    .upload(path, buffer, {
      contentType: file.type,
      upsert: true,
    });

  if (error) throw error;

  const { data } = supabaseAdmin.storage.from(PUBLIC_ASSETS_BUCKET).getPublicUrl(path);
  return {
    path,
    publicUrl: `${data.publicUrl}?v=${Date.now()}`,
    size: file.size,
  };
}
