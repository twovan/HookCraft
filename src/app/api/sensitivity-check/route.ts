import { NextRequest, NextResponse } from 'next/server';
import { SensitivityFilterService } from '../../../lib/sensitivity/SensitivityFilterService';
import { SensitivityLogService } from '../../../lib/sensitivity/SensitivityLogService';
import { supabaseAdmin } from '../../../lib/supabase/server';
import { getAuthUser } from '../../../lib/supabase/auth-helpers';
import type { SensitivityCheckInput, DetectedWord } from '../../../types/sensitivity';

/**
 * POST /api/sensitivity-check
 *
 * 敏感词检测 API 端点
 * 接收创作描述和可选歌词，执行敏感词检测并返回结构化结果。
 *
 * 请求体：{ description: string, lyrics?: string }
 * 响应：{ passed, resultType, descriptionResult, lyricsResult, rewrittenPrompt, styleTags, blockedWords, durationMs }
 */
export async function POST(req: NextRequest) {
  try {
    // 1. 认证检查
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json(
        { error: '未登录，请先登录' },
        { status: 401 }
      );
    }

    // 2. 解析请求体
    const body = await req.json();
    const { description, lyrics } = body as { description?: string; lyrics?: string };

    // 3. 请求验证：description 必填
    if (!description || description.trim().length === 0) {
      return NextResponse.json(
        { error: '创作描述不能为空' },
        { status: 400 }
      );
    }

    // 4. 获取 Gemini API Key
    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey || geminiApiKey === 'your_api_key_here') {
      return NextResponse.json(
        { error: '服务配置异常，请稍后重试' },
        { status: 500 }
      );
    }

    // 5. 创建服务实例
    const filterService = new SensitivityFilterService({
      supabase: supabaseAdmin,
      geminiApiKey,
    });

    const logService = new SensitivityLogService(supabaseAdmin);

    // 6. 执行敏感词检测
    const input: SensitivityCheckInput = {
      description: description.trim(),
      lyrics: lyrics?.trim() || undefined,
    };

    const result = await filterService.check(input);

    // Debug logging for troubleshooting
    console.log('[sensitivity-check] Result:', JSON.stringify({
      resultType: result.resultType,
      hasRewrittenPrompt: !!result.rewrittenPrompt,
      styleTags: result.styleTags,
      durationMs: result.durationMs,
    }));

    // 7. 记录检测日志（异步，不阻塞响应）
    const allDetectedWords: DetectedWord[] = [
      ...(result.descriptionResult?.detectedWords ?? []),
      ...(result.lyricsResult?.detectedWords ?? []),
    ];

    const detectionSource = determineDetectionSource(allDetectedWords);

    logService.log({
      userId: user.id,
      inputDescription: input.description,
      inputLyrics: input.lyrics,
      resultType: result.resultType,
      detectedWords: allDetectedWords,
      rewrittenPrompt: result.rewrittenPrompt ?? undefined,
      styleTags: result.styleTags ?? undefined,
      detectionSource,
      durationMs: result.durationMs,
    }).catch((err) => {
      console.error('[sensitivity-check] 日志记录失败:', err);
    });

    // 8. 返回结构化 JSON 响应
    return NextResponse.json({
      passed: result.passed,
      resultType: result.resultType,
      descriptionResult: result.descriptionResult,
      lyricsResult: result.lyricsResult,
      rewrittenPrompt: result.rewrittenPrompt,
      styleTags: result.styleTags,
      blockedWords: result.blockedWords,
      durationMs: result.durationMs,
    });
  } catch (error: any) {
    console.error('[sensitivity-check] 检测异常:', error);
    return NextResponse.json(
      { error: '敏感词检测服务异常，请稍后重试' },
      { status: 500 }
    );
  }
}

/**
 * 根据检测到的敏感词来源确定 detectionSource
 */
function determineDetectionSource(
  detectedWords: DetectedWord[]
): 'local' | 'gemini' | 'both' {
  if (detectedWords.length === 0) {
    return 'local'; // 无命中时默认 local（本地检测通过）
  }

  const hasLocal = detectedWords.some((w) => w.source === 'local');
  const hasGemini = detectedWords.some((w) => w.source === 'gemini');

  if (hasLocal && hasGemini) return 'both';
  if (hasGemini) return 'gemini';
  return 'local';
}
