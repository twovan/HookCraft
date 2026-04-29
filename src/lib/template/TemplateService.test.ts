// TemplateService 单元测试（Supabase 版）
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TemplateService } from './TemplateService';
import type { Template } from '../../types/template';

/**
 * 创建 mock Supabase 客户端
 * 模拟 .from().select() 和 .from().select().eq().single() 链式调用
 */
function createMockSupabase() {
  const mockSingle = vi.fn();
  const mockEq = vi.fn();
  const mockSelect = vi.fn();

  // select chain: from('templates').select('*') → 返回 { data, error }
  // select + eq + single chain: from('templates').select('*').eq('id', x).single()
  mockSingle.mockResolvedValue({ data: null, error: null });
  mockEq.mockReturnValue({ single: mockSingle });
  mockSelect.mockResolvedValue({ data: [], error: null });

  // 让 select 同时支持直接 resolve（getTemplates）和链式调用（getTemplateById）
  const selectFn = vi.fn().mockImplementation(() => {
    const result = Promise.resolve({ data: [], error: null }) as any;
    result.eq = mockEq;
    return result;
  });

  const mockFrom = vi.fn().mockReturnValue({
    select: selectFn,
  });

  const supabase = {
    from: mockFrom,
  } as any;

  return {
    supabase,
    mockFrom,
    mockSelect: selectFn,
    mockEq,
    mockSingle,
  };
}

