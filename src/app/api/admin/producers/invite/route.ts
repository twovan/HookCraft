import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabase/server';
import { requireAdmin } from '../../../../../lib/admin/auth';

/**
 * POST /api/admin/producers/invite
 * 发送制作人邀请
 */
export async function POST(req: NextRequest) {
  try {
    const { admin, response } = await requireAdmin(req);
    if (response) return response;

    const body = await req.json();
    const { inviteeName, inviteeEmail, expertiseTags, revenueShare, expiryDays, personalNote } = body;

    if (!inviteeName || !inviteeEmail) {
      return NextResponse.json({ error: '姓名和邮箱为必填项' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('producer_invitations')
      .insert({
        invitee_name: inviteeName,
        invitee_email: inviteeEmail,
        expertise_tags: expertiseTags || [],
        revenue_share: revenueShare || 0.7,
        expiry_days: expiryDays || 7,
        personal_note: personalNote || null,
        status: 'pending',
        invited_by: admin.adminId,
      })
      .select()
      .single();

    if (error) throw error;

    // Log operation
    await supabaseAdmin.from('operation_logs').insert({
      operator_id: admin.adminId,
      operator_name: admin.displayName || admin.username,
      operation_type: 'user',
      operation_description: `邀请制作人: ${inviteeName} (${inviteeEmail})`,
      target_type: 'producer_invitation',
      target_id: data.id,
      ip_address: req.headers.get('x-forwarded-for') || 'unknown',
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('[Admin Producer Invite Error]', error);
    return NextResponse.json({ error: '发送邀请失败' }, { status: 500 });
  }
}
