// DowngradeService 单元测试（Supabase 版）
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DowngradeService } from './DowngradeService';

/**
 * 创建 mock Supabase 客户端
 * 模拟 downgraded_file_access 表的链式调用
 */
function createMockSupabase() {
  // select chain: .select('*').eq('file_id', ...).single()
  const selectSingle = vi.fn().mockResolvedValue({ data: null, error: null });
  const selectEqFileId = vi.fn().mockReturnValue({ single: selectSingle });
  const selectEqUserId = vi.fn().mockReturnValue({ in: vi.fn() });

  // select chain for markFilesForUpgrade: .select('*').eq('user_id', ...).in('file_id', [...])
  const selectIn = vi.fn().mockResolvedValue({ data: [], error: null });
  const selectEqForBatch = vi.fn().mockReturnValue({ in: selectIn });

  // update chain: .update({}).eq('user_id', ...).in('file_id', [...])
  const updateIn = vi.fn().mockResolvedValue({ data: null, error: null });
  const updateEq = vi.fn().mockReturnValue({ in: updateIn });
  const update = vi.fn().mockReturnValue({ eq: updateEq });

  const select = vi.fn().mockReturnValue({ eq: selectEqFileId });

  const mockFrom = vi.fn().mockReturnValue({
    select,
    update,
  });

  const supabase = { from: mockFrom } as any;

  return {
    supabase,
    mockFrom,
    select,
    selectSingle,
    selectEqFileId,
    selectIn,
    selectEqForBatch,
    update,
    updateEq,
    updateIn,
  };
}

/** 创建模拟的 downgraded_file_access 行数据 */
function createFileAccessRow(overrides: Partial<any> = {}) {
  return {
    id: 'uuid-1',
    file_id: 'file-1',
    user_id: 'user-1',
    original_tier: 'pro' as const,
    export_format: { format: 'wav' },
    generated_at: '2024-01-01T00:00:00Z',
    grace_period_end: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
    access_status: 'accessible' as const,
    ...overrides,
  };
}

