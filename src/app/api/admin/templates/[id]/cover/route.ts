import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../../lib/supabase/server';
import { requireAdmin } from '../../../../../../lib/admin/auth';
import {
  MAX_PUBLIC_IMAGE_UPLOAD_BYTES,
  TEMPLATE_ASSETS_BUCKET,
  TEMPLATE_COVER_IMAGE_MIME_TYPES,
  getPublicImageExtension,
  isPublicImageMimeType,
  uploadPublicImageAsset,
} from '@/lib/assets/publicAssetUpload.server';

/**
 * POST /api/admin/templates/[id]/cover
 * 上传模板封面图片
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { admin, response } = await requireAdmin(req);
    if (response) return response;

    const { id } = await params;

    const formData = await req.formData();
    const file = formData.get('cover') as File | null;

    if (!file) {
      return NextResponse.json({ error: '请选择封面图片' }, { status: 400 });
    }

    if (!isPublicImageMimeType(file.type, TEMPLATE_COVER_IMAGE_MIME_TYPES)) {
      return NextResponse.json({ error: '仅支持 JPG、PNG、WebP、GIF 格式' }, { status: 400 });
    }

    if (file.size > MAX_PUBLIC_IMAGE_UPLOAD_BYTES) {
      return NextResponse.json({ error: '图片大小不能超过 5MB' }, { status: 400 });
    }

    const asset = await uploadPublicImageAsset(file, {
      bucket: TEMPLATE_ASSETS_BUCKET,
      path: `templates/${id}/cover/cover.${getPublicImageExtension(file.type)}`,
      allowedMimeTypes: TEMPLATE_COVER_IMAGE_MIME_TYPES,
      cacheBustParam: 't',
    });

    // Update template record with cover URL
    const { data: updateData, error: updateError } = await supabaseAdmin
      .from('templates')
      .update({ cover_url: asset.publicUrl })
      .eq('id', id)
      .select('id, cover_url')
      .single();

    if (updateError) {
      console.error('[Cover Upload] DB update error:', updateError);
      throw updateError;
    }

    console.log('[Cover Upload] DB updated successfully:', updateData);

    // Log operation
    await supabaseAdmin.from('operation_logs').insert({
      operator_id: admin.adminId,
      operator_name: admin.displayName || admin.username,
      operation_type: 'content',
      operation_description: `上传模板封面: ${id}`,
      target_type: 'template',
      target_id: id,
    });

    return NextResponse.json({ coverUrl: asset.publicUrl, success: true });
  } catch (error) {
    console.error('[Admin Template Cover Upload Error]', error);
    return NextResponse.json({ error: '封面上传失败，请重试' }, { status: 500 });
  }
}
