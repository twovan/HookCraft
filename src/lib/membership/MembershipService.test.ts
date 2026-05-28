// MembershipService 单元测试（Supabase 版）
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MembershipService } from './MembershipService';
import { TIER_CONFIGS } from '../../config/tierConfig';
import type { FeatureKey, MembershipTier } from '../../types/membership';

/**
 * 创建 mock Supabase 客户端
 * 模拟 .from().select().eq().single() 和 .from().update().eq() 链式调用
 */
function createMockSupabase() {
  const mockRpc = vi.fn();
  const mockSingle = vi.fn();
  const mockEq = vi.fn();
  const mockSelect = vi.fn();
  const mockUpdate = vi.fn();
  const mockUpdateEq = vi.fn();
  const mockAdminConfigSelect = vi.fn().mockResolvedValue({ data: [], error: null });
  const mockInsertSingle = vi.fn();
  const mockInsertSelect = vi.fn();
  const mockInsert = vi.fn();

  // select chain: from('memberships').select('*').eq('user_id', x).single()
  mockSingle.mockResolvedValue({ data: null, error: null });
  mockEq.mockReturnValue({ single: mockSingle });
  mockSelect.mockReturnValue({ eq: mockEq });

  // update chain: from('memberships').update({}).eq('user_id', x)
  mockUpdateEq.mockResolvedValue({ data: null, error: null });
  mockUpdate.mockReturnValue({ eq: mockUpdateEq });
  mockInsertSingle.mockResolvedValue({ data: createMembershipRow(), error: null });
  mockInsertSelect.mockReturnValue({ single: mockInsertSingle });
  mockInsert.mockReturnValue({ select: mockInsertSelect });

  const mockFrom = vi.fn().mockImplementation((table: string) => {
    if (table === 'admin_config') {
      return {
        select: mockAdminConfigSelect,
      };
    }
    return {
      select: mockSelect,
      insert: mockInsert,
      update: mockUpdate,
    };
  });

  const supabase = {
    from: mockFrom,
    rpc: mockRpc,
  } as any;

  return {
    supabase,
    mockFrom,
    mockSelect,
    mockEq,
    mockSingle,
    mockUpdate,
    mockUpdateEq,
    mockRpc,
    mockAdminConfigSelect,
    mockInsert,
    mockInsertSelect,
    mockInsertSingle,
  };
}

