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

function clampNumber(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
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
