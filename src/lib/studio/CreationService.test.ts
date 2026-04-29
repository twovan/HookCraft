// CreationService 单元测试
import { describe, it, expect, beforeEach } from 'vitest';
import { CreationService } from './CreationService';
import { CreditService } from '../credits/CreditService';
import { TemplateService } from '../template/TemplateService';
import { TIER_CONFIGS } from '../../config/tierConfig';
import { CREDITS_COST } from '../../config/creditsCost';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../supabase/types';
import type { Template } from '../../types/template';
import type { MembershipTier } from '../../types/membership';
import type { CreditOperationType, ConsumeResult, PreviewCountInfo } from '../../types/credits';

const TEST_TEMPLATES: Template[] = [
  {
    id: 'tpl-free-pop',
    name: '流行节拍',
    description: '免费流行模板',
    category: 'free_template',
    genre: 'pop',
    analysisStatus: 'pending',
  },
  {
    id: 'tpl-paid-edm',
    name: 'EDM 电子舞曲',
    description: '付费电子模板',
    category: 'paid_template',
    genre: 'edm',
    analysisStatus: 'pending',
  },
];

// ─── 用于测试的 Mock 服务 ─────────────────────────────────
// CreationService 以同步方式调用 CreditService / TemplateService，
// 因此 mock 子类用内存数据覆盖父类的 async 方法，返回普通值而非 Promise。

/** 空 Supabase 客户端占位（不会被实际调用） */
const dummySupabase = {} as SupabaseClient<Database>;

/**
 * MockCreditService - 内存版 CreditService
 *
 * 覆盖 consumePreview / hasEnoughCredits / setUserTier / consumeCredits / getPreviewCount，
 * 使其以同步方式操作内存数据，与 CreationService 的同步调用方式匹配。
 */
class MockCreditService extends CreditService {
  private userCredits: Map<string, { tier: MembershipTier; used: number; total: number }> =
    new Map();
  private previewCounts: Map<string, { used: number; total: number }> = new Map();

  constructor() {
    super(dummySupabase);
  }

  /** 设置用户等级并初始化 Credits */
  override setUserTier(userId: string, tier: MembershipTier): any {
    const monthlyCredits = TIER_CONFIGS[tier].monthlyCredits;
    this.userCredits.set(userId, { tier, used: 0, total: monthlyCredits });
  }

  /** 消耗 Credits（同步） */
  override consumeCredits(userId: string, operations: CreditOperationType[]): any {
    const totalCost = this.calculateTotalCost(operations);
    const info = this.userCredits.get(userId);
    if (!info) {
      return { success: false, remaining: 0, consumed: 0, error: 'no_credits' as const };
    }
    if (info.used + totalCost > info.total) {
      return {
        success: false,
        remaining: info.total - info.used,
        consumed: 0,
        error: 'no_credits' as const,
      };
    }
    info.used += totalCost;
    return { success: true, remaining: info.total - info.used, consumed: totalCost };
  }

  /** 检查余额是否充足（同步） */
  override hasEnoughCredits(userId: string, operations: CreditOperationType[]): any {
    const info = this.userCredits.get(userId);
    if (!info) return false;
    const totalCost = this.calculateTotalCost(operations);
    return info.total - info.used >= totalCost;
  }

  /** 消耗 1 次 Preview（同步） */
  override consumePreview(userId: string): any {
    let counts = this.previewCounts.get(userId);
    if (!counts) {
      counts = { used: 0, total: TIER_CONFIGS.free.monthlyPreviews };
      this.previewCounts.set(userId, counts);
    }
    const remaining = counts.total - counts.used;
    if (remaining <= 0) {
      return { success: false, remaining: 0, consumed: 0, error: 'no_previews' as const };
    }
    counts.used += 1;
    return { success: true, remaining: remaining - 1, consumed: 1 };
  }

  /** 获取 Preview 次数信息（同步） */
  override getPreviewCount(userId: string): any {
    const counts = this.previewCounts.get(userId) ?? {
      used: 0,
      total: TIER_CONFIGS.free.monthlyPreviews,
    };
    return {
      userId,
      used: counts.used,
      total: counts.total,
      remaining: counts.total - counts.used,
    };
  }
}

