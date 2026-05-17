// lib/sensitivity/GeminiSensitivityDetector.ts - Gemini Flash 语义检测与改写服务

import { GoogleGenAI } from '@google/genai';
import type {
  DetectAndRewriteInput,
  DetectAndRewriteResult,
  RewriteOnlyInput,
  RewriteResult,
  SensitiveWordCategory,
} from '@/types/sensitivity';

/** Gemini Flash 调用超时时间（毫秒） */
const TIMEOUT_MS = 10000;

/** Gemini Flash 模型 ID */
const MODEL_ID = 'gemini-3-flash-preview';

/**
 * 检测+改写的 Gemini Prompt 模板
 *
 * 要求 Gemini 在单次调用中完成：
 * 1. 语义级敏感词检测（明星名字、歌曲名称、违禁词）
 * 2. Prompt 改写为英文 Lyria 3 音乐描述
 * 3. Style Tags 提取
 */
const DETECT_AND_REWRITE_PROMPT = `You are a music AI content safety and prompt engineering assistant. Your task is to analyze a user's music creation description for sensitive content and rewrite it into a professional English music prompt.

## Task
Analyze the following music creation description for:
1. **Celebrity names** (singers, musicians, bands - any language)
2. **Song names** (specific song titles - any language)
3. **Forbidden words** (profanity, hate speech, violence, illegal content, politically sensitive terms)

Then, if sensitive content is found (celebrity or song names), rewrite the description into a detailed English music production prompt suitable for AI music generation. The rewritten prompt must NOT contain any sensitive words.

## Input Description
{description}

{knownWordsSection}

## Output Requirements
Respond with a JSON object (no markdown code fences, just raw JSON):
{
  "hasSensitiveContent": boolean,
  "detectedWords": [
    { "word": "detected word", "category": "celebrity" | "song_name" | "forbidden" }
  ],
  "hasForbiddenWords": boolean,
  "forbiddenWords": ["list of forbidden words found"],
  "rewrittenPrompt": "English music prompt with genre, BPM range, instrumentation, vocal characteristics, mood/atmosphere" | null,
  "styleTags": ["English tag1", "English tag2", ...] | null,
  "styleTagsCn": ["中文标签1", "中文标签2", ...] | null
}

## Rules
- If no sensitive content is detected, set hasSensitiveContent to false, detectedWords to [], rewrittenPrompt to null, styleTags to null, styleTagsCn to null
- If celebrity/song names are detected, rewrite the prompt into English covering: music genre, BPM range, instrumentation, vocal characteristics, mood/atmosphere
- If forbidden words are detected, set hasForbiddenWords to true, list them in forbiddenWords, set rewrittenPrompt to null
- The rewritten prompt must be in English and must NOT contain any celebrity names, song names, or sensitive words
- styleTags should be 2-5 descriptive music style keywords IN ENGLISH extracted from the context
- styleTagsCn should be the CHINESE translation of each styleTags entry (same order, same count)
- Be thorough in detecting variants, nicknames, pinyin, and transliterations of celebrity/song names`;

/**
 * 仅改写的 Gemini Prompt 模板
 *
 * 本地已命中敏感词时使用，跳过检测步骤，直接改写
 */
const REWRITE_ONLY_PROMPT = `You are a music AI prompt engineering assistant. A user's music creation description contains sensitive words (celebrity names or song names) that have already been identified. Your task is to rewrite the description into a professional English music production prompt.

## Input Description
{description}

## Identified Sensitive Words
{sensitiveWords}

## Task
Rewrite the description into a detailed English music production prompt suitable for AI music generation (like Google Lyria 3). The rewritten prompt must NOT contain any of the identified sensitive words or any other celebrity/song names.

## Output Requirements
Respond with a JSON object (no markdown code fences, just raw JSON):
{
  "rewrittenPrompt": "English music prompt with genre, BPM range, instrumentation, vocal characteristics, mood/atmosphere",
  "styleTags": ["English tag1", "English tag2", ...],
  "styleTagsCn": ["中文标签1", "中文标签2", ...]
}

## Rules
- The rewritten prompt must be in English
- The rewritten prompt must NOT contain any celebrity names, song names, or sensitive words
- Cover these dimensions: music genre, BPM range (e.g., 120-130 BPM), instrumentation (specific instruments), vocal characteristics (tone, style), mood/atmosphere
- styleTags should be 2-5 descriptive music style keywords IN ENGLISH that capture the essence of the original description
- styleTagsCn should be the CHINESE translation of each styleTags entry (same order, same count)
- Preserve the user's intended musical style and mood while removing all sensitive references`;

/**
 * GeminiSensitivityDetector - Gemini Flash 语义检测与改写服务
 *
 * 使用 Gemini Flash 模型实现：
 * - 语义级敏感词检测（覆盖变体、昵称、英文名、拼音等）
 * - 智能 Prompt 改写（将敏感描述转化为合规的英文音乐描述）
 * - Style Tags 提取（2-5 个风格标签）
 *
 * 设计特点：
 * - 单次 API 调用合并检测与改写，减少网络延迟
 * - 3 秒超时保护，超时后降级处理
 * - 结构化 JSON 响应解析，格式异常时安全降级
 */
