import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase/server';
import { requireAdmin } from '../../../../lib/admin/auth';

/**
 * GET /api/admin/dashboard
 * 获取仪表盘聚合统计数据
 */
export async function GET(request: NextRequest) {
  try {
    const { admin, response } = await requireAdmin(request);
    if (response) return response;

    // Aggregate stats in parallel
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const [
      usersResult,
      templatesResult,
      paymentsResult,
      creditsResult,
      membershipsResult,
      recentPaymentsResult,
    ] = await Promise.all([
      // Total users
      supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1 }),
      // Total templates
      supabaseAdmin.from('templates').select('*', { count: 'exact', head: true }),
      // Monthly revenue from payments
      supabaseAdmin
        .from('payments')
        .select('amount')
        .gte('created_at', monthStart)
        .eq('status', 'completed'),
      // Monthly credits consumed
      supabaseAdmin
        .from('credits')
        .select('used'),
      // Membership distribution
      supabaseAdmin
        .from('memberships')
        .select('tier'),
      // Recent orders (last 5)
      supabaseAdmin
        .from('payments')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5),
    ]);

    // Calculate total users
    const totalUsers = usersResult.data?.users?.length !== undefined
      ? (usersResult.data as any)?.total || usersResult.data?.users?.length || 0
      : 0;

    // Calculate total templates
    const totalTemplates = templatesResult.count || 0;

    // Calculate monthly revenue
    const monthlyRevenue = (paymentsResult.data || []).reduce(
      (sum: number, p: any) => sum + (p.amount || 0),
      0
    );

    // Calculate monthly credits consumed
    const monthlyCreditsConsumed = (creditsResult.data || []).reduce(
      (sum: number, c: any) => sum + (c.used || 0),
      0
    );

    // Membership distribution
    const membershipData = membershipsResult.data || [];
    const tierCounts: Record<string, number> = { free: 0, pro: 0, business: 0 };
    membershipData.forEach((m: any) => {
      const tier = (m.tier || 'free').toLowerCase();
      if (tierCounts[tier] !== undefined) {
        tierCounts[tier]++;
      }
    });
    const totalMembers = membershipData.length || 1;
    const membershipDistribution = Object.entries(tierCounts).map(([tier, count]) => ({
      tier: tier.charAt(0).toUpperCase() + tier.slice(1),
      count,
      percentage: Math.round((count / totalMembers) * 100),
    }));

    // Recent orders
    const recentOrders = (recentPaymentsResult.data || []).map((p: any) => ({
      orderNumber: p.id?.slice(0, 8) || 'N/A',
      userName: p.user_id?.slice(0, 8) || '用户',
      templateName: p.description || p.type || '订单',
      amount: p.amount || 0,
      status: p.status || 'pending',
      createdAt: p.created_at,
    }));

    // Top templates (placeholder - use sales_count if available)
    const topTemplatesResult = await supabaseAdmin
      .from('templates')
      .select('name, category, price, sales_count' as any)
      .order('sales_count', { ascending: false })
      .limit(5);

    const topTemplates = (topTemplatesResult.data || []).map((t: any) => ({
      name: t.name || '未命名模板',
      category: t.category || '未分类',
      price: t.price || 0,
      salesCount: t.sales_count || 0,
    }));

    // Recent activity (placeholder based on recent data)
    const recentActivity = [
      { type: 'user', description: '新用户注册', time: new Date().toISOString() },
      { type: 'template', description: '新模板上传待审核', time: new Date().toISOString() },
      { type: 'order', description: '新订单完成', time: new Date().toISOString() },
      { type: 'ai', description: 'AI 生成任务完成', time: new Date().toISOString() },
      { type: 'system', description: '系统配置更新', time: new Date().toISOString() },
    ];

    return NextResponse.json({
      totalUsers,
      monthlyRevenue,
      totalTemplates,
      monthlyCreditsConsumed,
      recentOrders,
      membershipDistribution,
      topTemplates,
      recentActivity,
    });
  } catch (error) {
    console.error('[Admin Dashboard API Error]', error);
    return NextResponse.json({ error: '获取仪表盘数据失败，请重试' }, { status: 500 });
  }
}
