// PaymentService 单元测试（Supabase 版）
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PaymentService } from './PaymentService';
import { TIER_CONFIGS } from '../../config/tierConfig';
import type { CreateSubscriptionParams } from '../../types/payment';

/**
 * 创建 mock Supabase 客户端
 * 模拟 payment_sessions、payments、processed_webhook_events 表的链式调用
 */
function createMockSupabase() {
  // --- select chain mocks ---
  const mockSingle = vi.fn();
  const mockOrder = vi.fn();
  const mockSelectEq = vi.fn();
  const mockSelect = vi.fn();

  // --- insert mock ---
  const mockInsert = vi.fn();

  // --- update chain mocks ---
  const mockUpdateEq = vi.fn();
  const mockUpdate = vi.fn();

  // Default behaviors
  mockSingle.mockResolvedValue({ data: null, error: null });
  mockSelectEq.mockReturnValue({ single: mockSingle, order: mockOrder });
  mockOrder.mockResolvedValue({ data: [], error: null });
  mockSelect.mockReturnValue({ eq: mockSelectEq });
  mockInsert.mockResolvedValue({ data: null, error: null });
  mockUpdateEq.mockResolvedValue({ data: null, error: null });
  mockUpdate.mockReturnValue({ eq: mockUpdateEq });

  const mockFrom = vi.fn().mockReturnValue({
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
  });

  const supabase = { from: mockFrom } as any;

  return {
    supabase,
    mockFrom,
    mockSelect,
    mockSelectEq,
    mockSingle,
    mockOrder,
    mockInsert,
    mockUpdate,
    mockUpdateEq,
  };
}

