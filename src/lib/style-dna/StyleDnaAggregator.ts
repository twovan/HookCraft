import type { StyleDNA, TrackAnalysis } from '@/types/style-dna';

function unique(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function mostCommon(values: Array<string | undefined | null>, limit = 6) {
  const counts = new Map<string, number>();
  for (const value of values.map((item) => item?.trim() || '').filter(Boolean)) {
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([value]) => value);
}

export function aggregateStyleDnaLocally(
  id: string,
  name: string,
  analyses: TrackAnalysis[],
  now: string,
): StyleDNA {
  const bpms = analyses
    .map((analysis) => analysis.bpmEstimate)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  const minBpm = bpms.length ? Math.min(...bpms) : null;
  const maxBpm = bpms.length ? Math.max(...bpms) : null;

  const confidence = analyses.length === 0
    ? 0
    : Math.round((analyses.reduce((sum, item) => sum + item.confidence, 0) / analyses.length) * 100) / 100;

  const primary = mostCommon(analyses.flatMap((analysis) => analysis.instrumentation.primary));
  const secondary = mostCommon(analyses.flatMap((analysis) => analysis.instrumentation.secondary));
  const genres = mostCommon(analyses.flatMap((analysis) => analysis.genreCandidates), 4);
  const moods = mostCommon(analyses.flatMap((analysis) => analysis.moodTags), 6);

  return {
    id,
    name,
    sourceTrackIds: analyses.map((analysis) => analysis.sourceTrackId),
    summary: `${genres.join(', ') || 'Contemporary pop'} with ${moods.join(', ') || 'balanced emotional'} mood.`,
    genre: genres,
    tempoRange: minBpm !== null && maxBpm !== null ? `${minBpm}-${maxBpm} BPM` : 'unknown',
    keyMood: unique([analyses[0]?.mode || 'unknown', ...moods]).join(', '),
    primaryInstruments: primary,
    secondaryInstruments: secondary,
    drumPattern: mostCommon(analyses.map((analysis) => analysis.drumStyle.description), 2).join('; ') || 'unknown',
    bassPattern: mostCommon(analyses.map((analysis) => analysis.bassStyle.description), 2).join('; ') || 'unknown',
    harmonyLanguage: mostCommon(analyses.map((analysis) => analysis.harmonyStyle.description), 2).join('; ') || 'unknown',
    arrangementFormula: {
      intro: 'Introduce the core motif with restrained texture.',
      verse: mostCommon(analyses.map((analysis) => analysis.arrangementDensity.verse), 1)[0] || 'sparse',
      pre_chorus: 'Build gradually toward the chorus.',
      chorus: mostCommon(analyses.map((analysis) => analysis.arrangementDensity.chorus), 1)[0] || 'dense',
      bridge: 'Create contrast before the final chorus.',
      final_chorus: mostCommon(analyses.map((analysis) => analysis.arrangementDensity.final_chorus), 1)[0] || 'fuller',
    },
    sectionStructure: {},
    productionTexture: mostCommon(analyses.flatMap((analysis) => Object.values(analysis.productionTexture)), 5).join(', ') || 'unknown',
    emotionalArc: 'Gradual development from restrained opening to a fuller chorus.',
    chinesePopSpecificTraits: [],
    sunoFriendlyStyleTags: mostCommon(analyses.flatMap((analysis) => analysis.sunoRelevantTraits), 10),
    avoidTags: mostCommon(analyses.flatMap((analysis) => analysis.avoidElements), 10),
    highFrequencyTraits: mostCommon([
      ...genres,
      ...primary,
      ...analyses.flatMap((analysis) => analysis.signatureArrangementMoves),
    ], 10),
    lowFrequencyTraits: [],
    uncertainTraits: confidence < 0.65 ? ['Low confidence source analysis'] : [],
    confidence,
    version: 1,
    createdAt: now,
    updatedAt: now,
  };
}
