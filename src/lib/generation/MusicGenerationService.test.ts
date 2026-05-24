// MusicGenerationService 单元测试（Supabase 版）
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MusicGenerationService, DEFAULT_TEMPLATE_DESCRIPTION } from './MusicGenerationService';
import type { AIModelProvider } from './AIModelProvider';
import type { GenerationRequest, GenerationResponse, MusicGenerationInput } from '../../types/generation';

// ─── Mock AIModelProvider ─────────────────────────────────

function createMockProvider(overrides?: {
  previewResult?: GenerationResponse;
  fullDemoResult?: GenerationResponse;
  shouldThrow?: boolean;
}): AIModelProvider {
  const successResponse: GenerationResponse = {
    success: true,
    audioData: Buffer.from('fake-audio'),
    audioMimeType: 'audio/mpeg',
    lyrics: 'Test lyrics',
    modelId: 'lyria-3-clip-preview',
    hasSynthIdWatermark: true,
  };

  return {
    providerName: 'mock-lyria',
    async generatePreview(_req: GenerationRequest): Promise<GenerationResponse> {
      if (overrides?.shouldThrow) throw new Error('Lyria timeout');
      return overrides?.previewResult ?? successResponse;
    },
    async generateFullDemo(_req: GenerationRequest): Promise<GenerationResponse> {
      if (overrides?.shouldThrow) throw new Error('Lyria timeout');
      return overrides?.fullDemoResult ?? {
        ...successResponse,
        modelId: 'lyria-3-pro-preview',
      };
    },
  };
}

// ─── Mock Supabase Client ─────────────────────────────────

function createMockSupabase() {
  // generation_tasks table mocks
  const taskInsert = vi.fn().mockResolvedValue({ data: null, error: null });
  const taskUpdateEq = vi.fn().mockResolvedValue({ data: null, error: null });
  const taskUpdate = vi.fn().mockReturnValue({ eq: taskUpdateEq });
  const taskSingle = vi.fn().mockResolvedValue({ data: { status: 'pending' }, error: null });
  const taskSelectEq = vi.fn().mockReturnValue({ single: taskSingle });
  const taskSelect = vi.fn().mockReturnValue({ eq: taskSelectEq });

  const mockFrom = vi.fn().mockImplementation((table: string) => {
    if (table === 'generation_tasks') {
      return {
        insert: taskInsert,
        update: (data: any) => {
          taskUpdate(data);
          return { eq: taskUpdateEq };
        },
        select: taskSelect,
      };
    }
    return {};
  });

  const supabase = { from: mockFrom } as any;

  return {
    supabase,
    mockFrom,
    taskInsert,
    taskUpdate,
    taskUpdateEq,
    taskSelect,
    taskSelectEq,
    taskSingle,
  };
}

// ─── Mock CreditService ───────────────────────────────────

function createMockCreditService(overrides?: {
  hasEnough?: boolean;
  previewRemaining?: number;
  consumeCreditsResult?: any;
  consumePreviewResult?: any;
}) {
  return {
    getCredits: vi.fn().mockResolvedValue({
      userId: 'user-1',
      tier: 'pro',
      used: 0,
      total: 100,
      remaining: 100,
      periodStart: new Date(),
      periodEnd: new Date(),
    }),
    hasEnoughCredits: vi.fn().mockResolvedValue(overrides?.hasEnough ?? true),
    consumeCredits: vi.fn().mockResolvedValue(
      overrides?.consumeCreditsResult ?? { success: true, consumed: 1, remaining: 99 }
    ),
    consumePreview: vi.fn().mockResolvedValue(
      overrides?.consumePreviewResult ?? { success: true, consumed: 1, remaining: 2 }
    ),
    getPreviewCount: vi.fn().mockResolvedValue({
      userId: 'user-1',
      used: 0,
      total: 3,
      remaining: overrides?.previewRemaining ?? 3,
    }),
    calculateTotalCost: vi.fn().mockReturnValue(1),
    calculateTotalCostAsync: vi.fn().mockResolvedValue(1),
  } as any;
}

// ─── Mock TemplateAdminService ────────────────────────────

function createMockTemplateAdminService(overrides?: {
  cachedAnalysis?: any;
}) {
  return {
    getCachedAnalysis: vi.fn().mockResolvedValue(
      overrides?.cachedAnalysis ?? null
    ),
    analyzeTemplate: vi.fn().mockResolvedValue({}),
  } as any;
}

