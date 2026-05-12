// POST /api/payments/credits-pack - 购买 Credits 充值包（模拟支付）
// 使用 CreditService.purchaseCredits 将购买的 Credits 入账到 purchased_credits 表

import { NextRequest, NextResponse } from 'next/server';
import { CreditService } from '../../../../lib/credits/CreditService';
import { supabaseAdmin } from '../../../../lib/supabase/server';
import { getAuthUser } from '../../../../lib/supabase/auth-helpers';

const CREDITS_PACKS: Record<string, { credits: number; price: number; discountPrice: number; label: string }> = {
  pack_50: { credits: 50, price: 9900, discountPrice: 7900, label: '50 Credits' },
  pack_100: { credits: 100, price: 17900, discountPrice: 14300, label: '100 Credits' },
  pack_200: { credits: 200, price: 32900, discountPrice: 26300, label: '200 Credits' },
};

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: '未登录，请先登录' }, { status: 401 });
    }

    const body = await req.json();
    const { packId } = body as { packId: string };

    if (!packId || !CREDITS_PACKS[packId]) {
      return NextResponse.json({ error: '无效的充值包' }, { status: 400 });
    }

    const pack = CREDITS_PACKS[packId];

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

    await supabaseAdmin.from('payments').insert({
      id: orderId,
      user_id: user.id,
      amount: pack.price,
      currency: 'CNY',
      provider: 'alipay',
      tier: credits?.tier || 'free',
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
      pack_label: pack.label,
    });
  } catch (error: any) {
    console.error('Credits pack purchase error:', error);
    return NextResponse.json({ error: '充值失败，请重试' }, { status: 500 });
  }
}
