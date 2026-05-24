import { describe, expect, it } from 'vitest';
import {
  addStemMutedRange,
  buildAudibleStemSegments,
  clearStemMutedRangesInRange,
  mapStemMutedRangesToPixels,
  normalizeStemMutedRanges,
} from './stemMuteRanges';

describe('stem mute ranges', () => {
  it('normalizes, clamps, sorts, and merges muted ranges', () => {
    expect(normalizeStemMutedRanges([
      { start: 9, end: 14 },
      { start: -2, end: 2 },
      { start: 1.5, end: 4 },
      { start: 30, end: 30 },
      { start: 18, end: 12 },
    ], 12)).toEqual([
      { start: 0, end: 4 },
      { start: 9, end: 12 },
    ]);
  });

  it('adds a selected mute range and merges with existing ranges', () => {
    expect(addStemMutedRange([
      { start: 10, end: 12 },
      { start: 20, end: 22 },
    ], { start: 11.5, end: 21 }, 30)).toEqual([
      { start: 10, end: 22 },
    ]);
  });

  it('clears only the overlapping portion of muted ranges', () => {
    expect(clearStemMutedRangesInRange([
      { start: 5, end: 15 },
      { start: 20, end: 25 },
    ], { start: 8, end: 22 }, 30)).toEqual([
      { start: 5, end: 8 },
      { start: 22, end: 25 },
    ]);
  });

  it('builds audible segments around muted ranges', () => {
    expect(buildAudibleStemSegments({
      start: 4,
      end: 16,
      mutedRanges: [
        { start: 6, end: 8 },
        { start: 10, end: 20 },
      ],
    })).toEqual([
      { start: 4, end: 6 },
      { start: 8, end: 10 },
    ]);
  });

  it('maps muted ranges to visible waveform pixel rectangles', () => {
    expect(mapStemMutedRangesToPixels({
      mutedRanges: [
        { start: 5, end: 10 },
        { start: 30, end: 45 },
      ],
      duration: 60,
      width: 600,
    })).toEqual([
      { x: 50, width: 50 },
      { x: 300, width: 150 },
    ]);
  });

  it('drops muted range pixel rectangles that are outside the visible duration', () => {
    expect(mapStemMutedRangesToPixels({
      mutedRanges: [
        { start: 8, end: 20 },
        { start: 30, end: 35 },
      ],
      duration: 10,
      width: 100,
    })).toEqual([
      { x: 80, width: 20 },
    ]);
  });
});
