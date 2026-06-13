// lib/producer/ProducerService.ts - 音乐老师/制作人服务
//
// 负责查询制作人信息、模板列表和推荐制作人。

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../supabase/types';
import type {
  ProducerProfile,
  ProducerSummary,
  ProducerTemplatesQuery,
} from '../../types/producer';
import { toAppError } from '../supabase/errors';
import { normalizeCollaboratorWorks } from './collaboratorWorks';

/**
 * ProducerService - 音乐老师/制作人服务
 *
 * 负责：
 * - 查询制作人详细信息（含模板数量和下载量统计）
 * - 查询制作人的已发布模板（支持风格筛选和分页）
 * - 查询推荐制作人列表
 */
export class ProducerService {
  private supabase: SupabaseClient<Database>;

  constructor(supabase: SupabaseClient<Database>) {
    this.supabase = supabase;
  }

  /**
   * 获取制作人详细信息
   *
   * 查询 producers 表，并统计该制作人的模板数量。
   *
   * @param producerId 制作人 ID
   * @returns ProducerProfile
   */
  async getProducer(producerId: string): Promise<ProducerProfile> {
    // 查询制作人基本信息
    const { data: producer, error: producerError } = await this.supabase
      .from('producers')
      .select('*')
      .eq('id', producerId)
      .eq('status', 'active')
      .single();

    if (producerError) throw toAppError(producerError, 'producers', 'select');

    // 统计该制作人的已发布模板数量
    const { count: templateCount, error: countError } = await this.supabase
      .from('templates')
      .select('id', { count: 'exact', head: true })
      .eq('producer_id', producerId)
      .eq('status', 'published');

    if (countError) throw toAppError(countError, 'templates', 'select');

    // Sum sales_count for all published templates
    const { data: salesData } = await this.supabase
      .from('templates')
      .select('sales_count')
      .eq('producer_id', producerId)
      .eq('status', 'published');
    const totalSales = (salesData || []).reduce((sum: number, t: any) => sum + (t.sales_count || 0), 0);

    return {
      id: producer.id,
      displayName: producer.display_name,
      avatarUrl: producer.avatar_url ?? undefined,
      bio: producer.bio ?? undefined,
      styleTags: producer.style_tags ?? [],
      representativeWorks: producer.representative_works ?? [],
      useCases: producer.use_cases ?? [],
      collaborators: producer.collaborators ?? [],
      collaboratorWorks: normalizeCollaboratorWorks(producer.collaborator_works),
      templateCount: templateCount ?? 0,
      totalDownloads: producer.total_downloads,
      totalSales,
      joinedAt: producer.joined_at,
    };
  }

  /**
   * 获取制作人的已发布模板列表
   *
   * 支持按 genre 标签筛选和分页。
   *
   * @param producerId 制作人 ID
   * @param options 查询选项（genre 筛选、分页）
   * @returns 模板列表和总数
   */
  async getProducerTemplates(
    producerId: string,
    options?: ProducerTemplatesQuery,
  ): Promise<{ templates: Array<{
    id: string;
    name: string;
    description: string;
    genre: string;
    genreTags: string[];
    coverUrl: string | null;
    previewUrl: string | null;
    price: number;
    salesCount: number;
    createdAt: string;
  }>; total: number }> {
    const page = options?.page ?? 1;
    const pageSize = options?.pageSize ?? 20;
    const offset = (page - 1) * pageSize;

    // 构建查询
    let query = this.supabase
      .from('templates')
      .select('*', { count: 'exact' })
      .eq('producer_id', producerId)
      .eq('status', 'published');

    // 风格标签筛选
    if (options?.genre) {
      query = query.contains('genre_tags', [options.genre]);
    }

    // 分页和排序
    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1);

    const { data, error, count } = await query;

    if (error) throw toAppError(error, 'templates', 'select');

    const templates = (data ?? []).map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      genre: t.genre,
      genreTags: t.genre_tags ?? [],
      coverUrl: t.cover_url,
      previewUrl: t.preview_url,
      price: t.price,
      salesCount: t.sales_count,
      createdAt: t.created_at,
    }));

    return {
      templates,
      total: count ?? 0,
    };
  }

  /**
   * 获取推荐制作人列表
   *
   * 查询 is_featured = true 的制作人，默认限制 6 个。
   *
   * @param limit 返回数量限制（默认 6）
   * @returns ProducerSummary 数组
   */
  async getFeaturedProducers(limit = 6): Promise<ProducerSummary[]> {
    const { data, error } = await this.supabase
      .from('producers')
      .select('*')
      .eq('is_featured', true)
      .eq('status', 'active')
      .order('total_downloads', { ascending: false })
      .limit(limit);

    if (error) throw toAppError(error, 'producers', 'select');

    // 为每个制作人统计模板数量
    const producers: ProducerSummary[] = await Promise.all(
      (data ?? []).map(async (p) => {
        const { count, error: countError } = await this.supabase
          .from('templates')
          .select('id', { count: 'exact', head: true })
          .eq('producer_id', p.id)
          .eq('status', 'published');

        if (countError) throw toAppError(countError, 'templates', 'select');

        return {
          id: p.id,
          displayName: p.display_name,
          avatarUrl: p.avatar_url ?? undefined,
          styleTags: p.style_tags ?? [],
          templateCount: count ?? 0,
        };
      }),
    );

    return producers;
  }
}