// ─── Mock TemplateService ─────────────────────────────────

function createMockTemplateService() {
  return {
    getTemplates: vi.fn().mockResolvedValue([]),
    getTemplateById: vi.fn().mockResolvedValue(null),
  } as any;
}

// ─── Helper: 创建 Service 实例 ────────────────────────────

function createService(options?: {
  providerOverrides?: Parameters<typeof createMockProvider>[0];
  creditServiceOverrides?: Parameters<typeof createMockCreditService>[0];
  templateAdminOverrides?: Parameters<typeof createMockTemplateAdminService>[0];
}) {
  const mocks = createMockSupabase();
  const creditService = createMockCreditService(options?.creditServiceOverrides);
  const templateService = createMockTemplateService();
  const templateAdminService = createMockTemplateAdminService(options?.templateAdminOverrides);

  const service = new MusicGenerationService({
    supabase: mocks.supabase,
    provider: createMockProvider(options?.providerOverrides),
    creditService,
    templateService,
    templateAdminService,
  });

  return { service, mocks, creditService, templateService, templateAdminService };
}

// ─── 任务创建测试 ─────────────────────────────────────────

describe('MusicGenerationService - 任务创建（generation_tasks 表插入）', () => {
  it('生成时在 generation_tasks 表中插入新记录', async () => {
    const { service, mocks } = createService();

    await service.generate('user-1', 'pro', {
      userPrompt: 'A pop song',
      generationType: 'preview',
    });

    expect(mocks.taskInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        generation_type: 'preview',
        status: 'pending',
        model_id: 'lyria-3-clip-preview',
      })
    );
  });

  it('full_demo 任务使用 lyria-3-pro-preview 模型', async () => {
    const { service, mocks } = createService();

    await service.generate('user-1', 'pro', {
      userPrompt: 'A rock song',
      generationType: 'full_demo',
    });

    expect(mocks.taskInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        generation_type: 'full_demo',
        model_id: 'lyria-3-pro-preview',
      })
    );
  });

  it('任务创建包含 template_id 和 prompt', async () => {
    const { service, mocks } = createService();

    await service.generate('user-1', 'pro', {
      templateId: 'tpl-1',
      userPrompt: 'Make it jazzy',
      generationType: 'preview',
    });

    expect(mocks.taskInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        template_id: 'tpl-1',
        prompt: 'Make it jazzy',
      })
    );
  });

  it('无 templateId 时 template_id 为 null', async () => {
    const { service, mocks } = createService();

    await service.generate('user-1', 'pro', {
      userPrompt: 'A song',
      generationType: 'preview',
    });

    expect(mocks.taskInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        template_id: null,
      })
    );
  });

  it('任务创建数据库错误时抛出 AppError', async () => {
    const { service, mocks } = createService();
    mocks.taskInsert.mockResolvedValue({
      data: null,
      error: { code: '23503', message: 'FK violation' },
    });

    await expect(
      service.generate('user-1', 'pro', {
        userPrompt: 'A song',
        generationType: 'preview',
      })
    ).rejects.toMatchObject({
      code: '23503',
      table: 'generation_tasks',
      operation: 'insert',
    });
  });
});

// ─── 状态更新测试 ─────────────────────────────────────────

