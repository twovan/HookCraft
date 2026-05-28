export type StemEditorReadinessLevel = 'ready' | 'loading' | 'attention' | 'blocked';

export interface StemEditorReadinessInput {
  loadableStemCount: number;
  readyStemCount: number;
  loadingStemCount: number;
  failedStemCount: number;
  skippedStemCount: number;
  exportSelectedCount: number;
  exportMissingCount: number;
}

export interface StemEditorReadiness {
  level: StemEditorReadinessLevel;
  canPreview: boolean;
  canExport: boolean;
  title: string;
  detail: string;
}

export function buildStemEditorReadiness(input: StemEditorReadinessInput): StemEditorReadiness {
  const canPreview = input.readyStemCount > 0;
  const canExport = input.exportSelectedCount > 0;

  if (!canPreview && input.loadingStemCount > 0) {
    return {
      level: 'loading',
      canPreview,
      canExport: false,
      title: '准备音频中',
      detail: `正在加载 ${input.loadingStemCount} 条分轨，第一条就绪后即可预听。`,
    };
  }

  if (!canPreview) {
    return {
      level: 'blocked',
      canPreview,
      canExport: false,
      title: '暂无可播放分轨',
      detail: input.failedStemCount > 0
        ? `${input.failedStemCount} 条分轨加载失败，请先重试音频。`
        : '还没有可用音频，请检查分轨任务结果。',
    };
  }

  if (input.loadingStemCount > 0 || input.failedStemCount > 0 || input.exportMissingCount > 0) {
    const issues = [
      input.loadingStemCount > 0 ? `${input.loadingStemCount} 条加载中` : '',
      input.failedStemCount > 0 ? `${input.failedStemCount} 条失败` : '',
      input.exportMissingCount > 0 ? `导出缺 ${input.exportMissingCount} 条` : '',
    ].filter(Boolean).join('，');

    return {
      level: 'attention',
      canPreview,
      canExport,
      title: '可以测试，仍有待处理项',
      detail: issues || '可以先测试已就绪轨道。',
    };
  }

  return {
    level: 'ready',
    canPreview,
    canExport,
    title: '编辑器已就绪',
    detail: input.skippedStemCount > 0
      ? `可用分轨全部就绪，已跳过 ${input.skippedStemCount} 条空轨。`
      : '可用分轨全部就绪，可以播放、编辑和导出。',
  };
}
