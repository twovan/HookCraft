import { describe, expect, it } from 'vitest';
import { resolveStemExportSaveIntent } from './stemExportSaveIntent';

describe('resolveStemExportSaveIntent', () => {
  it('skips save when there are no pending edits', () => {
    expect(resolveStemExportSaveIntent({
      hasPendingChanges: false,
      canPersist: true,
    })).toMatchObject({
      shouldSave: false,
      status: 'clean',
    });
  });

  it('saves when pending edits can be persisted', () => {
    expect(resolveStemExportSaveIntent({
      hasPendingChanges: true,
      canPersist: true,
    })).toMatchObject({
      shouldSave: true,
      status: 'save-before-export',
    });
  });

  it('continues without save when no cache id is available', () => {
    expect(resolveStemExportSaveIntent({
      hasPendingChanges: true,
      canPersist: false,
    })).toMatchObject({
      shouldSave: false,
      status: 'cannot-save',
    });
  });
});
