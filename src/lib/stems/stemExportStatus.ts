export type StemExportPhase = 'idle' | 'waiting-cache' | 'preparing' | 'rendering' | 'encoding' | 'downloading' | 'done' | 'error';
export type StemExportStatusTone = 'muted' | 'info' | 'warning' | 'success' | 'error';

export interface StemExportStatusInput {
  phase: StemExportPhase;
  loadedCount?: number;
  totalCount?: number;
  exportedCount?: number;
  fileType?: string;
  message?: string;
}

export interface StemExportStatusView {
  tone: StemExportStatusTone;
  label: string;
  detail: string;
  progress: number;
}

function progressPercent(loadedCount = 0, totalCount = 0) {
  if (totalCount <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((loadedCount / totalCount) * 100)));
}

export function resolveStemExportStatus(input: StemExportStatusInput): StemExportStatusView {
  if (input.phase === 'waiting-cache') {
    const loadedCount = input.loadedCount ?? 0;
    const totalCount = input.totalCount ?? 0;
    return {
      tone: 'warning',
      label: '等待缓存',
      detail: `已加载 ${loadedCount}/${totalCount} 条分轨，缓存完成后会自动继续导出。`,
      progress: progressPercent(loadedCount, totalCount),
    };
  }

  if (input.phase === 'preparing') {
    return {
      tone: 'info',
      label: '准备导出',
      detail: input.message || '正在检查轨道、裁剪和混音参数。',
      progress: 35,
    };
  }

  if (input.phase === 'rendering') {
    return {
      tone: 'info',
      label: '渲染混音',
      detail: input.message || '正在离线渲染音频，请保持页面打开。',
      progress: 70,
    };
  }

  if (input.phase === 'encoding') {
    return {
      tone: 'info',
      label: '生成文件',
      detail: `正在生成 ${input.fileType || 'WAV'} 文件。`,
      progress: 88,
    };
  }

  if (input.phase === 'downloading') {
    return {
      tone: 'info',
      label: '开始下载',
      detail: '文件已生成，正在交给浏览器下载。',
      progress: 96,
    };
  }

  if (input.phase === 'done') {
    return {
      tone: 'success',
      label: '导出完成',
      detail: `已生成 ${input.fileType || 'WAV'} 文件，共导出 ${input.exportedCount ?? 0} 条轨道。`,
      progress: 100,
    };
  }

  if (input.phase === 'error') {
    return {
      tone: 'error',
      label: '导出失败',
      detail: input.message || '导出失败，请检查轨道状态后重试。',
      progress: 100,
    };
  }

  return {
    tone: 'muted',
    label: '待导出',
    detail: '调整好混音后可以导出 WAV。',
    progress: 0,
  };
}
