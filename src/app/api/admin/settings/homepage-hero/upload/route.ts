import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '../../../../../../lib/admin/auth';
import {
  MAX_PUBLIC_IMAGE_UPLOAD_BYTES,
  isPublicImageMimeType,
  uploadPublicImageAsset,
} from '@/lib/assets/publicAssetUpload.server';

export async function POST(req: NextRequest) {
  const { response } = await requireAdmin(req);
  if (response) return response;

  const formData = await req.formData();
  const file = formData.get('heroImage');

  if (!(file instanceof File)) {
    return NextResponse.json({ error: '请选择首页背景图' }, { status: 400 });
  }

  if (!isPublicImageMimeType(file.type)) {
    return NextResponse.json({ error: '仅支持 JPG、PNG、WebP 图片' }, { status: 400 });
  }

  if (file.size > MAX_PUBLIC_IMAGE_UPLOAD_BYTES) {
    return NextResponse.json({ error: '图片压缩后仍超过 5MB，请降低尺寸或质量后重试' }, { status: 400 });
  }

  try {
    const asset = await uploadPublicImageAsset(file, 'homepage', 'hero');
    return NextResponse.json({
      backgroundImageUrl: asset.publicUrl,
      size: asset.size,
    });
  } catch (error) {
    console.error('[Homepage Hero Upload Error]', error);
    return NextResponse.json({ error: '首页背景图上传失败，请稍后重试' }, { status: 500 });
  }
}
