// lib/template/TemplateService.ts - 模板管理服务（Supabase 版）

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../supabase/types';
import type { MembershipTier } from '../../types/membership';
import type { Template, TemplateCategory } from '../../types/template';
import { TIER_CONFIGS } from '../../config/tierConfig';
import { toTemplate } from '../supabase/mappers/template';
import { toAppError } from '../supabase/errors';

/**
 * TemplateService - 模板管理服务
 *
 * 负责模板的查询、分类过滤和访问权限校验。
 * Free 用户仅可使用 free_template，Pro/Business 用户可使用全部模板。
 * 使用 Supabase（PostgreSQL）持久化存储，所有操作均为异步。
 */
export class TemplateService {
  /** Supabase 管理员客户端（绕过 RLS） */
  private supabase: SupabaseClient<Database>;

  constructor(supabase: SupabaseClient<Database>) {
    this.supabase = supabase;
  }

  /**
   * 获取所有模板
   * 从 templates 表查询所有记录
   */
  async getTemplates(): Promise<Template[]> {
    const { data, error } = await this.supabase
      .from('templates')
      .select('*');

    if (error) throw toAppError(error, 'templates', 'select');
    return (data ?? []).map(toTemplate);
  }

  /**
   * 根据 ID 获取单个模板
   * 不存在时返回 undefined
   */
  async getTemplateById(id: string): Promise<Template | undefined> {
    const { data, error } = await this.supabase
      .from('templates')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      // PGRST116 表示 "Row not found"，返回 undefined 而非抛出错误
      if (error.code === 'PGRST116') {
        return undefined;
      }
      throw toAppError(error, 'templates', 'select');
    }
    return toTemplate(data);
  }

  /**
   * 按分类过滤模板
   */
  async getTemplatesByCategory(category: TemplateCategory): Promise<Template[]> {
    const { data, error } = await this.supabase
      .from('templates')
      .select('*')
      .eq('category', category);

    if (error) throw toAppError(error, 'templates', 'select');
    return (data ?? []).map(toTemplate);
  }

  /**
   * 检查指定用户等级是否可以访问某模板
   *
   * - Free 用户仅可使用 free_template
   * - Pro/Business 用户可使用全部模板（free_template + paid_template）
   *
   * 模板不存在时返回 false
   */
  async isTemplateAccessible(userTier: MembershipTier, templateId: string): Promise<boolean> {
    const template = await this.getTemplateById(templateId);
    if (!template) {
      return false;
    }

    const tierFeatures = TIER_CONFIGS[userTier].features;
    return tierFeatures.includes(template.category);
  }
}
