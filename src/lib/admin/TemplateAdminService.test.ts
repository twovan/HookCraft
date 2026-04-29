// TemplateAdminService 单元测试（Supabase 版）
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  TemplateAdminService,
  type GeminiAnalyzeFn,
  parseAnalysisResponse,
} from './TemplateAdminService';

/** 模拟 Gemini 返回的完整分析文本 */
const MOCK_GEMINI_RESPONSE = `🎵 流派与子流派：流行电子（Synth-Pop）
⏱️ BPM：120
🎹 调性与音阶：C 大调
🎸 主要使用的乐器：合成器、电子鼓、贝斯
🌙 情绪与氛围：欢快、充满活力
📐 歌曲结构：前奏 → 主歌 → 副歌 → 间奏 → 副歌 → 尾奏
🔧 制作技巧：侧链压缩、混响空间感
⚡ 整体能量水平：中高

[PROMPT] A synth-pop track at 120 BPM in C major, featuring synthesizers, electronic drums, and bass, with an upbeat and energetic atmosphere. Intro, verse, chorus, bridge, chorus, outro structure. Instrumental only. [/PROMPT]`;

const MOCK_LYRIA_PROMPT =
  'A synth-pop track at 120 BPM in C major, featuring synthesizers, electronic drums, and bass, with an upbeat and energetic atmosphere. Intro, verse, chorus, bridge, chorus, outro structure. Instrumental only.';

/**
 * 创建 mock Supabase 客户端
 * 模拟 .from('templates').update().eq() 和 .from('templates').select().eq().single() 链式调用
 */
function createMockSupabase() {
  const mockSingle = vi.fn();
  const mockUpdateEq = vi.fn();
  const mockSelectEq = vi.fn();
  const mockUpdate = vi.fn();
  const mockSelect = vi.fn();

  // 默认：update 成功
  mockUpdateEq.mockResolvedValue({ data: null, error: null });
  mockUpdate.mockReturnValue({ eq: mockUpdateEq });

  // 默认：select + eq + single 返回 null（未找到）
  mockSingle.mockResolvedValue({ data: null, error: { code: 'PGRST116', message: 'Row not found' } });
  mockSelectEq.mockReturnValue({ single: mockSingle });
  mockSelect.mockReturnValue({ eq: mockSelectEq });

  const mockFrom = vi.fn().mockReturnValue({
    update: mockUpdate,
    select: mockSelect,
  });

  const supabase = {
    from: mockFrom,
  } as any;

  return {
    supabase,
    mockFrom,
    mockUpdate,
    mockUpdateEq,
    mockSelect,
    mockSelectEq,
    mockSingle,
  };
}

