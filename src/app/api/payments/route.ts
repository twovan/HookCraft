// GET /api/payments - 获取用户支付记录
// POST /api/payments - 创建支付会话

import { NextRequest, NextResponse } from 'next/server';
import { PaymentService } from '../../../lib/payment/PaymentService';
import { supabaseAdmin } from '../../../lib/supabase/server';
import { getAuthUser } from '../../../lib/supabase/auth-helpers';
import type { MembershipTier, BillingCycle, PaymentProvider } from '../../../types/membership';

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json([], { status: 200 });
    }

    // 查询用户的已完成支付记录
    const { data, error } = await supabaseAdmin
      .from('payments')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('获取支付记录失败:', error);
      return NextResponse.json([], { status: 200 });
    }

    return NextResponse.json(data || []);
  } catch {
    return NextResponse.json([], { status: 200 });
  }
}

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
    const { tier, billingCycle, paymentProvider } = body as {
      tier: MembershipTier;
      billingCycle: BillingCycle;
      paymentProvider: PaymentProvider;
    };

    if (!tier || !billingCycle || !paymentProvider) {
      return NextResponse.json(
        { error: '缺少必要参数' },
        { status: 400 }
      );
    }

    const validTiers: MembershipTier[] = ['pro', 'business'];
    if (!validTiers.includes(tier)) {
      return NextResponse.json(
        { error: '无效的订阅等级' },
        { status: 400 }
      );
    }

    const validCycles: BillingCycle[] = ['monthly', 'yearly'];
    if (!validCycles.includes(billingCycle)) {
      return NextResponse.json(
        { error: '无效的计费周期' },
        { status: 400 }
      );
    }

    const validProviders: PaymentProvider[] = ['stripe', 'paypal', 'wechat', 'alipay'];
    if (!validProviders.includes(paymentProvider)) {
      return NextResponse.json(
        { error: '不支持的支付方式' },
        { status: 400 }
      );
    }

    const paymentService = new PaymentService(supabaseAdmin);
    const session = await paymentService.createSubscription({
      userId: user.id,
      tier,
      billingCycle,
      paymentProvider,
    });

    return NextResponse.json(session);
  } catch (error: any) {
    console.error('创建支付会话失败:', error);
    return NextResponse.json(
      { error: '创建支付失败，请稍后重试' },
      { status: 500 }
    );
  }
}
