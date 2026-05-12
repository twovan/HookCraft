import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../../lib/supabase/server';
import { requireAdmin } from '../../../../../../lib/admin/auth';
import { uploadTemplateAsset, getPublicCoverUrl } from '../../../../../../lib/supabase/storage';

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

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!validTypes.includes(file.type)) {
      return NextResponse.json({ error: '仅支持 JPG、PNG、WebP、GIF 格式' }, { status: 400 });
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: '图片大小不能超过 5MB' }, { status: 400 });
    }

    // Upload to Supabase Storage
    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = file.name.split('.').pop() || 'jpg';
    const filename = `cover.${ext}`;

    const path = await uploadTemplateAsset(id, 'cover', buffer, filename);
    const coverUrl = getPublicCoverUrl(path);

    // 添加时间戳参数避免 CDN/浏览器缓存旧图片
    const coverUrlWithCacheBust = `${coverUrl}?t=${Date.now()}`;

    // Update template record with cover URL
    const { data: updateData, error: updateError } = await supabaseAdmin
      .from('templates')
      .update({ cover_url: coverUrlWithCacheBust })
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

    return NextResponse.json({ coverUrl: coverUrlWithCacheBust, success: true });
  } catch (error) {
    console.error('[Admin Template Cover Upload Error]', error);
    return NextResponse.json({ error: '封面上传失败，请重试' }, { status: 500 });
  }
}
