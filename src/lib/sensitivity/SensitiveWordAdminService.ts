// lib/sensitivity/SensitiveWordAdminService.ts - 敏感词库管理后台服务

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../supabase/types';
import type {
  SensitiveWordEntry,
  SensitiveWordCategory,
} from '@/types/sensitivity';

/** 敏感词列表查询参数 */
export interface WordListParams {
  page?: number;
  pageSize?: number;
  category?: SensitiveWordCategory;
}

/** 新增敏感词输入 */
export interface CreateWordInput {
  word: string;
  category: SensitiveWordCategory;
  variants?: string[];
  note?: string;
}

/** 编辑敏感词输入 */
export interface UpdateWordInput {
  word?: string;
  category?: SensitiveWordCategory;
  variants?: string[];
  note?: string;
}

/** 批量导入输入 */
export interface BatchImportInput {
  words: Array<{
    word: string;
    category: SensitiveWordCategory;
    variants?: string[];
    note?: string;
  }>;
}

/**
 * SensitiveWordAdminService - 敏感词库管理后台服务
 *
 * 提供敏感词的 CRUD 操作和批量导入功能，供管理后台使用。
 * 支持分页查询、按分类筛选、去重导入等能力。
 */
export class SensitiveWordAdminService {
  private supabase: SupabaseClient<Database>;

  constructor(supabase: SupabaseClient<Database>) {
    this.supabase = supabase;
  }

  /**
   * 获取敏感词列表（支持分页、按分类筛选）
   * Requirements: 8.1
   */
  async list(params: WordListParams = {}): Promise<{ words: SensitiveWordEntry[]; total: number }> {
    const { page = 1, pageSize = 20, category } = params;
    const offset = (page - 1) * pageSize;

    // 构建查询 - 获取总数
    let countQuery = this.supabase
      .from('sensitive_words')
      .select('*', { count: 'exact', head: true });

    if (category) {
      countQuery = countQuery.eq('category', category);
    }

    const { count, error: countError } = await countQuery;

    if (countError) {
      throw new Error(`查询敏感词总数失败: ${countError.message}`);
    }

    // 构建查询 - 获取数据
    let dataQuery = this.supabase
      .from('sensitive_words')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (category) {
      dataQuery = dataQuery.eq('category', category);
    }

    const { data, error: dataError } = await dataQuery;

    if (dataError) {
      throw new Error(`查询敏感词列表失败: ${dataError.message}`);
    }

    const words: SensitiveWordEntry[] = (data ?? []).map((row) => ({
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

    return { words, total: count ?? 0 };
  }

  /**
   * 新增敏感词
   * Requirements: 8.2
   */
  async create(input: CreateWordInput): Promise<SensitiveWordEntry> {
    const { word, category, variants = [], note = '' } = input;

    if (!word || word.trim().length === 0) {
      throw new Error('敏感词内容不能为空');
    }

    const { data, error } = await this.supabase
      .from('sensitive_words')
      .insert({
        word: word.trim(),
        category,
        variants,
        note,
      })
      .select()
      .single();

    if (error) {
      // 处理唯一约束冲突
      if (error.code === '23505') {
        throw new Error(`敏感词 "${word}" 在分类 "${category}" 中已存在`);
      }
      throw new Error(`新增敏感词失败: ${error.message}`);
    }

    return {
      id: data.id,
      word: data.word,
      category: data.category as SensitiveWordCategory,
      variants: data.variants ?? [],
      note: data.note ?? '',
      hitCount: data.hit_count ?? 0,
      lastHitAt: data.last_hit_at,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  /**
   * 编辑敏感词
   * Requirements: 8.3
   */
  async update(id: string, input: UpdateWordInput): Promise<SensitiveWordEntry> {
    if (!id) {
      throw new Error('敏感词 ID 不能为空');
    }

    const updateData: Database['public']['Tables']['sensitive_words']['Update'] = {};

    if (input.word !== undefined) {
      if (input.word.trim().length === 0) {
        throw new Error('敏感词内容不能为空');
      }
      updateData.word = input.word.trim();
    }
    if (input.category !== undefined) {
      updateData.category = input.category;
    }
    if (input.variants !== undefined) {
      updateData.variants = input.variants;
    }
    if (input.note !== undefined) {
      updateData.note = input.note;
    }

    const { data, error } = await this.supabase
      .from('sensitive_words')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new Error(`敏感词 "${input.word}" 在分类 "${input.category}" 中已存在`);
      }
      if (error.code === 'PGRST116') {
        throw new Error(`敏感词 ID "${id}" 不存在`);
      }
      throw new Error(`编辑敏感词失败: ${error.message}`);
    }

    return {
      id: data.id,
      word: data.word,
      category: data.category as SensitiveWordCategory,
      variants: data.variants ?? [],
      note: data.note ?? '',
      hitCount: data.hit_count ?? 0,
      lastHitAt: data.last_hit_at,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  /**
   * 删除敏感词
   * Requirements: 8.4
   */
  async delete(id: string): Promise<void> {
    if (!id) {
      throw new Error('敏感词 ID 不能为空');
    }

    const { error } = await this.supabase
      .from('sensitive_words')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`删除敏感词失败: ${error.message}`);
    }
  }

  /**
   * 批量导入敏感词（去重处理）
   * Requirements: 8.5
   *
   * 对于已存在的 (word, category) 组合，跳过不导入。
   * 返回实际导入数量和跳过数量。
   */
  async batchImport(input: BatchImportInput): Promise<{ imported: number; skipped: number }> {
    const { words } = input;

    if (!words || words.length === 0) {
      return { imported: 0, skipped: 0 };
    }

    // 去重：输入列表内部去重（基于 word + category）
    const uniqueMap = new Map<string, BatchImportInput['words'][number]>();
    for (const item of words) {
      if (!item.word || item.word.trim().length === 0) continue;
      const key = `${item.word.trim().toLowerCase()}|${item.category}`;
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, { ...item, word: item.word.trim() });
      }
    }

    const uniqueWords = Array.from(uniqueMap.values());

    if (uniqueWords.length === 0) {
      return { imported: 0, skipped: 0 };
    }

    // 查询数据库中已存在的词（基于 word + category 组合）
    const { data: existingData, error: fetchError } = await this.supabase
      .from('sensitive_words')
      .select('word, category');

    if (fetchError) {
      throw new Error(`查询已有敏感词失败: ${fetchError.message}`);
    }

    const existingSet = new Set(
      (existingData ?? []).map((row) => `${row.word.toLowerCase()}|${row.category}`)
    );

    // 过滤出需要新增的词
    const toInsert = uniqueWords.filter((item) => {
      const key = `${item.word.toLowerCase()}|${item.category}`;
      return !existingSet.has(key);
    });

    const skipped = uniqueWords.length - toInsert.length;

    if (toInsert.length === 0) {
      return { imported: 0, skipped };
    }

    // 批量插入
    const insertData = toInsert.map((item) => ({
      word: item.word,
      category: item.category,
      variants: item.variants ?? [],
      note: item.note ?? '',
    }));

    const { error: insertError } = await this.supabase
      .from('sensitive_words')
      .insert(insertData);

    if (insertError) {
      throw new Error(`批量导入敏感词失败: ${insertError.message}`);
    }

    return { imported: toInsert.length, skipped };
  }
}
