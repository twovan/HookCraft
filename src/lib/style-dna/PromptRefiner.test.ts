import { describe, expect, it } from 'vitest';
import { refinePromptPackage } from './PromptRefiner';
import type { GenerationFeedback, StyleDNA, SunoPromptPackage } from '@/types/style-dna';

const dna = {
  id: 'dna-1',
  name: 'DNA',
  sourceTrackIds: ['t1'],
  summary: 'summary',
  genre: ['Mandarin pop'],
  tempoRange: '80-90 BPM',
  keyMood: 'emotional minor mood',
  primaryInstruments: ['piano'],
  secondaryInstruments: ['strings'],
  drumPattern: 'gentle live drums',
  bassPattern: 'smooth bass',
  harmonyLanguage: 'moderate pop harmony',
  arrangementFormula: { chorus: 'wide chorus' },
  sectionStructure: {},
  productionTexture: 'warm polished production',
  emotionalArc: 'gradual lift',
  chinesePopSpecificTraits: [],
  sunoFriendlyStyleTags: [],
  avoidTags: [],
  highFrequencyTraits: [],
  lowFrequencyTraits: [],
  uncertainTraits: [],
  confidence: 0.8,
  version: 1,
  createdAt: '2026-05-27T00:00:00.000Z',
  updatedAt: '2026-05-27T00:00:00.000Z',
} satisfies StyleDNA;

const pkg = {
  id: 'pkg-1',
  styleDnaId: 'dna-1',
  title: 'Demo',
  stylePromptShort: 'short',
  stylePromptMedium: 'medium',
  stylePromptLong: 'long',
  stylePrompt: 'medium',
  lyricPrompt: '',
  instrumentalPrompt: '',
  structurePrompt: '[Chorus]\nwide chorus',
  negativePrompt: '',
  customMode: true,
  instrumental: false,
  providerPayload: { prompt: '', style: 'medium', title: 'Demo', customMode: true, instrumental: false, model: 'V5_5' },
  promptVersion: 1,
  createdAt: '2026-05-27T00:00:00.000Z',
} satisfies SunoPromptPackage;

describe('refinePromptPackage', () => {
  it('creates a new version and strengthens selected feedback dimensions', () => {
    const feedback = {
      id: 'fb-1',
      promptPackageId: 'pkg-1',
      styleDnaId: 'dna-1',
      tooElectronic: true,
      tooRock: false,
      tooGeneric: true,
      drumsTooHeavy: true,
      chorusNotBigEnough: true,
      vocalNotForward: false,
      notMandarinPopEnough: true,
      harmonyTooSimple: true,
      arrangementTooFlat: true,
      emotionNotProgressive: true,
      melodyMismatch: false,
      arrangementMismatch: false,
      vocalMismatch: false,
      structureMismatch: false,
      createdAt: '2026-05-27T00:00:00.000Z',
    } satisfies GenerationFeedback;

    const refined = refinePromptPackage(dna, pkg, feedback, {
      id: 'pkg-2',
      createdAt: '2026-05-27T00:01:00.000Z',
    });

    expect(refined.promptVersion).toBe(2);
    expect(refined.id).toBe('pkg-2');
    expect(refined.changeSummary).toContain('Reduced electronic texture');
    expect(refined.negativePrompt).toContain('EDM');
    expect(refined.stylePromptLong).toContain('larger chorus');
  });
});

