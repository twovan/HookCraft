import { describe, expect, it } from 'vitest';
import { composeSunoPromptPackage } from './PromptComposer';
import type { StyleDNA } from '@/types/style-dna';

const baseDna: StyleDNA = {
  id: 'dna-1',
  name: 'Warm cinematic pop',
  sourceTrackIds: ['track-1'],
  summary: 'Warm cinematic Mandarin pop ballad identity.',
  genre: ['Mandarin cinematic pop ballad'],
  tempoRange: '78-88 BPM',
  keyMood: 'minor-key emotional mood',
  primaryInstruments: ['piano', 'acoustic guitar', 'strings'],
  secondaryInstruments: ['warm pads', 'smooth electric bass'],
  drumPattern: 'gentle live drums with restrained fills',
  bassPattern: 'smooth electric bass supporting chord roots',
  harmonyLanguage: 'diatonic pop harmony with occasional seventh chords',
  arrangementFormula: {
    intro: 'soft piano motif',
    verse: 'sparse piano-led verse',
    pre_chorus: 'gradual lift with pads',
    chorus: 'wide strings and live drums',
    bridge: 'breakdown contrast',
    final_chorus: 'fuller emotional release',
  },
  sectionStructure: {},
  productionTexture: 'warm, polished, airy reverb, vocal-forward mix',
  emotionalArc: 'restrained opening building to a wide final chorus',
  chinesePopSpecificTraits: ['Mandarin pop melodic phrasing'],
  sunoFriendlyStyleTags: ['warm acoustic textures', 'cinematic strings'],
  avoidTags: ['EDM drops', 'trap beats', 'heavy rock guitars'],
  highFrequencyTraits: [],
  lowFrequencyTraits: [],
  uncertainTraits: [],
  confidence: 0.82,
  version: 1,
  createdAt: '2026-05-27T00:00:00.000Z',
  updatedAt: '2026-05-27T00:00:00.000Z',
};

describe('composeSunoPromptPackage', () => {
  it('creates style, structure, negative prompt, and provider payload', () => {
    const pkg = composeSunoPromptPackage(baseDna, {
      id: 'pkg-1',
      title: 'New Demo',
      instrumental: false,
      createdAt: '2026-05-27T00:00:00.000Z',
    });

    expect(pkg.stylePromptShort).toContain('Mandarin cinematic pop ballad');
    expect(pkg.stylePromptLong).toContain('78-88 BPM');
    expect(pkg.structurePrompt).toContain('[Chorus]');
    expect(pkg.negativePrompt).toContain('EDM drops');
    expect(pkg.providerPayload.customMode).toBe(true);
    expect(pkg.providerPayload.instrumental).toBe(false);
  });

  it('removes direct artist imitation language', () => {
    const pkg = composeSunoPromptPackage(
      { ...baseDna, summary: 'like Jay Chou, in the style of Taylor Swift' },
      { id: 'pkg-2', title: 'Safe Demo', instrumental: true, createdAt: '2026-05-27T00:00:00.000Z' },
    );

    expect(pkg.stylePromptLong.toLowerCase()).not.toContain('like jay chou');
    expect(pkg.stylePromptLong.toLowerCase()).not.toContain('taylor swift');
  });
});

