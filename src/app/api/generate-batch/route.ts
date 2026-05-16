import { NextRequest, NextResponse } from 'next/server';
import type { MembershipTier } from '../../../types/membership';
import type { GenerateBatchRequest, GenerateBatchResponse } from '../../../types/generation';
import { MusicGenerationService } from '../../../lib/generation/MusicGenerationService';
import { LyriaProvider } from '../../../lib/generation/LyriaProvider';
import { CreditService } from '../../../lib/credits/CreditService';
import { TemplateService } from '../../../lib/template/TemplateService';
import { TemplateAdminService } from '../../../lib/admin/TemplateAdminService';
import { supabaseAdmin } from '../../../lib/supabase/server';
import { getAuthUser } from '../../../lib/supabase/auth-helpers';

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    // Auth check
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json(
        { error: '未登录，请先登录' },
        { status: 401 }
      );
    }

    // Parse and validate request body
    const body = (await req.json()) as GenerateBatchRequest;

    if (!body.templateId && !body.userPrompt) {
      return NextResponse.json(
        { error: '请提供模板或创作描述' },
        { status: 400 }
      );
    }

    if (!body.generationType) {
      return NextResponse.json(
        { error: '请指定生成类型（preview 或 full_demo）' },
        { status: 400 }
      );
    }

    // Get user's membership tier
    const { data: membership, error: membershipError } = await supabaseAdmin
      .from('memberships')
      .select('tier')
      .eq('user_id', user.id)
      .single();

    if (membershipError || !membership) {
      return NextResponse.json(
        { error: '无法获取会员信息' },
        { status: 500 }
      );
    }

    const userTier = membership.tier as MembershipTier;

    // Initialize services
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'your_api_key_here') {
      return NextResponse.json(
        { error: '服务配置异常，请稍后重试' },
        { status: 500 }
      );
    }

    const provider = new LyriaProvider(apiKey);
    const creditService = new CreditService(supabaseAdmin);
    const templateService = new TemplateService(supabaseAdmin);
    const templateAdminService = new TemplateAdminService(supabaseAdmin);

    const service = new MusicGenerationService({
      supabase: supabaseAdmin,
      provider,
      creditService,
      templateService,
      templateAdminService,
    });

    // Call generateBatch
    const result = await service.generateBatch(user.id, userTier, {
      templateId: body.templateId,
      userPrompt: body.userPrompt,
      generationType: body.generationType,
      usePremiumSinger: body.usePremiumSinger,
      images: body.images,
      instrumentalOnly: body.instrumentalOnly,
      voiceGender: body.voiceGender,
      customLyrics: body.customLyrics,
    }, body.versionCount || 1);

    const response: GenerateBatchResponse = {
      batchId: result.batchId,
      versions: result.versions,
      totalCreditsConsumed: result.totalCreditsConsumed,
    };

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('generate-batch error:', error);
    const message = error?.message || '批量生成失败，请重试';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
