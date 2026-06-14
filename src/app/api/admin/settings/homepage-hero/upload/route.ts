import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '../../../../../../lib/admin/auth';
import { supabaseAdmin } from '../../../../../../lib/supabase/server';

const SITE_ASSETS_BUCKET = 'site-assets';
const MAX_HERO_IMAGE_SIZE = 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function getExtension(type: string): string {
  if (type === 'image/png') return 'png';
  if (type === 'image/webp') return 'webp';
  return 'jpg';
}

async function ensureSiteAssetsBucket() {
  const { data: bucket } = await supabaseAdmin.storage.getBucket(SITE_ASSETS_BUCKET);
  if (bucket) return;

  await supabaseAdmin.storage.createBucket(SITE_ASSETS_BUCKET, {
    public: true,
    fileSizeLimit: MAX_HERO_IMAGE_SIZE,
    allowedMimeTypes: Array.from(ALLOWED_TYPES),
  });
}

export async function POST(req: NextRequest) {
  const { response } = await requireAdmin(req);
  if (response) return response;

  const formData = await req.formData();
  const file = formData.get('heroImage');

  if (!(file instanceof File)) {
    return NextResponse.json({ error: '请选择首页背景图' }, { status: 400 });
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: '仅支持 JPG、PNG、WebP 图片' }, { status: 400 });
  }

  if (file.size > MAX_HERO_IMAGE_SIZE) {
    return NextResponse.json({ error: '图片压缩后仍超过 1MB，请降低尺寸或质量后重试' }, { status: 400 });
  }

  await ensureSiteAssetsBucket();

  const extension = getExtension(file.type);
  const path = `homepage/hero-${Date.now()}.${extension}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: uploadError } = await supabaseAdmin.storage
    .from(SITE_ASSETS_BUCKET)
    .upload(path, buffer, {
      contentType: file.type,
      upsert: true,
    });

  if (uploadError) {
    console.error('[Homepage Hero Upload Error]', uploadError);
    return NextResponse.json({ error: '首页背景图上传失败，请稍后重试' }, { status: 500 });
  }

  const { data } = supabaseAdmin.storage.from(SITE_ASSETS_BUCKET).getPublicUrl(path);
  return NextResponse.json({
    backgroundImageUrl: `${data.publicUrl}?v=${Date.now()}`,
    size: file.size,
  });
}
