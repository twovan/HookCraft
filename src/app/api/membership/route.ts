// GET /api/membership - 获取会员信息

import { NextRequest, NextResponse } from 'next/server';
import { MembershipService } from '../../../lib/membership/MembershipService';
import { supabaseAdmin } from '../../../lib/supabase/server';
import { getAuthUser } from '../../../lib/supabase/auth-helpers';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      // Return default free membership when auth cookie isn't synced
      return NextResponse.json({
        tier: 'free',
        status: 'active',
        credits_total: 0,
        credits_used: 0,
        preview_total: 3,
        preview_used: 0,
      });
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
