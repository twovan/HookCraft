import { describe, expect, it } from 'vitest';
import { resolveStemEditSaveBadge } from './stemEditSaveBadge';

describe('stem edit save badge', () => {
  it('shows pending changes before autosave finishes', () => {
    expect(resolveStemEditSaveBadge({
      hasPendingChanges: true,
      isSaving: false,
      jobId: 'stem-job-1',
    })).toEqual({
      label: '待自动保存',
      tone: 'pending',
    });
  });

  it('prioritizes manual saving over pending changes', () => {
    expect(resolveStemEditSaveBadge({
      hasPendingChanges: true,
      isSaving: true,
      jobId: 'stem-job-1',
    })).toEqual({
      label: '保存中',
      tone: 'saving',
    });
  });

  it('shows saved after autosave succeeds', () => {
    expect(resolveStemEditSaveBadge({
      hasPendingChanges: false,
      isSaving: false,
      autoSaveStatus: '已自动保存 20:26:08',
      jobId: 'stem-job-1',
    })).toEqual({
      label: '已保存',
      tone: 'saved',
    });
  });

  it('shows failed save state', () => {
    expect(resolveStemEditSaveBadge({
      hasPendingChanges: false,
      isSaving: false,
      autoSaveStatus: '自动保存失败：网络错误',
      jobId: 'stem-job-1',
    })).toEqual({
      label: '保存失败',
      tone: 'error',
    });
  });
});
