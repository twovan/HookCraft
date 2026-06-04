import { describe, expect, it } from 'vitest';
import { normalizeEditState } from './route';

describe('stem edit-state route normalization', () => {
  it('persists an explicit empty clip list so deleted clips stay deleted', () => {
    const editState = normalizeEditState({
      tracks: {
        vocals: {
          volume: 0.8,
          pan: 0,
          muted: false,
          solo: false,
          collapsed: false,
          trimStart: 0,
          trimEnd: 0,
          fadeIn: 0,
          fadeOut: 0,
          mutedRanges: [],
          clips: [],
        },
      },
    });

    expect(editState?.tracks.vocals.clips).toEqual([]);
    expect(editState?.tracks.vocals.trimStart).toBe(0);
    expect(editState?.tracks.vocals.trimEnd).toBe(0);
  });
});
