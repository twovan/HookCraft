import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabase/server';
import { requireAdmin } from '../../../../../lib/admin/auth';

/**
 * GET /api/admin/users/[id]
 * 获取用户详情
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { admin, response } = await requireAdmin(req);
    if (response) return response;

    const { id } = await params;

    // Get user from auth
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(id);
    if (authError || !authUser?.user) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 });
    }

    const targetUser = authUser.user;

    // Get membership
    const { data: membership } = await supabaseAdmin
      .from('memberships')
      .select('*')
      .eq('user_id', id)
      .single();

    // Get credits
    const { data: credits } = await supabaseAdmin
      .from('credits')
      .select('*')
      .eq('user_id', id)
      .single();

    // Get recent payments
    const { data: payments } = await supabaseAdmin
      .from('payments')
      .select('*')
      .eq('user_id', id)
      .order('created_at', { ascending: false })
      .limit(10);

    // Get recent generation tasks
    const { data: tasks } = await supabaseAdmin
      .from('generation_tasks')
      .select('*')
      .eq('user_id', id)
      .order('created_at', { ascending: false })
      .limit(10);

    return NextResponse.json({
      user: {
        id: targetUser.id,
        email: targetUser.email,
        name: targetUser.user_metadata?.name || targetUser.user_metadata?.full_name || targetUser.email?.split('@')[0],
        registeredAt: targetUser.created_at,
        lastSignIn: targetUser.last_sign_in_at,
        status: (targetUser as any).banned_at ? 'disabled' : 'active',
      },
      membership: membership || null,
      credits: credits || null,
      payments: payments || [],
      tasks: tasks || [],
    });
  } catch (error) {
    console.error('[Admin User Detail Error]', error);
    return NextResponse.json({ error: '获取用户详情失败' }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/users/[id]
 * 禁用/启用用户
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
    const { action } = body; // 'disable' | 'enable'

    if (action === 'disable') {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(id, {
        ban_duration: '876000h', // ~100 years
      });
      if (error) throw error;
    } else if (action === 'enable') {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(id, {
        ban_duration: 'none',
      });
      if (error) throw error;
    } else {
      return NextResponse.json({ error: '无效操作' }, { status: 400 });
    }

    // Log operation
    await supabaseAdmin.from('operation_logs').insert({
      operator_id: admin.adminId,
      operator_name: admin.displayName || admin.username,
      operation_type: 'user',
      operation_description: action === 'disable' ? `禁用用户: ${id}` : `启用用户: ${id}`,
      target_type: 'user',
      target_id: id,
      ip_address: req.headers.get('x-forwarded-for') || 'unknown',
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Admin User PATCH Error]', error);
    return NextResponse.json({ error: '操作失败' }, { status: 500 });
  }
}
