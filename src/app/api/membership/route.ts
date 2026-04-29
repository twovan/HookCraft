// GET /api/membership - 获取会员信息

import { NextRequest, NextResponse } from 'next/server';
import { MembershipService } from '../../../lib/membership/MembershipService';
import { supabaseAdmin } from '../../../lib/supabase/server';
import { getAuthUser } from '../../../lib/supabase/auth-helpers';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json(
        { error: '未登录，请先登录' },
        { status: 401 }
      );
    }

    const membershipService = new MembershipService(supabaseAdmin);
    const membership = await membershipService.getMembership(user.id);

    return NextResponse.json(membership);
  } catch (error: any) {
    console.error('获取会员信息失败:', error);
    return NextResponse.json(
      { error: '获取会员信息失败，请稍后重试' },
      { status: 500 }
    );
  }
}
