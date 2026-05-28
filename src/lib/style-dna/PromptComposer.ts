import type { StyleDNA, SunoPromptPackage } from '@/types/style-dna';
import { sanitizeCopyrightUnsafeText } from './safety';

interface ComposeOptions {
  id: string;
  title: string;
  instrumental: boolean;
  createdAt: string;
  promptVersion?: number;
  changeSummary?: string;
}

function joinList(values: string[], fallback: string) {
  return values.filter(Boolean).join(', ') || fallback;
}

function buildStructurePrompt(dna: StyleDNA) {
  const formula = dna.arrangementFormula || {};
  return [
    `[Intro]\n${formula.intro || 'Introduce the core motif with restrained texture.'}`,
    `[Verse]\n${formula.verse || 'Keep the verse sparse and focused.'}`,
    `[Pre-Chorus]\n${formula.pre_chorus || 'Build harmonic and rhythmic tension gradually.'}`,
    `[Chorus]\n${formula.chorus || 'Open into the main emotional hook with fuller arrangement.'}`,
    `[Bridge]\n${formula.bridge || 'Create contrast before the final lift.'}`,
    `[Final Chorus]\n${formula.final_chorus || 'Return wider and more emotionally resolved.'}`,
  ].join('\n\n');
}

export function composeSunoPromptPackage(dna: StyleDNA, options: ComposeOptions): SunoPromptPackage {
  const genre = joinList(dna.genre, 'modern Mandarin pop');
  const primary = joinList(dna.primaryInstruments, 'piano, guitar, bass, drums');
  const secondary = joinList(dna.secondaryInstruments, 'pads and subtle ear candy');
  const avoid = joinList(dna.avoidTags, 'artist imitation, copyrighted song references, muddy mix');
  const tags = joinList(dna.sunoFriendlyStyleTags, dna.summary);

  const stylePromptShort = sanitizeCopyrightUnsafeText(
    `${genre}, ${dna.tempoRange}, ${dna.keyMood}, ${primary}, ${dna.drumPattern}, ${dna.productionTexture}.`,
  );

  const stylePromptMedium = sanitizeCopyrightUnsafeText(
    `${genre} with ${tags}, ${dna.tempoRange}, ${dna.keyMood}, primary instruments: ${primary}, secondary colors: ${secondary}, drums: ${dna.drumPattern}, bass: ${dna.bassPattern}, harmony: ${dna.harmonyLanguage}, production: ${dna.productionTexture}.`,
  );

  const stylePromptLong = sanitizeCopyrightUnsafeText(
    `${stylePromptMedium} Arrangement arc: ${dna.emotionalArc}. Structure: ${Object.values(dna.arrangementFormula || {}).filter(Boolean).join('; ')}. Avoid ${avoid}.`,
  );

  const structurePrompt = buildStructurePrompt(dna);
  const negativePrompt = sanitizeCopyrightUnsafeText(`Avoid ${avoid}.`);
  const lyricPrompt = options.instrumental
    ? ''
    : `${structurePrompt}\n\nWrite original Mandarin lyrics that match the emotional arc. Do not reference existing songs or artists.`;
  const instrumentalPrompt = options.instrumental
    ? `${structurePrompt}\n\nInstrumental only. Focus on arrangement, melody, groove, and production texture.`
    : '';
  const prompt = options.instrumental ? instrumentalPrompt : lyricPrompt;

  return {
    id: options.id,
    styleDnaId: dna.id,
    title: options.title,
    stylePromptShort,
    stylePromptMedium,
    stylePromptLong,
    stylePrompt: stylePromptMedium,
    lyricPrompt,
    instrumentalPrompt,
    structurePrompt,
    negativePrompt,
    customMode: true,
    instrumental: options.instrumental,
    providerPayload: {
      prompt: `${prompt}\n\nAvoid: ${avoid}`,
      style: stylePromptMedium,
      title: options.title,
      negativeTags: negativePrompt,
      customMode: true,
      instrumental: options.instrumental,
      model: 'V5_5',
    },
    promptVersion: options.promptVersion ?? 1,
    changeSummary: options.changeSummary,
    createdAt: options.createdAt,
  };
}

