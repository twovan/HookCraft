export interface StemMutedRange {
  start: number;
  end: number;
}

export interface StemMutedRangePixelRect {
  x: number;
  width: number;
}

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function roundTime(value: number) {
  return Number(value.toFixed(3));
}

export function normalizeStemMutedRanges(ranges: StemMutedRange[] | undefined | null, duration: number) {
  const safeDuration = Number.isFinite(duration) ? Math.max(0, duration) : 0;
  const normalized = (ranges || [])
    .map((range) => ({
      start: roundTime(clamp(range.start, 0, safeDuration)),
      end: roundTime(clamp(range.end, 0, safeDuration)),
    }))
    .filter((range) => range.end - range.start > 0.001)
    .sort((left, right) => left.start - right.start);

  return normalized.reduce<StemMutedRange[]>((merged, range) => {
    const previous = merged[merged.length - 1];
    if (!previous || range.start > previous.end + 0.001) {
      merged.push(range);
      return merged;
    }

    previous.end = roundTime(Math.max(previous.end, range.end));
    return merged;
  }, []);
}

export function addStemMutedRange(current: StemMutedRange[] | undefined | null, range: StemMutedRange, duration: number) {
  return normalizeStemMutedRanges([...(current || []), range], duration);
}

export function clearStemMutedRangesInRange(current: StemMutedRange[] | undefined | null, range: StemMutedRange, duration: number) {
  const [clearStart, clearEnd] = [
    clamp(Math.min(range.start, range.end), 0, duration),
    clamp(Math.max(range.start, range.end), 0, duration),
  ];
  if (clearEnd - clearStart <= 0.001) {
    return normalizeStemMutedRanges(current, duration);
  }

  const remaining = normalizeStemMutedRanges(current, duration).flatMap((mutedRange) => {
    if (mutedRange.end <= clearStart || mutedRange.start >= clearEnd) return [mutedRange];

    const nextRanges: StemMutedRange[] = [];
    if (mutedRange.start < clearStart) {
      nextRanges.push({ start: mutedRange.start, end: roundTime(clearStart) });
    }
    if (mutedRange.end > clearEnd) {
      nextRanges.push({ start: roundTime(clearEnd), end: mutedRange.end });
    }
    return nextRanges;
  });

  return normalizeStemMutedRanges(remaining, duration);
}

export function removeStemMutedRangeAtIndex(current: StemMutedRange[] | undefined | null, index: number, duration: number) {
  const normalized = normalizeStemMutedRanges(current, duration);
  if (!Number.isInteger(index) || index < 0 || index >= normalized.length) {
    return normalized;
  }

  return normalized.filter((_, mutedRangeIndex) => mutedRangeIndex !== index);
}

export function buildAudibleStemSegments({
  start,
  end,
  mutedRanges,
}: {
  start: number;
  end: number;
  mutedRanges?: StemMutedRange[] | null;
}) {
  const segmentStart = Math.max(0, Math.min(start, end));
  const segmentEnd = Math.max(segmentStart, end);
  const muted = normalizeStemMutedRanges(mutedRanges, segmentEnd)
    .filter((range) => range.end > segmentStart && range.start < segmentEnd);

  let cursor = segmentStart;
  const segments: StemMutedRange[] = [];
  muted.forEach((range) => {
    const mutedStart = Math.max(segmentStart, range.start);
    const mutedEnd = Math.min(segmentEnd, range.end);
    if (mutedStart - cursor > 0.001) {
      segments.push({ start: roundTime(cursor), end: roundTime(mutedStart) });
    }
    cursor = Math.max(cursor, mutedEnd);
  });

  if (segmentEnd - cursor > 0.001) {
    segments.push({ start: roundTime(cursor), end: roundTime(segmentEnd) });
  }

  return segments;
}

export function mapStemMutedRangesToPixels({
  mutedRanges,
  duration,
  width,
}: {
  mutedRanges?: StemMutedRange[] | null;
  duration: number;
  width: number;
}): StemMutedRangePixelRect[] {
  const safeDuration = Number.isFinite(duration) ? Math.max(0, duration) : 0;
  const safeWidth = Number.isFinite(width) ? Math.max(0, width) : 0;
  if (safeDuration <= 0 || safeWidth <= 0) return [];

  return normalizeStemMutedRanges(mutedRanges, safeDuration)
    .map((range) => {
      const start = clamp(range.start, 0, safeDuration);
      const end = clamp(range.end, 0, safeDuration);
      return {
        x: roundTime((start / safeDuration) * safeWidth),
        width: roundTime(((end - start) / safeDuration) * safeWidth),
      };
    })
    .filter((rect) => rect.width > 0.5);
}