/**
 * MockTemplateService - 内存版 TemplateService
 *
 * 覆盖 isTemplateAccessible，使其以同步方式查找内存模板列表。
 */
class MockTemplateService extends TemplateService {
  private templates: Template[];

  constructor(templates: Template[]) {
    super(dummySupabase);
    this.templates = templates;
  }

  /** 检查模板访问权限（同步） */
  override isTemplateAccessible(userTier: MembershipTier, templateId: string): any {
    const template = this.templates.find((t) => t.id === templateId);
    if (!template) return false;
    const tierFeatures = TIER_CONFIGS[userTier].features;
    return tierFeatures.includes(template.category);
  }
}

// ─── 测试 ─────────────────────────────────────────────────

describe('CreationService', () => {
  let creditService: MockCreditService;
  let templateService: MockTemplateService;
  let creationService: CreationService;

  beforeEach(() => {
    creditService = new MockCreditService();
    templateService = new MockTemplateService(TEST_TEMPLATES);
    creationService = new CreationService(creditService, templateService);
  });

  // ─── 输入验证 ──────────────────────────────────────────

  describe('输入验证', () => {
    it('templateId 和 prompt 都为空时返回错误', async () => {
      const result = await creationService.createGenerationTask('user-1', 'pro', {
        duration: 30,
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('请选择模板或输入提示词');
    });

    it('仅提供 templateId 时通过验证', async () => {
      creditService.setUserTier('user-1', 'pro');
      const result = await creationService.createGenerationTask('user-1', 'pro', {
        templateId: 'tpl-free-pop',
        duration: 30,
      });
      expect(result.success).toBe(true);
      expect(result.promptStrategy).toBe('template_only');
    });

    it('仅提供 prompt 时通过验证', async () => {
      creditService.setUserTier('user-1', 'pro');
      const result = await creationService.createGenerationTask('user-1', 'pro', {
        prompt: '一首轻快的流行歌曲',
        duration: 30,
      });
      expect(result.success).toBe(true);
      expect(result.promptStrategy).toBe('prompt_only');
    });

    it('同时提供 templateId 和 prompt 时策略为 template_and_prompt', async () => {
      creditService.setUserTier('user-1', 'pro');
      const result = await creationService.createGenerationTask('user-1', 'pro', {
        templateId: 'tpl-free-pop',
        prompt: '加入更多鼓点',
        duration: 30,
      });
      expect(result.success).toBe(true);
      expect(result.promptStrategy).toBe('template_and_prompt');
    });
  });

  // ─── Free 用户仅允许 Preview ──────────────────────────

  describe('Free 用户 Preview 限制', () => {
    it('Free 用户 duration=30 允许生成 Preview', async () => {
      const result = await creationService.createGenerationTask('free-user', 'free', {
        prompt: '一首轻快的歌',
        duration: 30,
      });
      expect(result.success).toBe(true);
      expect(result.generationType).toBe('preview');
    });

    it('Free 用户 duration=120 被拒绝（Full Demo）', async () => {
      const result = await creationService.createGenerationTask('free-user', 'free', {
        prompt: '一首轻快的歌',
        duration: 120,
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('升级到专业版解锁完整 Demo 生成');
    });
  });

  // ─── 模板访问权限 ─────────────────────────────────────

  describe('模板访问权限', () => {
    it('Free 用户可以使用 free_template', async () => {
      const result = await creationService.createGenerationTask('free-user', 'free', {
        templateId: 'tpl-free-pop',
        duration: 30,
      });
      expect(result.success).toBe(true);
    });

    it('Free 用户不能使用 paid_template', async () => {
      const result = await creationService.createGenerationTask('free-user', 'free', {
        templateId: 'tpl-paid-edm',
        duration: 30,
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('无权访问该模板');
    });

    it('Pro 用户可以使用 paid_template', async () => {
      creditService.setUserTier('user-1', 'pro');
      const result = await creationService.createGenerationTask('user-1', 'pro', {
        templateId: 'tpl-paid-edm',
        duration: 30,
      });
      expect(result.success).toBe(true);
    });

    it('不存在的模板返回错误', async () => {
      creditService.setUserTier('user-1', 'pro');
      const result = await creationService.createGenerationTask('user-1', 'pro', {
        templateId: 'tpl-nonexistent',
        duration: 30,
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('无权访问该模板');
    });
  });

  // ─── Credits 消耗计算 ─────────────────────────────────

  describe('Credits 消耗计算', () => {
    it('Preview（30s）消耗 1 Credit', async () => {
      creditService.setUserTier('user-1', 'pro');
      const result = await creationService.createGenerationTask('user-1', 'pro', {
        prompt: '流行歌曲',
        duration: 30,
      });
      expect(result.success).toBe(true);
      expect(result.creditsCost).toBe(1);
    });

    it('Full Demo（120s）消耗 20 Credits', async () => {
      creditService.setUserTier('user-1', 'pro');
      const result = await creationService.createGenerationTask('user-1', 'pro', {
        prompt: '流行歌曲',
        duration: 120,
      });
      expect(result.success).toBe(true);
      expect(result.creditsCost).toBe(20);
    });
  });

  // ─── Free 用户 Preview 次数消耗 ──────────────────────

  describe('Free 用户 Preview 次数消耗', () => {
    it('Free 用户成功消耗 1 次 Preview', async () => {
      const result = await creationService.createGenerationTask('free-user', 'free', {
        prompt: '一首歌',
        duration: 30,
      });
      expect(result.success).toBe(true);
      const count = creditService.getPreviewCount('free-user');
      expect(count.remaining).toBe(2);
    });

    it('Free 用户 3 次 Preview 用尽后被拒绝', async () => {
      // 消耗 3 次
      await creationService.createGenerationTask('free-user', 'free', { prompt: '歌1', duration: 30 });
      await creationService.createGenerationTask('free-user', 'free', { prompt: '歌2', duration: 30 });
      await creationService.createGenerationTask('free-user', 'free', { prompt: '歌3', duration: 30 });

      const result = await creationService.createGenerationTask('free-user', 'free', {
        prompt: '歌4',
        duration: 30,
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('本月预览次数已用尽');
    });
  });

  // ─── 付费用户 Credits 余额检查 ────────────────────────

  describe('付费用户 Credits 余额检查', () => {
    it('Pro 用户余额充足时成功', async () => {
      creditService.setUserTier('user-1', 'pro');
      const result = await creationService.createGenerationTask('user-1', 'pro', {
        prompt: '流行歌曲',
        duration: 120,
      });
      expect(result.success).toBe(true);
      expect(result.generationType).toBe('full_demo');
    });

    it('Pro 用户余额不足时被拒绝', async () => {
      creditService.setUserTier('user-1', 'pro');
      // 消耗到只剩 10 Credits
      creditService.consumeCredits('user-1', ['full_demo_long']); // 20
      creditService.consumeCredits('user-1', ['full_demo_long']); // 20
      creditService.consumeCredits('user-1', ['full_demo_long']); // 20
      creditService.consumeCredits('user-1', ['full_demo_long']); // 20
      creditService.consumeCredits('user-1', ['full_demo_short']); // 10, 剩 10

      const result = await creationService.createGenerationTask('user-1', 'pro', {
        prompt: '流行歌曲',
        duration: 120, // 需要 20 Credits
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Credits 不足');
    });

    it('Business 用户 Full Demo 成功', async () => {
      creditService.setUserTier('user-1', 'business');
      const result = await creationService.createGenerationTask('user-1', 'business', {
        templateId: 'tpl-paid-edm',
        prompt: '加入更多低音',
        duration: 120,
      });
      expect(result.success).toBe(true);
      expect(result.generationType).toBe('full_demo');
      expect(result.creditsCost).toBe(20);
    });
  });
});
