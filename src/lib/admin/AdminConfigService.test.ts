// AdminConfigService 单元测试（Supabase 版）
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AdminConfigService } from './AdminConfigService';

/**
 * 创建 mock Supabase 客户端
 * 模拟 admin_config 和 config_changelog 表的链式调用
 */
function createMockSupabase() {
  // --- admin_config table mocks ---
  const adminConfigSelect = vi.fn().mockResolvedValue({ data: [], error: null });
  const adminConfigUpsert = vi.fn().mockResolvedValue({ data: null, error: null });

  // --- config_changelog table mocks ---
  const changelogInsert = vi.fn().mockResolvedValue({ data: null, error: null });
  const changelogLimit = vi.fn().mockResolvedValue({ data: [], error: null });
  const changelogOrder = vi.fn().mockReturnValue({ limit: changelogLimit });
  const changelogSelect = vi.fn().mockReturnValue({ order: changelogOrder });

  const mockFrom = vi.fn().mockImplementation((table: string) => {
    if (table === 'admin_config') {
      return {
        select: () => adminConfigSelect(),
        upsert: (data: any, opts?: any) => {
          return adminConfigUpsert(data, opts);
        },
      };
    }
    if (table === 'config_changelog') {
      return {
        select: () => ({ order: changelogOrder }),
        insert: (data: any) => changelogInsert(data),
      };
    }
    return {};
  });

  const supabase = { from: mockFrom } as any;

  return {
    supabase,
    mockFrom,
    adminConfigSelect,
    adminConfigUpsert,
    changelogInsert,
    changelogSelect,
    changelogOrder,
    changelogLimit,
  };
}

/** 创建模拟的 admin_config 行数据 */
function createAdminConfigRows() {
  return [
    {
      id: 'uuid-1',
      config_type: 'credit_quota' as const,
      config_data: [
        { tier: 'free', monthlyCredits: 3 },
        { tier: 'pro', monthlyCredits: 100 },
        { tier: 'business', monthlyCredits: 300 },
      ],
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
    },
    {
      id: 'uuid-2',
      config_type: 'cost_rule' as const,
      config_data: [
        { operation: 'preview', cost: 1, description: 'Preview 1 Credit' },
        { operation: 'full_demo_short', cost: 10, description: 'Full Demo Short' },
      ],
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
    },
    {
      id: 'uuid-3',
      config_type: 'pricing' as const,
      config_data: [
        { tier: 'pro', monthlyPrice: 19900, yearlyPrice: 190560 },
        { tier: 'business', monthlyPrice: 49900, yearlyPrice: 478560 },
      ],
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
    },
    {
      id: 'uuid-4',
      config_type: 'credits_pack' as const,
      config_data: [
        { id: 'pack-10', credits: 10, price: 2900, businessDiscount: 0.8 },
        { id: 'pack-50', credits: 50, price: 12900, businessDiscount: 0.8 },
      ],
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
    },
  ];
}

