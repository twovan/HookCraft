export interface StemTrimControlInput {
  duration: number;
  trimStart: number;
  trimEnd?: number | null;
  fadeIn: number;
  fadeOut: number;
}

export interface StemTrimControlValues {
  durationMax: number;
  trimStart: number;
  trimEnd: number;
  clipDuration: number;
  fadeIn: number;
  fadeOut: number;
}

export interface StemTrimNudgeInput {
  edge: 'start' | 'end';
  delta: number;
  duration: number;
  trimStart: number;
  trimEnd: number;
}

export interface StemTrimRangeShiftInput {
  duration: number;
  trimStart: number;
  trimEnd: number;
  nextStart: number;
}

function clampNumber(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function roundTrimTime(value: number) {
  return Number(value.toFixed(3));
}

export function resolveStemTrimControlValues(input: StemTrimControlInput): StemTrimControlValues {
  const duration = Number.isFinite(input.duration) ? Math.max(0, input.duration) : 0;
  const trimStart = clampNumber(input.trimStart, 0, duration);
  const trimEnd = Math.max(trimStart, clampNumber(input.trimEnd ?? duration, 0, duration));
  const clipDuration = Math.max(0, trimEnd - trimStart);

  return {
    durationMax: Math.max(duration, 0.1),
    trimStart,
    trimEnd,
    clipDuration,
    fadeIn: clampNumber(input.fadeIn, 0, clipDuration),
    fadeOut: clampNumber(input.fadeOut, 0, clipDuration),
  };
}

export function nudgeStemTrimEdge(input: StemTrimNudgeInput) {
  const duration = Number.isFinite(input.duration) ? Math.max(0, input.duration) : 0;
  const trimStart = clampNumber(input.trimStart, 0, duration);
  const trimEnd = Math.max(trimStart, clampNumber(input.trimEnd, 0, duration));
  const delta = Number.isFinite(input.delta) ? input.delta : 0;
  const minimumClipDuration = Math.min(0.25, Math.max(0, duration));

  if (input.edge === 'start') {
    return roundTrimTime(clampNumber(trimStart + delta, 0, Math.max(0, trimEnd - minimumClipDuration)));
  }

  return roundTrimTime(clampNumber(trimEnd + delta, Math.min(duration, trimStart + minimumClipDuration), duration));
}

export function shiftStemTrimRange(input: StemTrimRangeShiftInput) {
  const duration = Number.isFinite(input.duration) ? Math.max(0, input.duration) : 0;
  const trimStart = clampNumber(input.trimStart, 0, duration);
  const trimEnd = Math.max(trimStart, clampNumber(input.trimEnd, 0, duration));
  const clipDuration = trimEnd - trimStart;
  const nextStart = clampNumber(input.nextStart, 0, Math.max(0, duration - clipDuration));

  return {
    trimStart: roundTrimTime(nextStart),
    trimEnd: roundTrimTime(nextStart + clipDuration),
  };
}
