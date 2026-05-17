// lib/sensitivity/SensitivityLogService.ts - 敏感词检测日志服务

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../supabase/types';
import type {
  SensitivityLogEntry,
  SensitivityLog,
  LogQueryParams,
  DetectedWord,
} from '@/types/sensitivity';

/**
 * SensitivityLogService - 敏感词检测日志服务
 *
 * 负责记录每次敏感词检测的日志到 sensitivity_logs 表，
 * 提供日志查询（支持分页），以及更新敏感词命中次数统计。
 */
export class SensitivityLogService {
  private supabase: SupabaseClient<Database>;

  constructor(supabase: SupabaseClient<Database>) {
    this.supabase = supabase;
  }

  /**
   * 记录检测日志到 sensitivity_logs 表
   * 每次敏感词检测完成后调用，记录完整的检测上下文
   */
  async log(entry: SensitivityLogEntry): Promise<void> {
    const { error } = await this.supabase
      .from('sensitivity_logs')
      .insert({
        user_id: entry.userId,
        input_description: entry.inputDescription,
        input_lyrics: entry.inputLyrics ?? null,
        result_type: entry.resultType,
        detected_words: entry.detectedWords.map((w) => ({
          word: w.word,
          category: w.category,
          source: w.source,
        })),
        rewritten_prompt: entry.rewrittenPrompt ?? null,
        style_tags: entry.styleTags ?? [],
        user_confirmed: entry.userConfirmed ?? null,
        detection_source: entry.detectionSource,
        duration_ms: entry.durationMs,
      });

    if (error) {
      // 日志记录失败不应阻塞主流程，仅打印错误
      console.error('记录敏感词检测日志失败:', error.message);
    }
  }

  /**
   * 查询检测日志（管理后台用）
   * 支持分页和按结果类型筛选
   */
  async getLogs(params: LogQueryParams = {}): Promise<SensitivityLog[]> {
    const { page = 1, pageSize = 20, resultType } = params;
    const offset = (page - 1) * pageSize;

    let query = this.supabase
      .from('sensitivity_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (resultType) {
      query = query.eq('result_type', resultType);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`查询检测日志失败: ${error.message}`);
    }

    return (data ?? []).map((row) => ({
      id: row.id,
      userId: row.user_id,
      inputDescription: row.input_description,
      inputLyrics: row.input_lyrics,
      resultType: row.result_type as SensitivityLog['resultType'],
      detectedWords: (row.detected_words ?? []) as unknown as DetectedWord[],
      rewrittenPrompt: row.rewritten_prompt,
      styleTags: row.style_tags ?? [],
      userConfirmed: row.user_confirmed,
      detectionSource: row.detection_source,
      durationMs: row.duration_ms,
      createdAt: row.created_at,
    }));
  }

  /**
   * 更新敏感词命中次数统计
   * 当检测到敏感词命中时调用，批量更新 hit_count 和 last_hit_at
   */
  async incrementHitCount(wordIds: string[]): Promise<void> {
    if (!wordIds || wordIds.length === 0) {
      return;
    }

    const now = new Date().toISOString();

    // 逐个更新命中次数（Supabase 不支持批量 increment，使用 rpc 或逐条更新）
    const updatePromises = wordIds.map(async (id) => {
      // 先获取当前 hit_count
      const { data, error: fetchError } = await this.supabase
        .from('sensitive_words')
        .select('hit_count')
        .eq('id', id)
        .single();

      if (fetchError || !data) {
        console.error(`获取敏感词 ${id} 命中次数失败:`, fetchError?.message);
        return;
      }

      const { error: updateError } = await this.supabase
        .from('sensitive_words')
        .update({
          hit_count: (data.hit_count ?? 0) + 1,
          last_hit_at: now,
        })
        .eq('id', id);

      if (updateError) {
        console.error(`更新敏感词 ${id} 命中次数失败:`, updateError.message);
      }
    });

    await Promise.all(updatePromises);
  }
}
