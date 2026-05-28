import { describe, expect, it } from 'vitest';
import {
  resolveTimelineTrimPointerIntent,
  resolveWaveformPointerIntent,
} from './waveformPointerIntent';

describe('resolveWaveformPointerIntent', () => {
  it('treats non-editable tracks as seek targets even near trim handles', () => {
    expect(resolveWaveformPointerIntent({
      editable: false,
      pointerX: 0,
      width: 100,
      duration: 120,
      trimStart: 0,
      trimEnd: 120,
    })).toEqual({ kind: 'seek', time: 0 });
  });

  it('starts trim drag on editable tracks near the closest handle', () => {
    expect(resolveWaveformPointerIntent({
      editable: true,
      pointerX: 91,
      width: 100,
      duration: 120,
      trimStart: 12,
      trimEnd: 108,
      hitSize: 12,
    })).toMatchObject({ kind: 'trim', edge: 'end' });
  });

  it('keeps full-length trim handles easy to grab at the canvas edges', () => {
    expect(resolveWaveformPointerIntent({
      editable: true,
      pointerX: 478,
      width: 500,
      duration: 150,
      trimStart: 0,
      trimEnd: 150,
    })).toMatchObject({ kind: 'trim', edge: 'end' });
  });

  it('keeps selected trim handles reachable even when the pointer is not pixel-perfect', () => {
    expect(resolveWaveformPointerIntent({
      editable: true,
      pointerX: 66,
      width: 500,
      duration: 150,
      trimStart: 30,
      trimEnd: 120,
    })).toMatchObject({ kind: 'trim', edge: 'start' });
  });

  it('starts playhead drag near the current playhead outside trim handles', () => {
    expect(resolveWaveformPointerIntent({
      editable: true,
      pointerX: 49,
      width: 100,
      duration: 120,
      trimStart: 12,
      trimEnd: 108,
      currentTime: 60,
      hitSize: 8,
      playheadHitSize: 5,
    })).toEqual({ kind: 'playhead', time: 58.8 });
  });

  it('keeps trim handles ahead of playhead dragging when they overlap', () => {
    expect(resolveWaveformPointerIntent({
      editable: true,
      pointerX: 90,
      width: 100,
      duration: 120,
      trimStart: 12,
      trimEnd: 108,
      currentTime: 108,
      hitSize: 12,
      playheadHitSize: 6,
    })).toMatchObject({ kind: 'trim', edge: 'end' });
  });

  it('seeks when the pointer is outside editable trim handles', () => {
    expect(resolveWaveformPointerIntent({
      editable: true,
      pointerX: 1,
      width: 100,
      duration: 120,
      trimStart: 12,
      trimEnd: 108,
      hitSize: 8,
    })).toEqual({ kind: 'seek', time: 1.2 });
  });

  it('starts moving the trimmed clip when dragging inside the selected range away from handles', () => {
    expect(resolveWaveformPointerIntent({
      editable: true,
      pointerX: 50,
      width: 100,
      duration: 120,
      trimStart: 24,
      trimEnd: 96,
      hitSize: 8,
    })).toMatchObject({ kind: 'move-trim', time: 60 });
  });
});

describe('resolveTimelineTrimPointerIntent', () => {
  it('starts selected range trim drag from the timeline ruler edge', () => {
    expect(resolveTimelineTrimPointerIntent({
      pointerX: 478,
      width: 500,
      duration: 150,
      trimStart: 0,
      trimEnd: 150,
    })).toMatchObject({ kind: 'trim', edge: 'end' });
  });

  it('gives timeline trim handles a forgiving target', () => {
    expect(resolveTimelineTrimPointerIntent({
      pointerX: 92,
      width: 500,
      duration: 150,
      trimStart: 30,
      trimEnd: 120,
      hitSize: 40,
    })).toMatchObject({ kind: 'trim', edge: 'start' });
  });

  it('keeps ruler clicks away from trim handles as seek actions', () => {
    expect(resolveTimelineTrimPointerIntent({
      pointerX: 250,
      width: 500,
      duration: 150,
      trimStart: 0,
      trimEnd: 150,
    })).toEqual({ kind: 'seek', time: 75 });
  });
});
