// POST /api/membership/cancel - 取消订阅

import { NextRequest, NextResponse } from 'next/server';
import { MembershipService } from '../../../../lib/membership/MembershipService';
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

    const membershipService = new MembershipService(supabaseAdmin);
    const result = await membershipService.cancelSubscription(user.id);

    if (!result.success) {
      return NextResponse.json(
        { error: '取消订阅失败，当前为免费用户无需取消' },
        { status: 400 }
      );
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('取消订阅失败:', error);
    return NextResponse.json(
      { error: '取消订阅失败，请稍后重试' },
      { status: 500 }
    );
  }
}
