import { describe, expect, it } from 'vitest';
import { nudgeStemTrimEdge, resolveStemTrimControlValues, shiftStemTrimRange } from './stemTrackControls';

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

  it('nudges one trim edge without moving the opposite edge', () => {
    expect(nudgeStemTrimEdge({
      edge: 'start',
      delta: 0.1,
      duration: 60,
      trimStart: 12,
      trimEnd: 20,
    })).toBe(12.1);

    expect(nudgeStemTrimEdge({
      edge: 'end',
      delta: -0.1,
      duration: 60,
      trimStart: 12,
      trimEnd: 20,
    })).toBe(19.9);
  });

  it('keeps trim nudges inside duration and minimum clip length', () => {
    expect(nudgeStemTrimEdge({
      edge: 'start',
      delta: 10,
      duration: 8,
      trimStart: 1,
      trimEnd: 2,
    })).toBe(1.75);

    expect(nudgeStemTrimEdge({
      edge: 'end',
      delta: -10,
      duration: 8,
      trimStart: 1,
      trimEnd: 2,
    })).toBe(1.25);
  });

  it('moves a trimmed range while preserving clip duration', () => {
    expect(shiftStemTrimRange({
      duration: 120,
      trimStart: 20,
      trimEnd: 50,
      nextStart: 35,
    })).toEqual({ trimStart: 35, trimEnd: 65 });
  });

  it('keeps moved trim ranges inside the full duration', () => {
    expect(shiftStemTrimRange({
      duration: 60,
      trimStart: 20,
      trimEnd: 50,
      nextStart: 45,
    })).toEqual({ trimStart: 30, trimEnd: 60 });

    expect(shiftStemTrimRange({
      duration: 60,
      trimStart: 20,
      trimEnd: 50,
      nextStart: -12,
    })).toEqual({ trimStart: 0, trimEnd: 30 });
  });
});