describe('AdminConfigService', () => {
  let service: AdminConfigService;
  let mocks: ReturnType<typeof createMockSupabase>;

  beforeEach(() => {
    mocks = createMockSupabase();
    service = new AdminConfigService(mocks.supabase);
  });

  // ─── getCurrentConfig ──────────────────────────────────

  describe('getCurrentConfig', () => {
    it('查询 admin_config 表并返回 AdminFullConfig', async () => {
      const rows = createAdminConfigRows();
      mocks.adminConfigSelect.mockResolvedValue({ data: rows, error: null });

      const config = await service.getCurrentConfig();

      expect(config).toHaveProperty('creditQuotas');
      expect(config).toHaveProperty('costRules');
      expect(config).toHaveProperty('pricing');
      expect(config).toHaveProperty('creditsPacks');
    });

    it('正确解析 JSONB creditQuotas 数据', async () => {
      const rows = createAdminConfigRows();
      mocks.adminConfigSelect.mockResolvedValue({ data: rows, error: null });

      const config = await service.getCurrentConfig();

      expect(config.creditQuotas).toHaveLength(3);
      const pro = config.creditQuotas.find((q) => q.tier === 'pro');
      expect(pro!.monthlyCredits).toBe(100);
    });

    it('正确解析 JSONB costRules 数据', async () => {
      const rows = createAdminConfigRows();
      mocks.adminConfigSelect.mockResolvedValue({ data: rows, error: null });

      const config = await service.getCurrentConfig();

      expect(config.costRules.length).toBeGreaterThanOrEqual(2);
      const preview = config.costRules.find((r) => r.operation === 'preview');
      expect(preview!.cost).toBe(1);
      const fullDemoShort = config.costRules.find((r) => r.operation === 'full_demo_short');
      expect(fullDemoShort!.cost).toBe(10);
    });

    it('正确解析 JSONB pricing 数据', async () => {
      const rows = createAdminConfigRows();
      mocks.adminConfigSelect.mockResolvedValue({ data: rows, error: null });

      const config = await service.getCurrentConfig();

      expect(config.pricing).toHaveLength(2);
      const proPrice = config.pricing.find((p) => p.tier === 'pro');
      expect(proPrice!.monthlyPrice).toBe(19900);
    });

    it('正确解析 JSONB creditsPacks 数据', async () => {
      const rows = createAdminConfigRows();
      mocks.adminConfigSelect.mockResolvedValue({ data: rows, error: null });

      const config = await service.getCurrentConfig();

      expect(config.creditsPacks).toHaveLength(2);
      const pack10 = config.creditsPacks.find((p) => p.id === 'pack-10');
      expect(pack10!.credits).toBe(10);
      expect(pack10!.price).toBe(2900);
      expect(pack10!.businessDiscount).toBe(0.8);
    });

    it('数据库返回空数组时返回默认成本规则和空业务配置', async () => {
      mocks.adminConfigSelect.mockResolvedValue({ data: [], error: null });

      const config = await service.getCurrentConfig();

      expect(config.creditQuotas).toEqual([]);
      expect(config.costRules.length).toBeGreaterThan(0);
      expect(config.pricing).toEqual([]);
      expect(config.creditsPacks).toEqual([]);
    });

    it('数据库错误时抛出 AppError', async () => {
      mocks.adminConfigSelect.mockResolvedValue({
        data: null,
        error: { code: 'PGRST301', message: 'Timeout' },
      });

      await expect(service.getCurrentConfig()).rejects.toMatchObject({
        code: 'PGRST301',
        table: 'admin_config',
        operation: 'select',
      });
    });
  });

  // ─── updateConfig ──────────────────────────────────────

  describe('updateConfig', () => {
    it('更新 creditQuotas 时 upsert admin_config 并插入 changelog', async () => {
      const rows = createAdminConfigRows();
      mocks.adminConfigSelect.mockResolvedValue({ data: rows, error: null });
      mocks.adminConfigUpsert.mockResolvedValue({ data: null, error: null });
      mocks.changelogInsert.mockResolvedValue({ data: null, error: null });

      const newQuotas = [
        { tier: 'free' as const, monthlyCredits: 5 },
        { tier: 'pro' as const, monthlyCredits: 200 },
        { tier: 'business' as const, monthlyCredits: 500 },
      ];

      await service.updateConfig({ creditQuotas: newQuotas }, 'admin-1');

      // 验证 upsert 被调用
      expect(mocks.adminConfigUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          config_type: 'credit_quota',
          config_data: newQuotas,
        }),
        expect.objectContaining({ onConflict: 'config_type' }),
      );

      // 验证 changelog 被插入
      expect(mocks.changelogInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          operator_id: 'admin-1',
          operator_name: '管理员 admin-1',
          config_type: 'credit_quota',
          description: '更新等级 Credits 配额',
        }),
      );
    });

    it('更新 costRules 时正确记录变更', async () => {
      const rows = createAdminConfigRows();
      mocks.adminConfigSelect.mockResolvedValue({ data: rows, error: null });
      mocks.adminConfigUpsert.mockResolvedValue({ data: null, error: null });
      mocks.changelogInsert.mockResolvedValue({ data: null, error: null });

      const newRules = [
        { operation: 'preview' as const, cost: 2, description: 'Preview 2 Credits' },
      ];

      await service.updateConfig({ costRules: newRules }, 'admin-2');

      expect(mocks.adminConfigUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          config_type: 'cost_rule',
          config_data: newRules,
        }),
        expect.any(Object),
      );

      expect(mocks.changelogInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          operator_id: 'admin-2',
          config_type: 'cost_rule',
          description: '更新 Credits 消耗规则',
        }),
      );
    });

    it('同时更新多个配置类型时分别 upsert 和记录日志', async () => {
      const rows = createAdminConfigRows();
      mocks.adminConfigSelect.mockResolvedValue({ data: rows, error: null });
      mocks.adminConfigUpsert.mockResolvedValue({ data: null, error: null });
      mocks.changelogInsert.mockResolvedValue({ data: null, error: null });

      await service.updateConfig(
        {
          creditQuotas: [{ tier: 'pro', monthlyCredits: 200 }],
          pricing: [{ tier: 'pro', monthlyPrice: 29900, yearlyPrice: 286560 }],
        },
        'admin-1',
      );

      // 两次 upsert（credit_quota + pricing）
      expect(mocks.adminConfigUpsert).toHaveBeenCalledTimes(2);
      // 两次 changelog insert
      expect(mocks.changelogInsert).toHaveBeenCalledTimes(2);
    });

    it('changelog 记录包含 previous_value 和 new_value', async () => {
      const rows = createAdminConfigRows();
      mocks.adminConfigSelect.mockResolvedValue({ data: rows, error: null });
      mocks.adminConfigUpsert.mockResolvedValue({ data: null, error: null });
      mocks.changelogInsert.mockResolvedValue({ data: null, error: null });

      const newQuotas = [{ tier: 'pro' as const, monthlyCredits: 200 }];
      await service.updateConfig({ creditQuotas: newQuotas }, 'admin-1');

      const insertCall = mocks.changelogInsert.mock.calls[0][0];
      expect(insertCall.previous_value).toEqual(rows[0].config_data);
      expect(insertCall.new_value).toEqual(newQuotas);
    });

    it('admin_config upsert 错误时抛出 AppError', async () => {
      const rows = createAdminConfigRows();
      mocks.adminConfigSelect.mockResolvedValue({ data: rows, error: null });
      mocks.adminConfigUpsert.mockResolvedValue({
        data: null,
        error: { code: '42501', message: 'Permission denied' },
      });

      await expect(
        service.updateConfig({ creditQuotas: [{ tier: 'pro', monthlyCredits: 200 }] }, 'admin-1'),
      ).rejects.toMatchObject({
        code: '42501',
        table: 'admin_config',
        operation: 'upsert',
      });
    });

    it('config_changelog insert 错误时抛出 AppError', async () => {
      const rows = createAdminConfigRows();
      mocks.adminConfigSelect.mockResolvedValue({ data: rows, error: null });
      mocks.adminConfigUpsert.mockResolvedValue({ data: null, error: null });
      mocks.changelogInsert.mockResolvedValue({
        data: null,
        error: { code: '23505', message: 'Duplicate key' },
      });

      await expect(
        service.updateConfig({ creditQuotas: [{ tier: 'pro', monthlyCredits: 200 }] }, 'admin-1'),
      ).rejects.toMatchObject({
        code: '23505',
        table: 'config_changelog',
        operation: 'insert',
      });
    });
  });

  // ─── getChangeHistory ──────────────────────────────────

  describe('getChangeHistory', () => {
    it('查询 config_changelog 表并返回 ConfigChangeLog 数组', async () => {
      const changelogRows = [
        {
          id: 'log-1',
          operator_id: 'admin-1',
          operator_name: '管理员 admin-1',
          config_type: 'credit_quota' as const,
          previous_value: { data: 'old' },
          new_value: { data: 'new' },
          changed_at: '2025-03-01T10:00:00Z',
          description: '更新等级 Credits 配额',
        },
        {
          id: 'log-2',
          operator_id: 'admin-2',
          operator_name: '管理员 admin-2',
          config_type: 'cost_rule' as const,
          previous_value: { data: 'old2' },
          new_value: { data: 'new2' },
          changed_at: '2025-02-15T08:00:00Z',
          description: '更新 Credits 消耗规则',
        },
      ];
      mocks.changelogLimit.mockResolvedValue({ data: changelogRows, error: null });

      const history = await service.getChangeHistory(10);

      expect(history).toHaveLength(2);
      expect(history[0].id).toBe('log-1');
      expect(history[0].operatorId).toBe('admin-1');
      expect(history[0].operatorName).toBe('管理员 admin-1');
      expect(history[0].configType).toBe('credit_quota');
      expect(history[0].changedAt).toBeInstanceOf(Date);
      expect(history[0].changedAt.toISOString()).toBe('2025-03-01T10:00:00.000Z');
      expect(history[0].description).toBe('更新等级 Credits 配额');
    });

    it('正确转换 changedAt 为 Date 对象', async () => {
      const changelogRows = [
        {
          id: 'log-1',
          operator_id: 'admin-1',
          operator_name: '管理员 admin-1',
          config_type: 'pricing' as const,
          previous_value: {},
          new_value: {},
          changed_at: '2025-06-15T14:30:00Z',
          description: '更新会员价格配置',
        },
      ];
      mocks.changelogLimit.mockResolvedValue({ data: changelogRows, error: null });

      const history = await service.getChangeHistory(5);
      expect(history[0].changedAt).toBeInstanceOf(Date);
      expect(history[0].changedAt.toISOString()).toBe('2025-06-15T14:30:00.000Z');
    });

    it('正确解析 JSONB previous_value 和 new_value', async () => {
      const previousValue = [{ tier: 'pro', monthlyCredits: 100 }];
      const newValue = [{ tier: 'pro', monthlyCredits: 200 }];
      const changelogRows = [
        {
          id: 'log-1',
          operator_id: 'admin-1',
          operator_name: '管理员 admin-1',
          config_type: 'credit_quota' as const,
          previous_value: previousValue,
          new_value: newValue,
          changed_at: '2025-03-01T10:00:00Z',
          description: '更新等级 Credits 配额',
        },
      ];
      mocks.changelogLimit.mockResolvedValue({ data: changelogRows, error: null });

      const history = await service.getChangeHistory(10);
      expect(history[0].previousValue).toEqual(previousValue);
      expect(history[0].newValue).toEqual(newValue);
    });

    it('按 changed_at 降序排列（通过 order 参数）', async () => {
      mocks.changelogLimit.mockResolvedValue({ data: [], error: null });

      await service.getChangeHistory(10);

      // 验证 order 被调用时传入了 changed_at 降序
      expect(mocks.changelogOrder).toHaveBeenCalledWith('changed_at', { ascending: false });
    });

    it('limit 参数传递给查询', async () => {
      mocks.changelogLimit.mockResolvedValue({ data: [], error: null });

      await service.getChangeHistory(5);

      expect(mocks.changelogLimit).toHaveBeenCalledWith(5);
    });

    it('无历史时返回空数组', async () => {
      mocks.changelogLimit.mockResolvedValue({ data: [], error: null });

      const history = await service.getChangeHistory(10);
      expect(history).toEqual([]);
    });

    it('data 为 null 时返回空数组', async () => {
      mocks.changelogLimit.mockResolvedValue({ data: null, error: null });

      const history = await service.getChangeHistory(10);
      expect(history).toEqual([]);
    });

    it('数据库错误时抛出 AppError', async () => {
      mocks.changelogLimit.mockResolvedValue({
        data: null,
        error: { code: 'PGRST301', message: 'Timeout' },
      });

      await expect(service.getChangeHistory(10)).rejects.toMatchObject({
        code: 'PGRST301',
        table: 'config_changelog',
        operation: 'select',
      });
    });
  });
});
