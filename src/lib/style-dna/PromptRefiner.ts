import type { GenerationFeedback, StyleDNA, SunoPromptPackage } from '@/types/style-dna';
import { composeSunoPromptPackage } from './PromptComposer';

interface RefineOptions {
  id: string;
  createdAt: string;
}

export function refinePromptPackage(
  dna: StyleDNA,
  previous: SunoPromptPackage,
  feedback: GenerationFeedback,
  options: RefineOptions,
): SunoPromptPackage {
  const avoidTags = [...dna.avoidTags];
  const strengthened: string[] = [];
  const summary: string[] = [];

  if (feedback.tooElectronic) {
    avoidTags.push('EDM drops', 'aggressive synth leads', 'overly synthetic texture');
    strengthened.push('more organic acoustic texture');
    summary.push('Reduced electronic texture');
  }
  if (feedback.tooRock) {
    avoidTags.push('heavy rock guitars', 'distorted guitar wall');
    summary.push('Reduced rock intensity');
  }
  if (feedback.tooGeneric) {
    strengthened.push('more specific instrumental motifs and arrangement moves');
    summary.push('Added more concrete arrangement detail');
  }
  if (feedback.drumsTooHeavy) {
    avoidTags.push('overpowering drums', 'aggressive percussion');
    summary.push('Softened drums');
  }
  if (feedback.chorusNotBigEnough) {
    strengthened.push('larger chorus with wider strings and emotional lift');
    summary.push('Strengthened chorus lift');
  }
  if (feedback.vocalNotForward) {
    strengthened.push('vocal-forward mix');
    summary.push('Moved vocal focus forward');
  }
  if (feedback.notMandarinPopEnough) {
    strengthened.push('modern Mandarin pop phrasing and polished Chinese pop arrangement');
    summary.push('Reinforced Mandarin pop identity');
  }
  if (feedback.harmonyTooSimple) {
    strengthened.push('richer pop harmony with tasteful seventh chords and passing chords');
    summary.push('Enriched harmony');
  }
  if (feedback.arrangementTooFlat) {
    strengthened.push('clearer verse to pre-chorus to chorus density progression');
    summary.push('Increased arrangement contrast');
  }
  if (feedback.emotionNotProgressive) {
    strengthened.push('more gradual emotional arc toward final chorus');
    summary.push('Improved emotional progression');
  }
  if (feedback.feedbackText) {
    strengthened.push(feedback.feedbackText);
    summary.push('Applied custom feedback');
  }

  const refinedDna: StyleDNA = {
    ...dna,
    sunoFriendlyStyleTags: [...dna.sunoFriendlyStyleTags, ...strengthened],
    avoidTags,
    version: dna.version + 1,
    updatedAt: options.createdAt,
  };

  return composeSunoPromptPackage(refinedDna, {
    id: options.id,
    title: previous.title,
    instrumental: previous.instrumental,
    createdAt: options.createdAt,
    promptVersion: previous.promptVersion + 1,
    changeSummary: summary.join('; ') || 'Created refined prompt version',
  });
}

