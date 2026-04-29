// POST /api/payments/webhook - 处理支付回调
// 注意：Webhook 路由不需要用户认证，由支付提供商调用
// 使用 supabaseAdmin 绕过 RLS 直接操作数据库

import { NextRequest, NextResponse } from 'next/server';
import { PaymentService } from '../../../../lib/payment/PaymentService';
import { supabaseAdmin } from '../../../../lib/supabase/server';
import type { PaymentProvider } from '../../../../types/membership';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { provider, eventId, sessionId, status } = body as {
      provider: PaymentProvider;
      eventId: string;
      sessionId: string;
      status: 'completed' | 'failed' | 'cancelled';
    };

    // 基础验签检查（简化版，生产环境需验证签名）
    if (!provider || !eventId || !sessionId || !status) {
      return NextResponse.json(
        { error: '无效的回调数据' },
        { status: 400 }
      );
    }

    const validProviders: PaymentProvider[] = ['stripe', 'paypal', 'wechat', 'alipay'];
    if (!validProviders.includes(provider)) {
      return NextResponse.json(
        { error: '验签失败' },
        { status: 400 }
      );
    }

    const paymentService = new PaymentService(supabaseAdmin);
    const result = await paymentService.handleWebhook(provider, {
      eventId,
      sessionId,
      status,
    });

    if (!result.handled) {
      return NextResponse.json(
        { error: '回调处理失败' },
        { status: 400 }
      );
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Webhook 处理失败:', error);
    return NextResponse.json(
      { error: '回调处理异常' },
      { status: 500 }
    );
  }
}
