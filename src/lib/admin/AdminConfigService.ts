// lib/admin/AdminConfigService.ts - 后台 Credits 配置管理服务（Supabase 版）
//
// 管理员通过 Admin_Panel 配置等级配额、消耗规则、价格和 Credits_Pack。
// 使用 Supabase（PostgreSQL）持久化存储，所有操作均为异步。

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../supabase/types';
import type {
  AdminFullConfig,
  AdminConfigUpdate,
  AdminCreditConfig,
  AdminCostRule,
  AdminPriceConfig,
  CreditsPack,
  ConfigChangeLog,
  ConfigPreview,
  ConfigDiffItem,
} from '../../types/admin';
import type { MembershipTier } from '../../types/membership';
import { toAdminConfig, toConfigChangelog } from '../supabase/mappers/admin';
import { toAppError } from '../supabase/errors';

/** 模拟用户数据（用于预估受影响用户数） */
const SIMULATED_USER_COUNTS: Record<MembershipTier, number> = {
  free: 5000,
  pro: 1200,
  business: 300,
};

/** config_type 到变更描述的映射 */
const CONFIG_TYPE_DESCRIPTIONS: Record<ConfigChangeLog['configType'], string> = {
  credit_quota: '更新等级 Credits 配额',
  cost_rule: '更新 Credits 消耗规则',
  pricing: '更新会员价格配置',
  credits_pack: '更新 Credits_Pack 配置',
};

/**
 * AdminConfigService - 后台 Credits 配置管理服务
 *
 * 负责：
 * - 获取当前配置（等级配额、消耗规则、价格、Credits_Pack）
 * - 更新配置（持久化到 admin_config 表）
 * - 预览配置变更影响（差异对比、受影响用户数、涉及功能模块）
 * - 记录配置变更历史（config_changelog 表）
 *
 * 使用 Supabase（PostgreSQL）持久化存储，所有操作均为异步。
 */
export class AdminConfigService {
  /** Supabase 管理员客户端（绕过 RLS） */
  private supabase: SupabaseClient<Database>;

  constructor(supabase: SupabaseClient<Database>) {
    this.supabase = supabase;
  }

  /**
   * 获取当前配置（等级配额、消耗规则、价格、Credits_Pack）。
   * 从 admin_config 表查询所有配置类型的记录，组装为 AdminFullConfig 对象。
   */
  async getCurrentConfig(): Promise<AdminFullConfig> {
    const { data, error } = await this.supabase
      .from('admin_config')
      .select('*');

    if (error) throw toAppError(error, 'admin_config', 'select');
    return toAdminConfig(data ?? []);
  }

  /**
   * 更新配置。持久化到 admin_config 表，并在 config_changelog 表中插入变更日志。
   *
   * @param update 要更新的配置项（部分更新）
   * @param operatorId 操作人员 ID
   */
  async updateConfig(update: AdminConfigUpdate, operatorId: string): Promise<void> {
    // 获取当前配置用于记录变更前的值
    const previous = await this.getCurrentConfig();

    if (update.creditQuotas) {
      await this.upsertConfigAndLog(
        'credit_quota',
        previous.creditQuotas,
        update.creditQuotas,
        operatorId,
      );
    }

    if (update.costRules) {
      await this.upsertConfigAndLog(
        'cost_rule',
        previous.costRules,
        update.costRules,
        operatorId,
      );
    }

    if (update.pricing) {
      await this.upsertConfigAndLog(
        'pricing',
        previous.pricing,
        update.pricing,
        operatorId,
      );
    }

    if (update.creditsPacks) {
      await this.upsertConfigAndLog(
        'credits_pack',
        previous.creditsPacks,
        update.creditsPacks,
        operatorId,
      );
    }
  }

