// GET /api/templates - 获取模板列表（按等级过滤）
// 模板列表为公开数据，不需要认证

import { NextRequest, NextResponse } from 'next/server';
import { TemplateService } from '../../../lib/template/TemplateService';
import { supabaseAdmin } from '../../../lib/supabase/server';
import type { MembershipTier } from '../../../types/membership';
import { TIER_CONFIGS } from '../../../config/tierConfig';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userTier = (searchParams.get('tier') ?? 'free') as MembershipTier;

    const validTiers: MembershipTier[] = ['free', 'pro', 'business'];
    if (!validTiers.includes(userTier)) {
      return NextResponse.json(
        { error: '无效的会员等级' },
        { status: 400 }
      );
    }

    const templateService = new TemplateService(supabaseAdmin);
    const allTemplates = await templateService.getTemplates();

    // 按用户等级过滤可访问的模板
    const tierFeatures = TIER_CONFIGS[userTier].features;
    const accessibleTemplates = allTemplates.filter((t) =>
      tierFeatures.includes(t.category)
    );

    return NextResponse.json(accessibleTemplates);
  } catch (error: any) {
    console.error('获取模板列表失败:', error);
    return NextResponse.json(
      { error: '获取模板列表失败，请稍后重试' },
      { status: 500 }
    );
  }
}
