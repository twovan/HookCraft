import { describe, it, expect } from 'vitest';
import { buildArrangementPrompt } from './buildArrangementPrompt';
import type { ArrangementParams } from '@/types/arrangement';

function makeParams(overrides: Partial<ArrangementParams> = {}): ArrangementParams {
  return {
    duration: 120,
    bpm: 120,
    musicalKey: 'C',
    scale: 'major',
    instruments: [],
    prompt: '',
    lyrics: '',
    isInstrumental: false,
    outputFormat: 'mp3',
    ...overrides,
  };
}

describe('buildArrangementPrompt', () => {
  it('includes BPM, musical key, and scale in the prompt', () => {
    const result = buildArrangementPrompt(makeParams({
      bpm: 128,
      musicalKey: 'A',
      scale: 'minor',
    }));

    expect(result).toContain('128');
    expect(result).toContain('A');
    expect(result).toContain('minor');
  });

  it('includes all selected instruments when instruments are provided', () => {
    const result = buildArrangementPrompt(makeParams({
      bpm: 128,
      musicalKey: 'A',
      scale: 'minor',
      instruments: ['piano', 'strings', 'synth pad'],
    }));

    expect(result).toContain('piano');
    expect(result).toContain('strings');
    expect(result).toContain('synth pad');
  });

  it('skips instruments segment when no instruments are selected (Requirement 5.6)', () => {
    const result = buildArrangementPrompt(makeParams({
      bpm: 100,
      musicalKey: 'D',
      scale: 'dorian',
      instruments: [],
    }));

    expect(result).not.toContain('featuring');
    expect(result).toContain('100');
    expect(result).toContain('D');
    expect(result).toContain('dorian');
  });

  it('appends user style description when non-empty (Requirement 5.3)', () => {
    const result = buildArrangementPrompt(makeParams({
      bpm: 128,
      musicalKey: 'A',
      scale: 'minor',
      instruments: ['piano', 'strings', 'synth pad'],
      prompt: '梦幻感的电子流行编曲',
    }));

    expect(result).toContain('梦幻感的电子流行编曲');
  });

  it('does not append style description when prompt is empty', () => {
    const result = buildArrangementPrompt(makeParams({
      bpm: 128,
      musicalKey: 'A',
      scale: 'minor',
      instruments: ['piano'],
      prompt: '',
    }));

    // Should end with the instruments, no trailing period+space for empty prompt
    expect(result).not.toContain('. ');
  });

  it('does not append style description when prompt is whitespace only', () => {
    const result = buildArrangementPrompt(makeParams({
      bpm: 128,
      musicalKey: 'A',
      scale: 'minor',
      instruments: ['piano'],
      prompt: '   ',
    }));

    expect(result).not.toContain('. ');
  });

  it('truncates to 2000 characters when prompt is very long (Requirement 5.2)', () => {
    const longPrompt = 'x'.repeat(3000);
    const result = buildArrangementPrompt(makeParams({
      bpm: 128,
      musicalKey: 'A',
      scale: 'minor',
      instruments: ['piano'],
      prompt: longPrompt,
    }));

    expect(result.length).toBeLessThanOrEqual(2000);
  });

  it('matches the design doc example output format', () => {
    const result = buildArrangementPrompt(makeParams({
      bpm: 128,
      musicalKey: 'A',
      scale: 'minor',
      instruments: ['piano', 'strings', 'synth pad'],
      prompt: '梦幻感的电子流行编曲',
    }));

    expect(result).toBe(
      'An arrangement at 128 BPM in A minor, featuring piano, strings, synth pad. 梦幻感的电子流行编曲'
    );
  });

  it('returns a non-empty string for minimal valid params', () => {
    const result = buildArrangementPrompt(makeParams({
      bpm: 60,
      musicalKey: 'C',
      scale: 'major',
      instruments: [],
      prompt: '',
    }));

    expect(result.length).toBeGreaterThan(0);
    expect(result).toBe('An arrangement at 60 BPM in C major');
  });
});
