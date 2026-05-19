// MiniMaxProvider - MiniMax music-cover 模型提供方实现
import type {
  PreprocessInput,
  PreprocessResult,
  ArrangementGenerationInput,
  ArrangementGenerationResult,
} from '../../types/arrangement';

/** MiniMax API 响应基础结构 */
interface MiniMaxBaseResponse {
  base_resp?: {
    status_code: number;
    status_msg: string;
  };
}

/** MiniMax 预处理 API 响应 */
interface MiniMaxPreprocessResponse extends MiniMaxBaseResponse {
  cover_feature_id?: string;
  formatted_lyrics?: string;
  structure_result?: string;
  audio_duration?: number;
}

/** MiniMax 生成 API 响应 */
interface MiniMaxGenerationResponse extends MiniMaxBaseResponse {
  data?: {
    audio?: string;  // hex 编码的音频数据 或 URL（取决于 output_format）
    status?: number;
  };
  extra_info?: {
    music_duration?: number;
    music_sample_rate?: number;
    music_channel?: number;
    bitrate?: number;
    music_size?: number;
  };
  // 兼容旧字段
  audio_file?: string;
  audio_hex?: string;
  task_id?: string;
}

/** MiniMax Provider 配置 */
interface MiniMaxProviderConfig {
  apiKey: string;
  baseUrl?: string;
}

/** 预处理超时时间（毫秒） */
const PREPROCESS_TIMEOUT_MS = 60_000;

/** 生成超时时间（毫秒） */
const GENERATION_TIMEOUT_MS = 300_000;

/** MiniMax music-cover 模型提供方实现 */
export class MiniMaxProvider {
  readonly providerName = 'minimax';
  private apiKey: string;
  private baseUrl: string;

  constructor(config?: MiniMaxProviderConfig) {
    this.apiKey = config?.apiKey || process.env.MINIMAX_API_KEY || '';
    this.baseUrl = config?.baseUrl || 'https://api.minimaxi.com';

    if (!this.apiKey) {
      throw new Error('MiniMax API Key 未配置');
    }
  }

  /** 预处理音频，提取特征和歌词结构 */
  async preprocess(input: PreprocessInput): Promise<PreprocessResult> {
    const url = `${this.baseUrl}/v1/music_cover_preprocess`;

    const body: Record<string, unknown> = {
      model: 'music-cover',
    };
    if (input.audioBase64) {
      body.audio_base64 = input.audioBase64;
    }
    if (input.audioUrl) {
      body.audio_url = input.audioUrl;
    }

    const response = await this.fetchWithTimeout(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    }, PREPROCESS_TIMEOUT_MS);

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`MiniMax 预处理请求失败 (${response.status}): ${errorText || response.statusText}`);
    }

    const data: MiniMaxPreprocessResponse = await response.json();

    // 检查业务错误
    if (data.base_resp && data.base_resp.status_code !== 0) {
      throw new Error(`MiniMax 预处理失败: ${data.base_resp.status_msg || '未知错误'}`);
    }

    if (!data.cover_feature_id) {
      throw new Error('MiniMax 预处理失败：未获取到音频特征 ID');
    }

    return {
      coverFeatureId: data.cover_feature_id,
      formattedLyrics: data.formatted_lyrics || '',
      structureResult: data.structure_result || '',
      audioDuration: data.audio_duration || 0,
    };
  }

  /** 使用 music-cover 模型生成编曲 */
  async generateArrangement(input: ArrangementGenerationInput): Promise<ArrangementGenerationResult> {
    const url = `${this.baseUrl}/v1/music_generation`;

    const body: Record<string, unknown> = {
      model: input.model,
      lyrics: input.lyrics || undefined,
      audio_setting: {
        sample_rate: input.audioSetting.sampleRate,
        bitrate: input.audioSetting.bitrate,
        format: input.audioSetting.format,
      },
      output_format: 'url',
    };

    // audio_url 和 cover_feature_id 互斥
    if (input.coverFeatureId) {
      body.cover_feature_id = input.coverFeatureId;
    } else if (input.audioUrl) {
      body.audio_url = input.audioUrl;
    }

    if (input.prompt) {
      body.prompt = input.prompt;
    }

    const response = await this.fetchWithTimeout(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    }, GENERATION_TIMEOUT_MS);

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      return {
        success: false,
        error: {
          code: `HTTP_${response.status}`,
          message: `MiniMax 生成请求失败 (${response.status}): ${errorText || response.statusText}`,
        },
      };
    }

    const data: MiniMaxGenerationResponse = await response.json();

    // 检查业务错误
    if (data.base_resp && data.base_resp.status_code !== 0) {
      return {
        success: false,
        error: {
          code: String(data.base_resp.status_code),
          message: data.base_resp.status_msg || '生成失败',
        },
      };
    }

    return {
      success: true,
      // output_format: 'url' 时 data.audio 是 URL，否则是 hex
      audioUrl: data.data?.audio?.startsWith('http') ? data.data.audio : (data.audio_file || undefined),
      audioHex: data.data?.audio && !data.data.audio.startsWith('http') ? data.data.audio : (data.audio_hex || undefined),
      taskId: data.task_id || crypto.randomUUID(),
    };
  }

  /** 带超时的 fetch 请求 */
  private async fetchWithTimeout(
    url: string,
    options: RequestInit,
    timeoutMs: number
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      return response;
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        throw new Error(`MiniMax API 请求超时 (${timeoutMs / 1000}s)`);
      }
      throw new Error(`MiniMax API 网络错误: ${err?.message || '未知错误'}`);
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
