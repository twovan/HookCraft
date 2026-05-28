// GET /api/credits/history - 获取 Credits 使用历史

import { NextRequest, NextResponse } from 'next/server';
import { CreditService } from '../../../../lib/credits/CreditService';
import { getServerSupabaseClient } from '../../../../lib/supabase/server';
import { getAuthAccessToken, getAuthUser } from '../../../../lib/supabase/auth-helpers';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json(
        { error: '未登录，请先登录' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const monthsParam = searchParams.get('months');

    const months = monthsParam ? parseInt(monthsParam, 10) : 6;
    if (isNaN(months) || months < 1 || months > 24) {
      return NextResponse.json(
        { error: '查询月数无效，请输入 1-24 之间的数字' },
        { status: 400 }
      );
    }

    const creditService = new CreditService(getServerSupabaseClient(await getAuthAccessToken()));
    const history = await creditService.getCreditHistory(user.id, months);

    return NextResponse.json({ history });
  } catch (error: any) {
    console.error('获取 Credits 历史失败:', error);
    return NextResponse.json(
      { error: '获取使用历史失败，请稍后重试' },
      { status: 500 }
    );
  }
}
