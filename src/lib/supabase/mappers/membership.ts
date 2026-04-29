// mappers/membership.ts - MembershipInfo ↔ memberships 行转换

import type { Tables, UpdateTables } from '../types';
import type { MembershipInfo } from '../../../types/membership';

/**
 * 将数据库 memberships 行转换为业务层 MembershipInfo 对象
 * - snake_case → camelCase
 * - timestamptz string → Date | null
 * - 枚举直接映射（值相同）
 */
export function toMembershipInfo(row: Tables<'memberships'>): MembershipInfo {
  return {
    userId: row.user_id,
    tier: row.tier,
    billingCycle: row.billing_cycle,
    startDate: row.start_date ? new Date(row.start_date) : null,
    expiresAt: row.expires_at ? new Date(row.expires_at) : null,
    autoRenew: row.auto_renew,
    paymentProvider: row.payment_provider,
    subscriptionId: row.subscription_id,
    status: row.status,
  };
}

/**
 * 将业务层 MembershipInfo 转换为数据库 memberships 更新对象
 * - camelCase → snake_case
 * - Date → ISO string
 * - 枚举直接映射
 */
export function fromMembershipInfo(info: MembershipInfo): Partial<UpdateTables<'memberships'>> {
  return {
    user_id: info.userId,
    tier: info.tier,
    billing_cycle: info.billingCycle,
    start_date: info.startDate ? info.startDate.toISOString() : null,
    expires_at: info.expiresAt ? info.expiresAt.toISOString() : null,
    auto_renew: info.autoRenew,
    payment_provider: info.paymentProvider,
    subscription_id: info.subscriptionId,
    status: info.status,
  };
}
