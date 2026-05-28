import { describe, expect, it } from 'vitest';
import { aggregateStyleDnaLocally } from './StyleDnaAggregator';
import type { TrackAnalysis } from '@/types/style-dna';

function track(id: string, bpm: number, instruments: string[]): TrackAnalysis {
  return {
    id: `analysis-${id}`,
    sourceTrackId: id,
    title: id,
    duration: 180,
    confidence: 0.8,
    bpmEstimate: bpm,
    bpmRange: `${bpm - 2}-${bpm + 2} BPM`,
    keyEstimate: 'unknown',
    mode: 'minor',
    genreCandidates: ['Mandarin pop', 'cinematic pop'],
    moodTags: ['emotional', 'warm'],
    energyCurve: {},
    sectionMap: [],
    instrumentation: { primary: instruments, secondary: ['pads'], notableAbsentElements: [] },
    drumStyle: { type: 'live drums', density: 'medium', description: 'gentle backbeat' },
    bassStyle: { type: 'electric bass', description: 'smooth root support' },
    harmonyStyle: { complexity: 'moderate', traits: ['diatonic pop chords'], description: 'warm pop harmony' },
    arrangementDensity: { verse: 'sparse', chorus: 'dense' },
    vocalPresence: 'high',
    productionTexture: { overall: 'warm', reverb: 'medium' },
    mixTraits: ['vocal-forward'],
    signatureArrangementMoves: ['gradual pre-chorus lift'],
    avoidElements: ['EDM drops'],
    sunoRelevantTraits: ['warm acoustic texture'],
    rawGoogleResponse: {},
    createdAt: '2026-05-27T00:00:00.000Z',
  };
}

describe('aggregateStyleDnaLocally', () => {
  it('calculates tempo range and shared instruments', () => {
    const dna = aggregateStyleDnaLocally('dna-1', 'Style DNA', [
      track('t1', 80, ['piano', 'strings']),
      track('t2', 88, ['piano', 'acoustic guitar']),
    ], '2026-05-27T00:00:00.000Z');

    expect(dna.tempoRange).toBe('80-88 BPM');
    expect(dna.primaryInstruments).toContain('piano');
    expect(dna.genre).toContain('Mandarin pop');
    expect(dna.avoidTags).toContain('EDM drops');
  });
});

