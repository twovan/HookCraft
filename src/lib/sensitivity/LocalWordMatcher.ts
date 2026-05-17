// lib/sensitivity/LocalWordMatcher.ts - 本地敏感词库匹配器

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../supabase/types';
import type {
  SensitiveWordEntry,
  SensitiveWordCategory,
  LocalMatchResult,
} from '@/types/sensitivity';

/** 缓存刷新间隔（毫秒）：60 秒 */
const REFRESH_INTERVAL_MS = 60 * 1000;

/**
 * LocalWordMatcher - 本地敏感词库匹配器
 *
 * 将敏感词库加载到内存中，提供低延迟（<50ms）的本地匹配能力。
 * 支持精确匹配和变体匹配，大小写不敏感。
 * 每 60 秒自动检查并刷新缓存，确保管理员修改后及时生效。
 */
export class LocalWordMatcher {
  private supabase: SupabaseClient<Database>;
  private wordCache: SensitiveWordEntry[] = [];
  private lastRefreshTime: number = 0;
  private initialized: boolean = false;

  constructor(supabase: SupabaseClient<Database>) {
    this.supabase = supabase;
  }

  /**
   * 初始化：从 Supabase 加载敏感词库到内存
   * 应在服务启动时调用一次
   */
  async initialize(): Promise<void> {
    await this.loadWords();
    this.initialized = true;
  }

  /**
   * 刷新缓存（若距上次刷新超过 60 秒）
   * 在每次匹配前调用，确保数据新鲜度
   */
  async refreshIfNeeded(): Promise<void> {
    const now = Date.now();
    if (now - this.lastRefreshTime >= REFRESH_INTERVAL_MS) {
      try {
        await this.loadWords();
      } catch {
        // 刷新失败时保留旧缓存，下次重试
        // 参考设计文档错误处理：缓存刷新失败 → 保留旧缓存
      }
    }
  }

  /**
   * 对文本执行本地匹配，返回命中的敏感词列表
   * 支持精确匹配和变体匹配，大小写不敏感
   */
  match(text: string): LocalMatchResult {
    if (!text || text.trim().length === 0) {
      return { matched: false, words: [] };
    }

    const normalizedText = text.toLowerCase();
    const matchedWords: LocalMatchResult['words'] = [];

    for (const entry of this.wordCache) {
      // 精确匹配：检查文本中是否包含敏感词本身
      const normalizedWord = entry.word.toLowerCase();
      if (normalizedText.includes(normalizedWord)) {
        matchedWords.push({
          word: entry.word,
          category: entry.category,
        });
        continue; // 已匹配到主词，跳过变体检查
      }

      // 变体匹配：检查文本中是否包含任何注册的变体词
      if (entry.variants && entry.variants.length > 0) {
        let variantMatched = false;
        for (const variant of entry.variants) {
          if (!variant) continue;
          const normalizedVariant = variant.toLowerCase();
          if (normalizedText.includes(normalizedVariant)) {
            matchedWords.push({
              word: entry.word,
              category: entry.category,
              matchedVariant: variant,
            });
            variantMatched = true;
            break; // 匹配到一个变体即可
          }
        }
        if (variantMatched) continue;
      }
    }

    return {
      matched: matchedWords.length > 0,
      words: matchedWords,
    };
  }

  /**
   * 获取当前缓存的敏感词数量（用于调试/监控）
   */
  getCacheSize(): number {
    return this.wordCache.length;
  }

  /**
   * 检查是否已初始化
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  // ─── 内部方法 ───────────────────────────────────────────

  /**
   * 从 Supabase 加载所有敏感词到内存
   */
  private async loadWords(): Promise<void> {
    const { data, error } = await this.supabase
      .from('sensitive_words')
      .select('*');

    if (error) {
      throw new Error(`加载敏感词库失败: ${error.message}`);
    }

    this.wordCache = (data ?? []).map((row) => ({
      id: row.id,
      word: row.word,
      category: row.category as SensitiveWordCategory,
      variants: row.variants ?? [],
      note: row.note ?? '',
      hitCount: row.hit_count ?? 0,
      lastHitAt: row.last_hit_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    this.lastRefreshTime = Date.now();
  }
}
