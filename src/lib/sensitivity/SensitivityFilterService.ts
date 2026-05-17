// lib/sensitivity/SensitivityFilterService.ts - 核心敏感词过滤服务

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../supabase/types';
import type {
  SensitivityCheckInput,
  SensitivityCheckResult,
  LyricsCheckResult,
  DetectedWord,
} from '@/types/sensitivity';
import { LocalWordMatcher } from './LocalWordMatcher';
import { GeminiSensitivityDetector } from './GeminiSensitivityDetector';

/**
 * SensitivityFilterService - 核心敏感词过滤服务
 *
 * 编排完整的敏感词检测流程：
 * 1. 歌词优先检测：歌词中任何类型的敏感词直接 block（不走 rewrite）
 * 2. 创作描述检测：本地词库匹配 → Gemini 语义检测+改写
 * 3. 结果类型判定：forbidden → block，celebrity/song_name → rewrite，无命中 → pass
 *
 * 降级策略：
 * - Gemini 调用失败时，仅依赖本地词库结果
 * - 若本地未命中则放行（不阻塞用户），同时记录错误日志
 */
export class SensitivityFilterService {
  private localMatcher: LocalWordMatcher;
  private geminiDetector: GeminiSensitivityDetector;
  private supabase: SupabaseClient<Database>;

  constructor(deps: {
    supabase: SupabaseClient<Database>;
    geminiApiKey: string;
  }) {
    this.supabase = deps.supabase;
    this.localMatcher = new LocalWordMatcher(deps.supabase);
    this.geminiDetector = new GeminiSensitivityDetector(deps.geminiApiKey);
  }

  /**
   * 执行完整的敏感词检测流程
   *
   * 流程：
   * 1. 若有歌词，先检测歌词（歌词中所有类型敏感词直接 block）
   * 2. 歌词通过后，检测创作描述
   * 3. 返回结构化结果，包含 durationMs
   */
  async check(input: SensitivityCheckInput): Promise<SensitivityCheckResult> {
    const startTime = Date.now();

    // 确保本地词库已初始化并刷新
    if (!this.localMatcher.isInitialized()) {
      await this.localMatcher.initialize();
    } else {
      await this.localMatcher.refreshIfNeeded();
    }

    // ─── 步骤 1：歌词优先检测 ───────────────────────────────
    let lyricsResult: LyricsCheckResult | null = null;

    if (input.lyrics && input.lyrics.trim().length > 0) {
      lyricsResult = this.checkLyrics(input.lyrics);

      // 歌词命中敏感词 → 直接 block，短路不再检测描述
      if (lyricsResult.type === 'block') {
        const blockedWords = lyricsResult.detectedWords.map((w) => w.word);
        return {
          passed: false,
          resultType: 'block',
          descriptionResult: null,
          lyricsResult,
          rewrittenPrompt: null,
          styleTags: null,
          styleTagsCn: null,
          blockedWords,
          durationMs: Date.now() - startTime,
        };
      }
    }

    // ─── 步骤 2：创作描述检测 ───────────────────────────────
    const descriptionResult = await this.checkDescription(input.description);

    // ─── 步骤 3：组装最终结果 ───────────────────────────────
    const durationMs = Date.now() - startTime;

    if (descriptionResult.type === 'block') {
      return {
        passed: false,
        resultType: 'block',
        descriptionResult,
        lyricsResult,
        rewrittenPrompt: null,
        styleTags: null,
        styleTagsCn: null,
        blockedWords: descriptionResult.detectedWords
          .filter((w) => w.category === 'forbidden')
          .map((w) => w.word),
        durationMs,
      };
    }

    if (descriptionResult.type === 'rewrite') {
      return {
        passed: false,
        resultType: 'rewrite',
        descriptionResult,
        lyricsResult,
        rewrittenPrompt: descriptionResult.rewrittenPrompt ?? null,
        styleTags: descriptionResult.styleTags ?? null,
        styleTagsCn: descriptionResult.styleTagsCn ?? null,
        blockedWords: null,
        durationMs,
      };
    }

    // pass
    return {
      passed: true,
      resultType: 'pass',
      descriptionResult,
      lyricsResult,
      rewrittenPrompt: null,
      styleTags: null,
      styleTagsCn: null,
      blockedWords: null,
      durationMs,
    };
  }

  // ─── 内部方法 ───────────────────────────────────────────

  /**
   * 检测歌词中的敏感词
   * 歌词中所有类型的敏感词（celebrity、song_name、forbidden）都直接 block
   */
  private checkLyrics(lyrics: string): LyricsCheckResult {
    const localResult = this.localMatcher.match(lyrics);

    if (localResult.matched) {
      const detectedWords: DetectedWord[] = localResult.words.map((w) => ({
        word: w.word,
        category: w.category,
        source: 'local' as const,
      }));

      return {
        type: 'block',
        detectedWords,
      };
    }

    return {
      type: 'pass',
      detectedWords: [],
    };
  }

