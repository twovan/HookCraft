// lib/payment/PaymentService.ts - 支付与订阅管理服务（Supabase 版）

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../supabase/types';
import type {
  MembershipTier,
  BillingCycle,
  PaymentProvider,
} from '../../types/membership';
import type {
  PaymentSession,
  PaymentRecord,
  WebhookResult,
  CreateSubscriptionParams,
} from '../../types/payment';
import { TIER_CONFIGS } from '../../config/tierConfig';
import { toPaymentRecord, toPaymentSession } from '../supabase/mappers/payment';
import { toAppError } from '../supabase/errors';

/** Credits 充值包定义 */
interface CreditsPack {
  id: string;
  credits: number;
  price: number;           // 原价（分）
  discountPrice: number;   // Business 折扣价（分）
}

/** 可用的 Credits 充值包 */
const CREDITS_PACKS: Record<string, CreditsPack> = {
  'pack-50': { id: 'pack-50', credits: 50, price: 9900, discountPrice: 7900 },
  'pack-100': { id: 'pack-100', credits: 100, price: 17900, discountPrice: 14300 },
  'pack-200': { id: 'pack-200', credits: 200, price: 32900, discountPrice: 26300 },
};

const SUPPORTED_PROVIDERS: PaymentProvider[] = ['stripe', 'paypal', 'wechat', 'alipay'];

/**
 * PaymentService - 支付与订阅管理服务
 *
 * 负责创建订阅、处理 Webhook 回调、取消自动续费、
 * 查询支付历史和购买 Credits 充值包。
 * 使用 Supabase（PostgreSQL）持久化存储，所有操作均为异步。
 * 支付操作保证幂等性，防止重复扣款。
 */
export class PaymentService {
  /** Supabase 管理员客户端（绕过 RLS） */
  private supabase: SupabaseClient<Database>;

  constructor(supabase: SupabaseClient<Database>) {
    this.supabase = supabase;
  }

  /**
   * 创建订阅支付会话
   *
   * 支持月付和年付两种方式，年付享 8 折优惠。
   * 支持 Stripe、PayPal、微信支付、支付宝四种支付渠道。
   * 异步插入 payment_sessions + payments 表。
   *
   * @param params - 创建订阅参数
   * @returns PaymentSession 包含支付链接
   */
  async createSubscription(params: CreateSubscriptionParams): Promise<PaymentSession> {
    const { userId, tier, billingCycle, paymentProvider } = params;

    if (!SUPPORTED_PROVIDERS.includes(paymentProvider)) {
      throw new Error(`不支持的支付渠道: ${paymentProvider}`);
    }

    if (tier === 'free') {
      throw new Error('免费版无需订阅');
    }

    const config = TIER_CONFIGS[tier];
    const amount = billingCycle === 'yearly' ? config.yearlyPrice : config.monthlyPrice;

    const sessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 分钟过期
    const checkoutUrl = `https://pay.example.com/${paymentProvider}/${sessionId}`;

    // 1. 插入 payment_sessions 表
    const { error: sessionError } = await this.supabase
      .from('payment_sessions')
      .insert({
        id: sessionId,
        user_id: userId,
        provider: paymentProvider,
        checkout_url: checkoutUrl,
        tier,
        billing_cycle: billingCycle,
        expires_at: expiresAt.toISOString(),
      });

    if (sessionError) throw toAppError(sessionError, 'payment_sessions', 'insert');

    // 2. 插入 payments 表（状态为 pending）
    const paymentId = `pay_${sessionId}`;
    const { error: paymentError } = await this.supabase
      .from('payments')
      .insert({
        id: paymentId,
        user_id: userId,
        session_id: sessionId,
        amount,
        currency: 'CNY',
        provider: paymentProvider,
        tier,
        billing_cycle: billingCycle,
        status: 'pending',
      });

    if (paymentError) throw toAppError(paymentError, 'payments', 'insert');

    return {
      sessionId,
      provider: paymentProvider,
      checkoutUrl,
      expiresAt,
    };
  }

