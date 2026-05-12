import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabase/server';
import { requireAdmin } from '../../../../../lib/admin/auth';

/**
 * PUT /api/admin/categories/[id]
 * 更新分类
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
      return NextResponse.json({ error: '分类名称不能为空' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('categories')
      .update({ name: name.trim(), icon: icon || '' })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: '分类不存在' }, { status: 404 });
      }
      throw error;
    }

    // Log operation
    await supabaseAdmin.from('operation_logs').insert({
      operator_id: admin.adminId,
      operator_name: admin.displayName || admin.username,
      operation_type: 'content',
      operation_description: `更新分类: ${name}`,
      target_type: 'category',
      target_id: id,
    });

    return NextResponse.json({ data, success: true });
  } catch (error) {
    console.error('[Admin Categories PUT Error]', error);
    return NextResponse.json({ error: '更新分类失败，请重试' }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/categories/[id]
 * 切换分类启用/禁用状态
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
      .from('categories')
      .update({ enabled })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: '分类不存在' }, { status: 404 });
      }
      throw error;
    }

    // Log operation
    await supabaseAdmin.from('operation_logs').insert({
      operator_id: admin.adminId,
      operator_name: admin.displayName || admin.username,
      operation_type: 'content',
      operation_description: `${enabled ? '启用' : '禁用'}分类: ${data.name}`,
      target_type: 'category',
      target_id: id,
    });

    return NextResponse.json({ data, success: true });
  } catch (error) {
    console.error('[Admin Categories PATCH Error]', error);
    return NextResponse.json({ error: '操作失败，请重试' }, { status: 500 });
  }
}
