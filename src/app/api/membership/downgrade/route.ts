// POST /api/membership/downgrade - 降级会员等级

import { NextRequest, NextResponse } from 'next/server';
import { MembershipService } from '../../../../lib/membership/MembershipService';
import { supabaseAdmin } from '../../../../lib/supabase/server';
import { getAuthUser } from '../../../../lib/supabase/auth-helpers';
import type { MembershipTier } from '../../../../types/membership';

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
    const { targetTier } = body as { targetTier: MembershipTier };

    if (!targetTier) {
      return NextResponse.json(
        { error: '缺少必要参数' },
        { status: 400 }
      );
    }

    const validTiers: MembershipTier[] = ['free', 'pro', 'business'];
    if (!validTiers.includes(targetTier)) {
      return NextResponse.json(
        { error: '无效的目标等级' },
        { status: 400 }
      );
    }

    const membershipService = new MembershipService(supabaseAdmin);
    const result = await membershipService.downgradeTier(user.id, targetTier);

    if (!result.success) {
      return NextResponse.json(
        { error: '降级失败，目标等级必须低于当前等级' },
        { status: 400 }
      );
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('降级会员失败:', error);
    return NextResponse.json(
      { error: '降级操作失败，请稍后重试' },
      { status: 500 }
    );
  }
}
