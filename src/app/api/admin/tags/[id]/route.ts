import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabase/server';
import { requireAdmin } from '../../../../../lib/admin/auth';

/**
 * PUT /api/admin/tags/[id]
 * 更新标签
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { admin, response } = await requireAdmin(req);
    if (response) return response;

    const { id } = await params;
    const body = await req.json();
    const { name, icon } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: '标签名称不能为空' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('tags')
      .update({ name: name.trim(), icon: icon || '' })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: '标签不存在' }, { status: 404 });
      }
      throw error;
    }

    // Log operation
    await supabaseAdmin.from('operation_logs').insert({
      operator_id: admin.adminId,
      operator_name: admin.displayName || admin.username,
      operation_type: 'content',
      operation_description: `更新标签: ${name}`,
      target_type: 'tag',
      target_id: id,
    });

    return NextResponse.json({ data, success: true });
  } catch (error) {
    console.error('[Admin Tags PUT Error]', error);
    return NextResponse.json({ error: '更新标签失败，请重试' }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/tags/[id]
 * 切换标签启用/禁用状态
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
    const { enabled } = body;

    if (typeof enabled !== 'boolean') {
      return NextResponse.json({ error: '参数不合法' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('tags')
      .update({ enabled })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: '标签不存在' }, { status: 404 });
      }
      throw error;
    }

    // Log operation
    await supabaseAdmin.from('operation_logs').insert({
      operator_id: admin.adminId,
      operator_name: admin.displayName || admin.username,
      operation_type: 'content',
      operation_description: `${enabled ? '启用' : '禁用'}标签: ${data.name}`,
      target_type: 'tag',
      target_id: id,
    });

    return NextResponse.json({ data, success: true });
  } catch (error) {
    console.error('[Admin Tags PATCH Error]', error);
    return NextResponse.json({ error: '操作失败，请重试' }, { status: 500 });
  }
}
