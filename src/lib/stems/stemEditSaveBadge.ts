export type StemEditSaveBadgeTone = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

export interface StemEditSaveBadge {
  label: string;
  tone: StemEditSaveBadgeTone;
}

export function resolveStemEditSaveBadge({
  hasPendingChanges,
  isSaving,
  autoSaveStatus,
  jobId,
}: {
  hasPendingChanges: boolean;
  isSaving: boolean;
  autoSaveStatus?: string | null;
  jobId?: string | null;
}): StemEditSaveBadge {
  if (!jobId) {
    return { label: '未保存', tone: 'error' };
  }

  if (isSaving) {
    return { label: '保存中', tone: 'saving' };
  }

  if (hasPendingChanges) {
    return { label: '待自动保存', tone: 'pending' };
  }

  if (autoSaveStatus?.startsWith('自动保存失败')) {
    return { label: '保存失败', tone: 'error' };
  }

  if (autoSaveStatus?.startsWith('已自动保存')) {
    return { label: '已保存', tone: 'saved' };
  }

  return { label: '可编辑', tone: 'idle' };
}
