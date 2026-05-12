import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../../lib/supabase/server';
import { requireAdmin } from '../../../../../../lib/admin/auth';

/**
 * PATCH /api/admin/revenue/settlements/[id]
 * 确认打款
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { admin, response } = await requireAdmin(req);
    if (response) return response;

    const { id } = await params;

    const { error } = await supabaseAdmin
      .from('settlements')
      .update({
        status: 'paid',
        paid_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) throw error;

    // Log operation
    await supabaseAdmin.from('operation_logs').insert({
      operator_id: admin.adminId,
      operator_name: admin.displayName || admin.username,
      operation_type: 'transaction',
      operation_description: `确认打款: ${id}`,
      target_type: 'settlement',
      target_id: id,
      ip_address: req.headers.get('x-forwarded-for') || 'unknown',
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Admin Settlement PATCH Error]', error);
    return NextResponse.json({ error: '确认打款失败' }, { status: 500 });
  }
}
