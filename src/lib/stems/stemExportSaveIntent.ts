export type StemExportSaveStatus = 'clean' | 'save-before-export' | 'cannot-save';

export interface StemExportSaveIntentInput {
  hasPendingChanges: boolean;
  canPersist: boolean;
}

export interface StemExportSaveIntent {
  shouldSave: boolean;
  status: StemExportSaveStatus;
}

export function resolveStemExportSaveIntent(input: StemExportSaveIntentInput): StemExportSaveIntent {
  if (!input.hasPendingChanges) {
    return { shouldSave: false, status: 'clean' };
  }

  if (!input.canPersist) {
    return { shouldSave: false, status: 'cannot-save' };
  }

  return { shouldSave: true, status: 'save-before-export' };
}
