import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase/server';
import { requireAdmin } from '../../../../lib/admin/auth';

/**
 * GET /api/admin/revenue
 * 获取收入统计和分类明细
 */
export async function GET(req: NextRequest) {
  try {
    const { admin, response } = await requireAdmin(req);
    if (response) return response;

    // Get all completed payments
    const { data: payments } = await supabaseAdmin
      .from('payments')
      .select('amount, tier, billing_cycle')
      .eq('status', 'completed');

    const allPayments = payments || [];
    const totalRevenue = allPayments.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);

    // Breakdown by tier (membership payments are pro/business, credits packs would be free tier)
    const membershipRevenue = allPayments
      .filter((p: any) => p.tier === 'pro' || p.tier === 'business')
      .reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
    const creditsPackRevenue = allPayments
      .filter((p: any) => p.tier === 'free')
      .reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
    const templateSales = totalRevenue - membershipRevenue - creditsPackRevenue;

    // Platform commission (assume 30% default on template sales)
    const commissionRate = 0.3;
    const platformCommission = Math.round(templateSales * commissionRate);
    const producerPayouts = templateSales - platformCommission;

    // Pending settlements
    const { data: pendingSettlements } = await supabaseAdmin
      .from('settlements')
      .select('settlement_amount')
      .eq('status', 'processing');

    const pendingAmount = (pendingSettlements || []).reduce((sum: number, s: any) => sum + (s.settlement_amount || 0), 0);

    return NextResponse.json({
      stats: {
        totalRevenue,
        platformCommission,
        producerPayouts,
        pendingSettlements: pendingAmount,
      },
      breakdown: [
        {
          category: '模板销售',
          amount: templateSales,
          percentage: totalRevenue > 0 ? Math.round((templateSales / totalRevenue) * 100) : 0,
        },
        {
          category: '会员订阅',
          amount: membershipRevenue,
          percentage: totalRevenue > 0 ? Math.round((membershipRevenue / totalRevenue) * 100) : 0,
        },
        {
          category: '积分包购买',
          amount: creditsPackRevenue,
          percentage: totalRevenue > 0 ? Math.round((creditsPackRevenue / totalRevenue) * 100) : 0,
        },
      ],
    });
  } catch (error) {
    console.error('[Admin Revenue GET Error]', error);
    return NextResponse.json({ error: '获取收入数据失败' }, { status: 500 });
  }
}