describe('MusicGenerationService - 状态更新（generation_tasks 表 status 字段）', () => {
  it('构建 Prompt 阶段更新状态为 building_prompt', async () => {
    const { service, mocks } = createService();

    await service.generate('user-1', 'pro', {
      userPrompt: 'A pop song',
      generationType: 'preview',
    });

    expect(mocks.taskUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'building_prompt',
      })
    );
  });

  it('生成阶段更新状态为 generating', async () => {
    const { service, mocks } = createService();

    await service.generate('user-1', 'pro', {
      userPrompt: 'A pop song',
      generationType: 'preview',
    });

    expect(mocks.taskUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'generating',
      })
    );
  });

  it('生成失败时更新状态为 failed', async () => {
    const { service, mocks } = createService({
      providerOverrides: { shouldThrow: true },
    });

    await service.generate('user-1', 'pro', {
      userPrompt: 'A song',
      generationType: 'preview',
    });

    expect(mocks.taskUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'failed',
        error_code: 'LYRIA_GENERATION_FAILED',
      })
    );
  });

  it('安全过滤器拦截时更新状态为 safety_blocked', async () => {
    const { service, mocks } = createService({
      providerOverrides: {
        previewResult: {
          success: false,
          modelId: 'lyria-3-clip-preview',
          hasSynthIdWatermark: true,
        },
      },
    });

    await service.generate('user-1', 'pro', {
      userPrompt: 'Bad content',
      generationType: 'preview',
    });

    expect(mocks.taskUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'safety_blocked',
        error_code: 'SAFETY_FILTER_BLOCKED',
      })
    );
  });

  it('权限不足时更新状态为 failed', async () => {
    const { service, mocks } = createService();

    await service.generate('user-free', 'free', {
      userPrompt: 'A song',
      generationType: 'full_demo',
    });

    expect(mocks.taskUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'failed',
        error_code: 'INVALID_PROMPT',
      })
    );
  });

  it('状态更新数据库错误时抛出 AppError', async () => {
    const { service, mocks } = createService();
    // 第一次 update (building_prompt) 失败
    mocks.taskUpdateEq.mockResolvedValueOnce({
      data: null,
      error: { code: '42501', message: 'Permission denied' },
    });

    await expect(
      service.generate('user-1', 'pro', {
        userPrompt: 'A song',
        generationType: 'preview',
      })
    ).rejects.toMatchObject({
      code: '42501',
      table: 'generation_tasks',
      operation: 'update',
    });
  });
});

// ─── 生成完成测试 ─────────────────────────────────────────

describe('MusicGenerationService - 生成完成（generation_tasks 表结果字段更新）', () => {
  it('生成成功后更新 status 为 completed 和结果字段', async () => {
    const { service, mocks } = createService();

    const result = await service.generate('user-1', 'pro', {
      userPrompt: 'A pop song',
      generationType: 'preview',
    });

    expect(result.success).toBe(true);
    expect(mocks.taskUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'completed',
        lyrics: 'Test lyrics',
        credits_consumed: 1,
      })
    );
  });

  it('生成成功后更新 song_structure 字段', async () => {
    const { service, mocks } = createService({
      providerOverrides: {
        previewResult: {
          success: true,
          audioData: Buffer.from('audio'),
          audioMimeType: 'audio/mpeg',
          lyrics: 'Lyrics here',
          songStructureDescription: '{"sections":[]}',
          modelId: 'lyria-3-clip-preview',
          hasSynthIdWatermark: true,
        },
      },
    });

    await service.generate('user-1', 'pro', {
      userPrompt: 'A song',
      generationType: 'preview',
    });

    expect(mocks.taskUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'completed',
        song_structure: '{"sections":[]}',
      })
    );
  });

  it('Free 用户 preview 成功消耗 1 次 Preview 次数', async () => {
    const { service, creditService } = createService();

    const result = await service.generate('user-free', 'free', {
      userPrompt: 'A song',
      generationType: 'preview',
    });

    expect(result.success).toBe(true);
    expect(creditService.consumePreview).toHaveBeenCalledWith('user-free');
  });

  it('付费用户生成成功后扣减 Credits', async () => {
    const { service, creditService } = createService({
      creditServiceOverrides: {
        consumeCreditsResult: { success: true, consumed: 10, remaining: 90 },
      },
    });

    const result = await service.generate('user-pro', 'pro', {
      userPrompt: 'A rock song',
      generationType: 'full_demo',
    });

    expect(result.success).toBe(true);
    expect(result.creditsConsumed).toBe(10);
    expect(creditService.consumeCredits).toHaveBeenCalledWith('user-pro', ['full_demo_long']);
  });

  it('Full Demo + Premium Singer 消耗额外 Credits', async () => {
    const { service, creditService } = createService({
      creditServiceOverrides: {
        consumeCreditsResult: { success: true, consumed: 15, remaining: 85 },
      },
    });

    const result = await service.generate('user-pro', 'pro', {
      userPrompt: 'A song with premium voice',
      generationType: 'full_demo',
      usePremiumSinger: true,
    });

    expect(result.success).toBe(true);
    expect(result.creditsConsumed).toBe(15);
    expect(creditService.consumeCredits).toHaveBeenCalledWith(
      'user-pro',
      ['full_demo_long', 'premium_singer']
    );
  });

  it('生成失败不扣减 Credits', async () => {
    const { service, creditService } = createService({
      providerOverrides: { shouldThrow: true },
    });

    const result = await service.generate('user-pro', 'pro', {
      userPrompt: 'A song',
      generationType: 'preview',
    });

    expect(result.success).toBe(false);
    expect(result.creditsConsumed).toBe(0);
    expect(creditService.consumeCredits).not.toHaveBeenCalled();
    expect(creditService.consumePreview).not.toHaveBeenCalled();
  });
});

