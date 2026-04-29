// GET /api/credits - 获取 Credits 信息
// POST /api/credits - 消耗 Credits

import { NextRequest, NextResponse } from 'next/server';
import { CreditService } from '../../../lib/credits/CreditService';
import { supabaseAdmin } from '../../../lib/supabase/server';
import { getAuthUser } from '../../../lib/supabase/auth-helpers';
import type { CreditOperationType } from '../../../types/credits';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json(
        { error: '未登录，请先登录' },
        { status: 401 }
      );
    }

    const creditService = new CreditService(supabaseAdmin);
    const credits = await creditService.getCredits(user.id);

    return NextResponse.json(credits);
  } catch (error: any) {
    console.error('获取 Credits 信息失败:', error);
    return NextResponse.json(
      { error: '获取额度信息失败，请稍后重试' },
      { status: 500 }
    );
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
    const { operations } = body as { operations: CreditOperationType[] };

    if (!operations || !Array.isArray(operations) || operations.length === 0) {
      return NextResponse.json(
        { error: '缺少必要参数' },
        { status: 400 }
      );
    }

    const creditService = new CreditService(supabaseAdmin);
    const result = await creditService.consumeCredits(user.id, operations);

    if (!result.success) {
      const errorMessages: Record<string, string> = {
        no_credits: 'Credits 不足，请购买充值包或升级会员',
        concurrent_limit: '操作冲突，请稍后重试',
      };
      return NextResponse.json(
        { error: errorMessages[result.error ?? ''] ?? '消耗失败' },
        { status: 400 }
      );
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('消耗 Credits 失败:', error);
    return NextResponse.json(
      { error: '操作失败，请稍后重试' },
      { status: 500 }
    );
  }
}
