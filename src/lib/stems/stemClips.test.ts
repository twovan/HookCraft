import { describe, expect, it } from 'vitest';
import {
  findStemClipAtTime,
  cloneStemClipForPaste,
  moveStemClip,
  normalizeStemClipState,
  normalizeStemClips,
  removeStemClipAtTime,
  resizeStemClipEdge,
  resolveStemClipDragTarget,
  sliceStemClipPeaks,
  splitStemClipAtTime,
} from './stemClips';

describe('stem clips', () => {
  it('creates a single clip from legacy trim state', () => {
    expect(normalizeStemClips(null, 120, 10, 70)).toEqual([{
      id: 'clip-1',
      start: 10,
      sourceStart: 10,
      sourceEnd: 70,
    }]);
  });

  it('splits a clip at a timeline time while preserving source continuity', () => {
    const clips = normalizeStemClips(null, 120, 10, 70);
    const split = splitStemClipAtTime(clips, 35, 120);

    expect(split).toHaveLength(2);
    expect(split[0]).toMatchObject({ start: 10, sourceStart: 10, sourceEnd: 35 });
    expect(split[1]).toMatchObject({ start: 35, sourceStart: 35, sourceEnd: 70 });
  });

  it('removes the clip under the playhead', () => {
    const clips = splitStemClipAtTime(normalizeStemClips(null, 120, 10, 70), 35, 120);

    expect(removeStemClipAtTime(clips, 50)).toEqual([clips[0]]);
  });

  it('moves one clip without changing its source range', () => {
    const clips = splitStemClipAtTime(normalizeStemClips(null, 120, 10, 70), 35, 120);
    const moved = moveStemClip(clips, clips[1].id, 80, 120);

    expect(moved.find((clip) => clip.id === clips[1].id)).toMatchObject({
      start: 80,
      sourceStart: 35,
      sourceEnd: 70,
    });
  });

  it('resizes only the selected clip edge without merging split clips', () => {
    const clips = [
      { id: 'left', start: 0, sourceStart: 0, sourceEnd: 8.59 },
      { id: 'right', start: 17.19, sourceStart: 17.19, sourceEnd: 34.38 },
    ];

    const resized = resizeStemClipEdge(clips, 'right', 'end', 40, 120);

    expect(resized).toHaveLength(2);
    expect(resized.find((clip) => clip.id === 'left')).toEqual(clips[0]);
    expect(resized.find((clip) => clip.id === 'right')).toMatchObject({
      start: 17.19,
      sourceStart: 17.19,
      sourceEnd: 40,
    });
  });

  it('shrinks the selected clip end without merging split clips', () => {
    const clips = [
      { id: 'left', start: 0, sourceStart: 0, sourceEnd: 8.59 },
      { id: 'right', start: 17.19, sourceStart: 17.19, sourceEnd: 34.38 },
    ];

    const resized = resizeStemClipEdge(clips, 'right', 'end', 24, 120);

    expect(resized).toHaveLength(2);
    expect(resized.find((clip) => clip.id === 'left')).toEqual(clips[0]);
    expect(resized.find((clip) => clip.id === 'right')).toMatchObject({
      start: 17.19,
      sourceStart: 17.19,
      sourceEnd: 24,
    });
  });

  it('moves a selected clip start by trimming its source start', () => {
    const clips = [
      { id: 'left', start: 0, sourceStart: 0, sourceEnd: 8.59 },
      { id: 'right', start: 17.19, sourceStart: 17.19, sourceEnd: 34.38 },
    ];

    const resized = resizeStemClipEdge(clips, 'right', 'start', 20, 120);

    expect(resized.find((clip) => clip.id === 'right')).toMatchObject({
      start: 20,
      sourceStart: 20,
      sourceEnd: 34.38,
    });
  });

  it('clones a clip to a new timeline start while preserving source audio', () => {
    const clone = cloneStemClipForPaste({
      id: 'clip-a',
      start: 12,
      sourceStart: 4,
      sourceEnd: 18,
      sourceTrackType: 'vocals',
    }, 42);

    expect(clone).toMatchObject({
      start: 42,
      sourceStart: 4,
      sourceEnd: 18,
      sourceTrackType: 'vocals',
    });
    expect(clone.id).not.toBe('clip-a');
  });

  it('keeps the source track on normalized copied clips', () => {
    expect(normalizeStemClipState({
      clips: [{
        id: 'copied',
        start: 36,
        sourceStart: 4,
        sourceEnd: 14,
        sourceTrackType: 'drums',
      }],
      duration: 80,
      trimStart: 0,
      trimEnd: 80,
    }).clips[0]).toMatchObject({
      id: 'copied',
      start: 36,
      sourceStart: 4,
      sourceEnd: 14,
      sourceTrackType: 'drums',
    });
  });

  it('slices waveform peaks by a clip source range', () => {
    const peaks = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8];

    expect(sliceStemClipPeaks({
      id: 'clip-a',
      start: 40,
      sourceStart: 20,
      sourceEnd: 60,
    }, 80, peaks)).toEqual([0.3, 0.4, 0.5, 0.6]);
  });

  it('allows dragging a single full-length clip later in the timeline', () => {
    const clips = normalizeStemClips(null, 120, 0, 120);
    const moved = moveStemClip(clips, clips[0].id, 30, 150);

    expect(moved[0]).toMatchObject({
      start: 30,
      sourceStart: 0,
      sourceEnd: 120,
    });
  });

  it('selects a single clip as a drag target', () => {
    const clips = normalizeStemClips(null, 120, 0, 120);

    expect(resolveStemClipDragTarget(clips, 42)?.id).toBe(clips[0].id);
  });

  it('finds a clip by timeline position', () => {
    const clips = splitStemClipAtTime(normalizeStemClips(null, 120, 10, 70), 35, 120);

    expect(findStemClipAtTime(clips, 20)?.id).toBe(clips[0].id);
    expect(findStemClipAtTime(clips, 90)).toBeNull();
  });

  it('migrates legacy trim state into a persisted clip state', () => {
    expect(normalizeStemClipState({
      clips: null,
      duration: 120,
      trimStart: 12,
      trimEnd: 48,
    })).toEqual({
      clips: [{ id: 'clip-1', start: 12, sourceStart: 12, sourceEnd: 48 }],
      trimStart: 12,
      trimEnd: 48,
    });
  });

  it('derives timeline bounds from persisted clips', () => {
    expect(normalizeStemClipState({
      clips: [
        { id: 'a', start: 40, sourceStart: 10, sourceEnd: 20 },
        { id: 'b', start: 12, sourceStart: 30, sourceEnd: 38 },
      ],
      duration: 120,
      trimStart: 0,
      trimEnd: 120,
    })).toEqual({
      clips: [
        { id: 'b', start: 12, sourceStart: 30, sourceEnd: 38 },
        { id: 'a', start: 40, sourceStart: 10, sourceEnd: 20 },
      ],
      trimStart: 12,
      trimEnd: 50,
    });
  });

  it('keeps an empty clip state silent', () => {
    expect(normalizeStemClipState({
      clips: [],
      duration: 120,
      trimStart: 0,
      trimEnd: 0,
    })).toEqual({
      clips: [],
      trimStart: 0,
      trimEnd: 0,
    });
  });
});
