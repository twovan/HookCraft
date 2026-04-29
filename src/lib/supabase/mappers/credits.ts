// mappers/credits.ts - CreditInfo / CreditHistory / PreviewCountInfo ↔ DB 行转换

import type { Tables, UpdateTables } from '../types';
import type { CreditInfo, CreditHistory, PreviewCountInfo } from '../../../types/credits';

/**
 * 将数据库 credits 行转换为业务层 CreditInfo 对象
 */
export function toCreditInfo(row: Tables<'credits'>): CreditInfo {
  return {
    userId: row.user_id,
    tier: row.tier,
    used: row.used,
    total: row.total,
    remaining: row.total - row.used,
    periodStart: new Date(row.period_start),
    periodEnd: new Date(row.period_end),
  };
}

/**
 * 将业务层 CreditInfo 转换为数据库 credits 更新对象
 */
export function fromCreditInfo(info: CreditInfo): Partial<UpdateTables<'credits'>> {
  return {
    user_id: info.userId,
    tier: info.tier,
    used: info.used,
    total: info.total,
    period_start: info.periodStart.toISOString(),
    period_end: info.periodEnd.toISOString(),
  };
}

/**
 * 将数据库 credit_history 行转换为业务层 CreditHistory 对象
 */
export function toCreditHistory(row: Tables<'credit_history'>): CreditHistory {
  return {
    month: row.month,
    used: row.used,
    total: row.total,
  };
}

/**
 * 将数据库 preview_counts 行转换为业务层 PreviewCountInfo 对象
 */
export function toPreviewCount(row: Tables<'preview_counts'>): PreviewCountInfo {
  return {
    userId: row.user_id,
    used: row.used,
    total: row.total,
    remaining: row.total - row.used,
  };
}
