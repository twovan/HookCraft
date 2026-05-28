// POST /api/payments/credits-pack - 购买 Credits 充值包（模拟支付）
// 使用 CreditService.purchaseCredits 将购买的 Credits 入账到 purchased_credits 表

import { NextRequest, NextResponse } from 'next/server';
import { CreditService } from '../../../../lib/credits/CreditService';
import { isSupabaseAdminConfigured, supabaseAdmin } from '../../../../lib/supabase/server';
import { getAuthUser } from '../../../../lib/supabase/auth-helpers';
import { AdminConfigService } from '../../../../lib/admin/AdminConfigService';
import {
  calculateCreditsPackPrice,
  findCreditsPack,
  getPublicCreditsPacks,
} from '../../../../config/creditsPack';

async function loadCreditsPacksConfig() {
  if (!isSupabaseAdminConfigured()) return [];

  try {
    const service = new AdminConfigService(supabaseAdmin);
    const config = await service.getCurrentConfig();
    return config.creditsPacks;
  } catch (error: any) {
    console.error('Credits pack config load error:', error);
    return [];
  }
}

export async function GET() {
  const creditsPacks = await loadCreditsPacksConfig();
  return NextResponse.json({
    creditsPacks: getPublicCreditsPacks(creditsPacks),
  });
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: '未登录，请先登录' }, { status: 401 });
    }

    const body = await req.json();
    const { packId } = body as { packId: string };
    const configuredPacks = await loadCreditsPacksConfig();
    const pack = packId ? findCreditsPack(configuredPacks, packId) : null;

    if (!pack) {
      return NextResponse.json({ error: '无效的充值包' }, { status: 400 });
    }

    // 使用 CreditService 将购买的 Credits 入账到 purchased_credits 表
    const creditService = new CreditService(supabaseAdmin);
    const result = await creditService.purchaseCredits(user.id, pack.credits);

    if (!result.success) {
      return NextResponse.json({ error: '充值失败，请重试' }, { status: 500 });
    }

    // 写入 payments 记录
    const orderId = crypto.randomUUID();
    const { data: credits } = await supabaseAdmin
      .from('credits')
      .select('tier')
      .eq('user_id', user.id)
      .single();
    const tier = credits?.tier || 'free';
    const amount = calculateCreditsPackPrice(pack, tier);

    await supabaseAdmin.from('payments').insert({
      id: orderId,
      user_id: user.id,
      amount,
      currency: 'CNY',
      provider: 'alipay',
      tier,
      billing_cycle: 'monthly',
      status: 'completed',
      completed_at: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      credits_added: pack.credits,
      purchasedBalance: result.purchasedBalance,
      totalAvailable: result.totalAvailable,
      remaining: result.totalAvailable,
      order_id: orderId,
      pack_label: `${pack.credits} Credits`,
      amount,
    });
  } catch (error: any) {
    console.error('Credits pack purchase error:', error);
    return NextResponse.json({ error: '充值失败，请重试' }, { status: 500 });
  }
}
