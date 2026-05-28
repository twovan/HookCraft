// GET /api/credits/preview - 获取 Free 用户 Preview 次数
// POST /api/credits/preview - 消耗 1 次 Preview

import { NextRequest, NextResponse } from 'next/server';
import { CreditService } from '../../../../lib/credits/CreditService';
import { getServerSupabaseClient } from '../../../../lib/supabase/server';
import { getAuthAccessToken, getAuthUser } from '../../../../lib/supabase/auth-helpers';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      // Return default free tier preview count when auth cookie isn't synced
      return NextResponse.json({ used: 0, total: 3, remaining: 3 });
    }

    const creditService = new CreditService(getServerSupabaseClient(await getAuthAccessToken()));
    const previewCount = await creditService.getPreviewCount(user.id);

    return NextResponse.json(previewCount);
  } catch (error: any) {
    console.error('获取 Preview 次数失败:', error);
    return NextResponse.json(
      { error: '获取预览次数失败，请稍后重试' },
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

    const creditService = new CreditService(getServerSupabaseClient(await getAuthAccessToken()));
    const result = await creditService.consumePreview(user.id);

    if (!result.success) {
      return NextResponse.json(
        { error: '本月预览次数已用尽，升级到专业版获取更多创作额度' },
        { status: 400 }
      );
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('消耗 Preview 次数失败:', error);
    return NextResponse.json(
      { error: '操作失败，请稍后重试' },
      { status: 500 }
    );
  }
}