// ─── getTaskStatus 测试 ───────────────────────────────────

describe('MusicGenerationService.getTaskStatus', () => {
  it('从 generation_tasks 表查询任务状态', async () => {
    const { service, mocks } = createService();
    mocks.taskSingle.mockResolvedValue({ data: { status: 'generating' }, error: null });

    const status = await service.getTaskStatus('task-123');
    expect(status).toBe('generating');
    expect(mocks.taskSelect).toHaveBeenCalledWith('status');
  });

  it('数据库错误时抛出 AppError', async () => {
    const { service, mocks } = createService();
    mocks.taskSingle.mockResolvedValue({
      data: null,
      error: { code: 'PGRST116', message: 'Row not found' },
    });

    await expect(service.getTaskStatus('non-existent')).rejects.toMatchObject({
      code: 'PGRST116',
      table: 'generation_tasks',
      operation: 'select',
    });
  });
});

// ─── buildPrompt 测试 ─────────────────────────────────────

describe('MusicGenerationService.buildPrompt', () => {
  it('仅模板：使用缓存的 lyriaPrompt', async () => {
    const { service } = createService({
      templateAdminOverrides: {
        cachedAnalysis: {
          templateId: 'tpl-1',
          analysisResult: '分析结果',
          lyriaPrompt: 'A pop track at 120 BPM in C major',
          analyzedAt: new Date(),
          status: 'completed',
        },
      },
    });

    const prompt = await service.buildPrompt({
      templateId: 'tpl-1',
      generationType: 'preview',
    });

    expect(prompt).toContain('A pop track at 120 BPM in C major');
    expect(prompt).toContain('Include vocals with lyrics');
    expect(prompt).toContain('Generate lyrics in Chinese');
  });

  it('仅用户 Prompt：直接使用 userPrompt', async () => {
    const { service } = createService();

    const prompt = await service.buildPrompt({
      userPrompt: 'A chill lofi beat',
      generationType: 'preview',
    });

    expect(prompt).toContain('A chill lofi beat');
    expect(prompt).toContain('Include vocals with lyrics');
    expect(prompt).toContain('Generate lyrics in Chinese');
  });

  it('模板 + 用户 Prompt：合并为 reference style + additional instructions', async () => {
    const { service } = createService({
      templateAdminOverrides: {
        cachedAnalysis: {
          templateId: 'tpl-2',
          analysisResult: '分析结果',
          lyriaPrompt: 'A pop track at 120 BPM in C major',
          analyzedAt: new Date(),
          status: 'completed',
        },
      },
    });

    const prompt = await service.buildPrompt({
      templateId: 'tpl-2',
      userPrompt: 'Make it more energetic',
      generationType: 'preview',
    });

    expect(prompt).toContain(
      'Based on this reference style: A pop track at 120 BPM in C major\n\nUser\'s additional instructions: Make it more energetic'
    );
    expect(prompt).toContain('Include vocals with lyrics');
    expect(prompt).toContain('Generate lyrics in Chinese');
  });

  it('缓存缺失时降级为默认描述', async () => {
    const { service } = createService({
      templateAdminOverrides: { cachedAnalysis: null },
    });

    const prompt = await service.buildPrompt({
      templateId: 'non-existent-template',
      generationType: 'preview',
    });

    expect(prompt).toContain(DEFAULT_TEMPLATE_DESCRIPTION);
    expect(prompt).toContain('Include vocals with lyrics');
    expect(prompt).toContain('Generate lyrics in Chinese');
  });

  it('缓存状态非 completed 时降级为默认描述', async () => {
    const { service } = createService({
      templateAdminOverrides: {
        cachedAnalysis: {
          templateId: 'tpl-fail',
          analysisResult: '',
          lyriaPrompt: '',
          analyzedAt: new Date(),
          status: 'failed',
        },
      },
    });

    const prompt = await service.buildPrompt({
      templateId: 'tpl-fail',
      generationType: 'preview',
    });

    expect(prompt).toContain(DEFAULT_TEMPLATE_DESCRIPTION);
    expect(prompt).toContain('Include vocals with lyrics');
    expect(prompt).toContain('Generate lyrics in Chinese');
  });
});

