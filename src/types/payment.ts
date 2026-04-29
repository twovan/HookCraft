// types/payment.ts - 支付相关类型定义

import type { MembershipTier, BillingCycle, PaymentProvider, FeatureKey } from './membership';

/** 支付会话 */
export interface PaymentSession {
  sessionId: string;
  provider: PaymentProvider;
  checkoutUrl: string;
  expiresAt: Date;
}

/** 支付记录 */
export interface PaymentRecord {
  id: string;
  userId: string;
  amount: number;                 // 金额（分）
  currency: 'CNY';
  provider: PaymentProvider;
  tier: MembershipTier;
  billingCycle: BillingCycle;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  createdAt: Date;
  completedAt: Date | null;
}

/** 升级结果 */
export interface UpgradeResult {
  success: boolean;
  proratedAmount: number;         // 需补差价（分）
  paymentSession?: PaymentSession;
  error?: string;
}

/** 降级结果 */
export interface DowngradeResult {
  success: boolean;
  effectiveDate: Date;            // 降级生效日期（当前周期结束）
  lostFeatures: FeatureKey[];     // 将失去的功能列表
}

/** 取消订阅结果 */
export interface CancelResult {
  success: boolean;
  effectiveDate: Date;            // 取消生效日期
  retainedUntil: Date;            // 权限保留至
}

/** Webhook 处理结果 */
export interface WebhookResult {
  handled: boolean;
  action: 'subscription_created' | 'payment_completed' | 'payment_failed' | 'subscription_cancelled';
  userId?: string;
}

/** 创建订阅参数 */
export interface CreateSubscriptionParams {
  userId: string;
  tier: MembershipTier;
  billingCycle: BillingCycle;
  paymentProvider: PaymentProvider;
}