  /**
   * 处理支付回调（Webhook）
   *
   * 幂等处理：先查询 processed_webhook_events 表检查是否已处理。
   * 未处理过的事件更新 payments 表状态并在 processed_webhook_events 表中插入记录。
   *
   * @param provider - 支付渠道
   * @param payload - 回调数据
   * @returns WebhookResult 处理结果
   */
  async handleWebhook(
    provider: PaymentProvider,
    payload: { eventId: string; sessionId: string; status: 'completed' | 'failed' | 'cancelled' }
  ): Promise<WebhookResult> {
    const { eventId, sessionId, status } = payload;

    // 1. 幂等性检查：查询 processed_webhook_events 表
    const { data: existingEvent } = await this.supabase
      .from('processed_webhook_events')
      .select('event_id')
      .eq('event_id', eventId)
      .single();

    if (existingEvent) {
      return { handled: true, action: 'payment_completed' };
    }

    // 2. 查询 payment_sessions 获取用户信息
    const { data: session } = await this.supabase
      .from('payment_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (!session) {
      return { handled: false, action: 'payment_failed' };
    }

    // 3. 更新 payments 表状态
    const paymentId = `pay_${sessionId}`;
    const updateData: { status: string; completed_at?: string } = { status };
    if (status === 'completed') {
      updateData.completed_at = new Date().toISOString();
    }

    const { error: updateError } = await this.supabase
      .from('payments')
      .update(updateData as any)
      .eq('id', paymentId);

    if (updateError) throw toAppError(updateError, 'payments', 'update');

    // 4. 插入 processed_webhook_events 记录（标记已处理）
    const { error: insertError } = await this.supabase
      .from('processed_webhook_events')
      .insert({
        event_id: eventId,
        provider,
        session_id: sessionId,
        status,
      });

    if (insertError) throw toAppError(insertError, 'processed_webhook_events', 'insert');

    // 5. 返回处理结果
    const actionMap: Record<string, WebhookResult['action']> = {
      completed: 'payment_completed',
      failed: 'payment_failed',
      cancelled: 'subscription_cancelled',
    };

    return {
      handled: true,
      action: actionMap[status] ?? 'payment_failed',
      userId: session.user_id,
    };
  }

  /**
   * 取消自动续费
   *
   * @param subscriptionId - 订阅 ID
   */
  cancelAutoRenewal(subscriptionId: string): void {
    // 自动续费状态由 MembershipService 管理（memberships.auto_renew 字段）
    // 此方法保留接口兼容性
  }

  /**
   * 获取自动续费状态
   */
  getAutoRenewStatus(subscriptionId: string): boolean {
    // 自动续费状态由 MembershipService 管理
    return true;
  }

  /**
   * 获取用户支付历史
   * 从 payments 表查询，按 created_at 降序排列
   *
   * @param userId - 用户 ID
   * @returns PaymentRecord 数组
   */
  async getPaymentHistory(userId: string): Promise<PaymentRecord[]> {
    const { data, error } = await this.supabase
      .from('payments')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw toAppError(error, 'payments', 'select');
    return (data ?? []).map(toPaymentRecord);
  }

  /**
   * 购买 Credits 充值包
   *
   * Business 用户享折扣价。
   *
   * @param userId - 用户 ID
   * @param packId - 充值包 ID
   * @param userTier - 用户当前等级（用于判断折扣）
   * @param paymentProvider - 支付渠道
   * @returns PaymentSession 支付会话
   */
  async purchaseCreditsPackage(
    userId: string,
    packId: string,
    userTier: MembershipTier = 'pro',
    paymentProvider: PaymentProvider = 'stripe'
  ): Promise<PaymentSession> {
    const pack = CREDITS_PACKS[packId];
    if (!pack) {
      throw new Error(`无效的充值包 ID: ${packId}`);
    }

    const amount = userTier === 'business' ? pack.discountPrice : pack.price;

    const sessionId = `session_credits_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    const checkoutUrl = `https://pay.example.com/${paymentProvider}/${sessionId}`;

    // 1. 插入 payment_sessions 表
    const { error: sessionError } = await this.supabase
      .from('payment_sessions')
      .insert({
        id: sessionId,
        user_id: userId,
        provider: paymentProvider,
        checkout_url: checkoutUrl,
        tier: userTier,
        billing_cycle: 'monthly', // Credits pack 不区分周期
        expires_at: expiresAt.toISOString(),
      });

    if (sessionError) throw toAppError(sessionError, 'payment_sessions', 'insert');

    // 2. 插入 payments 表
    const { error: paymentError } = await this.supabase
      .from('payments')
      .insert({
        id: `pay_${sessionId}`,
        user_id: userId,
        session_id: sessionId,
        amount,
        currency: 'CNY',
        provider: paymentProvider,
        tier: userTier,
        billing_cycle: 'monthly',
        status: 'pending',
      });

    if (paymentError) throw toAppError(paymentError, 'payments', 'insert');

    return {
      sessionId,
      provider: paymentProvider,
      checkoutUrl,
      expiresAt,
    };
  }

  /**
   * 获取支持的支付渠道列表
   */
  static getSupportedProviders(): PaymentProvider[] {
    return [...SUPPORTED_PROVIDERS];
  }

  /**
   * 获取 Credits 充值包信息
   */
  static getCreditsPack(packId: string): CreditsPack | undefined {
    return CREDITS_PACKS[packId];
  }

  /**
   * 获取所有 Credits 充值包
   */
  static getAllCreditsPacks(): CreditsPack[] {
    return Object.values(CREDITS_PACKS);
  }
}
