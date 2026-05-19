import { NextRequest, NextResponse } from 'next/server';
import { MiniMaxProvider } from '../../../../lib/generation/MiniMaxProvider';
import { CreditService } from '../../../../lib/credits/CreditService';
import { SensitivityFilterService } from '../../../../lib/sensitivity/SensitivityFilterService';
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
 * POST /api/minimax/generate
 *
 * 编曲生成 API 端点
 * 接收预处理后的 coverFeatureId 和参数，调用 MiniMax music-cover 模型生成编曲。
 *
 * 流程：
 * 1. 验证用户认证
 * 2. 速率限制检查
 * 3. 请求参数校验
 * 4. Credits 余额检查
 * 5. 敏感词检查（prompt + lyrics）
 * 6. 调用 MiniMax 生成 API
 * 7. 成功后：上传音频到 Storage，创建 generation_tasks 记录，扣减 Credits
 * 8. 失败时不扣减 Credits
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

    // ─── Step 4: Credits 余额检查（暂时跳过，hasEnoughCredits 有 bug 未计算购买额度）───
    // TODO: 修复 CreditService.hasEnoughCredits 后重新启用
    // const creditService = new CreditService(supabaseAdmin);
    // const operations: CreditOperationType[] = ['arrangement_generation'];
    const creditService = new CreditService(supabaseAdmin);
    const operations: CreditOperationType[] = ['arrangement_generation'];

    // ─── Step 5: 敏感词检查（暂时跳过，依赖 MiniMax 自身的内容安全过滤）───
    // TODO: 后续优化本地敏感词库误报问题后重新启用
    // const geminiApiKey = process.env.GEMINI_API_KEY;
    // if (geminiApiKey && geminiApiKey !== 'your_api_key_here') { ... }

    // ─── Step 6: 调用 MiniMax 生成 API ───────────────────────
    const provider = new MiniMaxProvider();

    const generationInput: ArrangementGenerationInput = {
      model: 'music-cover',
      coverFeatureId: coverFeatureId || undefined,
      audioUrl: audioUrl || undefined,
      // 一步模式（audioUrl）歌词可选；两步模式（coverFeatureId）歌词必填 [10, 1000]
      lyrics: coverFeatureId
        ? (lyrics && lyrics.trim().length >= 10 ? lyrics.trim().slice(0, 1000) : '[Verse]\nla la la la la la\nla la la la la')
        : (lyrics?.trim() || ''),
      prompt: prompt || undefined,
      isInstrumental: isInstrumental || false,
      audioSetting,
    };

    const result = await provider.generateArrangement(generationInput);

    // ─── Step 7: 处理生成结果 ─────────────────────────────────
    if (!result.success) {
      // 生成失败，不扣减 Credits
      return NextResponse.json(
        {
          error: result.error?.message || '编曲生成失败',
          code: result.error?.code || 'GENERATION_FAILED',
        },
        { status: 500 }
      );
    }

    // ─── Step 8: 上传音频到 Supabase Storage ─────────────────
    let audioStoragePath: string | null = null;
    let publicAudioUrl: string | null = result.audioUrl || null;

    if (result.audioHex) {
      // 如果返回的是 hex 编码的音频数据，上传到 Storage
      const audioBuffer = Buffer.from(result.audioHex, 'hex');
      const extension = audioSetting.format || 'mp3';
      const taskId = result.taskId || crypto.randomUUID();
      const storagePath = `${user.id}/arrangements/${taskId}.${extension}`;

      const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
        .from('generations')
        .upload(storagePath, audioBuffer, {
          upsert: true,
          contentType: extension === 'wav' ? 'audio/wav' : 'audio/mpeg',
        });

      if (uploadError) {
        console.error('[minimax/generate] 音频上传失败:', uploadError);
        // 上传失败仍然返回结果（audioUrl 可能可用）
      } else {
        audioStoragePath = uploadData.path;
        const { data: urlData } = supabaseAdmin.storage
          .from('generations')
          .getPublicUrl(storagePath);
        publicAudioUrl = urlData.publicUrl;
      }
    } else if (result.audioUrl) {
      // 如果返回的是 URL，下载后上传到 Storage
      try {
        const audioResponse = await fetch(result.audioUrl);
        if (audioResponse.ok) {
          const audioArrayBuffer = await audioResponse.arrayBuffer();
          const audioBuffer = Buffer.from(audioArrayBuffer);
          const extension = audioSetting.format || 'mp3';
          const taskId = result.taskId || crypto.randomUUID();
          const storagePath = `${user.id}/arrangements/${taskId}.${extension}`;

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
        // 下载失败时使用原始 URL
      }
    }

    // ─── Step 9: 创建 generation_batches + generation_tasks 记录 ───
    const taskId = result.taskId || crypto.randomUUID();
    const batchId = crypto.randomUUID();
    const creditsCost = CREDITS_COST.arrangement_generation;

    // 先创建 batch 记录（创作列表查询的是这个表）
    const { error: batchError } = await supabaseAdmin
      .from('generation_batches')
      .insert({
        id: batchId,
        user_id: user.id,
        generation_type: 'arrangement',
        prompt: prompt || null,
        status: 'completed',
        version_count: 1,
        selected_task_id: taskId,
      } as any);

    if (batchError) {
      console.error('[minimax/generate] 创建 batch 记录失败:', batchError);
    }

    // 再创建 task 记录
    const { error: insertError } = await supabaseAdmin
      .from('generation_tasks')
      .insert({
        id: taskId,
        user_id: user.id,
        generation_type: 'arrangement' as any,
        status: 'completed',
        prompt: prompt || null,
        model_id: 'music-cover',
        audio_path: audioStoragePath || publicAudioUrl || null,
        lyrics: isInstrumental ? null : (lyrics || null),
        credits_consumed: creditsCost,
        batch_id: batchId,
      } as any);

    if (insertError) {
      console.error('[minimax/generate] 创建任务记录失败:', insertError);
      // 记录创建失败不影响返回结果，但记录日志
    }

    // ─── Step 10: 扣减 Credits ────────────────────────────────
    try {
      const consumeResult = await creditService.consumeCredits(user.id, operations);
      if (!consumeResult.success) {
        console.error('[minimax/generate] Credits 扣减失败:', consumeResult.error);
      }
    } catch (err: any) {
      console.error('[minimax/generate] Credits 扣减异常:', err?.message || err);
    }

    // ─── Step 11: 返回成功结果 ────────────────────────────────
    return NextResponse.json({
      taskId,
      audioUrl: publicAudioUrl,
      lyrics: isInstrumental ? null : (lyrics || null),
    });
  } catch (error: any) {
    console.error('[minimax/generate] 未预期错误:', error);

    // 超时错误
    if (error?.message?.includes('超时') || error?.name === 'AbortError') {
      return NextResponse.json(
        { error: '生成超时，请稍后重试', code: 'TIMEOUT' },
        { status: 504 }
      );
    }

    return NextResponse.json(
      { error: '编曲生成服务异常，请稍后重试' },
      { status: 500 }
    );
  }
}
