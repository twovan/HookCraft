import { describe, expect, it } from 'vitest';
import { resolveWaveformPointerIntent } from './waveformPointerIntent';

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

  it('seeks when the pointer is outside editable trim handles', () => {
    expect(resolveWaveformPointerIntent({
      editable: true,
      pointerX: 50,
      width: 100,
      duration: 120,
      trimStart: 12,
      trimEnd: 108,
      hitSize: 8,
    })).toEqual({ kind: 'seek', time: 60 });
  });
});
