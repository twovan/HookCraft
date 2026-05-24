import { describe, expect, it } from 'vitest';
import { resolveStemTrimControlValues } from './stemTrackControls';

describe('resolveStemTrimControlValues', () => {
  it('keeps selected stem trim controls bounded and independent', () => {
    expect(resolveStemTrimControlValues({
      duration: 128,
      trimStart: 12.345,
      trimEnd: 86.789,
      fadeIn: 4,
      fadeOut: 5,
    })).toEqual({
      durationMax: 128,
      trimStart: 12.345,
      trimEnd: 86.789,
      clipDuration: 74.444,
      fadeIn: 4,
      fadeOut: 5,
    });
  });

  it('falls back to duration for unset trim end and clamps fades to the selected clip', () => {
    expect(resolveStemTrimControlValues({
      duration: 30,
      trimStart: 25,
      trimEnd: null,
      fadeIn: 10,
      fadeOut: 12,
    })).toEqual({
      durationMax: 30,
      trimStart: 25,
      trimEnd: 30,
      clipDuration: 5,
      fadeIn: 5,
      fadeOut: 5,
    });
  });
});
