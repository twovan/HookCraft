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
import { readStudioTabSettings } from '@/lib/studio/StudioTabSettingsStore';
import { SensitivityFilterService } from '@/lib/sensitivity/SensitivityFilterService';
import { SensitivityLogService } from '@/lib/sensitivity/SensitivityLogService';
import { persistCompletedCoverTracks } from '@/app/api/kie/upload-cover/persist-tracks';
import type { CreditOperationType } from '@/types/credits';
import type { KieSunoModel } from '@/types/kie';
import type { DetectedWord, SensitivityCheckResult } from '@/types/sensitivity';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const DEFAULT_MODEL: KieSunoModel = 'V5_5';
const MODELS: KieSunoModel[] = ['V5_5', 'V5', 'V4_5PLUS', 'V4_5', 'V4'];
const SIMPLE_GENERATE_OPERATIONS: CreditOperationType[] = ['cover_generation'];

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function hasPlayableTrack(tracks: Array<{ audioUrl?: string; streamAudioUrl?: string }>) {
  return tracks.some((track) => track.audioUrl || track.streamAudioUrl);
}

function determineDetectionSource(
  detectedWords: DetectedWord[]
): 'local' | 'gemini' | 'both' {
  if (detectedWords.length === 0) return 'local';

  const hasLocal = detectedWords.some((word) => word.source === 'local');
  const hasGemini = detectedWords.some((word) => word.source === 'gemini');

  if (hasLocal && hasGemini) return 'both';
  return hasGemini ? 'gemini' : 'local';
}

async function checkSimplePromptSafety(input: {
  userId: string;
  prompt: string;
}): Promise<
  | { ok: true }
  | {
      ok: false;
      status: number;
      body: Record<string, unknown>;
    }
> {
  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (!geminiApiKey || geminiApiKey === 'your_api_key_here') {
    return {
      ok: false,
      status: 500,
      body: { error: '内容安全服务配置异常，请稍后重试' },
    };
  }

  const filterService = new SensitivityFilterService({
    supabase: supabaseAdmin,
    geminiApiKey,
  });
  const result: SensitivityCheckResult = await filterService.check({
    description: input.prompt,
  });

  const detectedWords: DetectedWord[] = [
    ...(result.descriptionResult?.detectedWords ?? []),
    ...(result.lyricsResult?.detectedWords ?? []),
  ];

  new SensitivityLogService(supabaseAdmin).log({
    userId: input.userId,
    inputDescription: input.prompt,
    resultType: result.resultType,
    detectedWords,
    rewrittenPrompt: result.rewrittenPrompt ?? undefined,
    styleTags: result.styleTags ?? undefined,
    detectionSource: determineDetectionSource(detectedWords),
    durationMs: result.durationMs,
  }).catch((error) => {
    console.error('[kie/simple-generate] Sensitivity log failed:', error);
  });

  if (result.resultType === 'block') {
    return {
      ok: false,
      status: 400,
      body: {
        error: '内容安全检查未通过，请修改描述后重试',
        code: 'sensitivity_blocked',
        blockedWords: result.blockedWords,
      },
    };
  }

  if (result.resultType === 'rewrite') {
    return {
      ok: false,
      status: 409,
      body: {
        error: '内容需要改写后确认，请使用改写后的描述重试',
        code: 'sensitivity_rewrite_required',
        rewrittenPrompt: result.rewrittenPrompt,
        rewrittenPromptCn: result.rewrittenPromptCn,
        styleTags: result.styleTags,
        styleTagsCn: result.styleTagsCn,
      },
    };
  }

  return { ok: true };
}

