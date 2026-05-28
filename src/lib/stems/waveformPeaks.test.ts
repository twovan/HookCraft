import { describe, expect, it } from 'vitest';
import { buildWaveformPeaksFromSamples } from './waveformPeaks';

describe('buildWaveformPeaksFromSamples', () => {
  it('builds absolute peak buckets from audio samples', () => {
    expect(buildWaveformPeaksFromSamples(Float32Array.from([0, -0.2, 0.4, -1]), 2)).toEqual([0.2, 1]);
  });

  it('handles empty input without throwing', () => {
    expect(buildWaveformPeaksFromSamples(new Float32Array(), 4)).toEqual([0, 0, 0, 0]);
  });
});
