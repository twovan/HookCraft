import { describe, expect, it } from 'vitest';
import { selectStemTypesForAudioLoad } from './stemAudioLoadPlan';

describe('selectStemTypesForAudioLoad', () => {
  it('skips known empty and already loaded stems', () => {
    expect(selectStemTypesForAudioLoad([
      { type: 'vocals', knownEmpty: false, loaded: true },
      { type: 'drums', knownEmpty: false, loaded: false },
      { type: 'fx', knownEmpty: true, loaded: false },
      { type: 'bass', knownEmpty: false, loaded: false },
    ])).toEqual(['drums', 'bass']);
  });

  it('returns an empty plan when every usable stem is already loaded', () => {
    expect(selectStemTypesForAudioLoad([
      { type: 'vocals', loaded: true },
      { type: 'drums', loaded: true },
      { type: 'fx', knownEmpty: true, loaded: false },
    ])).toEqual([]);
  });
});
