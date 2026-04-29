// mappers/payment.ts - PaymentRecord / PaymentSession ↔ DB 行转换

import type { Tables, UpdateTables } from '../types';
import type { PaymentRecord, PaymentSession } from '../../../types/payment';

/**
 * 将数据库 payments 行转换为业务层 PaymentRecord 对象
 */
export function toPaymentRecord(row: Tables<'payments'>): PaymentRecord {
  return {
    id: row.id,
    userId: row.user_id,
    amount: row.amount,
    currency: row.currency as 'CNY',
    provider: row.provider,
    tier: row.tier,
    billingCycle: row.billing_cycle,
    status: row.status,
    createdAt: new Date(row.created_at),
    completedAt: row.completed_at ? new Date(row.completed_at) : null,
  };
}

/**
 * 将业务层 PaymentRecord 转换为数据库 payments 更新对象
 */
export function fromPaymentRecord(info: PaymentRecord): Partial<UpdateTables<'payments'>> {
  return {
    id: info.id,
    user_id: info.userId,
    amount: info.amount,
    currency: info.currency,
    provider: info.provider,
    tier: info.tier,
    billing_cycle: info.billingCycle,
    status: info.status,
    created_at: info.createdAt.toISOString(),
    completed_at: info.completedAt ? info.completedAt.toISOString() : null,
  };
}

/**
 * 将数据库 payment_sessions 行转换为业务层 PaymentSession 对象
 */
export function toPaymentSession(row: Tables<'payment_sessions'>): PaymentSession {
  return {
    sessionId: row.id,
    provider: row.provider,
    checkoutUrl: row.checkout_url,
    expiresAt: new Date(row.expires_at),
  };
}
