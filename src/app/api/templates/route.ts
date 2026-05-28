// GET /api/templates - 获取模板列表（按等级过滤）
// 模板列表为公开数据，不需要认证

import { NextRequest, NextResponse } from 'next/server';
import { TemplateService } from '../../../lib/template/TemplateService';
import { getServerSupabaseClient } from '../../../lib/supabase/server';
import { getAuthAccessToken } from '../../../lib/supabase/auth-helpers';
import type { MembershipTier } from '../../../types/membership';
import { TIER_CONFIGS } from '../../../config/tierConfig';

export const dynamic = 'force-dynamic';

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

    const supabase = getServerSupabaseClient(await getAuthAccessToken());
    const templateService = new TemplateService(supabase);
    const allTemplates = await templateService.getTemplates();

    // 按用户等级过滤可访问的模板，且只显示已发布的
    const tierFeatures = TIER_CONFIGS[userTier].features;
    const accessibleTemplates = allTemplates.filter((t) =>
      tierFeatures.includes(t.category) && t.status === 'published'
    );

    const producerIds = Array.from(new Set(accessibleTemplates.map((t) => t.producerId).filter(Boolean))) as string[];
    let producerMap: Record<string, { name: string; avatarUrl?: string }> = {};

    if (producerIds.length > 0) {
      const { data: producers } = await supabase
        .from('producers')
        .select('id, display_name, avatar_url')
        .in('id', producerIds);

      producerMap = (producers || []).reduce((acc: Record<string, { name: string; avatarUrl?: string }>, producer: any) => {
        acc[producer.id] = {
          name: producer.display_name,
          avatarUrl: producer.avatar_url || undefined,
        };
        return acc;
      }, {});
    }

    return NextResponse.json(accessibleTemplates.map((template) => {
      const producer = template.producerId ? producerMap[template.producerId] : undefined;
      return {
        ...template,
        producerName: producer?.name,
        producerAvatarUrl: producer?.avatarUrl,
      };
    }));
  } catch (error: any) {
    console.error('获取模板列表失败:', error);
    return NextResponse.json(
      { error: '获取模板列表失败，请稍后重试' },
      { status: 500 }
    );
  }
}
