import { NextRequest, NextResponse } from 'next/server';
import { MiniMaxProvider } from '../../../../lib/generation/MiniMaxProvider';
import { CreditService } from '../../../../lib/credits/CreditService';
import { supabaseAdmin } from '../../../../lib/supabase/server';
import { getAuthUser } from '../../../../lib/supabase/auth-helpers';
import { CREDITS_COST } from '../../../../config/creditsCost';
import type { ArrangementGenerationInput, AudioSetting } from '../../../../types/arrangement';
import type { CreditOperationType } from '../../../../types/credits';

// Vercel serverless 超时设置（Pro 版支持最长 300 秒）
export const maxDuration = 300;

// ─── 用户级速率限制（内存实现） ─────────────────────────────
const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 分钟
const RATE_LIMIT_MAX_REQUESTS = 10;  // 每用户每分钟最多 10 次

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const timestamps = rateLimitMap.get(userId) || [];

  // 清除过期的时间戳
  const validTimestamps = timestamps.filter(
    (ts) => now - ts < RATE_LIMIT_WINDOW_MS
  );

  if (validTimestamps.length >= RATE_LIMIT_MAX_REQUESTS) {
    rateLimitMap.set(userId, validTimestamps);
    return false; // 超限
  }

  validTimestamps.push(now);
  rateLimitMap.set(userId, validTimestamps);
  return true; // 未超限
}

// ─── 请求体类型 ─────────────────────────────────────────────
interface GenerateRequestBody {
  coverFeatureId?: string;
  audioUrl?: string;  // 一步模式：直接传音频 URL
  lyrics?: string;
  prompt?: string;
  isInstrumental?: boolean;
  audioSetting: AudioSetting;
}

/**
 * 后台处理 MiniMax 生成任务
 * 在返回 taskId 给前端后异步执行，前端通过 /api/minimax/generate/status 轮询结果
 */
