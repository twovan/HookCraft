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
const DEFAULT_NEGATIVE_TAGS = 'low quality, distorted, clipping, harsh noise, off-key, messy arrangement';

function parseNumber(value: FormDataEntryValue | null, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(1, Math.max(0, Math.round(parsed * 100) / 100));
}

function validateText(value: string, label: string, max: number): string | null {
  if (value.length > max) return `${label} cannot exceed ${max} characters`;
  return null;
}

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function buildPromptSummary(input: {
  title: string;
  tags: string;
  negativeTags: string;
}): string {
  return [
    input.title ? `Title: ${input.title}` : '',
    input.tags ? `Style tags: ${input.tags}` : '',
    input.negativeTags ? `Negative tags: ${input.negativeTags}` : '',
  ].filter(Boolean).join('\n');
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const title = String(formData.get('title') || '').trim();
    const tags = String(formData.get('tags') || '').trim();
    const negativeTags = String(formData.get('negativeTags') || '').trim() || DEFAULT_NEGATIVE_TAGS;
    const templateId = String(formData.get('templateId') || '').trim() || null;
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

    if (!title) {
      return NextResponse.json({ error: '请填写歌曲名称' }, { status: 400 });
    }

    if (!tags) {
      return NextResponse.json({ error: '当前模板缺少风格标签，请先在后台完成模板分析' }, { status: 400 });
    }

    const textError =
      validateText(title, '歌曲名称', model === 'V4' ? 80 : 100) ||
      validateText(tags, '风格标签', 1000) ||
      validateText(negativeTags, '排除标签', 500);

    if (textError) {
      return NextResponse.json({ error: textError }, { status: 400 });
    }

    const creditOperations: CreditOperationType[] = ['add_instrumental'];
    const creditService = new CreditService(supabaseAdmin);
    let creditsConsumed = 0;
    if (!(await creditService.hasEnoughCredits(user.id, creditOperations))) {
      return NextResponse.json({ error: 'Credits 余额不足，请先充值或升级套餐' }, { status: 402 });
    }

    const provider = new KieSunoProvider();
    const uploadUrl = await provider.uploadAudioFile(file, user.id);
    const batchId = createId('kie-batch');
    const localTaskId = createId('kie-task');
    const promptSummary = buildPromptSummary({ title, tags, negativeTags });

    const { error: batchError } = await supabaseAdmin
      .from('generation_batches')
      .insert({
        id: batchId,
        user_id: user.id,
        template_id: templateId,
        prompt: promptSummary,
        title,
        generation_type: 'full_demo',
        use_premium_singer: false,
        version_count: 1,
        status: 'generating',
      } as any);

    if (batchError) {
      console.error('[kie/add-instrumental] Create batch failed:', batchError);
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
        template_id: templateId,
        model_id: 'kie-suno-add-instrumental-v5_5',
        audio_path: null,
        raw_audio_path: uploadUrl,
        lyrics: null,
        song_structure: null,
        credits_consumed: 0,
        batch_id: batchId,
        version_number: 1,
        duration_seconds: null,
      } as any);

    if (taskError) {
      console.error('[kie/add-instrumental] Create task failed:', taskError);
      await supabaseAdmin.from('generation_batches').delete().eq('id', batchId).eq('user_id', user.id);
      return NextResponse.json({ error: '创建创作任务失败，请稍后重试' }, { status: 500 });
    }

    const callBackUrl = `${req.nextUrl.origin}/api/kie/upload-cover/callback?localTaskId=${encodeURIComponent(localTaskId)}`;
    let result;
    try {
      result = await provider.addInstrumental({
        uploadUrl,
        title,
        tags,
        model,
        negativeTags,
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
          error_code: 'KIE_ADD_INSTRUMENTAL_FAILED',
          error_message: error?.message || 'Add-instrumental task failed',
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

    const consumeResult = await creditService.consumeCredits(user.id, creditOperations);
    if (!consumeResult.success) {
      const errorMessage = getConsumeCreditsErrorMessage(consumeResult.error);
      console.error('[kie/add-instrumental] Credits consume failed:', {
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
    console.error('[kie/add-instrumental] Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Add-instrumental task failed, please try again later' },
      { status: 500 }
    );
  }
}
