import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabase/server';
import { requireAdmin } from '../../../../../lib/admin/auth';

/**
 * GET /api/admin/users/export
 * 导出用户列表 CSV
 */
export async function GET(req: NextRequest) {
  try {
    const { admin, response } = await requireAdmin(req);
    if (response) return response;

    // Get all users
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });

    if (authError) throw authError;

    const users = authData?.users || [];

    // Get memberships
    const userIds = users.map((u) => u.id);
    const { data: memberships } = await supabaseAdmin
      .from('memberships')
      .select('*')
      .in('user_id', userIds.length > 0 ? userIds : ['__none__']);

    // Build CSV
    const headers = ['ID', '邮箱', '昵称', '会员等级', '状态', '注册时间'];
    const rows = users.map((u) => {
      const membership = memberships?.find((m: any) => m.user_id === u.id);
      return [
        u.id,
        u.email || '',
        u.user_metadata?.name || u.user_metadata?.full_name || '',
        membership?.tier || 'free',
        (u as any).banned_at ? '已禁用' : '正常',
        u.created_at,
      ].join(',');
    });

    const csv = [headers.join(','), ...rows].join('\n');

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename=users_export.csv',
      },
    });
  } catch (error) {
    console.error('[Admin Users Export Error]', error);
    return NextResponse.json({ error: '导出失败' }, { status: 500 });
  }
}