describe('DowngradeService', () => {
  let service: DowngradeService;
  let mocks: ReturnType<typeof createMockSupabase>;

  beforeEach(() => {
    mocks = createMockSupabase();
    service = new DowngradeService(mocks.supabase);
  });

  // ─── getFileAccessStatus ────────────────────────────────

  describe('getFileAccessStatus', () => {
    it('查询 downgraded_file_access 表并返回 DowngradedFileAccess', async () => {
      const row = createFileAccessRow();

      // Mock the chain: from('downgraded_file_access').select('*').eq('file_id', 'file-1').single()
      const singleFn = vi.fn().mockResolvedValue({ data: row, error: null });
      const eqFn = vi.fn().mockReturnValue({ single: singleFn });
      const selectFn = vi.fn().mockReturnValue({ eq: eqFn });
      mocks.mockFrom.mockReturnValue({ select: selectFn, update: mocks.update });

      const result = await service.getFileAccessStatus('file-1');

      expect(mocks.mockFrom).toHaveBeenCalledWith('downgraded_file_access');
      expect(result).not.toBeNull();
      expect(result!.fileId).toBe('file-1');
      expect(result!.userId).toBe('user-1');
      expect(result!.originalTier).toBe('pro');
      expect(result!.exportFormat).toEqual({ format: 'wav' });
      expect(result!.accessStatus).toBe('accessible');
    });

    it('正确转换 JSONB export_format 字段', async () => {
      const row = createFileAccessRow({
        export_format: { format: 'mp3', quality: '320kbps' },
      });

      const singleFn = vi.fn().mockResolvedValue({ data: row, error: null });
      const eqFn = vi.fn().mockReturnValue({ single: singleFn });
      const selectFn = vi.fn().mockReturnValue({ eq: eqFn });
      mocks.mockFrom.mockReturnValue({ select: selectFn, update: mocks.update });

      const result = await service.getFileAccessStatus('file-1');

      expect(result!.exportFormat).toEqual({ format: 'mp3', quality: '320kbps' });
    });

    it('正确转换 timestamptz 为 Date 对象', async () => {
      const row = createFileAccessRow({
        generated_at: '2024-06-15T10:30:00Z',
        grace_period_end: '2024-07-15T10:30:00Z',
      });

      const singleFn = vi.fn().mockResolvedValue({ data: row, error: null });
      const eqFn = vi.fn().mockReturnValue({ single: singleFn });
      const selectFn = vi.fn().mockReturnValue({ eq: eqFn });
      mocks.mockFrom.mockReturnValue({ select: selectFn, update: mocks.update });

      const result = await service.getFileAccessStatus('file-1');

      expect(result!.generatedAt).toBeInstanceOf(Date);
      expect(result!.generatedAt.toISOString()).toBe('2024-06-15T10:30:00.000Z');
      expect(result!.gracePeriodEnd).toBeInstanceOf(Date);
      expect(result!.gracePeriodEnd.toISOString()).toBe('2024-07-15T10:30:00.000Z');
    });

    it('文件不存在时返回 null（PGRST116）', async () => {
      const singleFn = vi.fn().mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'No rows found' },
      });
      const eqFn = vi.fn().mockReturnValue({ single: singleFn });
      const selectFn = vi.fn().mockReturnValue({ eq: eqFn });
      mocks.mockFrom.mockReturnValue({ select: selectFn, update: mocks.update });

      const result = await service.getFileAccessStatus('non-existent');

      expect(result).toBeNull();
    });

    it('数据库错误时抛出 AppError', async () => {
      const singleFn = vi.fn().mockResolvedValue({
        data: null,
        error: { code: 'PGRST301', message: 'Timeout' },
      });
      const eqFn = vi.fn().mockReturnValue({ single: singleFn });
      const selectFn = vi.fn().mockReturnValue({ eq: eqFn });
      mocks.mockFrom.mockReturnValue({ select: selectFn, update: mocks.update });

      await expect(service.getFileAccessStatus('file-1')).rejects.toMatchObject({
        code: 'PGRST301',
        table: 'downgraded_file_access',
        operation: 'select',
      });
    });
  });

  // ─── markFilesForUpgrade ────────────────────────────────

  describe('markFilesForUpgrade', () => {
    it('空文件列表返回空数组', async () => {
      const result = await service.markFilesForUpgrade('user-1', []);
      expect(result).toEqual([]);
    });

    it('WAV 文件标记为 upgrade_required', async () => {
      const rows = [
        createFileAccessRow({ file_id: 'f1', export_format: { format: 'wav' } }),
      ];

      // Mock select chain: .select('*').eq('user_id', ...).in('file_id', [...])
      const inFn = vi.fn().mockResolvedValue({ data: rows, error: null });
      const eqFn = vi.fn().mockReturnValue({ in: inFn });
      const selectFn = vi.fn().mockReturnValue({ eq: eqFn });

      // Mock update chain: .update({}).eq('user_id', ...).in('file_id', [...])
      const updateInFn = vi.fn().mockResolvedValue({ data: null, error: null });
      const updateEqFn = vi.fn().mockReturnValue({ in: updateInFn });
      const updateFn = vi.fn().mockReturnValue({ eq: updateEqFn });

      mocks.mockFrom.mockReturnValue({ select: selectFn, update: updateFn });

      const result = await service.markFilesForUpgrade('user-1', ['f1']);

      expect(result).toHaveLength(1);
      expect(result[0].accessStatus).toBe('upgrade_required');
    });

    it('MP3 128kbps 文件保持 accessible', async () => {
      const rows = [
        createFileAccessRow({ file_id: 'f2', export_format: { format: 'mp3', quality: '128kbps' } }),
      ];

      const inFn = vi.fn().mockResolvedValue({ data: rows, error: null });
      const eqFn = vi.fn().mockReturnValue({ in: inFn });
      const selectFn = vi.fn().mockReturnValue({ eq: eqFn });

      const updateInFn = vi.fn().mockResolvedValue({ data: null, error: null });
      const updateEqFn = vi.fn().mockReturnValue({ in: updateInFn });
      const updateFn = vi.fn().mockReturnValue({ eq: updateEqFn });

      mocks.mockFrom.mockReturnValue({ select: selectFn, update: updateFn });

      const result = await service.markFilesForUpgrade('user-1', ['f2']);

      expect(result).toHaveLength(1);
      expect(result[0].accessStatus).toBe('accessible');
    });

    it('混合格式文件正确标记', async () => {
      const rows = [
        createFileAccessRow({ file_id: 'f1', export_format: { format: 'mp3', quality: '128kbps' } }),
        createFileAccessRow({ file_id: 'f2', export_format: { format: 'wav' } }),
        createFileAccessRow({ file_id: 'f3', export_format: { format: 'midi' } }),
        createFileAccessRow({ file_id: 'f4', export_format: { format: 'stems' } }),
      ];

      const inFn = vi.fn().mockResolvedValue({ data: rows, error: null });
      const eqFn = vi.fn().mockReturnValue({ in: inFn });
      const selectFn = vi.fn().mockReturnValue({ eq: eqFn });

      const updateInFn = vi.fn().mockResolvedValue({ data: null, error: null });
      const updateEqFn = vi.fn().mockReturnValue({ in: updateInFn });
      const updateFn = vi.fn().mockReturnValue({ eq: updateEqFn });

      mocks.mockFrom.mockReturnValue({ select: selectFn, update: updateFn });

      const result = await service.markFilesForUpgrade('user-1', ['f1', 'f2', 'f3', 'f4']);

      expect(result[0].accessStatus).toBe('accessible');
      expect(result[1].accessStatus).toBe('upgrade_required');
      expect(result[2].accessStatus).toBe('upgrade_required');
      expect(result[3].accessStatus).toBe('upgrade_required');
    });

    it('批量更新调用 Supabase update 方法', async () => {
      const rows = [
        createFileAccessRow({ file_id: 'f1', export_format: { format: 'wav' } }),
        createFileAccessRow({ file_id: 'f2', export_format: { format: 'midi' } }),
      ];

      const inFn = vi.fn().mockResolvedValue({ data: rows, error: null });
      const eqFn = vi.fn().mockReturnValue({ in: inFn });
      const selectFn = vi.fn().mockReturnValue({ eq: eqFn });

      const updateInFn = vi.fn().mockResolvedValue({ data: null, error: null });
      const updateEqFn = vi.fn().mockReturnValue({ in: updateInFn });
      const updateFn = vi.fn().mockReturnValue({ eq: updateEqFn });

      mocks.mockFrom.mockReturnValue({ select: selectFn, update: updateFn });

      await service.markFilesForUpgrade('user-1', ['f1', 'f2']);

      // update should be called with access_status: 'upgrade_required'
      expect(updateFn).toHaveBeenCalledWith({ access_status: 'upgrade_required' });
    });

    it('查询数据库错误时抛出 AppError', async () => {
      const inFn = vi.fn().mockResolvedValue({
        data: null,
        error: { code: 'PGRST301', message: 'Timeout' },
      });
      const eqFn = vi.fn().mockReturnValue({ in: inFn });
      const selectFn = vi.fn().mockReturnValue({ eq: eqFn });

      const updateFn = vi.fn();
      mocks.mockFrom.mockReturnValue({ select: selectFn, update: updateFn });

      await expect(
        service.markFilesForUpgrade('user-1', ['f1'])
      ).rejects.toMatchObject({
        code: 'PGRST301',
        table: 'downgraded_file_access',
        operation: 'select',
      });
    });

    it('更新数据库错误时抛出 AppError', async () => {
      const rows = [
        createFileAccessRow({ file_id: 'f1', export_format: { format: 'wav' } }),
      ];

      const inFn = vi.fn().mockResolvedValue({ data: rows, error: null });
      const eqFn = vi.fn().mockReturnValue({ in: inFn });
      const selectFn = vi.fn().mockReturnValue({ eq: eqFn });

      const updateInFn = vi.fn().mockResolvedValue({
        data: null,
        error: { code: '42501', message: 'Permission denied' },
      });
      const updateEqFn = vi.fn().mockReturnValue({ in: updateInFn });
      const updateFn = vi.fn().mockReturnValue({ eq: updateEqFn });

      mocks.mockFrom.mockReturnValue({ select: selectFn, update: updateFn });

      await expect(
        service.markFilesForUpgrade('user-1', ['f1'])
      ).rejects.toMatchObject({
        code: '42501',
        table: 'downgraded_file_access',
        operation: 'update',
      });
    });
  });

  // ─── computeAccessStatus ────────────────────────────────

  describe('computeAccessStatus', () => {
    it('宽限期内文件返回 accessible', () => {
      const file = {
        fileId: 'file-1',
        userId: 'user-1',
        originalTier: 'pro' as const,
        exportFormat: { format: 'wav' as const },
        generatedAt: new Date('2024-01-01'),
        gracePeriodEnd: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
        accessStatus: 'accessible' as const,
      };
      expect(service.computeAccessStatus(file)).toBe('accessible');
    });

    it('宽限期过后 WAV 文件返回 upgrade_required', () => {
      const file = {
        fileId: 'file-1',
        userId: 'user-1',
        originalTier: 'pro' as const,
        exportFormat: { format: 'wav' as const },
        generatedAt: new Date('2024-01-01'),
        gracePeriodEnd: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        accessStatus: 'accessible' as const,
      };
      expect(service.computeAccessStatus(file)).toBe('upgrade_required');
    });

    it('宽限期过后 MP3 128kbps 文件仍返回 accessible（Free 等级支持）', () => {
      const file = {
        fileId: 'file-1',
        userId: 'user-1',
        originalTier: 'pro' as const,
        exportFormat: { format: 'mp3' as const, quality: '128kbps' },
        generatedAt: new Date('2024-01-01'),
        gracePeriodEnd: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        accessStatus: 'accessible' as const,
      };
      expect(service.computeAccessStatus(file)).toBe('accessible');
    });

    it('宽限期过后 MP3 320kbps 文件返回 upgrade_required', () => {
      const file = {
        fileId: 'file-1',
        userId: 'user-1',
        originalTier: 'pro' as const,
        exportFormat: { format: 'mp3' as const, quality: '320kbps' },
        generatedAt: new Date('2024-01-01'),
        gracePeriodEnd: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        accessStatus: 'accessible' as const,
      };
      expect(service.computeAccessStatus(file)).toBe('upgrade_required');
    });

    it('宽限期过后 MIDI 文件返回 upgrade_required', () => {
      const file = {
        fileId: 'file-1',
        userId: 'user-1',
        originalTier: 'business' as const,
        exportFormat: { format: 'midi' as const },
        generatedAt: new Date('2024-01-01'),
        gracePeriodEnd: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        accessStatus: 'accessible' as const,
      };
      expect(service.computeAccessStatus(file)).toBe('upgrade_required');
    });

    it('宽限期过后 stems 文件返回 upgrade_required', () => {
      const file = {
        fileId: 'file-1',
        userId: 'user-1',
        originalTier: 'business' as const,
        exportFormat: { format: 'stems' as const },
        generatedAt: new Date('2024-01-01'),
        gracePeriodEnd: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        accessStatus: 'accessible' as const,
      };
      expect(service.computeAccessStatus(file)).toBe('upgrade_required');
    });
  });

  // ─── isWithinGracePeriod ────────────────────────────────

  describe('isWithinGracePeriod', () => {
    it('未来日期返回 true', () => {
      const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      expect(service.isWithinGracePeriod(future)).toBe(true);
    });

    it('过去日期返回 false', () => {
      const past = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);
      expect(service.isWithinGracePeriod(past)).toBe(false);
    });

    it('当前时刻返回 true（边界）', () => {
      const now = new Date();
      expect(service.isWithinGracePeriod(now)).toBe(true);
    });
  });
});