/** 创建一个模拟的 memberships 行数据 */
function createMembershipRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'uuid-1',
    user_id: 'user-1',
    tier: 'free' as MembershipTier,
    billing_cycle: null,
    start_date: null,
    expires_at: null,
    auto_renew: false,
    payment_provider: null,
    subscription_id: null,
    status: 'active',
    grace_period_end: null,
    pending_downgrade_tier: null,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('MembershipService', () => {
  let service: MembershipService;
  let mocks: ReturnType<typeof createMockSupabase>;

  beforeEach(() => {
    mocks = createMockSupabase();
    service = new MembershipService(mocks.supabase);
  });

  // ─── getMembership ──────────────────────────────────────

  describe('getMembership', () => {
    it('查询 memberships 表并返回 MembershipInfo', async () => {
      const row = createMembershipRow();
      mocks.mockSingle.mockResolvedValue({ data: row, error: null });

      const info = await service.getMembership('user-1');
      expect(info.userId).toBe('user-1');
      expect(info.tier).toBe('free');
      expect(info.status).toBe('active');
      expect(info.billingCycle).toBeNull();
      expect(info.expiresAt).toBeNull();
      expect(info.autoRenew).toBe(false);
    });

    it('正确转换日期字段', async () => {
      const row = createMembershipRow({
        tier: 'pro',
        billing_cycle: 'monthly',
        start_date: '2025-01-15T10:00:00Z',
        expires_at: '2025-02-15T10:00:00Z',
        auto_renew: true,
        status: 'active',
      });
      mocks.mockSingle.mockResolvedValue({ data: row, error: null });

      const info = await service.getMembership('user-1');
      expect(info.tier).toBe('pro');
      expect(info.billingCycle).toBe('monthly');
      expect(info.startDate).toBeInstanceOf(Date);
      expect(info.expiresAt).toBeInstanceOf(Date);
      expect(info.autoRenew).toBe(true);
    });

    it('会员记录不存在时自动创建 free 会员', async () => {
      mocks.mockSingle.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'Row not found' },
      });
      const freeRow = createMembershipRow({ tier: 'free' });
      mocks.mockInsertSingle.mockResolvedValue({ data: freeRow, error: null });

      const info = await service.getMembership('user-1');

      expect(info.tier).toBe('free');
      expect(mocks.mockInsert).toHaveBeenCalledWith(expect.objectContaining({
        user_id: 'user-1',
        tier: 'free',
        status: 'active',
      }));
    });
  });

  // ─── upgradeTier ────────────────────────────────────────

  describe('upgradeTier', () => {
    it('free 升级到 pro 调用 RPC 成功', async () => {
      const row = createMembershipRow({ tier: 'free' });
      mocks.mockSingle.mockResolvedValue({ data: row, error: null });
      mocks.mockRpc.mockResolvedValue({ data: null, error: null });

      const result = await service.upgradeTier('user-1', 'pro');
      expect(result.success).toBe(true);
      expect(result.proratedAmount).toBeGreaterThanOrEqual(0);

      // 验证 RPC 调用参数
      expect(mocks.mockRpc).toHaveBeenCalledWith('upgrade_membership', {
        p_user_id: 'user-1',
        p_target_tier: 'pro',
        p_billing_cycle: 'monthly',
        p_monthly_credits: TIER_CONFIGS.pro.monthlyCredits,
      });
    });

    it('free 升级到 business 调用 RPC 成功', async () => {
      const row = createMembershipRow({ tier: 'free' });
      mocks.mockSingle.mockResolvedValue({ data: row, error: null });
      mocks.mockRpc.mockResolvedValue({ data: null, error: null });

      const result = await service.upgradeTier('user-1', 'business');
      expect(result.success).toBe(true);

      expect(mocks.mockRpc).toHaveBeenCalledWith('upgrade_membership', {
        p_user_id: 'user-1',
        p_target_tier: 'business',
        p_billing_cycle: 'monthly',
        p_monthly_credits: TIER_CONFIGS.business.monthlyCredits,
      });
    });

    it('pro 升级到 business 使用现有 billing_cycle', async () => {
      const row = createMembershipRow({
        tier: 'pro',
        billing_cycle: 'yearly',
        status: 'active',
      });
      mocks.mockSingle.mockResolvedValue({ data: row, error: null });
      mocks.mockRpc.mockResolvedValue({ data: null, error: null });

      const result = await service.upgradeTier('user-1', 'business');
      expect(result.success).toBe(true);

      expect(mocks.mockRpc).toHaveBeenCalledWith('upgrade_membership', {
        p_user_id: 'user-1',
        p_target_tier: 'business',
        p_billing_cycle: 'yearly',
        p_monthly_credits: TIER_CONFIGS.business.monthlyCredits,
      });
    });

    it('不能升级到同等级', async () => {
      const row = createMembershipRow({ tier: 'pro' });
      mocks.mockSingle.mockResolvedValue({ data: row, error: null });

      const result = await service.upgradeTier('user-1', 'pro');
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(mocks.mockRpc).not.toHaveBeenCalled();
    });

    it('不能降级（通过 upgradeTier）', async () => {
      const row = createMembershipRow({ tier: 'business' });
      mocks.mockSingle.mockResolvedValue({ data: row, error: null });

      const result = await service.upgradeTier('user-1', 'pro');
      expect(result.success).toBe(false);
      expect(mocks.mockRpc).not.toHaveBeenCalled();
    });

    it('RPC 错误时抛出 AppError', async () => {
      const row = createMembershipRow({ tier: 'free' });
      mocks.mockSingle.mockResolvedValue({ data: row, error: null });
      mocks.mockRpc.mockResolvedValue({
        data: null,
        error: { code: '23503', message: 'Foreign key violation' },
      });

      await expect(service.upgradeTier('user-1', 'pro')).rejects.toMatchObject({
        code: '23503',
        table: 'memberships',
        operation: 'rpc:upgrade_membership',
      });
    });

    it('升级差价计算：有剩余天数时差价 >= 0', async () => {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 15);
      const row = createMembershipRow({
        tier: 'pro',
        billing_cycle: 'monthly',
        expires_at: expiresAt.toISOString(),
        status: 'active',
      });
      mocks.mockSingle.mockResolvedValue({ data: row, error: null });
      mocks.mockRpc.mockResolvedValue({ data: null, error: null });

      const result = await service.upgradeTier('user-1', 'business');
      expect(result.success).toBe(true);
      expect(result.proratedAmount).toBeGreaterThan(0);
    });

    it('升级时使用后台配置的价格和 monthly credits', async () => {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);
      const row = createMembershipRow({
        tier: 'pro',
        billing_cycle: 'monthly',
        expires_at: expiresAt.toISOString(),
        status: 'active',
      });
      mocks.mockSingle.mockResolvedValue({ data: row, error: null });
      mocks.mockRpc.mockResolvedValue({ data: null, error: null });
      mocks.mockAdminConfigSelect.mockResolvedValue({
        data: [
          {
            config_type: 'pricing',
            config_data: [
              { tier: 'pro', monthlyPrice: 10000, yearlyPrice: 96000 },
              { tier: 'business', monthlyPrice: 40000, yearlyPrice: 384000 },
            ],
          },
          {
            config_type: 'credit_quota',
            config_data: [
              { tier: 'pro', monthlyCredits: 111 },
              { tier: 'business', monthlyCredits: 777 },
            ],
          },
        ],
        error: null,
      });

      const result = await service.upgradeTier('user-1', 'business');

      expect(result.success).toBe(true);
      expect(result.proratedAmount).toBe(30000);
      expect(mocks.mockRpc).toHaveBeenCalledWith('upgrade_membership', {
        p_user_id: 'user-1',
        p_target_tier: 'business',
        p_billing_cycle: 'monthly',
        p_monthly_credits: 777,
      });
    });
  });

  // ─── downgradeTier ──────────────────────────────────────

  describe('downgradeTier', () => {
    it('pro 降级到 free 返回失去的功能', async () => {
      const expiresAt = new Date('2025-02-01T00:00:00Z');
      const row = createMembershipRow({
        tier: 'pro',
        billing_cycle: 'monthly',
        expires_at: expiresAt.toISOString(),
        status: 'active',
      });
      mocks.mockSingle.mockResolvedValue({ data: row, error: null });
      mocks.mockUpdateEq.mockResolvedValue({ data: null, error: null });

      const result = await service.downgradeTier('user-1', 'free');
      expect(result.success).toBe(true);
      expect(result.lostFeatures.length).toBeGreaterThan(0);

      // 失去的功能应该是 pro 有但 free 没有的
      const proFeatures = TIER_CONFIGS.pro.features;
      const freeFeatures = new Set(TIER_CONFIGS.free.features);
      const expectedLost = proFeatures.filter((f) => !freeFeatures.has(f));
      expect(result.lostFeatures).toEqual(expectedLost);
    });

    it('business 降级到 pro 返回正确的功能差集', async () => {
      const row = createMembershipRow({
        tier: 'business',
        billing_cycle: 'monthly',
        status: 'active',
      });
      mocks.mockSingle.mockResolvedValue({ data: row, error: null });
      mocks.mockUpdateEq.mockResolvedValue({ data: null, error: null });

      const result = await service.downgradeTier('user-1', 'pro');
      expect(result.success).toBe(true);

      const businessFeatures = TIER_CONFIGS.business.features;
      const proFeatures = new Set(TIER_CONFIGS.pro.features);
      const expectedLost = businessFeatures.filter((f) => !proFeatures.has(f));
      expect(result.lostFeatures).toEqual(expectedLost);
    });

    it('不能升级（通过 downgradeTier）', async () => {
      const row = createMembershipRow({ tier: 'free' });
      mocks.mockSingle.mockResolvedValue({ data: row, error: null });

      const result = await service.downgradeTier('user-1', 'pro');
      expect(result.success).toBe(false);
    });

    it('不能降级到同等级', async () => {
      const row = createMembershipRow({ tier: 'pro' });
      mocks.mockSingle.mockResolvedValue({ data: row, error: null });

      const result = await service.downgradeTier('user-1', 'pro');
      expect(result.success).toBe(false);
    });

    it('降级生效日期为当前周期结束', async () => {
      const expiresAt = new Date('2025-02-01T00:00:00Z');
      const row = createMembershipRow({
        tier: 'pro',
        billing_cycle: 'monthly',
        expires_at: expiresAt.toISOString(),
        status: 'active',
      });
      mocks.mockSingle.mockResolvedValue({ data: row, error: null });
      mocks.mockUpdateEq.mockResolvedValue({ data: null, error: null });

      const result = await service.downgradeTier('user-1', 'free');
      expect(result.success).toBe(true);
      expect(result.effectiveDate).toEqual(expiresAt);
    });

    it('更新 auto_renew 和 pending_downgrade_tier', async () => {
      const row = createMembershipRow({
        tier: 'pro',
        billing_cycle: 'monthly',
        status: 'active',
      });
      mocks.mockSingle.mockResolvedValue({ data: row, error: null });
      mocks.mockUpdateEq.mockResolvedValue({ data: null, error: null });

      await service.downgradeTier('user-1', 'free');

      // 验证 update 被调用
      expect(mocks.mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          auto_renew: false,
          pending_downgrade_tier: 'free',
        })
      );
      expect(mocks.mockUpdateEq).toHaveBeenCalledWith('user_id', 'user-1');
    });

    it('数据库错误时抛出 AppError', async () => {
      const row = createMembershipRow({ tier: 'pro' });
      mocks.mockSingle.mockResolvedValue({ data: row, error: null });
      mocks.mockUpdateEq.mockResolvedValue({
        data: null,
        error: { code: '42501', message: 'Permission denied' },
      });

      await expect(service.downgradeTier('user-1', 'free')).rejects.toMatchObject({
        code: '42501',
        table: 'memberships',
        operation: 'update',
      });
    });
  });

  // ─── cancelSubscription ─────────────────────────────────

  describe('cancelSubscription', () => {
    it('取消付费订阅成功', async () => {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 20);
      const row = createMembershipRow({
        tier: 'pro',
        billing_cycle: 'monthly',
        expires_at: expiresAt.toISOString(),
        status: 'active',
      });
      mocks.mockSingle.mockResolvedValue({ data: row, error: null });
      mocks.mockUpdateEq.mockResolvedValue({ data: null, error: null });

      const result = await service.cancelSubscription('user-1');
      expect(result.success).toBe(true);
      expect(result.retainedUntil).toEqual(expiresAt);
    });

    it('free 用户取消订阅失败', async () => {
      const row = createMembershipRow({ tier: 'free' });
      mocks.mockSingle.mockResolvedValue({ data: row, error: null });

      const result = await service.cancelSubscription('user-1');
      expect(result.success).toBe(false);
    });

    it('更新 status 为 cancelled 和 auto_renew 为 false', async () => {
      const row = createMembershipRow({
        tier: 'pro',
        billing_cycle: 'monthly',
        status: 'active',
      });
      mocks.mockSingle.mockResolvedValue({ data: row, error: null });
      mocks.mockUpdateEq.mockResolvedValue({ data: null, error: null });

      await service.cancelSubscription('user-1');

      expect(mocks.mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'cancelled',
          auto_renew: false,
        })
      );
      expect(mocks.mockUpdateEq).toHaveBeenCalledWith('user_id', 'user-1');
    });

    it('数据库错误时抛出 AppError', async () => {
      const row = createMembershipRow({ tier: 'pro' });
      mocks.mockSingle.mockResolvedValue({ data: row, error: null });
      mocks.mockUpdateEq.mockResolvedValue({
        data: null,
        error: { code: 'PGRST301', message: 'Timeout' },
      });

      await expect(service.cancelSubscription('user-1')).rejects.toMatchObject({
        code: 'PGRST301',
        table: 'memberships',
        operation: 'update',
      });
    });
  });

  // ─── checkPermission ────────────────────────────────────

  describe('checkPermission', () => {
    it('free 用户有 free_template 权限', async () => {
      const row = createMembershipRow({ tier: 'free' });
      mocks.mockSingle.mockResolvedValue({ data: row, error: null });

      expect(await service.checkPermission('user-1', 'free_template')).toBe(true);
    });

    it('free 用户有 preview 权限', async () => {
      const row = createMembershipRow({ tier: 'free' });
      mocks.mockSingle.mockResolvedValue({ data: row, error: null });

      expect(await service.checkPermission('user-1', 'preview')).toBe(true);
    });

    it('free 用户没有 paid_template 权限', async () => {
      const row = createMembershipRow({ tier: 'free' });
      mocks.mockSingle.mockResolvedValue({ data: row, error: null });

      expect(await service.checkPermission('user-1', 'paid_template')).toBe(false);
    });

    it('pro 用户有 paid_template 权限', async () => {
      const row = createMembershipRow({ tier: 'pro' });
      mocks.mockSingle.mockResolvedValue({ data: row, error: null });

      expect(await service.checkPermission('user-1', 'paid_template')).toBe(true);
    });

    it('business 用户有全部功能权限', async () => {
      const row = createMembershipRow({ tier: 'business' });
      mocks.mockSingle.mockResolvedValue({ data: row, error: null });

      const allFeatures = TIER_CONFIGS.business.features;
      for (const feature of allFeatures) {
        expect(await service.checkPermission('user-1', feature)).toBe(true);
      }
    });
  });

  // ─── handleExpiration ───────────────────────────────────

  describe('handleExpiration', () => {
    it('付费用户到期后更新为 free + grace_period', async () => {
      const row = createMembershipRow({
        tier: 'pro',
        billing_cycle: 'monthly',
        status: 'active',
      });
      mocks.mockSingle.mockResolvedValue({ data: row, error: null });
      mocks.mockUpdateEq.mockResolvedValue({ data: null, error: null });

      await service.handleExpiration('user-1');

      expect(mocks.mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          tier: 'free',
          status: 'grace_period',
          billing_cycle: null,
          auto_renew: false,
          subscription_id: null,
          payment_provider: null,
        })
      );
      // grace_period_end 应该是一个 ISO 字符串
      const updateArg = mocks.mockUpdate.mock.calls[0][0];
      expect(updateArg.grace_period_end).toBeDefined();
      expect(new Date(updateArg.grace_period_end).getTime()).toBeGreaterThan(Date.now());
    });

    it('free 用户调用 handleExpiration 无变化', async () => {
      const row = createMembershipRow({ tier: 'free' });
      mocks.mockSingle.mockResolvedValue({ data: row, error: null });

      await service.handleExpiration('user-1');

      // 不应调用 update
      expect(mocks.mockUpdate).not.toHaveBeenCalled();
    });

    it('business 用户到期后降级为 free', async () => {
      const row = createMembershipRow({
        tier: 'business',
        billing_cycle: 'yearly',
        status: 'active',
      });
      mocks.mockSingle.mockResolvedValue({ data: row, error: null });
      mocks.mockUpdateEq.mockResolvedValue({ data: null, error: null });

      await service.handleExpiration('user-1');

      expect(mocks.mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          tier: 'free',
          status: 'grace_period',
        })
      );
    });

    it('数据库错误时抛出 AppError', async () => {
      const row = createMembershipRow({ tier: 'pro' });
      mocks.mockSingle.mockResolvedValue({ data: row, error: null });
      mocks.mockUpdateEq.mockResolvedValue({
        data: null,
        error: { code: '23505', message: 'Unique violation' },
      });

      await expect(service.handleExpiration('user-1')).rejects.toMatchObject({
        code: '23505',
        table: 'memberships',
        operation: 'update',
      });
    });
  });

  // ─── getTierConfig ──────────────────────────────────────

  describe('getTierConfig', () => {
    it('返回 free 等级配置', () => {
      const config = service.getTierConfig('free');
      expect(config.tier).toBe('free');
      expect(config.monthlyPrice).toBe(0);
      expect(config.monthlyCredits).toBe(0);
    });

    it('返回 pro 等级配置', () => {
      const config = service.getTierConfig('pro');
      expect(config.tier).toBe('pro');
      expect(config.monthlyPrice).toBe(19900);
      expect(config.monthlyCredits).toBe(100);
    });

    it('返回 business 等级配置', () => {
      const config = service.getTierConfig('business');
      expect(config.tier).toBe('business');
      expect(config.monthlyPrice).toBe(49900);
      expect(config.monthlyCredits).toBe(300);
    });
  });

  // ─── isExpiringSoon ─────────────────────────────────────

  describe('isExpiringSoon', () => {
    it('free 用户不会即将到期', async () => {
      const row = createMembershipRow({ tier: 'free' });
      mocks.mockSingle.mockResolvedValue({ data: row, error: null });

      expect(await service.isExpiringSoon('user-1')).toBe(false);
    });

    it('距到期 3 天时返回 true', async () => {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 3);
      const row = createMembershipRow({
        tier: 'pro',
        expires_at: expiresAt.toISOString(),
        status: 'active',
      });
      mocks.mockSingle.mockResolvedValue({ data: row, error: null });

      expect(await service.isExpiringSoon('user-1')).toBe(true);
    });

    it('距到期 7 天时返回 true', async () => {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);
      const row = createMembershipRow({
        tier: 'pro',
        expires_at: expiresAt.toISOString(),
        status: 'active',
      });
      mocks.mockSingle.mockResolvedValue({ data: row, error: null });

      expect(await service.isExpiringSoon('user-1')).toBe(true);
    });

    it('距到期 8 天时返回 false', async () => {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 8);
      const row = createMembershipRow({
        tier: 'pro',
        expires_at: expiresAt.toISOString(),
        status: 'active',
      });
      mocks.mockSingle.mockResolvedValue({ data: row, error: null });

      expect(await service.isExpiringSoon('user-1')).toBe(false);
    });

    it('已过期时返回 false', async () => {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() - 1);
      const row = createMembershipRow({
        tier: 'pro',
        expires_at: expiresAt.toISOString(),
        status: 'expired',
      });
      mocks.mockSingle.mockResolvedValue({ data: row, error: null });

      expect(await service.isExpiringSoon('user-1')).toBe(false);
    });
  });

  // ─── calculateProration ─────────────────────────────────

  describe('calculateProration', () => {
    it('free 到 pro 差价计算正确', () => {
      const proration = service.calculateProration('free', 'pro', 30);
      // (19900/30 - 0/30) × 30 = 19900
      expect(proration).toBe(19900);
    });

    it('free 到 business 差价计算正确', () => {
      const proration = service.calculateProration('free', 'business', 30);
      // (49900/30 - 0/30) × 30 = 49900
      expect(proration).toBe(49900);
    });

    it('pro 到 business 差价计算正确', () => {
      const proration = service.calculateProration('pro', 'business', 15);
      // (49900/30 - 19900/30) × 15 = (1663.33 - 663.33) × 15 = 1000 × 15 = 15000
      expect(proration).toBe(15000);
    });

    it('剩余 0 天差价为 0', () => {
      const proration = service.calculateProration('free', 'pro', 0);
      expect(proration).toBe(0);
    });

    it('差价始终 >= 0', () => {
      const proration = service.calculateProration('business', 'free', 15);
      expect(proration).toBeGreaterThanOrEqual(0);
    });
  });
});