export class GeminiSensitivityDetector {
  private ai: GoogleGenAI;

  constructor(apiKey: string) {
    this.ai = new GoogleGenAI({ apiKey });
  }

  /**
   * 单次 Gemini Flash 调用，同时完成：
   * - 语义级敏感词检测
   * - Prompt 改写（若检测到明星/歌曲名称）
   * - Style Tags 提取
   *
   * @param input - 检测+改写输入
   * @returns 检测+改写结果
   * @throws 超时或 API 调用失败时抛出错误
   */
  async detectAndRewrite(input: DetectAndRewriteInput): Promise<DetectAndRewriteResult> {
    const knownWordsSection = input.knownSensitiveWords && input.knownSensitiveWords.length > 0
      ? `## Already Identified Sensitive Words (from local matching)\n${input.knownSensitiveWords.join(', ')}\n\nNote: These words were already detected by local matching. Include them in your analysis and ensure the rewritten prompt avoids them.`
      : '';

    const prompt = DETECT_AND_REWRITE_PROMPT
      .replace('{description}', input.description)
      .replace('{knownWordsSection}', knownWordsSection);

    const responseText = await this.callGeminiWithTimeout(prompt);
    return this.parseDetectAndRewriteResponse(responseText);
  }

  /**
   * 仅改写（本地已命中明星/歌曲名称时使用）
   * 跳过检测步骤，直接改写
   *
   * @param input - 改写输入（包含已识别的敏感词）
   * @returns 改写结果
   * @throws 超时或 API 调用失败时抛出错误
   */
  async rewriteOnly(input: RewriteOnlyInput): Promise<RewriteResult> {
    const prompt = REWRITE_ONLY_PROMPT
      .replace('{description}', input.description)
      .replace('{sensitiveWords}', input.sensitiveWords.join(', '));

    const responseText = await this.callGeminiWithTimeout(prompt);
    return this.parseRewriteOnlyResponse(responseText);
  }

  // ─── 内部方法 ───────────────────────────────────────────

  /**
   * 调用 Gemini Flash 并附加超时保护（3 秒）
   */
  private async callGeminiWithTimeout(prompt: string): Promise<string> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      console.log('[GeminiDetector] Calling Gemini model:', MODEL_ID);
      const response = await Promise.race([
        this.ai.models.generateContent({
          model: MODEL_ID,
          contents: [
            {
              role: 'user',
              parts: [{ text: prompt }],
            },
          ],
          config: {
            responseMimeType: 'application/json',
          },
        }),
        new Promise<never>((_, reject) => {
          controller.signal.addEventListener('abort', () => {
            reject(new Error('Gemini Flash 调用超时（10s）'));
          });
        }),
      ]);

      console.log('[GeminiDetector] Gemini response received');

      // 提取文本响应
      const parts = response.candidates?.[0]?.content?.parts;
      let fullText = '';
      if (parts) {
        for (const part of parts) {
          if (part.text) fullText += part.text;
        }
      }

      if (!fullText) {
        throw new Error('Gemini Flash 未返回有效响应');
      }

      return fullText;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * 解析 detectAndRewrite 的 JSON 响应
   */
  private parseDetectAndRewriteResponse(responseText: string): DetectAndRewriteResult {
    try {
      // 尝试清理可能的 markdown 代码块包裹
      const cleanedText = this.cleanJsonResponse(responseText);
      const parsed = JSON.parse(cleanedText);

      // 验证并规范化响应结构
      const hasSensitiveContent = Boolean(parsed.hasSensitiveContent);
      const hasForbiddenWords = Boolean(parsed.hasForbiddenWords);

      const detectedWords: Array<{ word: string; category: SensitiveWordCategory }> = [];
      if (Array.isArray(parsed.detectedWords)) {
        for (const item of parsed.detectedWords) {
          if (item && typeof item.word === 'string' && this.isValidCategory(item.category)) {
            detectedWords.push({
              word: item.word,
              category: item.category as SensitiveWordCategory,
            });
          }
        }
      }

      const forbiddenWords: string[] = [];
      if (Array.isArray(parsed.forbiddenWords)) {
        for (const word of parsed.forbiddenWords) {
          if (typeof word === 'string') {
            forbiddenWords.push(word);
          }
        }
      }

      // 改写 Prompt：仅在非违禁词场景下有值
      let rewrittenPrompt: string | null = null;
      if (!hasForbiddenWords && typeof parsed.rewrittenPrompt === 'string' && parsed.rewrittenPrompt.trim()) {
        rewrittenPrompt = parsed.rewrittenPrompt.trim();
      }

      // Style Tags：2-5 个
      let styleTags: string[] | null = null;
      if (Array.isArray(parsed.styleTags) && parsed.styleTags.length > 0) {
        const validTags = parsed.styleTags
          .filter((tag: unknown) => typeof tag === 'string' && (tag as string).trim())
          .map((tag: string) => tag.trim())
          .slice(0, 5); // 最多 5 个
        if (validTags.length >= 2) {
          styleTags = validTags;
        } else if (validTags.length > 0) {
          // 不足 2 个时仍保留（降级处理）
          styleTags = validTags;
        }
      }

      // Style Tags 中文版
      let styleTagsCn: string[] | null = null;
      if (Array.isArray(parsed.styleTagsCn) && parsed.styleTagsCn.length > 0) {
        styleTagsCn = parsed.styleTagsCn
          .filter((tag: unknown) => typeof tag === 'string' && (tag as string).trim())
          .map((tag: string) => tag.trim())
          .slice(0, 5);
      }

      return {
        hasSensitiveContent,
        detectedWords,
        rewrittenPrompt,
        styleTags,
        styleTagsCn,
        hasForbiddenWords,
        forbiddenWords,
      };
    } catch {
      // JSON 解析失败：视为未检测到敏感词（降级策略）
      return {
        hasSensitiveContent: false,
        detectedWords: [],
        rewrittenPrompt: null,
        styleTags: null,
        styleTagsCn: null,
        hasForbiddenWords: false,
        forbiddenWords: [],
      };
    }
  }

