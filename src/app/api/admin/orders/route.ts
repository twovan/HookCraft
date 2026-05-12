import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase/server';
import { requireAdmin } from '../../../../lib/admin/auth';

/**
 * GET /api/admin/orders
 * 获取订单列表（分页、可筛选）
 */
export async function GET(req: NextRequest) {
  try {
    const { admin, response } = await requireAdmin(req);
    if (response) return response;

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '10');
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';

    // Build query
    let query = supabaseAdmin
      .from('payments')
      .select('*', { count: 'exact' });

    if (status) {
      query = query.eq('status', status as any);
    }

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data: orders, count, error } = await query
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw error;

    // Map orders - payments table has: id, user_id, session_id, amount, currency, provider, tier, billing_cycle, status, created_at, completed_at
    let mappedOrders = (orders || []).map((o: any) => ({
      id: o.id,
      orderNumber: o.id.slice(0, 12).toUpperCase(),
      userId: o.user_id,
      userName: o.user_id?.slice(0, 8) || '用户',
      type: o.tier === 'free' ? 'credits_pack' : 'membership',
      productName: `${o.tier} ${o.billing_cycle || ''}`.trim(),
      amount: o.amount || 0,
      paymentMethod: o.provider || 'stripe',
      status: o.status || 'completed',
      createdAt: o.created_at,
    }));

    if (search) {
      const q = search.toLowerCase();
      mappedOrders = mappedOrders.filter(
        (o) => o.orderNumber.toLowerCase().includes(q) || o.userName.toLowerCase().includes(q)
      );
    }

    // Stats
    const { count: totalOrders } = await supabaseAdmin
      .from('payments')
      .select('*', { count: 'exact', head: true });

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: monthlyPayments } = await supabaseAdmin
      .from('payments')
      .select('amount')
      .eq('status', 'completed')
      .gte('created_at', thirtyDaysAgo);

    const monthlyAmount = (monthlyPayments || []).reduce((sum: number, p: any) => sum + (p.amount || 0), 0);

    const { count: pendingRefunds } = await supabaseAdmin
      .from('payments')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'refunded');

    const avgOrderValue = monthlyPayments && monthlyPayments.length > 0 ? Math.round(monthlyAmount / monthlyPayments.length) : 0;

    return NextResponse.json({
      data: mappedOrders,
      total: search ? mappedOrders.length : (count || 0),
      page,
      pageSize,
      stats: {
        totalOrders: totalOrders || 0,
        monthlyAmount,
        pendingRefunds: pendingRefunds || 0,
        avgOrderValue,
      },
    });
  } catch (error) {
    console.error('[Admin Orders GET Error]', error);
    return NextResponse.json({ error: '获取订单列表失败' }, { status: 500 });
  }
}
