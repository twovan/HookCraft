export interface StemClip {
  id: string;
  start: number;
  sourceStart: number;
  sourceEnd: number;
  sourceTrackType?: string;
}

export interface StemClipSegment {
  clip: StemClip;
  start: number;
  end: number;
}

export interface StemClipState {
  clips: StemClip[];
  trimStart: number;
  trimEnd: number | null;
}

function roundTime(value: number) {
  return Number(value.toFixed(3));
}

function clampNumber(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function normalizeSourceTrackType(value: unknown) {
  return typeof value === 'string' ? value.trim().slice(0, 96) : '';
}

export function getStemClipDuration(clip: StemClip) {
  return Math.max(0, clip.sourceEnd - clip.sourceStart);
}

export function normalizeStemClips(
  clips: StemClip[] | undefined | null,
  duration: number,
  fallbackTrimStart = 0,
  fallbackTrimEnd: number | null = null,
): StemClip[] {
  const safeDuration = Math.max(0, Number.isFinite(duration) ? duration : 0);
  const normalized = (clips || [])
    .map((clip, index) => {
      const sourceStart = clampNumber(clip.sourceStart, 0, safeDuration);
      const sourceEnd = clampNumber(Math.max(sourceStart, clip.sourceEnd), 0, safeDuration);
      const clipDuration = sourceEnd - sourceStart;
      const sourceTrackType = normalizeSourceTrackType(clip.sourceTrackType);
      if (clipDuration <= 0.001) return null;
      return {
        id: clip.id || `clip-${index + 1}`,
        start: roundTime(clampNumber(clip.start, 0, Math.max(0, safeDuration - clipDuration))),
        sourceStart: roundTime(sourceStart),
        sourceEnd: roundTime(sourceEnd),
        ...(sourceTrackType ? { sourceTrackType } : {}),
      };
    })
    .filter((clip): clip is StemClip => Boolean(clip));

  if (normalized.length > 0) {
    return normalized.sort((left, right) => left.start - right.start || left.sourceStart - right.sourceStart);
  }

  const sourceStart = clampNumber(fallbackTrimStart, 0, safeDuration);
  const sourceEnd = Math.max(sourceStart, clampNumber(fallbackTrimEnd ?? safeDuration, 0, safeDuration));
  if (sourceEnd - sourceStart <= 0.001) return [];
  return [{
    id: 'clip-1',
    start: roundTime(sourceStart),
    sourceStart: roundTime(sourceStart),
    sourceEnd: roundTime(sourceEnd),
  }];
}

export function normalizeStemClipState({
  clips,
  duration,
  trimStart = 0,
  trimEnd = null,
}: {
  clips: StemClip[] | undefined | null;
  duration: number;
  trimStart?: number;
  trimEnd?: number | null;
}): StemClipState {
  const normalizedClips = normalizeStemClips(clips, duration, trimStart, trimEnd);
  if (normalizedClips.length === 0) {
    return {
      clips: [],
      trimStart: 0,
      trimEnd: 0,
    };
  }

  const timelineStart = Math.min(...normalizedClips.map((clip) => clip.start));
  const timelineEnd = Math.max(...normalizedClips.map((clip) => clip.start + getStemClipDuration(clip)));

  return {
    clips: normalizedClips,
    trimStart: roundTime(timelineStart),
    trimEnd: roundTime(timelineEnd),
  };
}

export function splitStemClipAtTime(clips: StemClip[], time: number, duration: number) {
  const safeTime = clampNumber(time, 0, Math.max(0, duration));
  const target = clips.find((clip) => safeTime > clip.start + 0.05 && safeTime < clip.start + getStemClipDuration(clip) - 0.05);
  if (!target) return clips;

  const sourceSplit = target.sourceStart + (safeTime - target.start);
  const left: StemClip = {
    ...target,
    sourceEnd: roundTime(sourceSplit),
  };
  const right: StemClip = {
    id: `${target.id}-split-${Date.now().toString(36)}`,
    start: roundTime(safeTime),
    sourceStart: roundTime(sourceSplit),
    sourceEnd: target.sourceEnd,
  };

  return clips
    .flatMap((clip) => clip.id === target.id ? [left, right] : [clip])
    .sort((leftClip, rightClip) => leftClip.start - rightClip.start || leftClip.sourceStart - rightClip.sourceStart);
}

export function removeStemClipAtTime(clips: StemClip[], time: number) {
  const safeTime = Number.isFinite(time) ? time : 0;
  const remaining = clips.filter((clip) => !(safeTime >= clip.start && safeTime <= clip.start + getStemClipDuration(clip)));
  return remaining.length === clips.length ? clips : remaining;
}

export function moveStemClip(clips: StemClip[], clipId: string, nextStart: number, duration: number) {
  return clips.map((clip) => {
    if (clip.id !== clipId) return clip;
    const clipDuration = getStemClipDuration(clip);
    return {
      ...clip,
      start: roundTime(clampNumber(nextStart, 0, Math.max(0, duration - clipDuration))),
    };
  }).sort((left, right) => left.start - right.start || left.sourceStart - right.sourceStart);
}

export function cloneStemClipForPaste(clip: StemClip, nextStart: number): StemClip {
  const sourceTrackType = normalizeSourceTrackType(clip.sourceTrackType);
  return {
    ...clip,
    id: `${clip.id}-copy-${Date.now().toString(36)}`,
    start: roundTime(Math.max(0, Number.isFinite(nextStart) ? nextStart : 0)),
    ...(sourceTrackType ? { sourceTrackType } : {}),
  };
}

export function findStemClipAtTime(clips: StemClip[], time: number) {
  return clips.find((clip) => time >= clip.start && time <= clip.start + getStemClipDuration(clip)) || null;
}

export function resolveStemClipDragTarget(clips: StemClip[], time: number) {
  return findStemClipAtTime(clips, time);
}

export function sliceStemClipPeaks(clip: StemClip, sourceDuration: number, peaks: number[]) {
  if (!peaks.length || sourceDuration <= 0) return [];
  const lastIndex = peaks.length - 1;
  const startRatio = clampNumber(clip.sourceStart / sourceDuration, 0, 1);
  const endRatio = clampNumber(clip.sourceEnd / sourceDuration, startRatio, 1);
  const startIndex = Math.floor(startRatio * peaks.length);
  const endIndex = Math.ceil(endRatio * peaks.length);
  return peaks.slice(
    clampNumber(startIndex, 0, lastIndex),
    clampNumber(Math.max(startIndex + 1, endIndex), 1, peaks.length),
  );
}
