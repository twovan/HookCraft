import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '../../../../lib/supabase/auth-helpers';
import { supabaseAdmin } from '../../../../lib/supabase/server';
import { KieSunoProvider } from '../../../../lib/generation/KieSunoProvider';
import { CreditService } from '../../../../lib/credits/CreditService';
import { getConsumeCreditsErrorMessage } from '../../../../lib/credits/consumeError';
import type { KieSunoModel } from '../../../../types/kie';
import type { CreditOperationType } from '../../../../types/credits';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const ALLOWED_TYPES = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/wave'];
const ALLOWED_EXTENSIONS = ['mp3', 'wav'];
const MAX_FILE_SIZE = 100 * 1024 * 1024;
const DEFAULT_MODEL: KieSunoModel = 'V5_5';
const MODELS: KieSunoModel[] = ['V5_5', 'V5', 'V4_5PLUS', 'V4_5', 'V4'];
const TEMP_BYPASS_GENERATION_CREDITS = true;

function parseBoolean(value: FormDataEntryValue | null, fallback = false): boolean {
  if (value === null) return fallback;
  return String(value) === 'true';
}

function parseNumber(value: FormDataEntryValue | null, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(1, Math.max(0, Math.round(parsed * 100) / 100));
}

function validateText(value: string, label: string, max: number): string | null {
  if (value.length > max) return `${label}不能超过 ${max} 个字符`;
  return null;
}

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function buildPromptSummary(input: {
  customMode: boolean;
  instrumental: boolean;
  title: string;
  style: string;
  prompt: string;
}): string {
  if (!input.customMode) return input.prompt;

  return [
    input.title ? `标题：${input.title}` : '',
    input.style ? `风格：${input.style}` : '',
    input.prompt ? `${input.instrumental ? '创作描述' : '歌词'}：${input.prompt}` : '',
  ].filter(Boolean).join('\n');
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: '未登录，请先登录' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const prompt = String(formData.get('prompt') || '').trim();
    const style = String(formData.get('style') || '').trim();
    const title = String(formData.get('title') || '').trim();
    const negativeTags = String(formData.get('negativeTags') || '').trim();
    const vocalGenderRaw = String(formData.get('vocalGender') || '').trim();
    const customMode = parseBoolean(formData.get('customMode'), true);
    const instrumental = parseBoolean(formData.get('instrumental'), false);
    const modelRaw = String(formData.get('model') || DEFAULT_MODEL);
    const model = (MODELS.includes(modelRaw as KieSunoModel) ? modelRaw : DEFAULT_MODEL) as KieSunoModel;

    if (!file) {
      return NextResponse.json({ error: '请先上传参考音频' }, { status: 400 });
    }

    const extension = file.name.split('.').pop()?.toLowerCase() || '';
    const hasAllowedMime = !file.type || file.type === 'application/octet-stream' || ALLOWED_TYPES.includes(file.type);
    const hasAllowedExtension = ALLOWED_EXTENSIONS.includes(extension);
    if (!hasAllowedMime || !hasAllowedExtension) {
      return NextResponse.json({ error: '仅支持 MP3/WAV 音频文件' }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: '音频文件不能超过 100MB' }, { status: 400 });
    }

    if (customMode) {
      if (!style) return NextResponse.json({ error: '自定义模式下请填写风格' }, { status: 400 });
      if (!title) return NextResponse.json({ error: '自定义模式下请填写标题' }, { status: 400 });
      if (!instrumental && !prompt) {
        return NextResponse.json({ error: '非纯音乐模式下请填写歌词' }, { status: 400 });
      }
    } else if (!prompt) {
      return NextResponse.json({ error: '快捷模式下请填写生成描述' }, { status: 400 });
    }

    const maxPromptLength = customMode ? 5000 : 500;
    const textError =
      validateText(prompt, customMode ? (instrumental ? '创作描述' : '歌词') : '生成描述', maxPromptLength) ||
      validateText(style, '风格', 1000) ||
      validateText(title, '标题', model === 'V4' ? 80 : 100) ||
      validateText(negativeTags, '排除标签', 500);

    if (textError) {
      return NextResponse.json({ error: textError }, { status: 400 });
    }

    const creditOperations: CreditOperationType[] = ['cover_generation'];
    const creditService = TEMP_BYPASS_GENERATION_CREDITS ? null : new CreditService(supabaseAdmin);
    let creditsConsumed = 0;
    if (creditService && !(await creditService.hasEnoughCredits(user.id, creditOperations))) {
      return NextResponse.json({ error: 'Credits 余额不足，请先充值或升级套餐' }, { status: 402 });
    }

    const provider = new KieSunoProvider();
    const uploadUrl = await provider.uploadAudioFile(file, user.id);
    const batchId = createId('kie-batch');
    const localTaskId = createId('kie-task');
    const promptSummary = buildPromptSummary({ customMode, instrumental, title, style, prompt });

    const { error: batchError } = await supabaseAdmin
      .from('generation_batches')
      .insert({
        id: batchId,
        user_id: user.id,
        template_id: null,
        prompt: promptSummary,
        title,
        generation_type: 'full_demo',
        use_premium_singer: false,
        version_count: 1,
        status: 'generating',
      } as any);

    if (batchError) {
      console.error('[kie/upload-cover] Create batch failed:', batchError);
      return NextResponse.json({ error: '创建创作记录失败，请稍后重试' }, { status: 500 });
    }

    const { error: taskError } = await supabaseAdmin
      .from('generation_tasks')
      .insert({
        id: localTaskId,
        user_id: user.id,
        generation_type: 'full_demo',
        status: 'generating',
        prompt: promptSummary,
        title,
        template_id: null,
        model_id: 'kie-suno-v5_5',
        audio_path: null,
        raw_audio_path: uploadUrl,
        lyrics: customMode && !instrumental ? prompt : null,
        song_structure: null,
        credits_consumed: 0,
        batch_id: batchId,
        version_number: 1,
        duration_seconds: null,
      } as any);

    if (taskError) {
      console.error('[kie/upload-cover] Create task failed:', taskError);
      await supabaseAdmin.from('generation_batches').delete().eq('id', batchId).eq('user_id', user.id);
      return NextResponse.json({ error: '创建创作任务失败，请稍后重试' }, { status: 500 });
    }

    const callBackUrl = `${req.nextUrl.origin}/api/kie/upload-cover/callback?localTaskId=${encodeURIComponent(localTaskId)}`;
    let result;
    try {
      result = await provider.uploadAndCover({
        uploadUrl,
        prompt,
        customMode,
        instrumental,
        model,
        style,
        title,
        negativeTags,
        vocalGender: vocalGenderRaw === 'm' || vocalGenderRaw === 'f' ? vocalGenderRaw : undefined,
        styleWeight: parseNumber(formData.get('styleWeight'), 0.65),
        weirdnessConstraint: parseNumber(formData.get('weirdnessConstraint'), 0.5),
        audioWeight: parseNumber(formData.get('audioWeight'), 0.65),
        callBackUrl,
      });
    } catch (error: any) {
      await supabaseAdmin
        .from('generation_tasks')
        .update({
          status: 'failed',
          error_code: 'KIE_CREATE_TASK_FAILED',
          error_message: error?.message || '高级编曲任务创建失败',
          credits_consumed: 0,
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', localTaskId)
        .eq('user_id', user.id);

      await supabaseAdmin
        .from('generation_batches')
        .update({
          status: 'failed',
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', batchId)
        .eq('user_id', user.id);

      throw error;
    }

    if (creditService) {
      const consumeResult = await creditService.consumeCredits(user.id, creditOperations);
      if (!consumeResult.success) {
        const errorMessage = getConsumeCreditsErrorMessage(consumeResult.error);
        console.error('[kie/upload-cover] Credits consume failed:', {
          userId: user.id,
          operations: creditOperations,
          error: consumeResult.error,
          remaining: consumeResult.remaining,
        });

        await supabaseAdmin
          .from('generation_tasks')
          .update({
            status: 'failed',
            error_code: 'CREDITS_NOT_ENOUGH',
            error_message: errorMessage,
            credits_consumed: 0,
            updated_at: new Date().toISOString(),
          } as any)
          .eq('id', localTaskId)
          .eq('user_id', user.id);

        await supabaseAdmin
          .from('generation_batches')
          .update({ status: 'failed', updated_at: new Date().toISOString() } as any)
          .eq('id', batchId)
          .eq('user_id', user.id);

        return NextResponse.json({ error: errorMessage, code: consumeResult.error }, { status: 402 });
      }
      creditsConsumed = consumeResult.consumed;
    }

    await supabaseAdmin
      .from('generation_tasks')
      .update({
        raw_audio_path: `kie:${result.taskId}`,
        credits_consumed: creditsConsumed,
        updated_at: new Date().toISOString(),
      } as any)
      .eq('id', localTaskId)
      .eq('user_id', user.id);

    return NextResponse.json({
      ...result,
      localTaskId,
      batchId,
      creationUrl: `/account/creations?expand=${encodeURIComponent(batchId)}`,
    });
  } catch (error: any) {
    console.error('[kie/upload-cover] Error:', error);
    return NextResponse.json(
      { error: error?.message || '高级编曲任务创建失败，请稍后重试' },
      { status: 500 }
    );
  }
}
