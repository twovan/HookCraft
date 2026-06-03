// CreditService 单元测试（Supabase 版）
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CreditService } from './CreditService';
import { CREDITS_COST } from '../../config/creditsCost';
import { TIER_CONFIGS } from '../../config/tierConfig';

/**
 * 创建 mock Supabase 客户端
 * 模拟 credits、credit_history、preview_counts、purchased_credits、credit_transactions 表的链式调用
 */
function createMockSupabase() {
  // --- credits table mocks ---
  const creditsSingle = vi.fn().mockResolvedValue({ data: null, error: null });
  const creditsSelectEq = vi.fn().mockReturnValue({ single: creditsSingle, maybeSingle: creditsSingle });
  const creditsSelect = vi.fn().mockReturnValue({ eq: creditsSelectEq });

  // optimistic lock update chain: .update({}).eq('user_id', x).eq('version', v).select('*')
  const creditsUpdateSelect = vi.fn().mockResolvedValue({ data: null, error: null, count: 0 });
  const creditsUpdateEq2 = vi.fn().mockReturnValue({ select: creditsUpdateSelect });
  const creditsUpdateEq = vi.fn().mockReturnValue({ eq: creditsUpdateEq2 });
  const creditsUpdate = vi.fn().mockReturnValue({ eq: creditsUpdateEq });

  // simple update chain: .update({}).eq('user_id', x)
  const creditsSimpleUpdateEq = vi.fn().mockResolvedValue({ data: null, error: null });
  const creditsSimpleUpdate = vi.fn().mockReturnValue({ eq: creditsSimpleUpdateEq });

  // --- credit_history table mocks ---
  const historyInsert = vi.fn().mockResolvedValue({ data: null, error: null });
  const historyLimit = vi.fn().mockResolvedValue({ data: [], error: null });
  const historyOrder = vi.fn().mockReturnValue({ limit: historyLimit });
  const historySelectEq = vi.fn().mockReturnValue({ order: historyOrder });
  const historySelect = vi.fn().mockReturnValue({ eq: historySelectEq });

  // --- preview_counts table mocks ---
  const previewSingle = vi.fn().mockResolvedValue({ data: null, error: null });
  const previewSelectEq = vi.fn().mockReturnValue({ single: previewSingle });
  const previewSelect = vi.fn().mockReturnValue({ eq: previewSelectEq });
  const previewUpdateEq = vi.fn().mockResolvedValue({ data: null, error: null });
  const previewUpdate = vi.fn().mockReturnValue({ eq: previewUpdateEq });

  // --- purchased_credits table mocks ---
  const purchasedMaybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
  const purchasedSelectEq = vi.fn().mockReturnValue({ maybeSingle: purchasedMaybeSingle });
  const purchasedSelect = vi.fn().mockReturnValue({ eq: purchasedSelectEq });
  const purchasedInsertSelect = vi.fn().mockResolvedValue({ data: [{ id: 'uuid-p-1', user_id: 'user-1', balance: 50, total_purchased: 50, version: 0, created_at: '', updated_at: '' }], error: null });
  const purchasedInsert = vi.fn().mockReturnValue({ select: purchasedInsertSelect });
  const purchasedUpdateSelect = vi.fn().mockResolvedValue({ data: null, error: null });
  const purchasedUpdateEq2 = vi.fn().mockReturnValue({ select: purchasedUpdateSelect });
  const purchasedUpdateEq = vi.fn().mockReturnValue({ eq: purchasedUpdateEq2 });
  const purchasedUpdate = vi.fn().mockReturnValue({ eq: purchasedUpdateEq });
  const purchasedUpsertMaybeSingle = vi.fn().mockResolvedValue({ data: createPurchasedRow(), error: null });
  const purchasedUpsertSelect = vi.fn().mockReturnValue({ maybeSingle: purchasedUpsertMaybeSingle });
  const purchasedUpsert = vi.fn().mockReturnValue({ select: purchasedUpsertSelect });

  // --- credit_transactions table mocks ---
  const txInsert = vi.fn().mockResolvedValue({ data: null, error: null });
  const txNeq = vi.fn().mockResolvedValue({ data: [], error: null });
  const txLt = vi.fn().mockReturnValue({ neq: txNeq });
  const txGte = vi.fn().mockReturnValue({ lt: txLt });
  const txSelectEq = vi.fn().mockReturnValue({ gte: txGte });
  const txSelect = vi.fn().mockReturnValue({ eq: txSelectEq });

  // --- admin_config table mocks ---
  const adminConfigMaybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
  const adminConfigEq = vi.fn().mockReturnValue({ maybeSingle: adminConfigMaybeSingle });
  const adminConfigSelect = vi.fn().mockReturnValue({ eq: adminConfigEq });

  // --- memberships table mocks ---
  const membershipMaybeSingle = vi.fn().mockResolvedValue({ data: { tier: 'pro' }, error: null });
  const membershipEq = vi.fn().mockReturnValue({ maybeSingle: membershipMaybeSingle });
  const membershipSelect = vi.fn().mockReturnValue({ eq: membershipEq });

  // --- payments table mocks ---
  const paymentsStatusEq = vi.fn().mockResolvedValue({ data: [], error: null });
  const paymentsUserEq = vi.fn().mockReturnValue({ eq: paymentsStatusEq });
  const paymentsSelect = vi.fn().mockReturnValue({ eq: paymentsUserEq });

  // --- RPC mock ---
  const rpc = vi.fn().mockResolvedValue({ data: null, error: null });

  const mockFrom = vi.fn().mockImplementation((table: string) => {
    if (table === 'credits') {
      return {
        select: creditsSelect,
        update: (data: any) => {
          const keys = Object.keys(data);
          // Optimistic lock update: only has used, version, updated_at (3 fields)
          const isOptimisticLock = keys.length === 3
            && 'used' in data
            && 'version' in data
            && 'updated_at' in data;

          if (isOptimisticLock) {
            creditsUpdate(data);
            return { eq: creditsUpdateEq };
          }
          // Simple update (setUserTier, resetMonthlyCredits)
          creditsSimpleUpdate(data);
          return { eq: creditsSimpleUpdateEq };
        },
      };
    }
    if (table === 'credit_history') {
      return {
        select: historySelect,
        insert: historyInsert,
      };
    }
    if (table === 'preview_counts') {
      return {
        select: previewSelect,
        update: (data: any) => {
          previewUpdate(data);
          return { eq: previewUpdateEq };
        },
      };
    }
    if (table === 'purchased_credits') {
      return {
        select: purchasedSelect,
        insert: (data: any) => {
          purchasedInsert(data);
          return { select: purchasedInsertSelect };
        },
        update: (data: any) => {
          purchasedUpdate(data);
          return { eq: purchasedUpdateEq };
        },
        upsert: (data: any, options: any) => {
          purchasedUpsert(data, options);
          return { select: purchasedUpsertSelect };
        },
      };
    }
    if (table === 'credit_transactions') {
      return {
        select: txSelect,
        insert: txInsert,
      };
    }
    if (table === 'admin_config') {
      return {
        select: adminConfigSelect,
      };
    }
    if (table === 'memberships') {
      return {
        select: membershipSelect,
      };
    }
    if (table === 'payments') {
      return {
        select: paymentsSelect,
      };
    }
    return {};
  });

  const supabase = { from: mockFrom, rpc } as any;

  return {
    supabase,
    mockFrom,
    rpc,
    // credits
    creditsSelect,
    creditsSelectEq,
    creditsSingle,
    creditsUpdate,
    creditsUpdateEq,
    creditsUpdateEq2,
    creditsUpdateSelect,
    creditsSimpleUpdate,
    creditsSimpleUpdateEq,
    // credit_history
    historyInsert,
    historySelect,
    historySelectEq,
    historyOrder,
    historyLimit,
    // preview_counts
    previewSelect,
    previewSelectEq,
    previewSingle,
    previewUpdate,
    previewUpdateEq,
    // purchased_credits
    purchasedSelect,
    purchasedSelectEq,
    purchasedMaybeSingle,
    purchasedInsert,
    purchasedInsertSelect,
    purchasedUpdate,
    purchasedUpdateEq,
    purchasedUpdateEq2,
    purchasedUpdateSelect,
    purchasedUpsert,
    purchasedUpsertSelect,
    purchasedUpsertMaybeSingle,
    // credit_transactions
    txInsert,
    txSelect,
    txSelectEq,
    txGte,
    txLt,
    txNeq,
    adminConfigSelect,
    adminConfigEq,
    adminConfigMaybeSingle,
    membershipSelect,
    membershipEq,
    membershipMaybeSingle,
    paymentsSelect,
    paymentsUserEq,
    paymentsStatusEq,
  };
}

