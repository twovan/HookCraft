// mappers/admin.ts - AdminConfig / ConfigChangeLog ↔ DB 行转换

import type { Tables, UpdateTables } from '../types';
import type { AdminFullConfig, ConfigChangeLog } from '../../../types/admin';

/**
 * 将多条 admin_config 行组装为业务层 AdminFullConfig 对象
 * 每条行的 config_type 对应 AdminFullConfig 的一个字段
 * JSONB config_data 直接解析为对应的 TypeScript 类型
 */
export function toAdminConfig(rows: Tables<'admin_config'>[]): AdminFullConfig {
  const config: AdminFullConfig = {
    creditQuotas: [],
    costRules: [],
    pricing: [],
    creditsPacks: [],
  };

  for (const row of rows) {
    const data = row.config_data;
    switch (row.config_type) {
      case 'credit_quota':
        config.creditQuotas = data as unknown as AdminFullConfig['creditQuotas'];
        break;
      case 'cost_rule':
        config.costRules = data as unknown as AdminFullConfig['costRules'];
        break;
      case 'pricing':
        config.pricing = data as unknown as AdminFullConfig['pricing'];
        break;
      case 'credits_pack':
        config.creditsPacks = data as unknown as AdminFullConfig['creditsPacks'];
        break;
    }
  }

  return config;
}

/**
 * 将业务层 AdminFullConfig 转换为数据库 admin_config 更新记录数组
 * 每个配置类型对应一条记录
 */
export function fromAdminConfig(
  config: Partial<AdminFullConfig>
): Array<{ config_type: Tables<'admin_config'>['config_type']; config_data: Record<string, unknown> }> {
  const records: Array<{ config_type: Tables<'admin_config'>['config_type']; config_data: Record<string, unknown> }> = [];

  if (config.creditQuotas !== undefined) {
    records.push({
      config_type: 'credit_quota',
      config_data: config.creditQuotas as unknown as Record<string, unknown>,
    });
  }
  if (config.costRules !== undefined) {
    records.push({
      config_type: 'cost_rule',
      config_data: config.costRules as unknown as Record<string, unknown>,
    });
  }
  if (config.pricing !== undefined) {
    records.push({
      config_type: 'pricing',
      config_data: config.pricing as unknown as Record<string, unknown>,
    });
  }
  if (config.creditsPacks !== undefined) {
    records.push({
      config_type: 'credits_pack',
      config_data: config.creditsPacks as unknown as Record<string, unknown>,
    });
  }

  return records;
}

/**
 * 将数据库 config_changelog 行转换为业务层 ConfigChangeLog 对象
 */
export function toConfigChangelog(row: Tables<'config_changelog'>): ConfigChangeLog {
  return {
    id: row.id,
    operatorId: row.operator_id,
    operatorName: row.operator_name,
    configType: row.config_type,
    previousValue: row.previous_value,
    newValue: row.new_value,
    changedAt: new Date(row.changed_at),
    description: row.description,
  };
}