/** 创建模拟的 templates 行数据 */
function createTemplateRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'tpl-1',
    name: 'Test Template',
    description: 'A test template',
    category: 'free_template',
    genre: 'pop',
    preview_url: null,
    cover_url: null,
    reference_audio_url: null,
    analysis_result: null,
    lyria_prompt: null,
    analyzed_at: null,
    analysis_status: 'pending',
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('TemplateService', () => {
  let service: TemplateService;
  let mocks: ReturnType<typeof createMockSupabase>;

  beforeEach(() => {
    mocks = createMockSupabase();
    service = new TemplateService(mocks.supabase);
  });

  // ─── getTemplates ──────────────────────────────────────

  describe('getTemplates', () => {
    it('查询 templates 表并返回所有模板', async () => {
      const rows = [
        createTemplateRow({ id: 'tpl-1', name: 'Template 1', category: 'free_template' }),
        createTemplateRow({ id: 'tpl-2', name: 'Template 2', category: 'paid_template' }),
      ];

      // 让 select 返回数据列表
      mocks.mockSelect.mockImplementation(() => {
        const result = Promise.resolve({ data: rows, error: null }) as any;
        result.eq = mocks.mockEq;
        return result;
      });

      const templates = await service.getTemplates();
      expect(templates).toHaveLength(2);
      expect(templates[0].id).toBe('tpl-1');
      expect(templates[0].name).toBe('Template 1');
      expect(templates[0].category).toBe('free_template');
      expect(templates[1].id).toBe('tpl-2');
      expect(templates[1].category).toBe('paid_template');
    });

    it('空表时返回空数组', async () => {
      mocks.mockSelect.mockImplementation(() => {
        const result = Promise.resolve({ data: [], error: null }) as any;
        result.eq = mocks.mockEq;
        return result;
      });

      const templates = await service.getTemplates();
      expect(templates).toHaveLength(0);
    });

    it('数据库错误时抛出 AppError', async () => {
      mocks.mockSelect.mockImplementation(() => {
        const result = Promise.resolve({
          data: null,
          error: { code: 'PGRST301', message: 'Timeout' },
        }) as any;
        result.eq = mocks.mockEq;
        return result;
      });

      await expect(service.getTemplates()).rejects.toMatchObject({
        code: 'PGRST301',
        table: 'templates',
        operation: 'select',
      });
    });

    it('正确转换可选字段', async () => {
      const rows = [
        createTemplateRow({
          id: 'tpl-full',
          preview_url: '/audio/preview.mp3',
          cover_url: '/images/cover.jpg',
          reference_audio_url: '/audio/ref.mp3',
          analysis_result: 'Some analysis',
          lyria_prompt: 'A prompt',
          analyzed_at: '2025-01-15T10:00:00Z',
          analysis_status: 'completed',
        }),
      ];

      mocks.mockSelect.mockImplementation(() => {
        const result = Promise.resolve({ data: rows, error: null }) as any;
        result.eq = mocks.mockEq;
        return result;
      });

      const templates = await service.getTemplates();
      expect(templates[0].previewUrl).toBe('/audio/preview.mp3');
      expect(templates[0].coverUrl).toBe('/images/cover.jpg');
      expect(templates[0].referenceAudioUrl).toBe('/audio/ref.mp3');
      expect(templates[0].analysisResult).toBe('Some analysis');
      expect(templates[0].lyriaPrompt).toBe('A prompt');
      expect(templates[0].analyzedAt).toBeInstanceOf(Date);
      expect(templates[0].analysisStatus).toBe('completed');
    });
  });

  // ─── getTemplateById ───────────────────────────────────

  describe('getTemplateById', () => {
    it('根据 ID 返回正确的模板', async () => {
      const row = createTemplateRow({
        id: 'tpl-1',
        name: 'Free Pop',
        category: 'free_template',
        genre: 'pop',
      });
      mocks.mockSingle.mockResolvedValue({ data: row, error: null });

      const template = await service.getTemplateById('tpl-1');
      expect(template).toBeDefined();
      expect(template!.id).toBe('tpl-1');
      expect(template!.name).toBe('Free Pop');
      expect(template!.category).toBe('free_template');
      expect(template!.genre).toBe('pop');
    });

    it('ID 不存在时返回 undefined', async () => {
      mocks.mockSingle.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' },
      });

      const template = await service.getTemplateById('nonexistent');
      expect(template).toBeUndefined();
    });

    it('其他数据库错误时抛出 AppError', async () => {
      mocks.mockSingle.mockResolvedValue({
        data: null,
        error: { code: '42501', message: 'Permission denied' },
      });

      await expect(service.getTemplateById('tpl-1')).rejects.toMatchObject({
        code: '42501',
        table: 'templates',
        operation: 'select',
      });
    });

    it('正确转换 null 字段为 undefined', async () => {
      const row = createTemplateRow({
        id: 'tpl-minimal',
        preview_url: null,
        cover_url: null,
        reference_audio_url: null,
        analysis_result: null,
        lyria_prompt: null,
        analyzed_at: null,
      });
      mocks.mockSingle.mockResolvedValue({ data: row, error: null });

      const template = await service.getTemplateById('tpl-minimal');
      expect(template).toBeDefined();
      expect(template!.previewUrl).toBeUndefined();
      expect(template!.coverUrl).toBeUndefined();
      expect(template!.referenceAudioUrl).toBeUndefined();
      expect(template!.analysisResult).toBeUndefined();
      expect(template!.lyriaPrompt).toBeUndefined();
      expect(template!.analyzedAt).toBeUndefined();
    });
  });

  // ─── getTemplatesByCategory ────────────────────────────

  describe('getTemplatesByCategory', () => {
    it('按分类过滤模板', async () => {
      const rows = [
        createTemplateRow({ id: 'tpl-free-1', category: 'free_template' }),
        createTemplateRow({ id: 'tpl-free-2', category: 'free_template' }),
      ];

      // getTemplatesByCategory 使用 select().eq() 链式调用
      // eq 返回的对象直接 resolve 为 { data, error }
      mocks.mockEq.mockResolvedValue({ data: rows, error: null });

      const templates = await service.getTemplatesByCategory('free_template');
      expect(templates).toHaveLength(2);
      templates.forEach((t) => {
        expect(t.category).toBe('free_template');
      });
    });

    it('数据库错误时抛出 AppError', async () => {
      mocks.mockEq.mockResolvedValue({
        data: null,
        error: { code: 'PGRST301', message: 'Timeout' },
      });

      await expect(service.getTemplatesByCategory('paid_template')).rejects.toMatchObject({
        code: 'PGRST301',
        table: 'templates',
        operation: 'select',
      });
    });
  });

  // ─── isTemplateAccessible ──────────────────────────────

  describe('isTemplateAccessible', () => {
    it('Free 用户可以访问 free_template', async () => {
      const row = createTemplateRow({ id: 'tpl-free', category: 'free_template' });
      mocks.mockSingle.mockResolvedValue({ data: row, error: null });

      expect(await service.isTemplateAccessible('free', 'tpl-free')).toBe(true);
    });

    it('Free 用户不能访问 paid_template', async () => {
      const row = createTemplateRow({ id: 'tpl-paid', category: 'paid_template' });
      mocks.mockSingle.mockResolvedValue({ data: row, error: null });

      expect(await service.isTemplateAccessible('free', 'tpl-paid')).toBe(false);
    });

    it('Pro 用户可以访问 paid_template', async () => {
      const row = createTemplateRow({ id: 'tpl-paid', category: 'paid_template' });
      mocks.mockSingle.mockResolvedValue({ data: row, error: null });

      expect(await service.isTemplateAccessible('pro', 'tpl-paid')).toBe(true);
    });

    it('Business 用户可以访问所有模板', async () => {
      const row = createTemplateRow({ id: 'tpl-paid', category: 'paid_template' });
      mocks.mockSingle.mockResolvedValue({ data: row, error: null });

      expect(await service.isTemplateAccessible('business', 'tpl-paid')).toBe(true);
    });

    it('模板不存在时返回 false', async () => {
      mocks.mockSingle.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'Row not found' },
      });

      expect(await service.isTemplateAccessible('pro', 'nonexistent')).toBe(false);
    });
  });
});
