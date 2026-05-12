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

    // Recent orders - fetch user info for display
    const recentPayments = recentPaymentsResult.data || [];
    const userIds = [...new Set(recentPayments.map((p: any) => p.user_id).filter(Boolean))];
    
    // Fetch user emails from auth
    const userNameMap: Record<string, string> = {};
    if (userIds.length > 0) {
      const { data: usersData } = await supabaseAdmin.auth.admin.listUsers({ perPage: 100 });
      if (usersData?.users) {
        for (const user of usersData.users) {
          const displayName = user.user_metadata?.display_name || user.user_metadata?.name || user.email?.split('@')[0] || user.id.slice(0, 8);
          userNameMap[user.id] = displayName;
        }
      }
    }

    const recentOrders = recentPayments.map((p: any) => ({
      orderNumber: p.id?.slice(0, 8) || 'N/A',
      userName: userNameMap[p.user_id] || p.user_id?.slice(0, 8) || '用户',
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

    // Revenue trend data (last 7 days / 7 weeks / 7 months based on query param)
    const { searchParams } = new URL(request.url);
    const trendPeriod = searchParams.get('trendPeriod') || 'week';

    const revenueTrend: { label: string; amount: number }[] = [];
    
    if (trendPeriod === 'day') {
      // Last 7 days
      for (let i = 6; i >= 0; i--) {
        const dayStart = new Date(now);
        dayStart.setDate(dayStart.getDate() - i);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(dayStart);
        dayEnd.setHours(23, 59, 59, 999);
        
        const { data: dayPayments } = await supabaseAdmin
          .from('payments')
          .select('amount')
          .gte('created_at', dayStart.toISOString())
          .lte('created_at', dayEnd.toISOString())
          .eq('status', 'completed');
        
        const dayTotal = (dayPayments || []).reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
        const label = `${dayStart.getMonth() + 1}/${dayStart.getDate()}`;
        revenueTrend.push({ label, amount: dayTotal });
      }
    } else if (trendPeriod === 'week') {
      // Last 7 weeks
      for (let i = 6; i >= 0; i--) {
        const weekEnd = new Date(now);
        weekEnd.setDate(weekEnd.getDate() - i * 7);
        weekEnd.setHours(23, 59, 59, 999);
        const weekStart = new Date(weekEnd);
        weekStart.setDate(weekStart.getDate() - 6);
        weekStart.setHours(0, 0, 0, 0);
        
        const { data: weekPayments } = await supabaseAdmin
          .from('payments')
          .select('amount')
          .gte('created_at', weekStart.toISOString())
          .lte('created_at', weekEnd.toISOString())
          .eq('status', 'completed');
        
        const weekTotal = (weekPayments || []).reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
        revenueTrend.push({ label: `W${7 - i}`, amount: weekTotal });
      }
    } else {
      // Last 7 months
      for (let i = 6; i >= 0; i--) {
        const mStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const mEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999);
        
        const { data: monthPayments } = await supabaseAdmin
          .from('payments')
          .select('amount')
          .gte('created_at', mStart.toISOString())
          .lte('created_at', mEnd.toISOString())
          .eq('status', 'completed');
        
        const monthTotal = (monthPayments || []).reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
        revenueTrend.push({ label: `${mStart.getMonth() + 1}月`, amount: monthTotal });
      }
    }

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
      revenueTrend,
    });
  } catch (error) {
    console.error('[Admin Dashboard API Error]', error);
    return NextResponse.json({ error: '获取仪表盘数据失败，请重试' }, { status: 500 });
  }
}
