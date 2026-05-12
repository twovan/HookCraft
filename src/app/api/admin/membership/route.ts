import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase/server';
import { requireAdmin } from '../../../../lib/admin/auth';

/**
 * GET /api/admin/membership
 * 获取会员管理数据
 */
export async function GET(req: NextRequest) {
  try {
    const { admin, response } = await requireAdmin(req);
    if (response) return response;

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '10');
    const tier = searchParams.get('tier') || '';
    const status = searchParams.get('status') || '';

    // Build query for paid members
    let query = supabaseAdmin
      .from('memberships')
      .select('*', { count: 'exact' })
      .neq('tier', 'free');

    if (tier) {
      query = query.eq('tier', tier as any);
    }
    if (status) {
      query = query.eq('status', status as any);
    }

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data: members, count, error } = await query
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw error;

    // Stats
    const { count: totalPaid } = await supabaseAdmin
      .from('memberships')
      .select('*', { count: 'exact', head: true })
      .neq('tier', 'free');

    const { count: proCount } = await supabaseAdmin
      .from('memberships')
      .select('*', { count: 'exact', head: true })
      .eq('tier', 'pro');

    const { count: businessCount } = await supabaseAdmin
      .from('memberships')
      .select('*', { count: 'exact', head: true })
      .eq('tier', 'business');

    // Monthly revenue from membership payments
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: recentPayments } = await supabaseAdmin
      .from('payments')
      .select('amount')
      .eq('status', 'completed')
      .gte('created_at', thirtyDaysAgo);

    const monthlyRevenue = (recentPayments || []).reduce((sum: number, p: any) => sum + (p.amount || 0), 0);

    return NextResponse.json({
      data: (members || []).map((m: any) => ({
        id: m.id,
        userId: m.user_id,
        email: m.user_id?.slice(0, 8) + '...',
        name: m.user_id?.slice(0, 8) || '用户',
        tier: m.tier,
        billingCycle: m.billing_cycle || 'monthly',
        startDate: m.start_date || m.created_at,
        expiryDate: m.expiry_date || m.end_date,
        autoRenew: m.auto_renew !== false,
        status: m.status || 'active',
      })),
      total: count || 0,
      page,
      pageSize,
      stats: {
        totalPaid: totalPaid || 0,
        proCount: proCount || 0,
        businessCount: businessCount || 0,
        monthlyRevenue,
      },
    });
  } catch (error) {
    console.error('[Admin Membership GET Error]', error);
    return NextResponse.json({ error: '获取会员数据失败' }, { status: 500 });
  }
}
