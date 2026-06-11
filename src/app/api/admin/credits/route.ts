import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase/server';
import { requireAdmin } from '../../../../lib/admin/auth';
import { AdminConfigService } from '../../../../lib/admin/AdminConfigService';
import {
  buildDailyCreditTrend,
  buildMonthlyQuotaMap,
  getDailyTrendStartDate,
} from '../../../../lib/admin/creditsOverview';

/**
 * GET /api/admin/credits
 * 获取积分使用概览
 */
export async function GET(req: NextRequest) {
  try {
    const { admin, response } = await requireAdmin(req);
    if (response) return response;

    const configService = new AdminConfigService(supabaseAdmin);
    const config = await configService.getCurrentConfig();
    const monthlyQuotaMap = buildMonthlyQuotaMap(config.creditQuotas);
    const dailyTrendStart = getDailyTrendStartDate();

    const [creditsResult, transactionsResult] = await Promise.all([
      supabaseAdmin
        .from('credits')
        .select('*'),
      supabaseAdmin
        .from('credit_transactions')
        .select('created_at, total_cost, operation_type')
        .gte('created_at', dailyTrendStart.toISOString()),
    ]);

    const { data: credits, error: creditsError } = creditsResult;
    const { data: transactions, error: transactionsError } = transactionsResult;

    if (creditsError) throw creditsError;
    if (transactionsError) throw transactionsError;

    const allCredits = credits || [];

    // Overall stats - credits table has: user_id, tier, used, total
    const totalIssued = allCredits.reduce((sum: number, c: any) => sum + (c.total || 0), 0);
    const totalConsumed = allCredits.reduce((sum: number, c: any) => sum + (c.used || 0), 0);
    const consumptionRate = totalIssued > 0 ? Math.round((totalConsumed / totalIssued) * 100) : 0;
    const exhaustedUsers = allCredits.filter((c: any) => c.used >= c.total && c.total > 0);

    // Days until next reset (assume 1st of next month)
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const daysUntilReset = Math.ceil((nextMonth.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    // Tier breakdown - credits table already has tier column
    const tierGroups: Record<string, { users: number; totalIssued: number; totalConsumed: number }> = {
      free: { users: 0, totalIssued: 0, totalConsumed: 0 },
      pro: { users: 0, totalIssued: 0, totalConsumed: 0 },
      business: { users: 0, totalIssued: 0, totalConsumed: 0 },
    };

    allCredits.forEach((c: any) => {
      const tier = c.tier || 'free';
      if (!tierGroups[tier]) tierGroups[tier] = { users: 0, totalIssued: 0, totalConsumed: 0 };
      tierGroups[tier].users += 1;
      tierGroups[tier].totalIssued += c.total || 0;
      tierGroups[tier].totalConsumed += c.used || 0;
    });

    const tierBreakdown = Object.entries(tierGroups).map(([tier, data]) => ({
      tier,
      users: data.users,
      monthlyQuota: monthlyQuotaMap[tier as keyof typeof monthlyQuotaMap] ?? 0,
      totalIssued: data.totalIssued,
      totalConsumed: data.totalConsumed,
      avgUsage: data.users > 0 ? Math.round(data.totalConsumed / data.users) : 0,
      consumptionRate: data.totalIssued > 0 ? Math.round((data.totalConsumed / data.totalIssued) * 100) : 0,
    }));

    // Exhausted users list
    const exhaustedList = exhaustedUsers.slice(0, 20).map((c: any) => ({
      userId: c.user_id,
      userName: c.user_id?.slice(0, 8) || '用户',
      email: '',
      tier: c.tier || 'free',
      creditsUsed: c.used,
      creditsTotal: c.total,
      exhaustedAt: c.updated_at || c.created_at,
    }));

    return NextResponse.json({
      stats: {
        totalIssued,
        totalConsumed,
        consumptionRate,
        exhaustedCount: exhaustedUsers.length,
        daysUntilReset,
      },
      tierBreakdown,
      dailyTrend: buildDailyCreditTrend(transactions || []),
      exhaustedUsers: exhaustedList,
    });
  } catch (error) {
    console.error('[Admin Credits GET Error]', error);
    return NextResponse.json({ error: '获取积分数据失败' }, { status: 500 });
  }
}
