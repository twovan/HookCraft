import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase/server';
import { requireAdmin } from '../../../../lib/admin/auth';

/**
 * GET /api/admin/users
 * 获取用户列表（分页、可筛选）
 */
export async function GET(req: NextRequest) {
  try {
    const { admin, response } = await requireAdmin(req);
    if (response) return response;

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '10');
    const search = searchParams.get('search') || '';
    const tier = searchParams.get('tier') || '';
    const status = searchParams.get('status') || '';

    // Get users from Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage: pageSize,
    });

    if (authError) throw authError;

    const users = authData?.users || [];
    const totalFromAuth = (authData as any)?.total || users.length;

    // Get memberships for these users
    const userIds = users.map((u) => u.id);
    const { data: memberships } = await supabaseAdmin
      .from('memberships')
      .select('*')
      .in('user_id', userIds.length > 0 ? userIds : ['__none__']);

    // Get credits for these users
    const { data: credits } = await supabaseAdmin
      .from('credits')
      .select('*')
      .in('user_id', userIds.length > 0 ? userIds : ['__none__']);

    // Map users with membership and credits info
    let mappedUsers = users.map((u) => {
      const membership = memberships?.find((m: any) => m.user_id === u.id);
      const credit = credits?.find((c: any) => c.user_id === u.id);
      return {
        id: u.id,
        email: u.email || '',
        name: u.user_metadata?.name || u.user_metadata?.full_name || u.email?.split('@')[0] || '未知',
        tier: membership?.tier || 'free',
        status: (u as any).banned_at ? 'disabled' : 'active',
        registeredAt: u.created_at,
        purchaseCount: 0,
        creditsUsed: credit?.used || 0,
        creditsTotal: credit?.total || 0,
      };
    });

    // Apply client-side filters
    if (search) {
      const q = search.toLowerCase();
      mappedUsers = mappedUsers.filter(
        (u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
      );
    }
    if (tier) {
      mappedUsers = mappedUsers.filter((u) => u.tier === tier);
    }
    if (status) {
      mappedUsers = mappedUsers.filter((u) => u.status === status);
    }

    // Stats
    const totalUsers = totalFromAuth;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayNew = users.filter((u) => new Date(u.created_at) >= today).length;
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const activeUsers = users.filter((u) => u.last_sign_in_at && new Date(u.last_sign_in_at) >= sevenDaysAgo).length;
    const paidUsers = memberships?.filter((m: any) => m.tier !== 'free').length || 0;

    return NextResponse.json({
      data: mappedUsers,
      total: mappedUsers.length,
      page,
      pageSize,
      stats: {
        totalUsers,
        todayNew,
        activeUsers,
        paidUsers,
      },
    });
  } catch (error) {
    console.error('[Admin Users GET Error]', error);
    return NextResponse.json({ error: '获取用户列表失败' }, { status: 500 });
  }
}
