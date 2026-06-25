import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/supabase/auth-helpers';
import { supabaseAdmin } from '@/lib/supabase/server';
import { CreditService } from '@/lib/credits/CreditService';
import { getConsumeCreditsErrorMessage } from '@/lib/credits/consumeError';
import {
  getKieUserFacingErrorMessage,
  isKieProviderCreditsInsufficient,
  KieSunoProvider,
} from '@/lib/generation/KieSunoProvider';
import type { CreditOperationType } from '@/types/credits';
import type { KieSunoModel } from '@/types/kie';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const DEFAULT_MODEL: KieSunoModel = 'V5_5';
const MODELS: KieSunoModel[] = ['V5_5', 'V5', 'V4_5PLUS', 'V4_5', 'V4'];
const SIMPLE_GENERATE_OPERATIONS: CreditOperationType[] = ['cover_generation'];

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: '未登录，请先登录' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const prompt = String(body.prompt || '').trim();
    const instrumental = body.instrumental === true;
    const modelRaw = String(body.model || DEFAULT_MODEL);
    const model = (MODELS.includes(modelRaw as KieSunoModel) ? modelRaw : DEFAULT_MODEL) as KieSunoModel;

    if (!prompt) {
      return NextResponse.json({ error: '请输入生成描述' }, { status: 400 });
    }

    if (prompt.length > 500) {
      return NextResponse.json({ error: '生成描述不能超过 500 个字符' }, { status: 400 });
    }

    const creditService = new CreditService(supabaseAdmin);
    if (!(await creditService.hasEnoughCredits(user.id, SIMPLE_GENERATE_OPERATIONS))) {
      return NextResponse.json({ error: 'Credits 余额不足，请先充值或升级套餐' }, { status: 402 });
    }

    const batchId = createId('kie-simple-batch');
    const localTaskId = createId('kie-simple-task');
    const title = prompt.slice(0, 40);

    const { error: batchError } = await supabaseAdmin.from('generation_batches').insert({
      id: batchId,
      user_id: user.id,
      template_id: null,
      prompt,
      title,
      generation_type: 'full_demo',
      use_premium_singer: false,
      version_count: 1,
      status: 'generating',
    } as any);

    if (batchError) {
      console.error('[kie/simple-generate] Create batch failed:', batchError);
      return NextResponse.json({ error: '创建创作记录失败，请稍后重试' }, { status: 500 });
    }

    const { error: taskError } = await supabaseAdmin.from('generation_tasks').insert({
      id: localTaskId,
      user_id: user.id,
      generation_type: 'full_demo',
      status: 'generating',
      prompt,
      title,
      template_id: null,
      model_id: `kie-suno-${model.toLowerCase()}`,
      audio_path: null,
      raw_audio_path: null,
      lyrics: instrumental ? null : prompt,
      song_structure: null,
      credits_consumed: 0,
      batch_id: batchId,
      version_number: 1,
      duration_seconds: null,
    } as any);

    if (taskError) {
      console.error('[kie/simple-generate] Create task failed:', taskError);
      await supabaseAdmin.from('generation_batches').delete().eq('id', batchId).eq('user_id', user.id);
      return NextResponse.json({ error: '创建创作任务失败，请稍后重试' }, { status: 500 });
    }

    const callBackUrl = `${req.nextUrl.origin}/api/kie/upload-cover/callback?localTaskId=${encodeURIComponent(localTaskId)}`;
    let result;
    try {
      result = await new KieSunoProvider().generateMusic({
        prompt,
        instrumental,
        model,
        callBackUrl,
      });
    } catch (error: any) {
      const rawMessage = error?.message || '简单模式生成任务创建失败';
      const errorMessage = getKieUserFacingErrorMessage(rawMessage) || rawMessage;
      const providerCreditsInsufficient = isKieProviderCreditsInsufficient(rawMessage);

      await supabaseAdmin.from('generation_tasks').update({
        status: 'failed',
        error_code: providerCreditsInsufficient
          ? 'KIE_PROVIDER_CREDITS_INSUFFICIENT'
          : 'KIE_SIMPLE_GENERATE_FAILED',
        error_message: errorMessage,
        credits_consumed: 0,
        updated_at: new Date().toISOString(),
      } as any).eq('id', localTaskId).eq('user_id', user.id);

      await supabaseAdmin.from('generation_batches').update({
        status: 'failed',
        updated_at: new Date().toISOString(),
      } as any).eq('id', batchId).eq('user_id', user.id);

      return NextResponse.json({ error: errorMessage }, { status: providerCreditsInsufficient ? 503 : 500 });
    }

    const consumeResult = await creditService.consumeCredits(user.id, SIMPLE_GENERATE_OPERATIONS);
    if (!consumeResult.success) {
      const errorMessage = getConsumeCreditsErrorMessage(consumeResult.error);

      await supabaseAdmin.from('generation_tasks').update({
        status: 'failed',
        error_code: 'CREDITS_NOT_ENOUGH',
        error_message: errorMessage,
        credits_consumed: 0,
        updated_at: new Date().toISOString(),
      } as any).eq('id', localTaskId).eq('user_id', user.id);

      await supabaseAdmin.from('generation_batches').update({
        status: 'failed',
        updated_at: new Date().toISOString(),
      } as any).eq('id', batchId).eq('user_id', user.id);

      return NextResponse.json({ error: errorMessage, code: consumeResult.error }, { status: 402 });
    }

    await supabaseAdmin.from('generation_tasks').update({
      raw_audio_path: `kie:${result.taskId}`,
      credits_consumed: consumeResult.consumed,
      updated_at: new Date().toISOString(),
    } as any).eq('id', localTaskId).eq('user_id', user.id);

    return NextResponse.json({
      taskId: result.taskId,
      localTaskId,
      batchId,
      creationUrl: `/account/creations?expand=${encodeURIComponent(batchId)}`,
      statusUrl: `/api/kie/upload-cover/status?taskId=${encodeURIComponent(result.taskId)}&localTaskId=${encodeURIComponent(localTaskId)}`,
    });
  } catch (error: any) {
    console.error('[kie/simple-generate] Error:', error);
    return NextResponse.json(
      { error: getKieUserFacingErrorMessage(error?.message) || error?.message || '简单模式生成失败，请稍后重试' },
      { status: 500 }
    );
  }
}
