// CreditService 单元测试（Supabase 版）
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CreditService } from './CreditService';
import { CREDITS_COST } from '../../config/creditsCost';
import { TIER_CONFIGS } from '../../config/tierConfig';

/**
 * 创建 mock Supabase 客户端
 * 模拟 credits、credit_history、preview_counts 表的链式调用
 *
 * credits update 有两种模式：
 * - 乐观锁 (consumeCredits): .update({}).eq('user_id', x).eq('version', v).select('*')
 * - 简单更新 (setUserTier, resetMonthlyCredits): .update({}).eq('user_id', x)
 *
 * 区分方式：乐观锁更新只有 used/version/updated_at 三个字段
 */
function createMockSupabase() {
  // --- credits table mocks ---
  const creditsSingle = vi.fn().mockResolvedValue({ data: null, error: null });
  const creditsSelectEq = vi.fn().mockReturnValue({ single: creditsSingle });
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
    return {};
  });

  const supabase = { from: mockFrom } as any;

  return {
    supabase,
    mockFrom,
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
    it('Preview 消耗 1 Credit 成功', async () => {
      const row = createCreditsRow({ used: 0, total: 100, version: 0 });
      mocks.creditsSingle.mockResolvedValue({ data: row, error: null });
      mocks.creditsUpdateSelect.mockResolvedValue({
        data: [{ ...row, used: 1, version: 1 }],
        error: null,
      });

      const result = await service.consumeCredits('user-1', ['preview']);
      expect(result.success).toBe(true);
      expect(result.consumed).toBe(1);
      expect(result.remaining).toBe(99);
    });

    it('Full Demo Short 消耗 10 Credits', async () => {
      const row = createCreditsRow({ used: 0, total: 100, version: 0 });
      mocks.creditsSingle.mockResolvedValue({ data: row, error: null });
      mocks.creditsUpdateSelect.mockResolvedValue({
        data: [{ ...row, used: 10, version: 1 }],
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
      mocks.creditsUpdateSelect.mockResolvedValue({
        data: [{ ...row, used: 15, version: 1 }],
        error: null,
      });

      const result = await service.consumeCredits('user-1', ['full_demo_short', 'premium_singer']);
      expect(result.success).toBe(true);
      expect(result.consumed).toBe(15);
      expect(result.remaining).toBe(85);
    });

    it('余额不足时返回 no_credits 错误', async () => {
      const row = createCreditsRow({ used: 90, total: 100, version: 5 });
      mocks.creditsSingle.mockResolvedValue({ data: row, error: null });

      const result = await service.consumeCredits('user-1', ['full_demo_long']); // 需要 20，只剩 10
      expect(result.success).toBe(false);
      expect(result.error).toBe('no_credits');
      expect(result.consumed).toBe(0);
      expect(result.remaining).toBe(10);
    });

    it('乐观锁冲突时返回 concurrent_limit 错误', async () => {
      const row = createCreditsRow({ used: 0, total: 100, version: 3 });
      mocks.creditsSingle.mockResolvedValue({ data: row, error: null });
      // 模拟 version 不匹配：update 返回空数组（0 行被更新）
      mocks.creditsUpdateSelect.mockResolvedValue({
        data: [],
        error: null,
      });

      const result = await service.consumeCredits('user-1', ['preview']);
      expect(result.success).toBe(false);
      expect(result.error).toBe('concurrent_limit');
      expect(result.consumed).toBe(0);
      expect(result.remaining).toBe(100);
    });

    it('update 返回 null data 时视为并发冲突', async () => {
      const row = createCreditsRow({ used: 0, total: 100, version: 0 });
      mocks.creditsSingle.mockResolvedValue({ data: row, error: null });
      mocks.creditsUpdateSelect.mockResolvedValue({
        data: null,
        error: null,
      });

      const result = await service.consumeCredits('user-1', ['preview']);
      expect(result.success).toBe(false);
      expect(result.error).toBe('concurrent_limit');
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

    it('数据库更新错误时抛出 AppError', async () => {
      const row = createCreditsRow({ used: 0, total: 100, version: 0 });
      mocks.creditsSingle.mockResolvedValue({ data: row, error: null });
      mocks.creditsUpdateSelect.mockResolvedValue({
        data: null,
        error: { code: '42501', message: 'Permission denied' },
      });

      await expect(service.consumeCredits('user-1', ['preview'])).rejects.toMatchObject({
        code: '42501',
        table: 'credits',
        operation: 'update',
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

    it('复合操作余额检查', async () => {
      const row = createCreditsRow({ used: 90, total: 100 });
      mocks.creditsSingle.mockResolvedValue({ data: row, error: null });

      // full_demo_short + premium_singer = 15，只剩 10，不够
      expect(await service.hasEnoughCredits('user-1', ['full_demo_short', 'premium_singer'])).toBe(false);
    });
  });

  // ─── resetMonthlyCredits ────────────────────────────────

  describe('resetMonthlyCredits', () => {
    it('归档当前周期并重置 credits', async () => {
      const row = createCreditsRow({ used: 50, total: 100, version: 3, tier: 'pro' });
      mocks.creditsSingle.mockResolvedValue({ data: row, error: null });
      mocks.historyInsert.mockResolvedValue({ data: null, error: null });
      mocks.creditsSimpleUpdateEq.mockResolvedValue({ data: null, error: null });

      await service.resetMonthlyCredits('user-1');

      // 验证归档到 credit_history
      expect(mocks.historyInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-1',
          month: '2025-01',
          used: 50,
          total: 100,
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
        { id: '1', user_id: 'user-1', month: '2025-03', used: 80, total: 100, created_at: '2025-04-01T00:00:00Z' },
        { id: '2', user_id: 'user-1', month: '2025-02', used: 60, total: 100, created_at: '2025-03-01T00:00:00Z' },
      ];
      mocks.historyLimit.mockResolvedValue({ data: historyData, error: null });

      const history = await service.getCreditHistory('user-1', 6);
      expect(history).toHaveLength(2);
      expect(history[0].month).toBe('2025-03');
      expect(history[0].used).toBe(80);
      expect(history[0].total).toBe(100);
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
  });
});
