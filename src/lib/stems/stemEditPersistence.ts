const LOCAL_DRAFT_PREFIX = 'hookcraft-stem-edit-draft';
const AUTO_SAVE_RETRY_DELAYS_MS = [3000, 8000, 15000] as const;

export type StemLocalDraftRecovery = 'none' | 'local-newer' | 'remote-current';

export function buildStemEditLocalDraftKey(jobId: string) {
  return `${LOCAL_DRAFT_PREFIX}:${jobId.trim() || 'draft'}`;
}

export function resolveStemAutoSaveRetryDelay(failedAttempt: number) {
  if (!Number.isFinite(failedAttempt) || failedAttempt < 1) return null;
  return AUTO_SAVE_RETRY_DELAYS_MS[Math.floor(failedAttempt) - 1] ?? null;
}

export function shouldWarnBeforeLeavingStemEditor({
  hasPendingChanges,
  isSaving,
}: {
  hasPendingChanges: boolean;
  isSaving: boolean;
}) {
  return hasPendingChanges || isSaving;
}

export function resolveStemLocalDraftRecovery({
  draftSavedAt,
  remoteSavedAt,
}: {
  draftSavedAt?: string | null;
  remoteSavedAt?: string | null;
}): StemLocalDraftRecovery {
  if (!draftSavedAt) return 'none';

  const draftTime = Date.parse(draftSavedAt);
  if (!Number.isFinite(draftTime)) return 'none';

  if (!remoteSavedAt) return 'local-newer';

  const remoteTime = Date.parse(remoteSavedAt);
  if (!Number.isFinite(remoteTime)) return 'local-newer';

  return draftTime > remoteTime ? 'local-newer' : 'remote-current';
}
