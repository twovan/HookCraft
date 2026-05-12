import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../../lib/supabase/server';
import { requireAdmin } from '../../../../../../lib/admin/auth';

/**
 * PATCH /api/admin/producers/invite/[id]
 * 重发邮件或撤销邀请
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
    const { action } = body; // 'resend' | 'revoke'

    if (action === 'revoke') {
      const { error } = await supabaseAdmin
        .from('producer_invitations')
        .update({ status: 'revoked', revoked_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;

      // Log operation
      await supabaseAdmin.from('operation_logs').insert({
        operator_id: admin.adminId,
        operator_name: admin.displayName || admin.username,
        operation_type: 'user',
        operation_description: `撤销制作人邀请: ${id}`,
        target_type: 'producer_invitation',
        target_id: id,
        ip_address: req.headers.get('x-forwarded-for') || 'unknown',
      });
    } else if (action === 'resend') {
      // Update the updated_at to track resend
      const { error } = await supabaseAdmin
        .from('producer_invitations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;

      // Log operation
      await supabaseAdmin.from('operation_logs').insert({
        operator_id: admin.adminId,
        operator_name: admin.displayName || admin.username,
        operation_type: 'user',
        operation_description: `重发制作人邀请邮件: ${id}`,
        target_type: 'producer_invitation',
        target_id: id,
        ip_address: req.headers.get('x-forwarded-for') || 'unknown',
      });
    } else {
      return NextResponse.json({ error: '无效操作' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Admin Producer Invite PATCH Error]', error);
    return NextResponse.json({ error: '操作失败' }, { status: 500 });
  }
}
