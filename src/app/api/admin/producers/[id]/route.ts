import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabase/server';
import { requireAdmin } from '../../../../../lib/admin/auth';

/**
 * GET /api/admin/producers/[id]
 * 获取单个制作人详情
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { admin, response } = await requireAdmin(req);
    if (response) return response;

    const { id } = await params;

    const { data, error } = await supabaseAdmin
      .from('producers')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      return NextResponse.json({ error: '制作人不存在' }, { status: 404 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('[Admin Producer GET Error]', error);
    return NextResponse.json({ error: '获取制作人失败' }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/producers/[id]
 * 编辑制作人信息
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { admin, response } = await requireAdmin(req);
    if (response) return response;

    const { id } = await params;
    const body = await req.json();
    const { displayName, bio, styleTags, representativeWorks, useCases, collaborators, collaboratorWorks, avatarUrl, revenueShare } = body;

    const updateData: any = { updated_at: new Date().toISOString() };
    if (displayName !== undefined) updateData.display_name = displayName;
    if (bio !== undefined) updateData.bio = bio;
    if (styleTags !== undefined) updateData.style_tags = styleTags;
    if (representativeWorks !== undefined) updateData.representative_works = representativeWorks;
    if (useCases !== undefined) updateData.use_cases = useCases;
    if (collaborators !== undefined) updateData.collaborators = collaborators;
    if (collaboratorWorks !== undefined) updateData.collaborator_works = collaboratorWorks;
    if (avatarUrl !== undefined) updateData.avatar_url = avatarUrl;
    if (revenueShare !== undefined) updateData.revenue_share = parseFloat(revenueShare);

    const { data, error } = await supabaseAdmin
      .from('producers')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[Admin Producer PATCH] error:', error.message);
      return NextResponse.json({ error: `更新失败: ${error.message}` }, { status: 500 });
    }

    // Log operation (non-blocking)
    try {
      await supabaseAdmin.from('operation_logs').insert({
        operator_id: admin.adminId,
        operator_name: admin.displayName || admin.username,
        operation_type: 'user',
        operation_description: `编辑制作人: ${data.display_name}`,
        target_type: 'producer',
        target_id: data.id,
        ip_address: req.headers.get('x-forwarded-for') || 'unknown',
      });
    } catch (logErr) {
      console.error('[Admin Producer PATCH] Log error (non-fatal):', logErr);
    }

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('[Admin Producer PATCH Error]', error?.message || error);
    return NextResponse.json({ error: '更新制作人失败' }, { status: 500 });
  }
}
