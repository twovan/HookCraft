// POST /api/payments/credits-pack - 购买 Credits 充值包

import { NextRequest, NextResponse } from 'next/server';
import { PaymentService } from '../../../../lib/payment/PaymentService';
import { supabaseAdmin } from '../../../../lib/supabase/server';
import { getAuthUser } from '../../../../lib/supabase/auth-helpers';
import type { MembershipTier, PaymentProvider } from '../../../../types/membership';

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
    const { packId, userTier, paymentProvider } = body as {
      packId: string;
      userTier?: MembershipTier;
      paymentProvider?: PaymentProvider;
    };

    if (!packId) {
      return NextResponse.json(
        { error: '缺少必要参数' },
        { status: 400 }
      );
    }

    // 验证充值包是否存在
    const pack = PaymentService.getCreditsPack(packId);
    if (!pack) {
      return NextResponse.json(
        { error: '无效的充值包' },
        { status: 400 }
      );
    }

    const paymentService = new PaymentService(supabaseAdmin);
    const session = await paymentService.purchaseCreditsPackage(
      user.id,
      packId,
      userTier ?? 'pro',
      paymentProvider ?? 'stripe'
    );

    return NextResponse.json(session);
  } catch (error: any) {
    console.error('购买充值包失败:', error);
    return NextResponse.json(
      { error: '购买失败，请稍后重试' },
      { status: 500 }
    );
  }
}
