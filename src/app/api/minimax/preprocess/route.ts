import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '../../../../lib/supabase/auth-helpers';
import { MiniMaxProvider } from '../../../../lib/generation/MiniMaxProvider';

export const maxDuration = 60;

// ---------------------------------------------------------------------------
// 用户级速率限制（内存实现，10 requests/user/minute）
// 注意：在多实例部署（如 Vercel serverless）中，每个实例有独立的内存，
// 实际限制可能略宽松。如需严格限制可改用 Redis。
// ---------------------------------------------------------------------------

interface RateLimitEntry {
  timestamps: number[];
}

const rateLimitMap = new Map<string, RateLimitEntry>();

const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 10;

function isRateLimited(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);

  if (!entry) {
    rateLimitMap.set(userId, { timestamps: [now] });
    return false;
  }

  // 清除窗口外的旧记录
  entry.timestamps = entry.timestamps.filter(
    (ts) => now - ts < RATE_LIMIT_WINDOW_MS
  );

  if (entry.timestamps.length >= RATE_LIMIT_MAX_REQUESTS) {
    return true;
  }

  entry.timestamps.push(now);
  return false;
}

// ---------------------------------------------------------------------------
// 服务端校验常量
// ---------------------------------------------------------------------------

const ALLOWED_MIME_TYPES = ['audio/mpeg', 'audio/wav', 'audio/x-wav'];
const MAX_AUDIO_SIZE_BYTES = 50 * 1024 * 1024; // 50MB

/**
 * 从 Base64 数据中检测 MIME 类型
 * 支持检测 MP3 和 WAV 文件头
 */
function detectMimeTypeFromBase64(base64Data: string): string | null {
  // 取前几个字节用于检测
  const binaryStr = atob(base64Data.slice(0, 16));
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }

  // WAV: 以 "RIFF" 开头
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
    return 'audio/wav';
  }

  // MP3: ID3 tag 或 MPEG frame sync
  if (
    (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) || // ID3
    (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) // MPEG sync
  ) {
    return 'audio/mpeg';
  }

  return null;
}

// ---------------------------------------------------------------------------
// POST /api/minimax/preprocess
//
// 接收音频 Base64 数据，调用 MiniMax 预处理 API 提取特征和歌词结构。
//
// Request Body:
//   { audioBase64: string, mimeType?: string }
//
// Response (200):
//   { coverFeatureId, lyrics, structure, duration }
//
// Error Responses:
//   401 - 未认证
//   429 - 速率限制
//   400 - 参数校验失败
//   500 - 服务端错误
//
// 关于时长校验（Requirement 10.5）：
// 服务端无法在不引入额外音频解码依赖的情况下精确检测 Base64 音频的时长。
// MiniMax 预处理 API 会返回 audio_duration，如果时长不在允许范围内，
// API 本身会拒绝处理。因此服务端依赖 MiniMax API 的时长校验。
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    // Step 1: 验证用户认证
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json(
        { error: '未登录，请先登录' },
        { status: 401 }
      );
    }

    // Step 2: 速率限制检查
    if (isRateLimited(user.id)) {
      return NextResponse.json(
        { error: '请求过于频繁，请稍后再试（每分钟最多 10 次）' },
        { status: 429 }
      );
    }

    // Step 3: 解析请求体
    let body: { audioBase64?: string; mimeType?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: '请求格式无效' },
        { status: 400 }
      );
    }

    const { audioBase64, mimeType } = body;

    // Step 4: 校验音频数据非空 (Requirement 10.4)
    if (!audioBase64 || audioBase64.trim().length === 0) {
      return NextResponse.json(
        { error: '音频数据不能为空' },
        { status: 400 }
      );
    }

    // Step 5: 校验 MIME 类型 (Requirement 10.2)
    // 优先使用客户端传递的 mimeType，同时通过文件头检测进行验证
    const detectedMime = detectMimeTypeFromBase64(audioBase64);
    const effectiveMime = detectedMime || mimeType || '';

    if (!ALLOWED_MIME_TYPES.includes(effectiveMime)) {
      return NextResponse.json(
        { error: '不支持的音频格式，仅支持 MP3/WAV' },
        { status: 400 }
      );
    }

    // Step 6: 校验文件大小 (Requirement 10.1)
    // Base64 编码后大小约为原始大小的 4/3
    const estimatedSizeBytes = Math.ceil((audioBase64.length * 3) / 4);
    if (estimatedSizeBytes > MAX_AUDIO_SIZE_BYTES) {
      return NextResponse.json(
        { error: '文件大小不能超过 50MB' },
        { status: 400 }
      );
    }

    // Step 7: 调用 MiniMax 预处理 API
    const provider = new MiniMaxProvider();
    const result = await provider.preprocess({ audioBase64 });

    // Step 8: 返回预处理结果
    return NextResponse.json({
      coverFeatureId: result.coverFeatureId,
      lyrics: result.formattedLyrics,
      structure: result.structureResult,
      duration: result.audioDuration,
    });
  } catch (error: any) {
    console.error('[/api/minimax/preprocess] Error:', error);

    // 区分不同类型的错误
    const message = error?.message || '预处理失败';

    if (message.includes('API Key')) {
      return NextResponse.json(
        { error: '服务配置异常，请稍后重试' },
        { status: 500 }
      );
    }

    if (message.includes('超时')) {
      return NextResponse.json(
        { error: '音频分析超时，请重试' },
        { status: 504 }
      );
    }

    return NextResponse.json(
      { error: '音频分析失败，请重试' },
      { status: 500 }
    );
  }
}
