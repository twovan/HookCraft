import { describe, expect, it } from 'vitest';
import { mergeStemCacheSummary } from './stemCacheLookup';

describe('stem cache lookup summaries', () => {
  it('keeps separate basic and professional cache modes for one song', () => {
    const basicSavedAt = '2026-06-03T09:10:00.000Z';
    const proSavedAt = '2026-06-03T17:31:00.000Z';

    const summary = mergeStemCacheSummary(
      mergeStemCacheSummary(undefined, 'basic-job', 'basic', basicSavedAt),
      'pro-job',
      'pro',
      proSavedAt,
    );

    expect(summary.hasStemCache).toBe(true);
    expect(summary.jobId).toBe('basic-job');
    expect(summary.basicJobId).toBe('basic-job');
    expect(summary.proJobId).toBe('pro-job');
    expect(summary.stemCacheModes).toEqual(['basic', 'pro']);
    expect(summary.editSavedAt).toBe(proSavedAt);
  });

  it('does not duplicate a cache mode when multiple jobs share the same mode', () => {
    const summary = mergeStemCacheSummary(
      mergeStemCacheSummary(undefined, 'old-basic-job', 'basic', null),
      'new-basic-job',
      'basic',
      null,
    );

    expect(summary.jobId).toBe('old-basic-job');
    expect(summary.basicJobId).toBe('old-basic-job');
    expect(summary.stemCacheModes).toEqual(['basic']);
  });
});