describe('TemplateAdminService', () => {
  let service: TemplateAdminService;
  let mockGemini: GeminiAnalyzeFn;
  let mocks: ReturnType<typeof createMockSupabase>;

  beforeEach(() => {
    mocks = createMockSupabase();
    mockGemini = vi.fn().mockResolvedValue(MOCK_GEMINI_RESPONSE);
    service = new TemplateAdminService(mocks.supabase, mockGemini);
  });

  // ─── analyzeTemplate ──────────────────────────────────

  describe('analyzeTemplate', () => {
    it('调用 Gemini 并正确更新 templates 表的分析字段', async () => {
      const result = await service.analyzeTemplate(
        'tpl-1',
        'base64audio',
        'audio/mp3',
      );

      // 返回值包含正确的 lyriaPrompt 和 analysisDisplay
      expect(result.lyriaPrompt).toBe(MOCK_LYRIA_PROMPT);
      expect(result.analysisDisplay).toContain('流行电子');
      expect(result.analysisDisplay).not.toContain('[PROMPT]');
      expect(result.analyzedAt).toBeInstanceOf(Date);

      // Gemini 被正确调用
      expect(mockGemini).toHaveBeenCalledOnce();
      expect(mockGemini).toHaveBeenCalledWith(
        'base64audio',
        'audio/mp3',
        expect.any(String),
      );

      // 验证 update 被调用了两次：一次设置 analyzing 状态，一次写入结果
      expect(mocks.mockUpdate).toHaveBeenCalledTimes(2);

      // 第一次调用：设置 analyzing 状态
      expect(mocks.mockUpdate).toHaveBeenNthCalledWith(1, expect.objectContaining({
        analysis_status: 'analyzing',
      }));

      // 第二次调用：写入分析结果
      expect(mocks.mockUpdate).toHaveBeenNthCalledWith(2, expect.objectContaining({
        analysis_result: expect.stringContaining('流行电子'),
        lyria_prompt: MOCK_LYRIA_PROMPT,
        analysis_status: 'completed',
      }));
    });

    it('Gemini 分析失败时更新 failed 状态并抛出错误', async () => {
      const failingGemini = vi
        .fn()
        .mockRejectedValue(new Error('API quota exceeded'));
      const failService = new TemplateAdminService(mocks.supabase, failingGemini);

      await expect(
        failService.analyzeTemplate('tpl-fail', 'audio', 'audio/mp3'),
      ).rejects.toThrow('API quota exceeded');

      // 验证 update 被调用了两次：一次设置 analyzing，一次设置 failed
      expect(mocks.mockUpdate).toHaveBeenCalledTimes(2);
      expect(mocks.mockUpdate).toHaveBeenNthCalledWith(2, expect.objectContaining({
        analysis_status: 'failed',
      }));
    });

    it('更新 analyzing 状态失败时抛出 AppError', async () => {
      mocks.mockUpdateEq.mockResolvedValueOnce({
        data: null,
        error: { code: '42501', message: 'Permission denied' },
      });

      await expect(
        service.analyzeTemplate('tpl-1', 'audio', 'audio/mp3'),
      ).rejects.toMatchObject({
        code: '42501',
        table: 'templates',
        operation: 'update',
      });
    });

    it('更新分析结果失败时抛出 AppError', async () => {
      // 第一次 update（analyzing）成功，第二次 update（结果）失败
      mocks.mockUpdateEq
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({
          data: null,
          error: { code: 'PGRST301', message: 'Timeout' },
        });

      await expect(
        service.analyzeTemplate('tpl-1', 'audio', 'audio/mp3'),
      ).rejects.toMatchObject({
        code: 'PGRST301',
        table: 'templates',
        operation: 'update',
      });
    });
  });

  // ─── getCachedAnalysis ─────────────────────────────────

  describe('getCachedAnalysis', () => {
    it('返回已分析的模板数据', async () => {
      mocks.mockSingle.mockResolvedValue({
        data: {
          id: 'tpl-1',
          analysis_result: '流行电子分析结果',
          lyria_prompt: MOCK_LYRIA_PROMPT,
          analyzed_at: '2025-01-15T10:00:00Z',
          analysis_status: 'completed',
        },
        error: null,
      });

      const cached = await service.getCachedAnalysis('tpl-1');

      expect(cached).not.toBeNull();
      expect(cached!.templateId).toBe('tpl-1');
      expect(cached!.analysisResult).toBe('流行电子分析结果');
      expect(cached!.lyriaPrompt).toBe(MOCK_LYRIA_PROMPT);
      expect(cached!.analyzedAt).toBeInstanceOf(Date);
      expect(cached!.status).toBe('completed');
    });

    it('模板不存在时返回 null', async () => {
      mocks.mockSingle.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'Row not found' },
      });

      const cached = await service.getCachedAnalysis('nonexistent');
      expect(cached).toBeNull();
    });

    it('模板存在但未分析（pending 状态且无结果）时返回 null', async () => {
      mocks.mockSingle.mockResolvedValue({
        data: {
          id: 'tpl-new',
          analysis_result: null,
          lyria_prompt: null,
          analyzed_at: null,
          analysis_status: 'pending',
        },
        error: null,
      });

      const cached = await service.getCachedAnalysis('tpl-new');
      expect(cached).toBeNull();
    });

    it('分析失败的模板返回 failed 状态', async () => {
      mocks.mockSingle.mockResolvedValue({
        data: {
          id: 'tpl-failed',
          analysis_result: null,
          lyria_prompt: null,
          analyzed_at: '2025-01-15T10:00:00Z',
          analysis_status: 'failed',
        },
        error: null,
      });

      const cached = await service.getCachedAnalysis('tpl-failed');
      expect(cached).not.toBeNull();
      expect(cached!.status).toBe('failed');
      expect(cached!.analysisResult).toBe('');
      expect(cached!.lyriaPrompt).toBe('');
    });

    it('数据库错误时抛出 AppError', async () => {
      mocks.mockSingle.mockResolvedValue({
        data: null,
        error: { code: '42501', message: 'Permission denied' },
      });

      await expect(service.getCachedAnalysis('tpl-1')).rejects.toMatchObject({
        code: '42501',
        table: 'templates',
        operation: 'select',
      });
    });
  });

  // ─── updateAnalysisManually ────────────────────────────

  describe('updateAnalysisManually', () => {
    it('手动更新 templates 表的分析字段', async () => {
      await service.updateAnalysisManually('tpl-manual', {
        lyriaPrompt: 'A jazz track at 90 BPM in Bb minor',
        analysisResult: '手动填写的爵士分析',
      });

      expect(mocks.mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
        analysis_result: '手动填写的爵士分析',
        lyria_prompt: 'A jazz track at 90 BPM in Bb minor',
        analysis_status: 'completed',
      }));
      expect(mocks.mockUpdateEq).toHaveBeenCalledWith('id', 'tpl-manual');
    });

    it('仅提供 lyriaPrompt 时 analysisResult 默认为空字符串', async () => {
      await service.updateAnalysisManually('tpl-min', {
        lyriaPrompt: 'A rock track',
      });

      expect(mocks.mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
        analysis_result: '',
        lyria_prompt: 'A rock track',
      }));
    });

    it('数据库更新失败时抛出 AppError', async () => {
      mocks.mockUpdateEq.mockResolvedValue({
        data: null,
        error: { code: '23503', message: 'Foreign key violation' },
      });

      await expect(
        service.updateAnalysisManually('tpl-bad', { lyriaPrompt: 'test' }),
      ).rejects.toMatchObject({
        code: '23503',
        table: 'templates',
        operation: 'update',
      });
    });
  });

  // ─── reAnalyzeTemplate ─────────────────────────────────

  describe('reAnalyzeTemplate', () => {
    it('使用已存储的音频重新分析并更新数据库', async () => {
      // 第一次分析
      await service.analyzeTemplate('tpl-1', 'base64audio', 'audio/wav');
      expect(mockGemini).toHaveBeenCalledTimes(1);

      // 修改 mock 返回不同结果
      const updatedResponse = MOCK_GEMINI_RESPONSE.replace(
        '120 BPM',
        '130 BPM',
      );
      (mockGemini as ReturnType<typeof vi.fn>).mockResolvedValue(
        updatedResponse,
      );

      // 重新分析
      const result = await service.reAnalyzeTemplate('tpl-1');
      expect(mockGemini).toHaveBeenCalledTimes(2);
      expect(result.lyriaPrompt).toContain('130 BPM');
    });

    it('音频数据不存在时抛出错误', async () => {
      await expect(
        service.reAnalyzeTemplate('nonexistent'),
      ).rejects.toThrow('音频数据不存在');
    });
  });

  // ─── parseAnalysisResponse ─────────────────────────────

  describe('parseAnalysisResponse', () => {
    it('正确提取 [PROMPT] 标签中的内容', () => {
      const result = parseAnalysisResponse(MOCK_GEMINI_RESPONSE);
      expect(result.lyriaPrompt).toBe(MOCK_LYRIA_PROMPT);
      expect(result.analysisDisplay).not.toContain('[PROMPT]');
      expect(result.analysisDisplay).not.toContain('[/PROMPT]');
    });

    it('无 [PROMPT] 标签时整段文本作为两者', () => {
      const plain = '这是一段没有标签的分析文本';
      const result = parseAnalysisResponse(plain);
      expect(result.lyriaPrompt).toBe(plain);
      expect(result.analysisDisplay).toBe(plain);
    });
  });
});