async function markSimpleGenerationFailed(input: {
  userId: string;
  localTaskId: string;
  batchId: string;
  errorCode: string;
  errorMessage: string;
  creditsConsumed?: number;
}): Promise<{ ok: true } | { ok: false; error: unknown }> {
  const taskResult = await supabaseAdmin.from('generation_tasks').update({
    status: 'failed',
    error_code: input.errorCode,
    error_message: input.errorMessage,
    credits_consumed: input.creditsConsumed ?? 0,
    updated_at: new Date().toISOString(),
  } as any).eq('id', input.localTaskId).eq('user_id', input.userId);

  const batchResult = await supabaseAdmin.from('generation_batches').update({
    status: 'failed',
    updated_at: new Date().toISOString(),
  } as any).eq('id', input.batchId).eq('user_id', input.userId);

  if (taskResult.error || batchResult.error) {
    return { ok: false, error: taskResult.error || batchResult.error };
  }

  return { ok: true };
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

    const studioTabSettings = await readStudioTabSettings(supabaseAdmin);
    if (!studioTabSettings.visibleTabs.includes('simple')) {
      return NextResponse.json({ error: '简单模式暂未开放' }, { status: 403 });
    }

    if (!prompt) {
      return NextResponse.json({ error: '请输入生成描述' }, { status: 400 });
    }

    if (prompt.length > 500) {
      return NextResponse.json({ error: '生成描述不能超过 500 个字符' }, { status: 400 });
    }

    const safetyResult = await checkSimplePromptSafety({ userId: user.id, prompt });
    if (!safetyResult.ok) {
      return NextResponse.json(safetyResult.body, { status: safetyResult.status });
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
    const provider = new KieSunoProvider();
    let result;
    try {
      result = await provider.generateMusic({
        prompt,
        instrumental,
        model,
        callBackUrl,
      });
    } catch (error: any) {
      const rawMessage = error?.message || '简单模式生成任务创建失败';
      const errorMessage = getKieUserFacingErrorMessage(rawMessage) || rawMessage;
      const providerCreditsInsufficient = isKieProviderCreditsInsufficient(rawMessage);

      const markResult = await markSimpleGenerationFailed({
        userId: user.id,
        localTaskId,
        batchId,
        errorCode: providerCreditsInsufficient
          ? 'KIE_PROVIDER_CREDITS_INSUFFICIENT'
          : 'KIE_SIMPLE_GENERATE_FAILED',
        errorMessage,
      });
      if (!markResult.ok) {
        console.error('[kie/simple-generate] Mark provider failure failed:', markResult.error);
        return NextResponse.json({ error: '记录任务失败状态失败，请联系管理员处理' }, { status: 500 });
      }

      return NextResponse.json({ error: errorMessage }, { status: providerCreditsInsufficient ? 503 : 500 });
    }

    const { error: providerLinkError } = await supabaseAdmin.from('generation_tasks').update({
      raw_audio_path: `kie:${result.taskId}`,
      updated_at: new Date().toISOString(),
    } as any).eq('id', localTaskId).eq('user_id', user.id);

    if (providerLinkError) {
      console.error('[kie/simple-generate] Provider task link update failed:', providerLinkError);
      const markResult = await markSimpleGenerationFailed({
        userId: user.id,
        localTaskId,
        batchId,
        errorCode: 'CREDITS_NOT_ENOUGH',
        errorMessage: '记录生成服务任务失败，请稍后重试',
      });
      if (!markResult.ok) {
        console.error('[kie/simple-generate] Mark provider link failure failed:', markResult.error);
      }
      return NextResponse.json({ error: '记录生成服务任务失败，请稍后重试' }, { status: 500 });
    }

    let consumeResult;
    try {
      consumeResult = await creditService.consumeCredits(user.id, SIMPLE_GENERATE_OPERATIONS);
    } catch (error: any) {
      const errorMessage = getConsumeCreditsErrorMessage(undefined as any);
      console.error('[kie/simple-generate] Credits consume threw:', error);

      const markResult = await markSimpleGenerationFailed({
        userId: user.id,
        localTaskId,
        batchId,
        errorCode: 'CREDITS_NOT_ENOUGH',
        errorMessage,
      });
      if (!markResult.ok) {
        console.error('[kie/simple-generate] Mark credits thrown failure failed:', markResult.error);
        return NextResponse.json({ error: '记录任务失败状态失败，请联系管理员处理' }, { status: 500 });
      }

      return NextResponse.json({ error: errorMessage }, { status: 402 });
    }

    if (!consumeResult.success) {
      const errorMessage = getConsumeCreditsErrorMessage(consumeResult.error);

      const markResult = await markSimpleGenerationFailed({
        userId: user.id,
        localTaskId,
        batchId,
        errorCode: 'CREDITS_NOT_ENOUGH',
        errorMessage,
      });
      if (!markResult.ok) {
        console.error('[kie/simple-generate] Mark credits returned failure failed:', markResult.error);
        return NextResponse.json({ error: '记录任务失败状态失败，请联系管理员处理' }, { status: 500 });
      }

      return NextResponse.json({ error: errorMessage, code: consumeResult.error }, { status: 402 });
    }

    const { error: finalUpdateError } = await supabaseAdmin.from('generation_tasks').update({
      credits_consumed: consumeResult.consumed,
      updated_at: new Date().toISOString(),
    } as any).eq('id', localTaskId).eq('user_id', user.id);

    if (finalUpdateError) {
      const accountingErrorMessage = 'Credits 已扣减，但任务状态更新失败，请联系管理员处理';
      console.error('[kie/simple-generate] Final task update failed:', finalUpdateError);
      const markResult = await markSimpleGenerationFailed({
        userId: user.id,
        localTaskId,
        batchId,
        errorCode: 'CREDITS_NOT_ENOUGH',
        errorMessage: accountingErrorMessage,
        creditsConsumed: consumeResult.consumed,
      });
      if (!markResult.ok) {
        console.error('[kie/simple-generate] Mark final update failure failed:', markResult.error);
      }
      return NextResponse.json({ error: accountingErrorMessage }, { status: 500 });
    }

    try {
      const details = await provider.getTaskDetails(result.taskId);
      if (details.status === 'SUCCESS' && hasPlayableTrack(details.tracks)) {
        await persistCompletedCoverTracks({
          localTaskId,
          userId: user.id,
          tracks: details.tracks,
        });
      }
    } catch (error) {
      console.warn('[kie/simple-generate] Replay completed provider result failed:', error);
    }

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
