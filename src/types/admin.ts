// types/admin.ts - 后台配置管理类型定义

import type { MembershipTier } from './membership';
import type { CreditOperationType } from './credits';

/** 管理员 Credits 配额配置 */
export interface AdminCreditConfig {
  tier: MembershipTier;
  monthlyCredits: number;
}

/** 管理员消耗规则配置 */
export interface AdminCostRule {
  operation: CreditOperationType;
  cost: number;
  description: string;
  actualCostCents?: number;
  profitMarginPercent?: number;
  suggestedCost?: number;
  enabled?: boolean;
}

/** 管理员价格配置 */
export interface AdminPriceConfig {
  tier: MembershipTier;
  monthlyPrice: number;     // 月付价格（分）
  yearlyPrice: number;      // 年付价格（分）
}

/** Credits_Pack 规格配置 */
export interface CreditsPack {
  id: string;
  credits: number;          // 包含的 Credits 数量
  price: number;            // 价格（分）
  businessDiscount: number; // Business 用户折扣比例（0-1，如 0.8 表示 8 折）
}

/** 完整管理配置 */
export interface AdminFullConfig {
  creditQuotas: AdminCreditConfig[];
  costRules: AdminCostRule[];
  pricing: AdminPriceConfig[];
  creditsPacks: CreditsPack[];
}

/** 管理员配置更新请求 */
export interface AdminConfigUpdate {
  creditQuotas?: AdminCreditConfig[];
  costRules?: AdminCostRule[];
  pricing?: AdminPriceConfig[];
  creditsPacks?: CreditsPack[];
}

/** 配置差异项 */
export interface ConfigDiffItem {
  field: string;
  oldValue: unknown;
  newValue: unknown;
}

/** 配置预览结果 */
export interface ConfigPreview {
  diffs: ConfigDiffItem[];
  estimatedAffectedUsers: number;
  affectedModules: string[];
}

/** 配置变更日志 */
export interface ConfigChangeLog {
  id: string;
  operatorId: string;       // 操作人员 ID
  operatorName: string;     // 操作人员名称
  configType: 'credit_quota' | 'cost_rule' | 'pricing' | 'credits_pack';
  previousValue: unknown;
  newValue: unknown;
  changedAt: Date;
  description: string;      // 变更描述
}