describe('PaymentService', () => {
  let service: PaymentService;
  let mocks: ReturnType<typeof createMockSupabase>;

  beforeEach(() => {
    mocks = createMockSupabase();
    service = new PaymentService(mocks.supabase);
  });

  // ─── createSubscription ─────────────────────────────────

  describe('createSubscription', () => {
    it('创建 Pro 月付订阅插入 payment_sessions 和 payments 表', async () => {
      const params: CreateSubscriptionParams = {
        userId: 'user-1',
        tier: 'pro',
        billingCycle: 'monthly',
        paymentProvider: 'stripe',
      };

      const session = await service.createSubscription(params);

      expect(session.sessionId).toBeTruthy();
      expect(session.provider).toBe('stripe');
      expect(session.checkoutUrl).toContain('stripe');
      expect(session.expiresAt.getTime()).toBeGreaterThan(Date.now());

      // 验证 insert 被调用了两次（payment_sessions + payments）
      expect(mocks.mockInsert).toHaveBeenCalledTimes(2);

      // 验证 from 被调用了 payment_sessions 和 payments
      expect(mocks.mockFrom).toHaveBeenCalledWith('payment_sessions');
      expect(mocks.mockFrom).toHaveBeenCalledWith('payments');
    });

    it('创建 Business 年付订阅', async () => {
      const params: CreateSubscriptionParams = {
        userId: 'user-1',
        tier: 'business',
        billingCycle: 'yearly',
        paymentProvider: 'alipay',
      };

      const session = await service.createSubscription(params);
      expect(session.provider).toBe('alipay');
      expect(session.sessionId).toBeTruthy();
    });

    it('支持四种支付渠道: stripe, paypal, wechat, alipay', () => {
      const providers = PaymentService.getSupportedProviders();
      expect(providers).toContain('stripe');
      expect(providers).toContain('paypal');
      expect(providers).toContain('wechat');
      expect(providers).toContain('alipay');
      expect(providers).toHaveLength(4);
    });

    it('免费版订阅抛出错误', async () => {
      const params: CreateSubscriptionParams = {
        userId: 'user-1',
        tier: 'free',
        billingCycle: 'monthly',
        paymentProvider: 'stripe',
      };
      await expect(service.createSubscription(params)).rejects.toThrow('免费版无需订阅');
    });

    it('不支持的支付渠道抛出错误', async () => {
      const params: CreateSubscriptionParams = {
        userId: 'user-1',
        tier: 'pro',
        billingCycle: 'monthly',
        paymentProvider: 'bitcoin' as any,
      };
      await expect(service.createSubscription(params)).rejects.toThrow('不支持的支付渠道');
    });

    it('payment_sessions 插入失败时抛出 AppError', async () => {
      mocks.mockInsert.mockResolvedValueOnce({
        data: null,
        error: { code: '23505', message: 'Unique violation' },
      });

      const params: CreateSubscriptionParams = {
        userId: 'user-1',
        tier: 'pro',
        billingCycle: 'monthly',
        paymentProvider: 'stripe',
      };

      await expect(service.createSubscription(params)).rejects.toMatchObject({
        code: '23505',
        table: 'payment_sessions',
        operation: 'insert',
      });
    });

    it('payments 插入失败时抛出 AppError', async () => {
      // 第一次 insert（payment_sessions）成功
      mocks.mockInsert.mockResolvedValueOnce({ data: null, error: null });
      // 第二次 insert（payments）失败
      mocks.mockInsert.mockResolvedValueOnce({
        data: null,
        error: { code: '23503', message: 'Foreign key violation' },
      });

      const params: CreateSubscriptionParams = {
        userId: 'user-1',
        tier: 'pro',
        billingCycle: 'monthly',
        paymentProvider: 'stripe',
      };

      await expect(service.createSubscription(params)).rejects.toMatchObject({
        code: '23503',
        table: 'payments',
        operation: 'insert',
      });
    });

    it('月付金额使用 monthlyPrice', async () => {
      const params: CreateSubscriptionParams = {
        userId: 'user-1',
        tier: 'pro',
        billingCycle: 'monthly',
        paymentProvider: 'stripe',
      };

      await service.createSubscription(params);

      // 第二次 insert 调用是 payments 表
      const paymentsInsertArg = mocks.mockInsert.mock.calls[1][0];
      expect(paymentsInsertArg.amount).toBe(TIER_CONFIGS.pro.monthlyPrice);
    });

    it('年付金额使用 yearlyPrice', async () => {
      const params: CreateSubscriptionParams = {
        userId: 'user-1',
        tier: 'pro',
        billingCycle: 'yearly',
        paymentProvider: 'stripe',
      };

      await service.createSubscription(params);

      const paymentsInsertArg = mocks.mockInsert.mock.calls[1][0];
      expect(paymentsInsertArg.amount).toBe(TIER_CONFIGS.pro.yearlyPrice);
    });
  });

  // ─── handleWebhook ──────────────────────────────────────

  describe('handleWebhook', () => {
    it('处理成功支付回调', async () => {
      // 幂等性检查：事件不存在
      mocks.mockSingle.mockResolvedValueOnce({ data: null, error: { code: 'PGRST116', message: 'not found' } });
      // 查询 session
      mocks.mockSingle.mockResolvedValueOnce({
        data: {
          id: 'session-1',
          user_id: 'user-1',
          provider: 'stripe',
          checkout_url: 'https://pay.example.com/stripe/session-1',
          tier: 'pro',
          billing_cycle: 'monthly',
          expires_at: '2025-01-01T00:30:00Z',
          created_at: '2025-01-01T00:00:00Z',
        },
        error: null,
      });

      const result = await service.handleWebhook('stripe', {
        eventId: 'evt-1',
        sessionId: 'session-1',
        status: 'completed',
      });

      expect(result.handled).toBe(true);
      expect(result.action).toBe('payment_completed');
      expect(result.userId).toBe('user-1');
    });

    it('幂等性：重复事件只处理一次', async () => {
      // 幂等性检查：事件已存在
      mocks.mockSingle.mockResolvedValueOnce({
        data: { event_id: 'evt-dup' },
        error: null,
      });

      const result = await service.handleWebhook('stripe', {
        eventId: 'evt-dup',
        sessionId: 'session-1',
        status: 'completed',
      });

      expect(result.handled).toBe(true);
      expect(result.action).toBe('payment_completed');

      // 不应调用 update 或 insert（除了幂等性查询）
      expect(mocks.mockUpdate).not.toHaveBeenCalled();
    });

    it('无效会话返回 handled=false', async () => {
      // 幂等性检查：事件不存在
      mocks.mockSingle.mockResolvedValueOnce({ data: null, error: { code: 'PGRST116', message: 'not found' } });
      // 查询 session：不存在
      mocks.mockSingle.mockResolvedValueOnce({ data: null, error: { code: 'PGRST116', message: 'not found' } });

      const result = await service.handleWebhook('stripe', {
        eventId: 'evt-2',
        sessionId: 'invalid-session',
        status: 'completed',
      });

      expect(result.handled).toBe(false);
    });

    it('处理失败支付回调', async () => {
      // 幂等性检查：事件不存在
      mocks.mockSingle.mockResolvedValueOnce({ data: null, error: { code: 'PGRST116', message: 'not found' } });
      // 查询 session
      mocks.mockSingle.mockResolvedValueOnce({
        data: {
          id: 'session-1',
          user_id: 'user-1',
          provider: 'stripe',
          checkout_url: 'https://pay.example.com/stripe/session-1',
          tier: 'pro',
          billing_cycle: 'monthly',
          expires_at: '2025-01-01T00:30:00Z',
          created_at: '2025-01-01T00:00:00Z',
        },
        error: null,
      });

      const result = await service.handleWebhook('stripe', {
        eventId: 'evt-fail',
        sessionId: 'session-1',
        status: 'failed',
      });

      expect(result.handled).toBe(true);
      expect(result.action).toBe('payment_failed');
      expect(result.userId).toBe('user-1');
    });

    it('payments 更新失败时抛出 AppError', async () => {
      // 幂等性检查：事件不存在
      mocks.mockSingle.mockResolvedValueOnce({ data: null, error: { code: 'PGRST116', message: 'not found' } });
      // 查询 session
      mocks.mockSingle.mockResolvedValueOnce({
        data: {
          id: 'session-1',
          user_id: 'user-1',
          provider: 'stripe',
          checkout_url: 'https://pay.example.com/stripe/session-1',
          tier: 'pro',
          billing_cycle: 'monthly',
          expires_at: '2025-01-01T00:30:00Z',
          created_at: '2025-01-01T00:00:00Z',
        },
        error: null,
      });
      // update 失败
      mocks.mockUpdateEq.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST301', message: 'Timeout' },
      });

      await expect(
        service.handleWebhook('stripe', {
          eventId: 'evt-err',
          sessionId: 'session-1',
          status: 'completed',
        })
      ).rejects.toMatchObject({
        code: 'PGRST301',
        table: 'payments',
        operation: 'update',
      });
    });

    it('processed_webhook_events 插入失败时抛出 AppError', async () => {
      // 幂等性检查：事件不存在
      mocks.mockSingle.mockResolvedValueOnce({ data: null, error: { code: 'PGRST116', message: 'not found' } });
      // 查询 session
      mocks.mockSingle.mockResolvedValueOnce({
        data: {
          id: 'session-1',
          user_id: 'user-1',
          provider: 'stripe',
          checkout_url: 'https://pay.example.com/stripe/session-1',
          tier: 'pro',
          billing_cycle: 'monthly',
          expires_at: '2025-01-01T00:30:00Z',
          created_at: '2025-01-01T00:00:00Z',
        },
        error: null,
      });
      // update 成功
      mocks.mockUpdateEq.mockResolvedValueOnce({ data: null, error: null });
      // insert processed_webhook_events 失败
      mocks.mockInsert.mockResolvedValueOnce({
        data: null,
        error: { code: '23505', message: 'Duplicate key' },
      });

      await expect(
        service.handleWebhook('stripe', {
          eventId: 'evt-dup-insert',
          sessionId: 'session-1',
          status: 'completed',
        })
      ).rejects.toMatchObject({
        code: '23505',
        table: 'processed_webhook_events',
        operation: 'insert',
      });
    });

    it('处理 cancelled 状态回调', async () => {
      // 幂等性检查：事件不存在
      mocks.mockSingle.mockResolvedValueOnce({ data: null, error: { code: 'PGRST116', message: 'not found' } });
      // 查询 session
      mocks.mockSingle.mockResolvedValueOnce({
        data: {
          id: 'session-1',
          user_id: 'user-1',
          provider: 'stripe',
          checkout_url: 'https://pay.example.com/stripe/session-1',
          tier: 'pro',
          billing_cycle: 'monthly',
          expires_at: '2025-01-01T00:30:00Z',
          created_at: '2025-01-01T00:00:00Z',
        },
        error: null,
      });

      const result = await service.handleWebhook('stripe', {
        eventId: 'evt-cancel',
        sessionId: 'session-1',
        status: 'cancelled',
      });

      expect(result.handled).toBe(true);
      expect(result.action).toBe('subscription_cancelled');
    });
  });

  // ─── getPaymentHistory ──────────────────────────────────

  describe('getPaymentHistory', () => {
    it('无记录时返回空数组', async () => {
      mocks.mockOrder.mockResolvedValue({ data: [], error: null });

      const history = await service.getPaymentHistory('user-none');
      expect(history).toEqual([]);
    });

    it('返回按 created_at 降序排列的记录', async () => {
      mocks.mockOrder.mockResolvedValue({
        data: [
          {
            id: 'pay-2',
            user_id: 'user-1',
            session_id: 'session-2',
            amount: 49900,
            currency: 'CNY',
            provider: 'alipay',
            tier: 'business',
            billing_cycle: 'yearly',
            status: 'pending',
            created_at: '2025-01-02T00:00:00Z',
            completed_at: null,
          },
          {
            id: 'pay-1',
            user_id: 'user-1',
            session_id: 'session-1',
            amount: 19900,
            currency: 'CNY',
            provider: 'stripe',
            tier: 'pro',
            billing_cycle: 'monthly',
            status: 'completed',
            created_at: '2025-01-01T00:00:00Z',
            completed_at: '2025-01-01T00:05:00Z',
          },
        ],
        error: null,
      });

      const history = await service.getPaymentHistory('user-1');
      expect(history).toHaveLength(2);
      expect(history[0].id).toBe('pay-2');
      expect(history[1].id).toBe('pay-1');
      expect(history[0].createdAt.getTime()).toBeGreaterThan(history[1].createdAt.getTime());
    });

    it('正确转换 PaymentRecord 字段', async () => {
      mocks.mockOrder.mockResolvedValue({
        data: [
          {
            id: 'pay-1',
            user_id: 'user-1',
            session_id: 'session-1',
            amount: 19900,
            currency: 'CNY',
            provider: 'stripe',
            tier: 'pro',
            billing_cycle: 'monthly',
            status: 'completed',
            created_at: '2025-01-01T00:00:00Z',
            completed_at: '2025-01-01T00:05:00Z',
          },
        ],
        error: null,
      });

      const history = await service.getPaymentHistory('user-1');
      expect(history[0].userId).toBe('user-1');
      expect(history[0].amount).toBe(19900);
      expect(history[0].currency).toBe('CNY');
      expect(history[0].provider).toBe('stripe');
      expect(history[0].tier).toBe('pro');
      expect(history[0].billingCycle).toBe('monthly');
      expect(history[0].status).toBe('completed');
      expect(history[0].createdAt).toBeInstanceOf(Date);
      expect(history[0].completedAt).toBeInstanceOf(Date);
    });

    it('数据库错误时抛出 AppError', async () => {
      mocks.mockOrder.mockResolvedValue({
        data: null,
        error: { code: 'PGRST301', message: 'Timeout' },
      });

      await expect(service.getPaymentHistory('user-1')).rejects.toMatchObject({
        code: 'PGRST301',
        table: 'payments',
        operation: 'select',
      });
    });
  });

  // ─── purchaseCreditsPackage ─────────────────────────────

  describe('purchaseCreditsPackage', () => {
    it('Pro 用户购买充值包使用原价', async () => {
      const session = await service.purchaseCreditsPackage('user-1', 'pack-50', 'pro');
      expect(session.sessionId).toBeTruthy();

      // 第二次 insert 是 payments 表
      const paymentsInsertArg = mocks.mockInsert.mock.calls[1][0];
      expect(paymentsInsertArg.amount).toBe(9900);
    });

    it('Business 用户购买充值包享折扣价', async () => {
      await service.purchaseCreditsPackage('user-1', 'pack-50', 'business');

      const paymentsInsertArg = mocks.mockInsert.mock.calls[1][0];
      expect(paymentsInsertArg.amount).toBe(7900);
    });

    it('无效充值包 ID 抛出错误', async () => {
      await expect(
        service.purchaseCreditsPackage('user-1', 'invalid-pack')
      ).rejects.toThrow('无效的充值包 ID');
    });

    it('获取所有充值包列表', () => {
      const packs = PaymentService.getAllCreditsPacks();
      expect(packs.length).toBeGreaterThan(0);
      packs.forEach((pack) => {
        expect(pack.credits).toBeGreaterThan(0);
        expect(pack.price).toBeGreaterThan(0);
        expect(pack.discountPrice).toBeLessThan(pack.price);
      });
    });
  });

  // ─── cancelAutoRenewal / getAutoRenewStatus ─────────────

  describe('cancelAutoRenewal', () => {
    it('cancelAutoRenewal 不抛出错误', () => {
      expect(() => service.cancelAutoRenewal('sub-1')).not.toThrow();
    });

    it('getAutoRenewStatus 默认返回 true', () => {
      expect(service.getAutoRenewStatus('sub-new')).toBe(true);
    });
  });
});