// ─── generate 权限校验测试 ────────────────────────────────

describe('MusicGenerationService.generate - 权限校验', () => {
  it('Free 用户不能生成 full_demo', async () => {
    const { service } = createService();

    const result = await service.generate('user-free', 'free', {
      userPrompt: 'A song',
      generationType: 'full_demo',
    });

    expect(result.success).toBe(false);
    expect(result.creditsConsumed).toBe(0);
    expect(result.error?.message).toContain('升级到专业版');
  });

  it('Free 用户可以 preview', async () => {
    const { service } = createService();

    const result = await service.generate('user-free', 'free', {
      userPrompt: 'A song',
      generationType: 'preview',
    });

    expect(result.success).toBe(true);
  });

  it('Pro 用户可以 full_demo', async () => {
    const { service } = createService();

    const result = await service.generate('user-pro', 'pro', {
      userPrompt: 'A rock song',
      generationType: 'full_demo',
    });

    expect(result.success).toBe(true);
    expect(result.modelId).toBe('lyria-3-pro-preview');
  });

  it('Business 用户可以 full_demo', async () => {
    const { service } = createService();

    const result = await service.generate('user-biz', 'business', {
      userPrompt: 'A jazz song',
      generationType: 'full_demo',
    });

    expect(result.success).toBe(true);
  });
});

// ─── generate 图片输入验证测试 ────────────────────────────

describe('MusicGenerationService.generate - 图片输入验证', () => {
  it('Free 用户不能使用图片输入', async () => {
    const { service } = createService();

    const result = await service.generate('user-free', 'free', {
      userPrompt: 'A song',
      generationType: 'preview',
      images: [{ data: 'base64data', mimeType: 'image/jpeg' }],
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('IMAGE_NOT_ALLOWED');
  });

  it('Pro 用户可以使用图片输入（≤10 张）', async () => {
    const { service } = createService();

    const result = await service.generate('user-pro', 'pro', {
      userPrompt: 'Inspired by this image',
      generationType: 'preview',
      images: [{ data: 'base64data', mimeType: 'image/jpeg' }],
    });

    expect(result.success).toBe(true);
  });

  it('图片超过 10 张被拒绝', async () => {
    const { service } = createService();

    const images = Array.from({ length: 11 }, () => ({
      data: 'base64data',
      mimeType: 'image/jpeg' as const,
    }));

    const result = await service.generate('user-pro', 'pro', {
      userPrompt: 'A song',
      generationType: 'preview',
      images,
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('IMAGE_LIMIT_EXCEEDED');
  });
});

// ─── generate Credits 校验测试 ────────────────────────────

describe('MusicGenerationService.generate - Credits 校验', () => {
  it('Free 用户 Preview 次数用完后被拒绝', async () => {
    const { service } = createService({
      creditServiceOverrides: { previewRemaining: 0 },
    });

    const result = await service.generate('user-free', 'free', {
      userPrompt: 'A song',
      generationType: 'preview',
    });

    expect(result.success).toBe(false);
    expect(result.creditsConsumed).toBe(0);
  });

  it('付费用户 Credits 不足时被拒绝', async () => {
    const { service } = createService({
      creditServiceOverrides: { hasEnough: false },
    });

    const result = await service.generate('user-pro', 'pro', {
      userPrompt: 'A song',
      generationType: 'full_demo',
    });

    expect(result.success).toBe(false);
    expect(result.creditsConsumed).toBe(0);
  });
});

// ─── getProvider 测试 ─────────────────────────────────────

describe('MusicGenerationService.getProvider', () => {
  it('返回注入的 AIModelProvider', () => {
    const { service } = createService();
    const provider = service.getProvider();
    expect(provider.providerName).toBe('mock-lyria');
  });
});
