import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabase/server';
import { requireAdmin } from '../../../../../lib/admin/auth';

/**
 * PATCH /api/admin/review/[id]
 * 审核内容：通过或拒绝
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
    const { action } = body; // 'approve' | 'reject'

    if (!action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: '无效的操作' }, { status: 400 });
    }

    const newStatus = action === 'approve' ? 'published' : 'rejected';

    const { data, error } = await supabaseAdmin
      .from('templates')
      .update({ status: newStatus })
      .eq('id', id)
      .eq('status', 'pending') // Only allow review of pending items
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: '审核项不存在或已被处理' }, { status: 404 });
      }
      throw error;
    }

    // Log operation
    await supabaseAdmin.from('operation_logs').insert({
      operator_id: admin.adminId,
      operator_name: admin.displayName || admin.username,
      operation_type: 'content',
      operation_description: `${action === 'approve' ? '审核通过' : '审核拒绝'}内容: ${data.name}`,
      target_type: 'template',
      target_id: id,
    });

    return NextResponse.json({ data, success: true });
  } catch (error) {
    console.error('[Admin Review PATCH Error]', error);
    return NextResponse.json({ error: '审核操作失败，请重试' }, { status: 500 });
  }
}
