import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '../../../../../lib/admin/auth';
import {
  AVATAR_ASSETS_BUCKET,
  MAX_PUBLIC_IMAGE_UPLOAD_BYTES,
  getPublicImageExtension,
  isPublicImageMimeType,
  uploadPublicImageAsset,
} from '@/lib/assets/publicAssetUpload.server';

/**
 * POST /api/admin/producers/upload-avatar
 * 上传制作人头像
 */
export async function POST(req: NextRequest) {
  try {
    const { admin, response } = await requireAdmin(req);
    if (response) return response;

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const producerId = formData.get('producerId') as string | null;

    if (!file) {
      return NextResponse.json({ error: '请选择文件' }, { status: 400 });
    }

    if (!producerId) {
      return NextResponse.json({ error: '缺少制作人ID' }, { status: 400 });
    }

    if (!isPublicImageMimeType(file.type)) {
      return NextResponse.json({ error: '仅支持 JPG、PNG、WebP 图片' }, { status: 400 });
    }

    if (file.size > MAX_PUBLIC_IMAGE_UPLOAD_BYTES) {
      return NextResponse.json({ error: '图片大小不能超过 5MB' }, { status: 400 });
    }

    const asset = await uploadPublicImageAsset(file, {
      bucket: AVATAR_ASSETS_BUCKET,
      path: `${producerId}-${Date.now()}.${getPublicImageExtension(file.type)}`,
    });

    return NextResponse.json({
      success: true,
      url: asset.publicUrl,
    });
  } catch (error: any) {
    console.error('[Avatar Upload Error]', error?.message || error);
    return NextResponse.json({ error: '上传头像失败' }, { status: 500 });
  }
}