  /**
   * 检测创作描述中的敏感词
   *
   * 流程：
   * 1. 本地词库匹配
   *    - 命中 forbidden → 直接 block
   *    - 命中 celebrity/song_name → 调用 Gemini 改写
   * 2. 本地未命中 → 调用 Gemini 语义检测+改写
   * 3. Gemini 失败时降级：仅依赖本地结果
   */
  private async checkDescription(
    description: string
  ): Promise<DescriptionCheckResultInternal> {
    const localResult = this.localMatcher.match(description);

    // ─── 本地命中场景 ───────────────────────────────────────
    if (localResult.matched) {
      const hasForbidden = localResult.words.some(
        (w) => w.category === 'forbidden'
      );

      // 本地命中 forbidden → 直接 block（block 优先于 rewrite）
      if (hasForbidden) {
        const detectedWords: DetectedWord[] = localResult.words.map((w) => ({
          word: w.word,
          category: w.category,
          source: 'local' as const,
        }));

        return {
          type: 'block',
          detectedWords,
        };
      }

      // 本地命中 celebrity/song_name → 检查是否有缓存的改写结果
      const sensitiveWords = localResult.words.map((w) => w.word);
      const firstMatchWithCache = localResult.words.find((w) => w.cachedRewrite);

      // 如果有缓存的改写结果，直接使用，不调用 Gemini
      if (firstMatchWithCache?.cachedRewrite) {
        console.log('[SensitivityFilter] 使用缓存的改写结果，跳过 Gemini 调用');
        const cached = firstMatchWithCache.cachedRewrite;
        const detectedWords: DetectedWord[] = localResult.words.map((w) => ({
          word: w.word,
          category: w.category,
          source: 'local' as const,
        }));

        return {
          type: 'rewrite',
          detectedWords,
          rewrittenPrompt: cached.rewrittenPrompt,
          styleTags: cached.styleTags,
          styleTagsCn: cached.styleTagsCn,
        };
      }

      // 没有缓存，调用 Gemini 改写
      try {
        const rewriteResult = await this.geminiDetector.rewriteOnly({
          description,
          sensitiveWords,
        });

        const detectedWords: DetectedWord[] = localResult.words.map((w) => ({
          word: w.word,
          category: w.category,
          source: 'local' as const,
        }));

        // 保存改写结果到缓存（异步，不阻塞返回）
        const wordIdsToCache = localResult.words
          .filter((w) => w.id && !w.cachedRewrite)
          .map((w) => w.id!);
        if (wordIdsToCache.length > 0) {
          this.saveRewriteCache(wordIdsToCache, {
            rewrittenPrompt: rewriteResult.rewrittenPrompt,
            styleTags: rewriteResult.styleTags,
            styleTagsCn: rewriteResult.styleTagsCn,
          }).catch((err) => {
            console.error('[SensitivityFilter] 保存改写缓存失败:', err);
          });
        }

        return {
          type: 'rewrite',
          detectedWords,
          rewrittenPrompt: rewriteResult.rewrittenPrompt,
          styleTags: rewriteResult.styleTags,
          styleTagsCn: rewriteResult.styleTagsCn,
        };
      } catch (error) {
        // Gemini 改写失败：本地已命中但无法改写
        // 根据设计文档：本地词库命中但 Gemini 改写失败 → 返回错误，提示用户手动修改
        console.error('[SensitivityFilter] Gemini 改写失败:', error instanceof Error ? error.message : error);

        const detectedWords: DetectedWord[] = localResult.words.map((w) => ({
          word: w.word,
          category: w.category,
          source: 'local' as const,
        }));

        return {
          type: 'rewrite',
          detectedWords,
          rewrittenPrompt: null,
          styleTags: null,
        };
      }
    }

    // ─── 本地未命中场景：调用 Gemini 语义检测+改写 ─────────────
    try {
      const geminiResult = await this.geminiDetector.detectAndRewrite({
        description,
      });

      // Gemini 检测到违禁词 → block
      if (geminiResult.hasForbiddenWords && geminiResult.forbiddenWords.length > 0) {
        const detectedWords: DetectedWord[] = geminiResult.detectedWords.map(
          (w) => ({
            word: w.word,
            category: w.category,
            source: 'gemini' as const,
          })
        );

        return {
          type: 'block',
          detectedWords,
        };
      }

      // Gemini 检测到敏感词（celebrity/song_name）→ rewrite
      if (geminiResult.hasSensitiveContent && geminiResult.detectedWords.length > 0) {
        const detectedWords: DetectedWord[] = geminiResult.detectedWords.map(
          (w) => ({
            word: w.word,
            category: w.category,
            source: 'gemini' as const,
          })
        );

        return {
          type: 'rewrite',
          detectedWords,
          rewrittenPrompt: geminiResult.rewrittenPrompt,
          styleTags: geminiResult.styleTags,
          styleTagsCn: geminiResult.styleTagsCn,
        };
      }

      // Gemini 未检测到敏感词 → pass
      return {
        type: 'pass',
        detectedWords: [],
      };
    } catch (error) {
      // ─── 降级策略：Gemini 失败时仅依赖本地结果 ─────────────
      // 本地未命中 + Gemini 失败 → 放行（不阻塞用户）
      console.error('[SensitivityFilter] Gemini 检测失败，降级放行:', error);

      return {
        type: 'pass',
        detectedWords: [],
      };
    }
  }

  /**
   * 保存改写结果到 sensitive_words 表的 cached_rewrite 字段
   * 下次相同敏感词命中时可直接使用缓存，不再调用 Gemini
   */
  private async saveRewriteCache(
    wordIds: string[],
    cache: { rewrittenPrompt: string; styleTags: string[]; styleTagsCn: string[] }
  ): Promise<void> {
    for (const id of wordIds) {
      await this.supabase
        .from('sensitive_words')
        .update({ cached_rewrite: cache } as any)
        .eq('id', id);
    }
  }
}

/**
 * 内部扩展的描述检测结果类型
 * 包含改写结果字段，用于在 check() 方法中传递改写数据
 */
interface DescriptionCheckResultInternal {
  type: 'pass' | 'rewrite' | 'block';
  detectedWords: DetectedWord[];
  rewrittenPrompt?: string | null;
  styleTags?: string[] | null;
  styleTagsCn?: string[] | null;
}