  /**
   * 解析 rewriteOnly 的 JSON 响应
   */
  private parseRewriteOnlyResponse(responseText: string): RewriteResult {
    try {
      const cleanedText = this.cleanJsonResponse(responseText);
      const parsed = JSON.parse(cleanedText);

      const rewrittenPrompt = typeof parsed.rewrittenPrompt === 'string'
        ? parsed.rewrittenPrompt.trim()
        : '';

      if (!rewrittenPrompt) {
        throw new Error('改写结果为空');
      }

      // Style Tags：2-5 个
      let styleTags: string[] = [];
      if (Array.isArray(parsed.styleTags)) {
        styleTags = parsed.styleTags
          .filter((tag: unknown) => typeof tag === 'string' && (tag as string).trim())
          .map((tag: string) => tag.trim())
          .slice(0, 5);
      }

      // 确保至少有 2 个 style tags
      if (styleTags.length < 2) {
        // 从改写 prompt 中提取关键词作为补充
        styleTags = this.extractFallbackTags(rewrittenPrompt, styleTags);
      }

      // Style Tags 中文版
      let styleTagsCn: string[] = [];
      if (Array.isArray(parsed.styleTagsCn)) {
        styleTagsCn = parsed.styleTagsCn
          .filter((tag: unknown) => typeof tag === 'string' && (tag as string).trim())
          .map((tag: string) => tag.trim())
          .slice(0, 5);
      }
      // 如果中文标签为空，用英文标签作为 fallback
      if (styleTagsCn.length === 0) {
        styleTagsCn = styleTags;
      }

      return {
        rewrittenPrompt,
        styleTags,
        styleTagsCn,
      };
    } catch (error) {
      throw new Error(
        `Gemini Flash 改写响应解析失败: ${error instanceof Error ? error.message : '未知错误'}`
      );
    }
  }

  /**
   * 清理 JSON 响应文本（移除可能的 markdown 代码块包裹）
   */
  private cleanJsonResponse(text: string): string {
    let cleaned = text.trim();

    // 移除 ```json ... ``` 包裹
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.slice(7);
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.slice(3);
    }

    if (cleaned.endsWith('```')) {
      cleaned = cleaned.slice(0, -3);
    }

    return cleaned.trim();
  }

  /**
   * 验证分类值是否合法
   */
  private isValidCategory(category: unknown): boolean {
    return category === 'celebrity' || category === 'song_name' || category === 'forbidden';
  }

  /**
   * 从改写 Prompt 中提取备用 Style Tags
   * 当 Gemini 返回的 tags 不足 2 个时使用
   */
  private extractFallbackTags(prompt: string, existingTags: string[]): string[] {
    const tags = [...existingTags];

    // 常见音乐风格关键词
    const genreKeywords = [
      'pop', 'rock', 'jazz', 'electronic', 'hip-hop', 'r&b', 'classical',
      'folk', 'country', 'blues', 'soul', 'funk', 'reggae', 'metal',
      'indie', 'ambient', 'lo-fi', 'synthwave', 'ballad', 'dance',
    ];

    const lowerPrompt = prompt.toLowerCase();
    for (const keyword of genreKeywords) {
      if (tags.length >= 2) break;
      if (lowerPrompt.includes(keyword) && !tags.includes(keyword)) {
        tags.push(keyword);
      }
    }

    // 如果仍不足 2 个，添加通用标签
    if (tags.length < 2) {
      const fallbacks = ['modern', 'melodic', 'atmospheric', 'rhythmic'];
      for (const fb of fallbacks) {
        if (tags.length >= 2) break;
        if (!tags.includes(fb)) {
          tags.push(fb);
        }
      }
    }

    return tags;
  }
}
