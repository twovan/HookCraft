import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabase/server';
import { requireAdmin } from '../../../../../lib/admin/auth';

/**
 * POST /api/admin/producers/add
 * 直接添加制作人（跳过邀请流程，状态直接为 accepted）
 */
export async function POST(req: NextRequest) {
  try {
    const { admin, response } = await requireAdmin(req);
    if (response) return response;

    const body = await req.json();
    const { name, email, expertiseTags, revenueShare, personalNote } = body;

    if (!name || !email) {
      return NextResponse.json({ error: '姓名和邮箱为必填项' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('producer_invitations')
      .insert({
        invitee_name: name,
        invitee_email: email,
        expertise_tags: expertiseTags || [],
        revenue_share: revenueShare || 0.7,
        expiry_days: 0,
        personal_note: personalNote || null,
        status: 'accepted',
        accepted_at: new Date().toISOString(),
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
      operation_description: `直接添加制作人: ${name} (${email})`,
      target_type: 'producer_invitation',
      target_id: data.id,
      ip_address: req.headers.get('x-forwarded-for') || 'unknown',
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('[Admin Producer Add Error]', error);
    return NextResponse.json({ error: '添加制作人失败' }, { status: 500 });
  }
}
