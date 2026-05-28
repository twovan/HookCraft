import { describe, expect, it } from 'vitest';
import { defaultStemMasterState, normalizeStemMasterState } from './stemMixState';

describe('stem master state', () => {
  it('normalizes invalid master output values', () => {
    expect(normalizeStemMasterState({ volume: 2, limiter: false })).toEqual({
      volume: 1,
      limiter: false,
    });
    expect(normalizeStemMasterState({ volume: -1 })).toEqual({
      volume: 0,
      limiter: true,
    });
    expect(normalizeStemMasterState(null)).toEqual(defaultStemMasterState());
  });
});
