import { describe, expect, it } from 'vitest';
import { resolveStemExportStatus } from './stemExportStatus';

describe('resolveStemExportStatus', () => {
  it('shows an idle state before exporting', () => {
    expect(resolveStemExportStatus({ phase: 'idle' })).toMatchObject({
      tone: 'muted',
      label: '待导出',
      detail: '调整好混音后可以导出 WAV。',
      progress: 0,
    });
  });

  it('describes cache waiting progress', () => {
    expect(resolveStemExportStatus({
      phase: 'waiting-cache',
      loadedCount: 3,
      totalCount: 12,
    })).toMatchObject({
      tone: 'warning',
      label: '等待缓存',
      detail: '已加载 3/12 条分轨，缓存完成后会自动继续导出。',
      progress: 25,
    });
  });

  it('marks successful export as complete', () => {
    expect(resolveStemExportStatus({
      phase: 'done',
      exportedCount: 7,
      fileType: 'WAV',
    })).toMatchObject({
      tone: 'success',
      label: '导出完成',
      detail: '已生成 WAV 文件，共导出 7 条轨道。',
      progress: 100,
    });
  });
});