  /**
   * 预览配置变更影响。
   * 展示修改后的配置与当前配置的差异对比以及预估影响范围。
   *
   * @param update 要预览的配置变更
   * @returns ConfigPreview 包含差异列表、受影响用户数和涉及功能模块
   */
  async previewConfigChange(update: AdminConfigUpdate): Promise<ConfigPreview> {
    const currentConfig = await this.getCurrentConfig();
    const diffs: ConfigDiffItem[] = [];
    const affectedTiers = new Set<MembershipTier>();
    const affectedModules: string[] = [];

    if (update.creditQuotas) {
      for (const newQuota of update.creditQuotas) {
        const current = currentConfig.creditQuotas.find((q) => q.tier === newQuota.tier);
        if (current && current.monthlyCredits !== newQuota.monthlyCredits) {
          diffs.push({
            field: `${newQuota.tier}.monthlyCredits`,
            oldValue: current.monthlyCredits,
            newValue: newQuota.monthlyCredits,
          });
          affectedTiers.add(newQuota.tier);
        }
      }
      if (diffs.length > 0) affectedModules.push('credit_quota');
    }

    if (update.costRules) {
      for (const newRule of update.costRules) {
        const current = currentConfig.costRules.find((r) => r.operation === newRule.operation);
        if (current && current.cost !== newRule.cost) {
          diffs.push({
            field: `costRule.${newRule.operation}`,
            oldValue: current.cost,
            newValue: newRule.cost,
          });
        }
      }
      if (update.costRules.some((r) => {
        const cur = currentConfig.costRules.find((c) => c.operation === r.operation);
        return cur && cur.cost !== r.cost;
      })) {
        affectedModules.push('cost_rule');
        affectedTiers.add('pro');
        affectedTiers.add('business');
      }
    }

    if (update.pricing) {
      for (const newPrice of update.pricing) {
        const current = currentConfig.pricing.find((p) => p.tier === newPrice.tier);
        if (current) {
          if (current.monthlyPrice !== newPrice.monthlyPrice) {
            diffs.push({
              field: `${newPrice.tier}.monthlyPrice`,
              oldValue: current.monthlyPrice,
              newValue: newPrice.monthlyPrice,
            });
            affectedTiers.add(newPrice.tier);
          }
          if (current.yearlyPrice !== newPrice.yearlyPrice) {
            diffs.push({
              field: `${newPrice.tier}.yearlyPrice`,
              oldValue: current.yearlyPrice,
              newValue: newPrice.yearlyPrice,
            });
            affectedTiers.add(newPrice.tier);
          }
        }
      }
      if (diffs.some((d) => d.field.includes('Price'))) {
        affectedModules.push('pricing');
      }
    }

    if (update.creditsPacks) {
      for (const newPack of update.creditsPacks) {
        const current = currentConfig.creditsPacks.find((p) => p.id === newPack.id);
        if (current) {
          if (current.price !== newPack.price || current.credits !== newPack.credits || current.businessDiscount !== newPack.businessDiscount) {
            diffs.push({
              field: `creditsPack.${newPack.id}`,
              oldValue: current,
              newValue: newPack,
            });
          }
        } else {
          diffs.push({
            field: `creditsPack.${newPack.id}`,
            oldValue: null,
            newValue: newPack,
          });
        }
      }
      if (diffs.some((d) => d.field.startsWith('creditsPack'))) {
        affectedModules.push('credits_pack');
        affectedTiers.add('pro');
        affectedTiers.add('business');
      }
    }

    const estimatedAffectedUsers = Array.from(affectedTiers).reduce(
      (sum, tier) => sum + SIMULATED_USER_COUNTS[tier],
      0,
    );

    return { diffs, estimatedAffectedUsers, affectedModules };
  }

  /**
   * 获取配置变更历史。
   * 从 config_changelog 表查询变更日志，按 changed_at 降序排列。
   *
   * @param limit 返回的最大条目数
   * @returns ConfigChangeLog[] 按时间倒序排列
   */
  async getChangeHistory(limit: number): Promise<ConfigChangeLog[]> {
    const { data, error } = await this.supabase
      .from('config_changelog')
      .select('*')
      .order('changed_at', { ascending: false })
      .limit(limit);

    if (error) throw toAppError(error, 'config_changelog', 'select');
    return (data ?? []).map(toConfigChangelog);
  }

  // ─── 内部方法 ───────────────────────────────────────────

  /**
   * 更新 admin_config 表中指定 config_type 的记录，并插入 config_changelog 变更日志。
   * 使用 upsert 确保记录存在时更新、不存在时插入。
   */
  private async upsertConfigAndLog(
    configType: ConfigChangeLog['configType'],
    previousValue: unknown,
    newValue: unknown,
    operatorId: string,
  ): Promise<void> {
    const now = new Date().toISOString();

    // 更新 admin_config 表（upsert by config_type）
    const { error: upsertError } = await this.supabase
      .from('admin_config')
      .upsert(
        {
          config_type: configType,
          config_data: newValue as unknown as Record<string, unknown>,
          updated_at: now,
        },
        { onConflict: 'config_type' },
      );

    if (upsertError) throw toAppError(upsertError, 'admin_config', 'upsert');

    // 插入 config_changelog 变更日志
    const logId = `log-${configType}-${Date.now()}`;
    const { error: logError } = await this.supabase
      .from('config_changelog')
      .insert({
        id: logId,
        operator_id: operatorId,
        operator_name: `管理员 ${operatorId}`,
        config_type: configType,
        previous_value: previousValue as unknown as Record<string, unknown>,
        new_value: newValue as unknown as Record<string, unknown>,
        changed_at: now,
        description: CONFIG_TYPE_DESCRIPTIONS[configType],
      });

    if (logError) throw toAppError(logError, 'config_changelog', 'insert');
  }
}