async function processGenerationInBackground(
  taskId: string,
  batchId: string,
  userId: string,
  generationInput: ArrangementGenerationInput,
  audioSetting: AudioSetting,
  lyrics: string | undefined,
  isInstrumental: boolean,
) {
  const provider = new MiniMaxProvider();

  try {
    // 更新状态为 generating
    await supabaseAdmin
      .from('generation_tasks')
      .update({ status: 'generating', updated_at: new Date().toISOString() } as any)
      .eq('id', taskId);

    const result = await provider.generateArrangement(generationInput);

    if (!result.success) {
      // 生成失败，更新状态
      await supabaseAdmin
        .from('generation_tasks')
        .update({
          status: 'failed',
          error_code: result.error?.code || 'GENERATION_FAILED',
          error_message: result.error?.message || '编曲生成失败',
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', taskId);

      await supabaseAdmin
        .from('generation_batches')
        .update({ status: 'failed' } as any)
        .eq('id', batchId);

      return;
    }

    // ─── 上传音频到 Supabase Storage ─────────────────
    let audioStoragePath: string | null = null;
    let publicAudioUrl: string | null = result.audioUrl || null;

    if (result.audioHex) {
      const audioBuffer = Buffer.from(result.audioHex, 'hex');
      const extension = audioSetting.format || 'mp3';
      const storagePath = `${userId}/arrangements/${taskId}.${extension}`;

      const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
        .from('generations')
        .upload(storagePath, audioBuffer, {
          upsert: true,
          contentType: extension === 'wav' ? 'audio/wav' : 'audio/mpeg',
        });

      if (uploadError) {
        console.error('[minimax/generate] 音频上传失败:', uploadError);
      } else {
        audioStoragePath = uploadData.path;
        const { data: urlData } = supabaseAdmin.storage
          .from('generations')
          .getPublicUrl(storagePath);
        publicAudioUrl = urlData.publicUrl;
      }
    } else if (result.audioUrl) {
      try {
        const audioResponse = await fetch(result.audioUrl);
        if (audioResponse.ok) {
          const audioArrayBuffer = await audioResponse.arrayBuffer();
          const audioBuffer = Buffer.from(audioArrayBuffer);
          const extension = audioSetting.format || 'mp3';
          const storagePath = `${userId}/arrangements/${taskId}.${extension}`;

          const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
            .from('generations')
            .upload(storagePath, audioBuffer, {
              upsert: true,
              contentType: extension === 'wav' ? 'audio/wav' : 'audio/mpeg',
            });

          if (uploadError) {
            console.error('[minimax/generate] 音频上传失败:', uploadError);
          } else {
            audioStoragePath = uploadData.path;
            const { data: urlData } = supabaseAdmin.storage
              .from('generations')
              .getPublicUrl(storagePath);
            publicAudioUrl = urlData.publicUrl;
          }
        }
      } catch (downloadErr: any) {
        console.error('[minimax/generate] 音频下载失败:', downloadErr?.message);
      }
    }

    // ─── 更新 task 和 batch 为 completed ─────────────────
    const creditsCost = CREDITS_COST.arrangement_generation;

    await supabaseAdmin
      .from('generation_tasks')
      .update({
        status: 'completed',
        audio_path: audioStoragePath || publicAudioUrl || null,
        lyrics: isInstrumental ? null : (lyrics || null),
        credits_consumed: creditsCost,
        updated_at: new Date().toISOString(),
      } as any)
      .eq('id', taskId);

    await supabaseAdmin
      .from('generation_batches')
      .update({ status: 'completed', selected_task_id: taskId } as any)
      .eq('id', batchId);

    // ─── 扣减 Credits ────────────────────────────────
    try {
      const creditService = new CreditService(supabaseAdmin);
      const operations: CreditOperationType[] = ['arrangement_generation'];
      const consumeResult = await creditService.consumeCredits(userId, operations);
      if (!consumeResult.success) {
        console.error('[minimax/generate] Credits 扣减失败:', consumeResult.error);
      }
    } catch (err: any) {
      console.error('[minimax/generate] Credits 扣减异常:', err?.message || err);
    }
  } catch (error: any) {
    console.error('[minimax/generate] 后台处理异常:', error);

    // 更新任务状态为失败
    await supabaseAdmin
      .from('generation_tasks')
      .update({
        status: 'failed',
        error_code: 'PROCESSING_ERROR',
        error_message: error?.message || '编曲生成服务异常',
        updated_at: new Date().toISOString(),
      } as any)
      .eq('id', taskId);

    await supabaseAdmin
      .from('generation_batches')
      .update({ status: 'failed' } as any)
      .eq('id', batchId);
  }
}

/**
 * POST /api/minimax/generate
 *
 * 编曲生成 API 端点（异步模式）
 * 
 * 流程：
 * 1. 验证用户认证 + 速率限制
 * 2. 请求参数校验
 * 3. 立即创建 generation_batches + generation_tasks 记录（status='pending'）
 * 4. 返回 taskId 给前端（快速响应，避免 Vercel 超时）
 * 5. 在后台继续执行 MiniMax 生成、上传、扣费
 * 6. 前端通过 /api/minimax/generate/status?taskId=xxx 轮询结果
 */
export async function POST(req: NextRequest) {
  try {
    // ─── Step 1: 认证检查 ─────────────────────────────────────
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json(
        { error: '未登录，请先登录' },
        { status: 401 }
      );
    }

    // ─── Step 2: 速率限制 ─────────────────────────────────────
    if (!checkRateLimit(user.id)) {
      return NextResponse.json(
        { error: '请求过于频繁，请稍后再试（每分钟最多 10 次）' },
        { status: 429 }
      );
    }

    // ─── Step 3: 解析并校验请求体 ─────────────────────────────
    const body: GenerateRequestBody = await req.json();
    const {
      coverFeatureId,
      audioUrl,
      lyrics,
      prompt,
      isInstrumental = false,
      audioSetting,
    } = body;

    // 必须提供 coverFeatureId 或 audioUrl 其中之一
    if (!coverFeatureId && !audioUrl) {
      return NextResponse.json(
        { error: '缺少 coverFeatureId 或 audioUrl 参数' },
        { status: 400 }
      );
    }

    if (!audioSetting || !audioSetting.format || !audioSetting.sampleRate || !audioSetting.bitrate) {
      return NextResponse.json(
        { error: '缺少 audioSetting 参数' },
        { status: 400 }
      );
    }

    // 两步模式（有 coverFeatureId）时歌词必填，一步模式（有 audioUrl）歌词可选
    if (coverFeatureId && !isInstrumental && (!lyrics || lyrics.trim().length === 0)) {
      return NextResponse.json(
        { error: '自定义翻唱模式下歌词不能为空' },
        { status: 400 }
      );
    }

    // ─── Step 4: 构建生成输入 ─────────────────────────────────
    const generationInput: ArrangementGenerationInput = {
      model: 'music-cover',
      coverFeatureId: coverFeatureId || undefined,
      audioUrl: audioUrl || undefined,
      lyrics: coverFeatureId
        ? (lyrics && lyrics.trim().length >= 10 ? lyrics.trim().slice(0, 1000) : '[Verse]\nla la la la la la\nla la la la la')
        : (lyrics?.trim() || ''),
      prompt: prompt || undefined,
      isInstrumental: isInstrumental || false,
      audioSetting,
    };

    // ─── Step 5: 立即创建 task 记录（status='pending'）并返回 taskId ───
    const taskId = crypto.randomUUID();
    const batchId = crypto.randomUUID();

    // 创建 batch 记录
    const { error: batchError } = await supabaseAdmin
      .from('generation_batches')
      .insert({
        id: batchId,
        user_id: user.id,
        generation_type: 'arrangement',
        prompt: prompt || null,
        status: 'pending',
        version_count: 1,
      } as any);

    if (batchError) {
      console.error('[minimax/generate] 创建 batch 记录失败:', batchError);
      return NextResponse.json(
        { error: '创建任务失败，请重试' },
        { status: 500 }
      );
    }

    // 创建 task 记录
    const { error: insertError } = await supabaseAdmin
      .from('generation_tasks')
      .insert({
        id: taskId,
        user_id: user.id,
        generation_type: 'arrangement' as any,
        status: 'pending',
        prompt: prompt || null,
        model_id: 'music-cover',
        lyrics: isInstrumental ? null : (lyrics || null),
        credits_consumed: 0,
        batch_id: batchId,
      } as any);

    if (insertError) {
      console.error('[minimax/generate] 创建任务记录失败:', insertError);
      return NextResponse.json(
        { error: '创建任务失败，请重试' },
        { status: 500 }
      );
    }

    // ─── Step 6: 启动后台处理（fire-and-forget）─────────────────
    // 不 await，让函数在返回响应后继续执行
    // Vercel Serverless Functions 在响应发送后仍会继续执行直到超时
    processGenerationInBackground(
      taskId,
      batchId,
      user.id,
      generationInput,
      audioSetting,
      lyrics,
      isInstrumental,
    ).catch((err) => {
      console.error('[minimax/generate] 后台任务启动失败:', err);
    });

    // ─── Step 7: 立即返回 taskId ──────────────────────────────
    return NextResponse.json({
      taskId,
      status: 'pending',
      message: '任务已创建，正在生成中...',
    });
  } catch (error: any) {
    console.error('[minimax/generate] 未预期错误:', error);
    return NextResponse.json(
      { error: '编曲生成服务异常，请稍后重试' },
      { status: 500 }
    );
  }
}
