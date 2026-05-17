// LyriaProvider - Lyria 3 模型提供方实现
import { GoogleGenAI } from '@google/genai';
import type { AIModelProvider } from './AIModelProvider';
import type {
  GenerationRequest,
  GenerationResponse,
  GeminiGenerationConfig,
  GeminiRawResponse,
  GeminiResponsePart,
  LyriaModelId,
} from '../../types/generation';

/** Lyria 3 模型提供方实现 */
export class LyriaProvider implements AIModelProvider {
  readonly providerName = 'lyria';
  private ai: GoogleGenAI;

  constructor(apiKey: string) {
    this.ai = new GoogleGenAI({ apiKey });
  }

  /** 调用 Lyria 3 Clip（lyria-3-clip-preview）生成 30 秒 MP3 */
  async generatePreview(request: GenerationRequest): Promise<GenerationResponse> {
    const modelId: LyriaModelId = 'lyria-3-clip-preview';
    const config = this.buildGenerationConfig(request);

    const contents = this.buildContents(request);

    try {
      const response = await this.ai.models.generateContent({
        model: modelId,
        contents,
        config,
      });

      // Try SDK .text getter for lyrics (some SDK versions expose it differently)
      let sdkText: string | undefined;
      try { sdkText = typeof (response as any).text === 'string' ? (response as any).text : undefined; } catch {}

      const result = this.parseResponse(response as unknown as GeminiRawResponse, modelId);

      // Fallback: if no lyrics found in parts but SDK .text has content
      if (!result.lyrics && sdkText && sdkText.trim() && sdkText !== '<instrumental>') {
        result.lyrics = sdkText;
      }

      return result;
    } catch (err: any) {
      const msg = err?.message || err?.toString?.() || 'Unknown Lyria error';
      console.error(`[LyriaProvider] generatePreview failed:`, msg);
      throw new Error(`Lyria API 调用失败: ${msg}`);
    }
  }

  /** 调用 Lyria 3 Pro（lyria-3-pro-preview）生成完整歌曲，支持 MP3/WAV */
  async generateFullDemo(request: GenerationRequest): Promise<GenerationResponse> {
    const modelId: LyriaModelId = 'lyria-3-pro-preview';
    const config = this.buildGenerationConfig(request);

    const contents = this.buildContents(request);

    const response = await this.ai.models.generateContent({
      model: modelId,
      contents,
      config,
    });

    // Try SDK .text getter for lyrics
    let sdkText: string | undefined;
    try { sdkText = typeof (response as any).text === 'string' ? (response as any).text : undefined; } catch {}

    const result = this.parseResponse(response as unknown as GeminiRawResponse, modelId);

    if (!result.lyrics && sdkText && sdkText.trim() && sdkText !== '<instrumental>') {
      result.lyrics = sdkText;
    }

    return result;
  }

  /** 构建请求内容（prompt + 可选图片） */
  private buildContents(request: GenerationRequest): string | Array<{ role: string; parts: Array<Record<string, unknown>> }> {
    if (!request.images || request.images.length === 0) {
      return request.prompt;
    }

    // 多模态请求：图片 + 文本
    const parts: Array<Record<string, unknown>> = request.images.map((img) => ({
      inlineData: { mimeType: img.mimeType, data: img.data },
    }));
    parts.push({ text: request.prompt });

    return [{ role: 'user', parts }];
  }

  /** 解析 Gemini API 响应，分离 text parts（歌词）和 inline_data parts（音频二进制数据） */
  parseResponse(response: GeminiRawResponse, modelId: LyriaModelId): GenerationResponse {
    const parts = response?.candidates?.[0]?.content?.parts;

    // Fallback: try SDK .text getter if parts are empty
    if ((!parts || parts.length === 0) && (response as any)?.text) {
      const textContent = (response as any).text;
      return {
        success: false,
        lyrics: textContent || undefined,
        modelId,
        hasSynthIdWatermark: true,
      };
    }

    if (!parts || parts.length === 0) {
      return {
        success: false,
        modelId,
        hasSynthIdWatermark: true,
      };
    }

    let lyrics = '';
    let audioData: Buffer | undefined;
    let audioMimeType: string | undefined;
    let songStructureDescription: string | undefined;

    for (const part of parts) {
      if (part.text) {
        // text parts 包含歌词和歌曲结构描述
        const text = part.text;
        // 尝试检测 JSON 结构描述
        if (text.trim().startsWith('{') || text.trim().startsWith('[')) {
          songStructureDescription = text;
        } else {
          lyrics += (lyrics ? '\n' : '') + text;
        }
      } else if (part.inlineData) {
        // inline_data parts 包含音频二进制数据
        audioData = Buffer.from(part.inlineData.data, 'base64');
        audioMimeType = part.inlineData.mimeType;
      }
    }

    return {
      success: !!audioData,
      audioData,
      audioMimeType,
      lyrics: lyrics || undefined,
      songStructureDescription,
      modelId,
      hasSynthIdWatermark: true,
    };
  }

  /** 提取原始响应数据（用于调试和日志） */
  extractRawResponse(response: any): { parts: any[]; text?: string } {
    const parts = response?.candidates?.[0]?.content?.parts || [];
    const text = (response as any)?.text;
    return { parts, text };
  }

  /** 构建 Lyria 3 API 请求配置 */
  buildGenerationConfig(request: GenerationRequest): GeminiGenerationConfig {
    const config: GeminiGenerationConfig = {
      responseModalities: ['AUDIO', 'TEXT'],
    };

    // WAV 格式需要设置 responseMimeType
    if (request.outputFormat === 'audio/wav') {
      config.responseMimeType = 'audio/wav';
    }

    return config;
  }
}