/** 创建模拟的 credits 行数据 */
function createCreditsRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'uuid-credits-1',
    user_id: 'user-1',
    tier: 'pro' as const,
    used: 0,
    total: 100,
    period_start: '2025-01-01T00:00:00Z',
    period_end: '2025-02-01T00:00:00Z',
    version: 0,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    ...overrides,
  };
}

/** 创建模拟的 purchased_credits 行数据 */
function createPurchasedRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'uuid-purchased-1',
    user_id: 'user-1',
    balance: 50,
    total_purchased: 50,
    version: 0,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    ...overrides,
  };
}

/** 创建模拟的 preview_counts 行数据 */
function createPreviewRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'uuid-preview-1',
    user_id: 'user-1',
    used: 0,
    total: 3,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('CreditService', () => {
  let service: CreditService;
  let mocks: ReturnType<typeof createMockSupabase>;

  beforeEach(() => {
    mocks = createMockSupabase();
    service = new CreditService(mocks.supabase);
  });

  // ─── getCredits ─────────────────────────────────────────

  describe('getCredits', () => {
    it('查询 credits 表并返回 CreditInfo', async () => {
      const row = createCreditsRow();
      mocks.creditsSingle.mockResolvedValue({ data: row, error: null });

      const info = await service.getCredits('user-1');
      expect(info.userId).toBe('user-1');
      expect(info.tier).toBe('pro');
      expect(info.used).toBe(0);
      expect(info.total).toBe(100);
      expect(info.remaining).toBe(100);
      expect(info.periodStart).toBeInstanceOf(Date);
      expect(info.periodEnd).toBeInstanceOf(Date);
    });

    it('正确转换日期字段', async () => {
      const row = createCreditsRow({
        period_start: '2025-03-01T08:00:00Z',
        period_end: '2025-04-01T08:00:00Z',
      });
      mocks.creditsSingle.mockResolvedValue({ data: row, error: null });

      const info = await service.getCredits('user-1');
      expect(info.periodStart.toISOString()).toBe('2025-03-01T08:00:00.000Z');
      expect(info.periodEnd.toISOString()).toBe('2025-04-01T08:00:00.000Z');
    });

    it('数据库错误时抛出 AppError', async () => {
      mocks.creditsSingle.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'Row not found' },
      });

      await expect(service.getCredits('user-1')).rejects.toMatchObject({
        code: 'PGRST116',
        table: 'credits',
        operation: 'select',
      });
    });
  });

  // ─── consumeCredits ─────────────────────────────────────

  describe('consumeCredits', () => {
    it('Preview 消耗 1 Credit 成功（仅月度扣除）', async () => {
      const row = createCreditsRow({ used: 0, total: 100, version: 0 });
      mocks.creditsSingle.mockResolvedValue({ data: row, error: null });
      mocks.purchasedMaybeSingle.mockResolvedValue({ data: null, error: null });
      mocks.rpc.mockResolvedValue({
        data: { success: true, consumed: 1, monthly_cost: 1, purchased_cost: 0, monthly_remaining: 99, purchased_remaining: 0 },
        error: null,
      });

      const result = await service.consumeCredits('user-1', ['preview']);
      expect(result.success).toBe(true);
      expect(result.consumed).toBe(1);
      expect(result.remaining).toBe(99);
      expect(result.monthlyCost).toBe(1);
      expect(result.purchasedCost).toBe(0);
      expect(result.monthlyRemaining).toBe(99);
      expect(result.purchasedRemaining).toBe(0);
    });

    it('Full Demo Short 消耗 10 Credits', async () => {
      const row = createCreditsRow({ used: 0, total: 100, version: 0 });
      mocks.creditsSingle.mockResolvedValue({ data: row, error: null });
      mocks.purchasedMaybeSingle.mockResolvedValue({ data: null, error: null });
      mocks.rpc.mockResolvedValue({
        data: { success: true, consumed: 10, monthly_cost: 10, purchased_cost: 0, monthly_remaining: 90, purchased_remaining: 0 },
        error: null,
      });

      const result = await service.consumeCredits('user-1', ['full_demo_short']);
      expect(result.success).toBe(true);
      expect(result.consumed).toBe(10);
      expect(result.remaining).toBe(90);
    });

    it('复合消耗：Full Demo Short + Premium Singer = 15 Credits', async () => {
      const row = createCreditsRow({ used: 0, total: 100, version: 0 });
      mocks.creditsSingle.mockResolvedValue({ data: row, error: null });
      mocks.purchasedMaybeSingle.mockResolvedValue({ data: null, error: null });
      mocks.rpc.mockResolvedValue({
        data: { success: true, consumed: 15, monthly_cost: 15, purchased_cost: 0, monthly_remaining: 85, purchased_remaining: 0 },
        error: null,
      });

      const result = await service.consumeCredits('user-1', ['full_demo_short', 'premium_singer']);
      expect(result.success).toBe(true);
      expect(result.consumed).toBe(15);
      expect(result.remaining).toBe(85);
    });

    it('拆分扣除：月度不足时从购买 Credits 补扣', async () => {
      const row = createCreditsRow({ used: 90, total: 100, version: 5 });
      const purchasedRow = createPurchasedRow({ balance: 50, version: 2 });
      mocks.creditsSingle.mockResolvedValue({ data: row, error: null });
      mocks.purchasedMaybeSingle.mockResolvedValue({ data: purchasedRow, error: null });
      mocks.rpc.mockResolvedValue({
        data: { success: true, consumed: 20, monthly_cost: 10, purchased_cost: 10, monthly_remaining: 0, purchased_remaining: 40 },
        error: null,
      });

      const result = await service.consumeCredits('user-1', ['full_demo_long']);
      expect(result.success).toBe(true);
      expect(result.consumed).toBe(20);
      expect(result.monthlyCost).toBe(10);
      expect(result.purchasedCost).toBe(10);
      expect(result.monthlyRemaining).toBe(0);
      expect(result.purchasedRemaining).toBe(40);
      expect(result.remaining).toBe(40);
    });

    it('余额不足时返回 no_credits 错误', async () => {
      const row = createCreditsRow({ used: 90, total: 100, version: 5 });
      mocks.creditsSingle.mockResolvedValue({ data: row, error: null });
      mocks.purchasedMaybeSingle.mockResolvedValue({ data: null, error: null });
      mocks.rpc.mockResolvedValue({
        data: { success: false, error: 'no_credits' },
        error: null,
      });

      const result = await service.consumeCredits('user-1', ['full_demo_long']); // 需要 20，只剩 10
      expect(result.success).toBe(false);
      expect(result.error).toBe('no_credits');
      expect(result.consumed).toBe(0);
      expect(result.remaining).toBe(10);
    });

    it('recovers purchased credits from completed payments before consumption when purchased_credits is missing', async () => {
      const row = createCreditsRow({ used: 100, total: 100, version: 5 });
      const recoveredPurchased = createPurchasedRow({ balance: 50, total_purchased: 50, version: 0 });
      mocks.creditsSingle.mockResolvedValue({ data: row, error: null });
      mocks.purchasedMaybeSingle.mockResolvedValue({ data: null, error: null });
      mocks.paymentsStatusEq.mockResolvedValue({ data: [{ amount: 9900 }], error: null });
      mocks.purchasedUpsertMaybeSingle.mockResolvedValue({ data: recoveredPurchased, error: null });
      mocks.rpc.mockResolvedValue({
        data: { success: false, error: 'no_credits' },
        error: null,
      });

      const result = await service.consumeCredits('user-1', ['stem_split_advanced']);

      expect(result.success).toBe(true);
      expect(result.consumed).toBe(50);
      expect(result.monthlyCost).toBe(0);
      expect(result.purchasedCost).toBe(50);
      expect(result.remaining).toBe(0);
      expect(mocks.purchasedUpsert).toHaveBeenCalledWith({
        user_id: 'user-1',
        balance: 50,
        total_purchased: 50,
        version: 0,
      }, { onConflict: 'user_id' });
    });

    it('乐观锁冲突时返回 concurrent_limit 错误', async () => {
      const row = createCreditsRow({ used: 0, total: 100, version: 3 });
      mocks.creditsSingle.mockResolvedValue({ data: row, error: null });
      mocks.purchasedMaybeSingle.mockResolvedValue({ data: null, error: null });
      mocks.rpc.mockResolvedValue({
        data: { success: false, error: 'concurrent_limit' },
        error: null,
      });

      const result = await service.consumeCredits('user-1', ['preview']);
      expect(result.success).toBe(false);
      expect(result.error).toBe('concurrent_limit');
      expect(result.consumed).toBe(0);
    });

    it('数据库读取错误时抛出 AppError', async () => {
      mocks.creditsSingle.mockResolvedValue({
        data: null,
        error: { code: 'PGRST301', message: 'Timeout' },
      });

      await expect(service.consumeCredits('user-1', ['preview'])).rejects.toMatchObject({
        code: 'PGRST301',
        table: 'credits',
        operation: 'select',
      });
    });

    it('RPC 错误时抛出 AppError', async () => {
      const row = createCreditsRow({ used: 0, total: 100, version: 0 });
      mocks.creditsSingle.mockResolvedValue({ data: row, error: null });
      mocks.purchasedMaybeSingle.mockResolvedValue({ data: null, error: null });
      mocks.rpc.mockResolvedValue({
        data: null,
        error: { code: '42501', message: 'Permission denied' },
      });

      await expect(service.consumeCredits('user-1', ['preview'])).rejects.toMatchObject({
        code: '42501',
        table: 'credits',
        operation: 'update',
      });
    });

    it('调用 RPC 时传入正确的参数', async () => {
      const row = createCreditsRow({ used: 0, total: 100, version: 3 });
      const purchasedRow = createPurchasedRow({ version: 2 });
      mocks.creditsSingle.mockResolvedValue({ data: row, error: null });
      mocks.purchasedMaybeSingle.mockResolvedValue({ data: purchasedRow, error: null });
      mocks.rpc.mockResolvedValue({
        data: { success: true, consumed: 1, monthly_cost: 1, purchased_cost: 0, monthly_remaining: 99, purchased_remaining: 50 },
        error: null,
      });

      await service.consumeCredits('user-1', ['preview']);

      expect(mocks.rpc).toHaveBeenCalledWith('consume_credits_with_priority', {
        p_user_id: 'user-1',
        p_total_cost: 1,
        p_operation_type: 'preview',
        p_credits_version: 3,
        p_purchased_version: 2,
      });
    });
  });

  // ─── hasEnoughCredits ───────────────────────────────────

  describe('hasEnoughCredits', () => {
    it('余额充足时返回 true', async () => {
      const row = createCreditsRow({ used: 0, total: 100 });
      mocks.creditsSingle.mockResolvedValue({ data: row, error: null });

      expect(await service.hasEnoughCredits('user-1', ['preview'])).toBe(true);
    });

    it('余额不足时返回 false', async () => {
      const row = createCreditsRow({ used: 90, total: 100 });
      mocks.creditsSingle.mockResolvedValue({ data: row, error: null });

      expect(await service.hasEnoughCredits('user-1', ['full_demo_long'])).toBe(false);
    });

    it('uses recovered purchased credits from completed payments in balance precheck', async () => {
      const row = createCreditsRow({ used: 100, total: 100 });
      mocks.creditsSingle.mockResolvedValue({ data: row, error: null });
      mocks.purchasedMaybeSingle.mockResolvedValue({ data: null, error: null });
      mocks.paymentsStatusEq.mockResolvedValue({ data: [{ amount: 9900 }], error: null });
      mocks.purchasedUpsertMaybeSingle.mockResolvedValue({
        data: createPurchasedRow({ balance: 50, total_purchased: 50, version: 0 }),
        error: null,
      });

      expect(await service.hasEnoughCredits('user-1', ['stem_split_advanced'])).toBe(true);
    });

    it('复合操作余额检查', async () => {
      const row = createCreditsRow({ used: 90, total: 100 });
      mocks.creditsSingle.mockResolvedValue({ data: row, error: null });

      // full_demo_short + premium_singer = 15，只剩 10，不够
      expect(await service.hasEnoughCredits('user-1', ['full_demo_short', 'premium_singer'])).toBe(false);
    });
  });

  // ─── resetMonthlyCredits ────────────────────────────────

  describe('resetMonthlyCredits', () => {
    it('归档当前周期并重置 credits（含分类消耗汇总）', async () => {
      const row = createCreditsRow({ used: 50, total: 100, version: 3, tier: 'pro' });
      mocks.creditsSingle.mockResolvedValue({ data: row, error: null });
      // Mock credit_transactions query returning some transactions
      mocks.txNeq.mockResolvedValue({
        data: [
          { monthly_cost: 30, purchased_cost: 20 },
        ],
        error: null,
      });
      mocks.historyInsert.mockResolvedValue({ data: null, error: null });
      mocks.creditsSimpleUpdateEq.mockResolvedValue({ data: null, error: null });

      await service.resetMonthlyCredits('user-1');

      // 验证归档到 credit_history（含分类消耗）
      expect(mocks.historyInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-1',
          month: '2025-01',
          used: 50,
          total: 100,
          monthly_used: 30,
          purchased_used: 20,
        })
      );

      // 验证 credits 表被重置
      expect(mocks.creditsSimpleUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          used: 0,
          total: TIER_CONFIGS.pro.monthlyCredits,
          version: 4,
        })
      );
    });

    it('无 transactions 时回退到 credits.used 作为 monthlyUsed', async () => {
      const row = createCreditsRow({ used: 50, total: 100, version: 3, tier: 'pro' });
      mocks.creditsSingle.mockResolvedValue({ data: row, error: null });
      mocks.txNeq.mockResolvedValue({ data: [], error: null });
      mocks.historyInsert.mockResolvedValue({ data: null, error: null });
      mocks.creditsSimpleUpdateEq.mockResolvedValue({ data: null, error: null });

      await service.resetMonthlyCredits('user-1');

      expect(mocks.historyInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-1',
          month: '2025-01',
          used: 50,
          total: 100,
          monthly_used: 50,
          purchased_used: 0,
        })
      );
    });

    it('读取错误时抛出 AppError', async () => {
      mocks.creditsSingle.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'Not found' },
      });

      await expect(service.resetMonthlyCredits('user-1')).rejects.toMatchObject({
        code: 'PGRST116',
        table: 'credits',
        operation: 'select',
      });
    });

    it('归档插入错误时抛出 AppError', async () => {
      const row = createCreditsRow({ used: 10, total: 100 });
      mocks.creditsSingle.mockResolvedValue({ data: row, error: null });
      mocks.txNeq.mockResolvedValue({ data: [], error: null });
      mocks.historyInsert.mockResolvedValue({
        data: null,
        error: { code: '23503', message: 'FK violation' },
      });

      await expect(service.resetMonthlyCredits('user-1')).rejects.toMatchObject({
        code: '23503',
        table: 'credit_history',
        operation: 'insert',
      });
    });

    it('重置更新错误时抛出 AppError', async () => {
      const row = createCreditsRow({ used: 10, total: 100 });
      mocks.creditsSingle.mockResolvedValue({ data: row, error: null });
      mocks.txNeq.mockResolvedValue({ data: [], error: null });
      mocks.historyInsert.mockResolvedValue({ data: null, error: null });
      mocks.creditsSimpleUpdateEq.mockResolvedValue({
        data: null,
        error: { code: '42501', message: 'Permission denied' },
      });

      await expect(service.resetMonthlyCredits('user-1')).rejects.toMatchObject({
        code: '42501',
        table: 'credits',
        operation: 'update',
      });
    });
  });

  // ─── consumePreview ────────────────────────────────────

  describe('consumePreview', () => {
    it('消耗 1 次 Preview 成功', async () => {
      const row = createPreviewRow({ used: 0, total: 3 });
      mocks.previewSingle.mockResolvedValue({ data: row, error: null });
      mocks.previewUpdateEq.mockResolvedValue({ data: null, error: null });

      const result = await service.consumePreview('user-1');
      expect(result.success).toBe(true);
      expect(result.consumed).toBe(1);
      expect(result.remaining).toBe(2);
    });

    it('次数用尽时返回 no_previews 错误', async () => {
      const row = createPreviewRow({ used: 3, total: 3 });
      mocks.previewSingle.mockResolvedValue({ data: row, error: null });

      const result = await service.consumePreview('user-1');
      expect(result.success).toBe(false);
      expect(result.error).toBe('no_previews');
      expect(result.consumed).toBe(0);
      expect(result.remaining).toBe(0);
    });

    it('已使用 2 次后还剩 1 次', async () => {
      const row = createPreviewRow({ used: 2, total: 3 });
      mocks.previewSingle.mockResolvedValue({ data: row, error: null });
      mocks.previewUpdateEq.mockResolvedValue({ data: null, error: null });

      const result = await service.consumePreview('user-1');
      expect(result.success).toBe(true);
      expect(result.remaining).toBe(0);
    });

    it('数据库读取错误时抛出 AppError', async () => {
      mocks.previewSingle.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'Not found' },
      });

      await expect(service.consumePreview('user-1')).rejects.toMatchObject({
        code: 'PGRST116',
        table: 'preview_counts',
        operation: 'select',
      });
    });

    it('数据库更新错误时抛出 AppError', async () => {
      const row = createPreviewRow({ used: 0, total: 3 });
      mocks.previewSingle.mockResolvedValue({ data: row, error: null });
      mocks.previewUpdateEq.mockResolvedValue({
        data: null,
        error: { code: '42501', message: 'Permission denied' },
      });

      await expect(service.consumePreview('user-1')).rejects.toMatchObject({
        code: '42501',
        table: 'preview_counts',
        operation: 'update',
      });
    });
  });

  // ─── getPreviewCount ───────────────────────────────────

  describe('getPreviewCount', () => {
    it('返回 PreviewCountInfo', async () => {
      const row = createPreviewRow({ used: 1, total: 3 });
      mocks.previewSingle.mockResolvedValue({ data: row, error: null });

      const info = await service.getPreviewCount('user-1');
      expect(info.userId).toBe('user-1');
      expect(info.used).toBe(1);
      expect(info.total).toBe(3);
      expect(info.remaining).toBe(2);
    });

    it('数据库错误时抛出 AppError', async () => {
      mocks.previewSingle.mockResolvedValue({
        data: null,
        error: { code: 'PGRST301', message: 'Timeout' },
      });

      await expect(service.getPreviewCount('user-1')).rejects.toMatchObject({
        code: 'PGRST301',
        table: 'preview_counts',
        operation: 'select',
      });
    });
  });

  // ─── getCreditHistory ───────────────────────────────────

  describe('getCreditHistory', () => {
    it('返回按 month 降序的历史记录', async () => {
      const historyData = [
        { id: '1', user_id: 'user-1', month: '2025-03', used: 80, total: 100, monthly_used: 60, purchased_used: 20, created_at: '2025-04-01T00:00:00Z' },
        { id: '2', user_id: 'user-1', month: '2025-02', used: 60, total: 100, monthly_used: 60, purchased_used: 0, created_at: '2025-03-01T00:00:00Z' },
      ];
      mocks.historyLimit.mockResolvedValue({ data: historyData, error: null });

      const history = await service.getCreditHistory('user-1', 6);
      expect(history).toHaveLength(2);
      expect(history[0].month).toBe('2025-03');
      expect(history[0].used).toBe(80);
      expect(history[0].total).toBe(100);
      expect(history[0].monthlyUsed).toBe(60);
      expect(history[0].purchasedUsed).toBe(20);
      expect(history[1].month).toBe('2025-02');
    });

    it('无历史时返回空数组', async () => {
      mocks.historyLimit.mockResolvedValue({ data: [], error: null });

      const history = await service.getCreditHistory('user-1', 6);
      expect(history).toEqual([]);
    });

    it('data 为 null 时返回空数组', async () => {
      mocks.historyLimit.mockResolvedValue({ data: null, error: null });

      const history = await service.getCreditHistory('user-1', 6);
      expect(history).toEqual([]);
    });

    it('数据库错误时抛出 AppError', async () => {
      mocks.historyLimit.mockResolvedValue({
        data: null,
        error: { code: 'PGRST301', message: 'Timeout' },
      });

      await expect(service.getCreditHistory('user-1', 6)).rejects.toMatchObject({
        code: 'PGRST301',
        table: 'credit_history',
        operation: 'select',
      });
    });
  });

  // ─── resetMonthlyPreviews ──────────────────────────────

  describe('resetMonthlyPreviews', () => {
    it('重置 preview_counts 的 used 为 0', async () => {
      mocks.previewUpdateEq.mockResolvedValue({ data: null, error: null });

      await service.resetMonthlyPreviews('user-1');

      expect(mocks.previewUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          used: 0,
          total: TIER_CONFIGS.free.monthlyPreviews,
        })
      );
    });

    it('数据库错误时抛出 AppError', async () => {
      mocks.previewUpdateEq.mockResolvedValue({
        data: null,
        error: { code: '42501', message: 'Permission denied' },
      });

      await expect(service.resetMonthlyPreviews('user-1')).rejects.toMatchObject({
        code: '42501',
        table: 'preview_counts',
        operation: 'update',
      });
    });
  });

  // ─── setUserTier ────────────────────────────────────────

  describe('setUserTier', () => {
    it('更新 credits 表的 tier 和 total', async () => {
      mocks.creditsSimpleUpdateEq.mockResolvedValue({ data: null, error: null });

      await service.setUserTier('user-1', 'pro');

      expect(mocks.creditsSimpleUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          tier: 'pro',
          total: TIER_CONFIGS.pro.monthlyCredits,
          used: 0,
          version: 0,
        })
      );
    });

    it('升级到 business 后配额变为 300', async () => {
      mocks.creditsSimpleUpdateEq.mockResolvedValue({ data: null, error: null });

      await service.setUserTier('user-1', 'business');

      expect(mocks.creditsSimpleUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          tier: 'business',
          total: 300,
        })
      );
    });

    it('数据库错误时抛出 AppError', async () => {
      mocks.creditsSimpleUpdateEq.mockResolvedValue({
        data: null,
        error: { code: '23503', message: 'FK violation' },
      });

      await expect(service.setUserTier('user-1', 'pro')).rejects.toMatchObject({
        code: '23503',
        table: 'credits',
        operation: 'update',
      });
    });
  });

  // ─── getPurchasedBalance ──────────────────────────────────

  describe('getPurchasedBalance', () => {
    it('有记录时返回 balance', async () => {
      const purchasedRow = createPurchasedRow({ balance: 75 });
      mocks.purchasedMaybeSingle.mockResolvedValue({ data: purchasedRow, error: null });

      const balance = await service.getPurchasedBalance('user-1');
      expect(balance).toBe(75);
    });

    it('无记录时返回 0', async () => {
      mocks.purchasedMaybeSingle.mockResolvedValue({ data: null, error: null });

      const balance = await service.getPurchasedBalance('user-1');
      expect(balance).toBe(0);
    });

    it('数据库错误时抛出 AppError', async () => {
      mocks.purchasedMaybeSingle.mockResolvedValue({
        data: null,
        error: { code: 'PGRST301', message: 'Timeout' },
      });

      await expect(service.getPurchasedBalance('user-1')).rejects.toMatchObject({
        code: 'PGRST301',
        table: 'purchased_credits',
        operation: 'select',
      });
    });
  });

  // ─── getCreditsEnhanced ─────────────────────────────────

  describe('getCreditsEnhanced', () => {
    it('有购买记录时返回完整 CreditInfoEnhanced', async () => {
      const creditsRow = createCreditsRow({ used: 30, total: 100 });
      const purchasedRow = createPurchasedRow({ balance: 50 });
      mocks.creditsSingle.mockResolvedValue({ data: creditsRow, error: null });
      mocks.purchasedMaybeSingle.mockResolvedValue({ data: purchasedRow, error: null });

      const info = await service.getCreditsEnhanced('user-1');
      expect(info.userId).toBe('user-1');
      expect(info.tier).toBe('pro');
      expect(info.monthlyUsed).toBe(30);
      expect(info.monthlyTotal).toBe(100);
      expect(info.monthlyRemaining).toBe(70);
      expect(info.purchasedBalance).toBe(50);
      expect(info.totalAvailable).toBe(120);
    });

    it('无购买记录时 purchasedBalance 为 0', async () => {
      const creditsRow = createCreditsRow({ used: 10, total: 100 });
      mocks.creditsSingle.mockResolvedValue({ data: creditsRow, error: null });
      mocks.purchasedMaybeSingle.mockResolvedValue({ data: null, error: null });

      const info = await service.getCreditsEnhanced('user-1');
      expect(info.purchasedBalance).toBe(0);
      expect(info.totalAvailable).toBe(90);
    });

    it('credits 查询错误时抛出 AppError', async () => {
      mocks.creditsSingle.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'Not found' },
      });

      await expect(service.getCreditsEnhanced('user-1')).rejects.toMatchObject({
        code: 'PGRST116',
        table: 'credits',
        operation: 'select',
      });
    });
  });

  // ─── purchaseCredits ────────────────────────────────────

  describe('purchaseCredits', () => {
    it('首次购买时创建新记录', async () => {
      mocks.purchasedMaybeSingle.mockResolvedValue({ data: null, error: null });
      mocks.purchasedInsertSelect.mockResolvedValue({
        data: [{ id: 'uuid-p-1', user_id: 'user-1', balance: 50, total_purchased: 50, version: 0, created_at: '', updated_at: '' }],
        error: null,
      });
      const creditsRow = createCreditsRow({ used: 30, total: 100 });
      mocks.creditsSingle.mockResolvedValue({ data: creditsRow, error: null });
      mocks.txInsert.mockResolvedValue({ data: null, error: null });

      const result = await service.purchaseCredits('user-1', 50);
      expect(result.success).toBe(true);
      expect(result.purchasedBalance).toBe(50);
      expect(result.totalAvailable).toBe(120); // 70 monthly remaining + 50 purchased
    });

    it('已有记录时累加 balance', async () => {
      const existingRow = createPurchasedRow({ balance: 30, total_purchased: 30, version: 1 });
      mocks.purchasedMaybeSingle.mockResolvedValue({ data: existingRow, error: null });
      mocks.purchasedUpdateSelect.mockResolvedValue({
        data: [{ ...existingRow, balance: 80, total_purchased: 80, version: 2 }],
        error: null,
      });
      const creditsRow = createCreditsRow({ used: 10, total: 100 });
      mocks.creditsSingle.mockResolvedValue({ data: creditsRow, error: null });
      mocks.txInsert.mockResolvedValue({ data: null, error: null });

      const result = await service.purchaseCredits('user-1', 50);
      expect(result.success).toBe(true);
      expect(result.purchasedBalance).toBe(80);
      expect(result.totalAvailable).toBe(170); // 90 monthly remaining + 80 purchased
    });

    it('乐观锁冲突时返回 concurrent_limit', async () => {
      const existingRow = createPurchasedRow({ balance: 30, version: 1 });
      mocks.purchasedMaybeSingle.mockResolvedValue({ data: existingRow, error: null });
      mocks.purchasedUpdateSelect.mockResolvedValue({ data: [], error: null });

      const result = await service.purchaseCredits('user-1', 50);
      expect(result.success).toBe(false);
      expect(result.error).toBe('concurrent_limit');
    });
  });

  // ─── calculateTotalCost ─────────────────────────────────

  describe('calculateTotalCost', () => {
    it('单操作成本正确', () => {
      expect(service.calculateTotalCost(['preview'])).toBe(1);
      expect(service.calculateTotalCost(['full_demo_short'])).toBe(10);
      expect(service.calculateTotalCost(['full_demo_long'])).toBe(20);
      expect(service.calculateTotalCost(['premium_singer'])).toBe(5);
      expect(service.calculateTotalCost(['export_wav'])).toBe(3);
      expect(service.calculateTotalCost(['export_stems'])).toBe(10);
    });

    it('复合操作成本累加', () => {
      expect(service.calculateTotalCost(['full_demo_short', 'premium_singer'])).toBe(15);
      expect(service.calculateTotalCost(['preview', 'premium_singer', 'export_wav'])).toBe(9);
    });

    it('空操作列表成本为 0', () => {
      expect(service.calculateTotalCost([])).toBe(0);
    });

    it('uses admin configured operation costs for async billing', async () => {
      mocks.adminConfigMaybeSingle.mockResolvedValue({
        data: {
          config_data: [
            { operation: 'preview', cost: 4, description: 'Configured preview', enabled: true },
            { operation: 'stem_split', cost: 12, description: 'Configured stem split', enabled: true },
          ],
        },
        error: null,
      });

      await expect(service.calculateTotalCostAsync(['preview', 'stem_split'])).resolves.toBe(16);
    });

    it('treats disabled admin cost rules as free', async () => {
      mocks.adminConfigMaybeSingle.mockResolvedValue({
        data: {
          config_data: [
            { operation: 'ai_preprocess', cost: 2, description: 'Preprocess', enabled: false },
          ],
        },
        error: null,
      });

      await expect(service.calculateTotalCostAsync(['ai_preprocess'])).resolves.toBe(0);
    });
  });
});
