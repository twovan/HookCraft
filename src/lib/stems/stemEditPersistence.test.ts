import { describe, expect, it } from 'vitest';
import {
  buildStemEditLocalDraftKey,
  resolveStemAutoSaveRetryDelay,
  resolveStemLocalDraftRecovery,
  shouldWarnBeforeLeavingStemEditor,
} from './stemEditPersistence';

describe('stem edit persistence', () => {
  it('uses a stable local draft key per persisted stem job', () => {
    expect(buildStemEditLocalDraftKey(' stem-job-1 ')).toBe('hookcraft-stem-edit-draft:stem-job-1');
  });

  it('schedules bounded retry delays after failed autosaves', () => {
    expect(resolveStemAutoSaveRetryDelay(1)).toBe(3000);
    expect(resolveStemAutoSaveRetryDelay(2)).toBe(8000);
    expect(resolveStemAutoSaveRetryDelay(3)).toBe(15000);
    expect(resolveStemAutoSaveRetryDelay(4)).toBeNull();
  });

  it('warns before leaving while edits are unsaved or saving', () => {
    expect(shouldWarnBeforeLeavingStemEditor({ hasPendingChanges: true, isSaving: false })).toBe(true);
    expect(shouldWarnBeforeLeavingStemEditor({ hasPendingChanges: false, isSaving: true })).toBe(true);
    expect(shouldWarnBeforeLeavingStemEditor({ hasPendingChanges: false, isSaving: false })).toBe(false);
  });

  it('prefers local draft only when it is newer than the remote edit state', () => {
    expect(resolveStemLocalDraftRecovery({
      draftSavedAt: '2026-06-02T10:00:01.000Z',
      remoteSavedAt: '2026-06-02T10:00:00.000Z',
    })).toBe('local-newer');

    expect(resolveStemLocalDraftRecovery({
      draftSavedAt: '2026-06-02T10:00:00.000Z',
      remoteSavedAt: '2026-06-02T10:00:01.000Z',
    })).toBe('remote-current');

    expect(resolveStemLocalDraftRecovery({
      draftSavedAt: null,
      remoteSavedAt: '2026-06-02T10:00:01.000Z',
    })).toBe('none');
  });
});
