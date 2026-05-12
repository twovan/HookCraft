// POST /api/credits/purchase - 购买 Credits 入账

import { NextRequest, NextResponse } from 'next/server';
import { CreditService } from '../../../../lib/credits/CreditService';
import { supabaseAdmin } from '../../../../lib/supabase/server';
import { getAuthUser } from '../../../../lib/supabase/auth-helpers';

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json(
        { error: '未登录，请先登录' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { amount, orderId } = body as { amount: number; orderId?: string };

    // Validate amount
    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json(
        { error: '购买数量无效，必须大于 0' },
        { status: 400 }
      );
    }

    if (!Number.isInteger(amount)) {
      return NextResponse.json(
        { error: '购买数量必须为整数' },
        { status: 400 }
      );
    }

    const creditService = new CreditService(supabaseAdmin);
    const result = await creditService.purchaseCredits(user.id, amount);

    if (!result.success) {
      return NextResponse.json(
        { error: '购买入账失败，请稍后重试' },
        { status: 409 }
      );
    }

    return NextResponse.json({
      success: true,
      purchasedBalance: result.purchasedBalance,
      totalAvailable: result.totalAvailable,
    });
  } catch (error: any) {
    console.error('购买 Credits 入账失败:', error);
    return NextResponse.json(
      { error: '购买入账失败，请稍后重试' },
      { status: 500 }
    );
  }
}
