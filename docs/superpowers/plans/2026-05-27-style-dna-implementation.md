# Style DNA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an additive Style DNA workbench that analyzes uploaded reference tracks into structured JSON, aggregates reusable style profiles, composes copyright-safe Suno/Kie prompts, generates through the existing Kie provider, and preserves feedback-driven prompt versions.

**Architecture:** Keep existing upload/template/Suno flows intact. Add a new `style-dna` domain with focused types, pure prompt/composition/refinement modules, server route handlers backed by Supabase tables, and an independent Studio workbench page. Reuse `KieSunoProvider`, `CreditService`, `getAuthUser`, and existing generation task conventions.

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript, Supabase Postgres/Storage/Auth, `@google/genai`, Vitest, existing Kie/Suno API wrapper.

---

## File Structure

- Create `src/types/style-dna.ts`: shared domain types, statuses, provider payload shapes.
- Create `src/lib/style-dna/googlePrompts.ts`: strict JSON prompt templates for track analysis and aggregation.
- Create `src/lib/style-dna/jsonRepair.ts`: parse/extract Google JSON and normalize missing fields.
- Create `src/lib/style-dna/safety.ts`: strip artist/song imitation phrasing from final prompts.
- Create `src/lib/style-dna/PromptComposer.ts`: deterministic StyleDNA to SunoPromptPackage conversion.
- Create `src/lib/style-dna/StyleDnaAggregator.ts`: local aggregation helpers plus Google aggregation adapter boundary.
- Create `src/lib/style-dna/PromptRefiner.ts`: feedback to prompt V2 package.
- Create tests beside modules under `src/lib/style-dna/*.test.ts`.
- Create `supabase/migrations/011_style_dna.sql`: additive tables and indexes.
- Modify `src/lib/supabase/types.ts`: add generated-style table typings manually matching local project pattern.
- Create `src/lib/style-dna/StyleDnaRepository.ts`: Supabase persistence boundary for jobs, tracks, analyses, DNA, packages, feedback.
- Create `src/lib/style-dna/GoogleAudioAnalysisProvider.ts`: server-only Google provider wrapper.
- Create API routes:
  - `src/app/api/style-dna/analyze/route.ts`
  - `src/app/api/style-dna/[id]/route.ts`
  - `src/app/api/style-dna/[id]/compose/route.ts`
  - `src/app/api/style-dna/[id]/generate/route.ts`
  - `src/app/api/style-dna/[id]/feedback/route.ts`
- Create UI:
  - `src/app/studio/style-dna/page.tsx`
  - `src/components/studio/style-dna/StyleDnaWorkbench.tsx`
  - `src/components/studio/style-dna/StyleDnaWorkbench.css.ts` if inline styles become too large.

---

### Task 1: Domain Types And Prompt Templates

**Files:**
- Create: `src/types/style-dna.ts`
- Create: `src/lib/style-dna/googlePrompts.ts`

- [ ] **Step 1: Add domain types**

Create `src/types/style-dna.ts` with these exports:

```ts
export type StyleDnaJobStatus =
  | 'pending'
  | 'analyzing'
  | 'aggregating'
  | 'prompt_ready'
  | 'generating'
  | 'completed'
  | 'failed';

export type SourceTrackStatus = 'pending' | 'analyzing' | 'completed' | 'failed';
export type EnergyLevel = 'low' | 'medium' | 'high' | 'unknown';
export type Mode = 'major' | 'minor' | 'modal' | 'unknown';

export interface TrackAnalysis {
  id: string;
  sourceTrackId: string;
  title?: string;
  duration?: number | null;
  confidence: number;
  bpmEstimate?: number | null;
  bpmRange: string;
  keyEstimate: string;
  mode: Mode;
  genreCandidates: string[];
  moodTags: string[];
  energyCurve: Record<string, EnergyLevel>;
  sectionMap: Array<{
    section: string;
    startTime: string;
    endTime: string;
    arrangementNotes: string;
  }>;
  instrumentation: {
    primary: string[];
    secondary: string[];
    notableAbsentElements: string[];
  };
  drumStyle: { type: string; density: string; description: string };
  bassStyle: { type: string; description: string };
  harmonyStyle: { complexity: string; traits: string[]; description: string };
  arrangementDensity: Record<string, string>;
  vocalPresence: string;
  productionTexture: Record<string, string>;
  mixTraits: string[];
  signatureArrangementMoves: string[];
  avoidElements: string[];
  sunoRelevantTraits: string[];
  rawGoogleResponse: unknown;
  createdAt: string;
}

export interface StyleDNA {
  id: string;
  name: string;
  sourceTrackIds: string[];
  summary: string;
  genre: string[];
  tempoRange: string;
  keyMood: string;
  primaryInstruments: string[];
  secondaryInstruments: string[];
  drumPattern: string;
  bassPattern: string;
  harmonyLanguage: string;
  arrangementFormula: Record<string, string>;
  sectionStructure: Record<string, string>;
  productionTexture: string;
  emotionalArc: string;
  chinesePopSpecificTraits: string[];
  sunoFriendlyStyleTags: string[];
  avoidTags: string[];
  highFrequencyTraits: string[];
  lowFrequencyTraits: string[];
  uncertainTraits: string[];
  confidence: number;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface SunoProviderPayload {
  uploadUrl?: string;
  prompt: string;
  style: string;
  title: string;
  negativeTags?: string;
  customMode: boolean;
  instrumental: boolean;
  model: 'V5_5' | 'V5' | 'V4_5PLUS' | 'V4_5' | 'V4';
}

export interface SunoPromptPackage {
  id: string;
  styleDnaId: string;
  title: string;
  stylePromptShort: string;
  stylePromptMedium: string;
  stylePromptLong: string;
  stylePrompt: string;
  lyricPrompt: string;
  instrumentalPrompt: string;
  structurePrompt: string;
  negativePrompt: string;
  customMode: boolean;
  instrumental: boolean;
  providerPayload: SunoProviderPayload;
  promptVersion: number;
  changeSummary?: string;
  createdAt: string;
}

export interface GenerationFeedback {
  id: string;
  generationId?: string | null;
  promptPackageId: string;
  styleDnaId: string;
  rating?: number | null;
  feedbackText?: string | null;
  tooElectronic: boolean;
  tooRock: boolean;
  tooGeneric: boolean;
  drumsTooHeavy: boolean;
  chorusNotBigEnough: boolean;
  vocalNotForward: boolean;
  notMandarinPopEnough: boolean;
  harmonyTooSimple: boolean;
  arrangementTooFlat: boolean;
  emotionNotProgressive: boolean;
  melodyMismatch: boolean;
  arrangementMismatch: boolean;
  vocalMismatch: boolean;
  structureMismatch: boolean;
  suggestedChanges?: string | null;
  createdAt: string;
}
```

- [ ] **Step 2: Add Google prompt templates**

Create `src/lib/style-dna/googlePrompts.ts`:

```ts
import type { TrackAnalysis } from '@/types/style-dna';

export const TRACK_ANALYSIS_JSON_PROMPT = `You are a professional music arranger, producer, and music information retrieval analyst.

Analyze the uploaded reference track. Do not imitate any specific artist. Do not write a Suno prompt yet.

Return strict JSON only. No markdown. No commentary.

Focus on arrangement, production, instrumentation, rhythm, harmony, structure, and emotional development.

Schema:
{
  "track_summary": "short neutral description of the song",
  "confidence": 0.0,
  "estimated_bpm": 0,
  "bpm_range": "string",
  "estimated_key": "string or unknown",
  "mode": "major | minor | modal | unknown",
  "genre_candidates": ["string"],
  "mood_tags": ["string"],
  "energy_curve": {
    "intro": "low | medium | high | unknown",
    "verse": "low | medium | high | unknown",
    "pre_chorus": "low | medium | high | unknown",
    "chorus": "low | medium | high | unknown",
    "bridge": "low | medium | high | unknown",
    "final_chorus": "low | medium | high | unknown"
  },
  "section_map": [
    {
      "section": "Intro | Verse | Pre-Chorus | Chorus | Bridge | Outro | Unknown",
      "start_time": "mm:ss or unknown",
      "end_time": "mm:ss or unknown",
      "arrangement_notes": "string"
    }
  ],
  "instrumentation": {
    "primary": ["piano", "acoustic guitar", "electric guitar", "strings", "pad", "synth", "drums", "bass", "other"],
    "secondary": ["string"],
    "notable_absent_elements": ["string"]
  },
  "drum_style": {
    "type": "live drums | electronic drums | hybrid | percussion only | minimal | unknown",
    "density": "low | medium | high | unknown",
    "description": "string"
  },
  "bass_style": {
    "type": "electric bass | synth bass | 808 | acoustic bass | minimal | unknown",
    "description": "string"
  },
  "harmony_style": {
    "complexity": "simple | moderate | rich | unknown",
    "traits": ["seventh chords", "passing chords", "secondary dominants", "modal color", "diatonic pop chords", "unknown"],
    "description": "string"
  },
  "arrangement_density": {
    "verse": "sparse | medium | dense | unknown",
    "chorus": "sparse | medium | dense | unknown",
    "final_chorus": "sparse | medium | dense | unknown"
  },
  "production_texture": {
    "overall": "clean | warm | dark | bright | cinematic | lo-fi | glossy | organic | electronic | unknown",
    "reverb": "dry | medium | wide | unknown",
    "stereo_width": "narrow | medium | wide | unknown",
    "vocal_forwardness": "low | medium | high | unknown"
  },
  "signature_arrangement_moves": ["specific reusable arrangement traits, not artist names"],
  "suno_relevant_traits": ["short phrases that would help a text-to-music model understand the style"],
  "avoid_elements": ["elements that should be avoided when recreating the broad style"]
}

Rules:
- Do not mention copyrighted artist names.
- Do not claim certainty when unsure.
- Prefer reusable musical traits over subjective praise.
- Be specific about instruments, rhythm, density, and section development.
- If a value cannot be inferred, use "unknown" instead of guessing.`;

export function buildStyleDnaAggregationPrompt(analyses: TrackAnalysis[]) {
  return `You are a senior music producer and prompt engineer for text-to-music generation.

You will receive multiple structured track analyses. Your job is to extract the shared style DNA.

Do not imitate any specific artist. Do not mention artist names. Do not mention song titles in the final style description.

Return strict JSON only.

Schema:
{
  "summary": "one paragraph describing the shared musical identity",
  "confidence": 0.0,
  "genre": ["string"],
  "tempo_range": "string",
  "key_mood": "string",
  "primary_instruments": ["string"],
  "secondary_instruments": ["string"],
  "drum_pattern": "string",
  "bass_pattern": "string",
  "harmony_language": "string",
  "arrangement_formula": {
    "intro": "string",
    "verse": "string",
    "pre_chorus": "string",
    "chorus": "string",
    "bridge": "string",
    "final_chorus": "string"
  },
  "production_texture": "string",
  "emotional_arc": "string",
  "suno_friendly_style_tags": ["string"],
  "avoid_tags": ["string"],
  "high_frequency_traits": ["string"],
  "low_frequency_traits": ["string"],
  "uncertain_traits": ["string"]
}

Input analyses:
${JSON.stringify(analyses, null, 2)}`;
}
```

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck`

Expected: Passes or fails only on unrelated existing dirty-worktree issues. Do not fix unrelated files in this task.

---

### Task 2: JSON Parsing, Safety, And Composer Tests

**Files:**
- Create: `src/lib/style-dna/jsonRepair.ts`
- Create: `src/lib/style-dna/safety.ts`
- Create: `src/lib/style-dna/PromptComposer.ts`
- Test: `src/lib/style-dna/jsonRepair.test.ts`
- Test: `src/lib/style-dna/PromptComposer.test.ts`

- [ ] **Step 1: Write JSON parser tests**

Create `src/lib/style-dna/jsonRepair.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { parseStrictJsonObject } from './jsonRepair';

describe('parseStrictJsonObject', () => {
  it('parses strict JSON directly', () => {
    expect(parseStrictJsonObject('{"confidence":0.8,"genre_candidates":["pop"]}')).toEqual({
      confidence: 0.8,
      genre_candidates: ['pop'],
    });
  });

  it('extracts JSON from markdown fences', () => {
    const result = parseStrictJsonObject('```json\n{"estimated_key":"unknown"}\n```');
    expect(result).toEqual({ estimated_key: 'unknown' });
  });

  it('throws a useful error for non JSON output', () => {
    expect(() => parseStrictJsonObject('I hear a warm pop song.')).toThrow('Google response did not contain a JSON object');
  });
});
```

- [ ] **Step 2: Write composer copyright-safety tests**

Create `src/lib/style-dna/PromptComposer.test.ts`:

```ts
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
```

- [ ] **Step 3: Run tests and verify they fail**

Run: `npm run test -- src/lib/style-dna/jsonRepair.test.ts src/lib/style-dna/PromptComposer.test.ts`

Expected: FAIL because implementation files do not exist yet.

- [ ] **Step 4: Implement JSON parser**

Create `src/lib/style-dna/jsonRepair.ts`:

```ts
export function parseStrictJsonObject(raw: string): Record<string, unknown> {
  const trimmed = raw.trim();
  const unfenced = trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  const candidates = [unfenced];
  const firstBrace = unfenced.indexOf('{');
  const lastBrace = unfenced.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    candidates.push(unfenced.slice(firstBrace, lastBrace + 1));
  }

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      continue;
    }
  }

  throw new Error('Google response did not contain a JSON object');
}

export function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter(Boolean);
}

export function asNumber(value: unknown, fallback: number | null = null): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function clampConfidence(value: unknown): number {
  const parsed = asNumber(value, 0);
  return Math.max(0, Math.min(1, parsed ?? 0));
}
```

- [ ] **Step 5: Implement safety helper**

Create `src/lib/style-dna/safety.ts`:

```ts
const BLOCKED_NAME_PATTERNS = [
  /\blike\s+[A-Z][A-Za-z0-9.' -]{1,40}/g,
  /\bin the style of\s+[A-Z][A-Za-z0-9.' -]{1,40}/gi,
  /\bsimilar to\s+[A-Z][A-Za-z0-9.' -]{1,40}/gi,
  /\b[a-z]+core\s+version of\s+[A-Z][A-Za-z0-9.' -]{1,40}/gi,
  /\bJay Chou\b/gi,
  /\bTaylor Swift\b/gi,
];

export function sanitizeCopyrightUnsafeText(input: string): string {
  let output = input;
  for (const pattern of BLOCKED_NAME_PATTERNS) {
    output = output.replace(pattern, 'copyright-safe broad musical traits');
  }
  return output.replace(/\s+/g, ' ').trim();
}
```

- [ ] **Step 6: Implement composer**

Create `src/lib/style-dna/PromptComposer.ts`:

```ts
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
```

- [ ] **Step 7: Run tests and typecheck**

Run: `npm run test -- src/lib/style-dna/jsonRepair.test.ts src/lib/style-dna/PromptComposer.test.ts`

Expected: PASS.

Run: `npm run typecheck`

Expected: PASS or only unrelated existing dirty-worktree errors.

---

### Task 3: Aggregation And Feedback Refinement

**Files:**
- Create: `src/lib/style-dna/StyleDnaAggregator.ts`
- Create: `src/lib/style-dna/PromptRefiner.ts`
- Test: `src/lib/style-dna/StyleDnaAggregator.test.ts`
- Test: `src/lib/style-dna/PromptRefiner.test.ts`

- [ ] **Step 1: Write aggregator tests**

Create `src/lib/style-dna/StyleDnaAggregator.test.ts`:

```ts
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
```

- [ ] **Step 2: Write refiner tests**

Create `src/lib/style-dna/PromptRefiner.test.ts`:

```ts
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
```

- [ ] **Step 3: Run tests and verify they fail**

Run: `npm run test -- src/lib/style-dna/StyleDnaAggregator.test.ts src/lib/style-dna/PromptRefiner.test.ts`

Expected: FAIL because implementation files do not exist.

- [ ] **Step 4: Implement local aggregation**

Create `src/lib/style-dna/StyleDnaAggregator.ts`:

```ts
import type { StyleDNA, TrackAnalysis } from '@/types/style-dna';

function unique(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function mostCommon(values: string[], limit = 6) {
  const counts = new Map<string, number>();
  for (const value of values.map((item) => item.trim()).filter(Boolean)) {
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
```

- [ ] **Step 5: Implement prompt refiner**

Create `src/lib/style-dna/PromptRefiner.ts`:

```ts
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
```

- [ ] **Step 6: Run focused tests**

Run: `npm run test -- src/lib/style-dna/StyleDnaAggregator.test.ts src/lib/style-dna/PromptRefiner.test.ts`

Expected: PASS.

---

### Task 4: Database Migration And Repository

**Files:**
- Create: `supabase/migrations/011_style_dna.sql`
- Create: `src/lib/style-dna/StyleDnaRepository.ts`
- Test: `src/lib/style-dna/StyleDnaRepository.test.ts`

- [ ] **Step 1: Add migration**

Create `supabase/migrations/011_style_dna.sql` with the additive tables from the design spec. Use `TEXT` for status fields to avoid enum migration risk:

```sql
CREATE TABLE IF NOT EXISTS style_dna_jobs (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_style_dna_jobs_user_id ON style_dna_jobs(user_id);

CREATE TABLE IF NOT EXISTS style_dna_source_tracks (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES style_dna_jobs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  public_url TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  duration_seconds NUMERIC,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_style_dna_source_tracks_job_id ON style_dna_source_tracks(job_id);

CREATE TABLE IF NOT EXISTS track_analyses (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES style_dna_jobs(id) ON DELETE CASCADE,
  source_track_id TEXT NOT NULL REFERENCES style_dna_source_tracks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT,
  duration NUMERIC,
  confidence NUMERIC NOT NULL DEFAULT 0,
  bpm_estimate NUMERIC,
  bpm_range TEXT NOT NULL DEFAULT 'unknown',
  key_estimate TEXT NOT NULL DEFAULT 'unknown',
  mode TEXT NOT NULL DEFAULT 'unknown',
  genre_candidates TEXT[] NOT NULL DEFAULT '{}',
  mood_tags TEXT[] NOT NULL DEFAULT '{}',
  energy_curve JSONB NOT NULL DEFAULT '{}',
  section_map JSONB NOT NULL DEFAULT '[]',
  instrumentation JSONB NOT NULL DEFAULT '{}',
  drum_style JSONB NOT NULL DEFAULT '{}',
  bass_style JSONB NOT NULL DEFAULT '{}',
  harmony_style JSONB NOT NULL DEFAULT '{}',
  arrangement_density JSONB NOT NULL DEFAULT '{}',
  vocal_presence TEXT NOT NULL DEFAULT 'unknown',
  production_texture JSONB NOT NULL DEFAULT '{}',
  mix_traits TEXT[] NOT NULL DEFAULT '{}',
  signature_arrangement_moves TEXT[] NOT NULL DEFAULT '{}',
  avoid_elements TEXT[] NOT NULL DEFAULT '{}',
  raw_google_response JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_track_analyses_job_id ON track_analyses(job_id);

CREATE TABLE IF NOT EXISTS style_dnas (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES style_dna_jobs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  source_track_ids TEXT[] NOT NULL DEFAULT '{}',
  summary TEXT NOT NULL DEFAULT '',
  genre TEXT[] NOT NULL DEFAULT '{}',
  tempo_range TEXT NOT NULL DEFAULT 'unknown',
  key_mood TEXT NOT NULL DEFAULT 'unknown',
  primary_instruments TEXT[] NOT NULL DEFAULT '{}',
  secondary_instruments TEXT[] NOT NULL DEFAULT '{}',
  drum_pattern TEXT NOT NULL DEFAULT 'unknown',
  bass_pattern TEXT NOT NULL DEFAULT 'unknown',
  harmony_language TEXT NOT NULL DEFAULT 'unknown',
  arrangement_formula JSONB NOT NULL DEFAULT '{}',
  section_structure JSONB NOT NULL DEFAULT '{}',
  production_texture TEXT NOT NULL DEFAULT 'unknown',
  emotional_arc TEXT NOT NULL DEFAULT '',
  chinese_pop_specific_traits TEXT[] NOT NULL DEFAULT '{}',
  suno_friendly_style_tags TEXT[] NOT NULL DEFAULT '{}',
  avoid_tags TEXT[] NOT NULL DEFAULT '{}',
  high_frequency_traits TEXT[] NOT NULL DEFAULT '{}',
  low_frequency_traits TEXT[] NOT NULL DEFAULT '{}',
  uncertain_traits TEXT[] NOT NULL DEFAULT '{}',
  confidence NUMERIC NOT NULL DEFAULT 0,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_style_dnas_job_id ON style_dnas(job_id);

CREATE TABLE IF NOT EXISTS suno_prompt_packages (
  id TEXT PRIMARY KEY,
  style_dna_id TEXT NOT NULL REFERENCES style_dnas(id) ON DELETE CASCADE,
  job_id TEXT NOT NULL REFERENCES style_dna_jobs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  style_prompt_short TEXT NOT NULL,
  style_prompt_medium TEXT NOT NULL,
  style_prompt_long TEXT NOT NULL,
  style_prompt TEXT NOT NULL,
  lyric_prompt TEXT NOT NULL DEFAULT '',
  instrumental_prompt TEXT NOT NULL DEFAULT '',
  structure_prompt TEXT NOT NULL DEFAULT '',
  negative_prompt TEXT NOT NULL DEFAULT '',
  custom_mode BOOLEAN NOT NULL DEFAULT true,
  instrumental BOOLEAN NOT NULL DEFAULT false,
  provider_payload JSONB NOT NULL DEFAULT '{}',
  prompt_version INTEGER NOT NULL DEFAULT 1,
  change_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_suno_prompt_packages_style_dna_id ON suno_prompt_packages(style_dna_id);

CREATE TABLE IF NOT EXISTS generation_feedback (
  id TEXT PRIMARY KEY,
  generation_id TEXT,
  prompt_package_id TEXT NOT NULL REFERENCES suno_prompt_packages(id) ON DELETE CASCADE,
  style_dna_id TEXT NOT NULL REFERENCES style_dnas(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating INTEGER,
  feedback_text TEXT,
  too_electronic BOOLEAN NOT NULL DEFAULT false,
  too_rock BOOLEAN NOT NULL DEFAULT false,
  too_generic BOOLEAN NOT NULL DEFAULT false,
  drums_too_heavy BOOLEAN NOT NULL DEFAULT false,
  chorus_not_big_enough BOOLEAN NOT NULL DEFAULT false,
  vocal_not_forward BOOLEAN NOT NULL DEFAULT false,
  not_mandarin_pop_enough BOOLEAN NOT NULL DEFAULT false,
  harmony_too_simple BOOLEAN NOT NULL DEFAULT false,
  arrangement_too_flat BOOLEAN NOT NULL DEFAULT false,
  emotion_not_progressive BOOLEAN NOT NULL DEFAULT false,
  melody_mismatch BOOLEAN NOT NULL DEFAULT false,
  arrangement_mismatch BOOLEAN NOT NULL DEFAULT false,
  vocal_mismatch BOOLEAN NOT NULL DEFAULT false,
  structure_mismatch BOOLEAN NOT NULL DEFAULT false,
  suggested_changes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_generation_feedback_style_dna_id ON generation_feedback(style_dna_id);
```

- [ ] **Step 2: Write repository tests**

Create `src/lib/style-dna/StyleDnaRepository.test.ts` with a mock Supabase client that verifies table names:

```ts
import { describe, expect, it, vi } from 'vitest';
import { StyleDnaRepository } from './StyleDnaRepository';

describe('StyleDnaRepository', () => {
  it('creates a job in style_dna_jobs', async () => {
    const insert = vi.fn().mockReturnValue({ select: () => ({ single: () => ({ data: { id: 'job-1' }, error: null }) }) });
    const from = vi.fn().mockReturnValue({ insert });
    const repo = new StyleDnaRepository({ from } as any);

    await repo.createJob({ id: 'job-1', userId: 'user-1', name: 'My DNA', now: '2026-05-27T00:00:00.000Z' });

    expect(from).toHaveBeenCalledWith('style_dna_jobs');
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      id: 'job-1',
      user_id: 'user-1',
      name: 'My DNA',
      status: 'pending',
    }));
  });
});
```

- [ ] **Step 3: Implement repository shell**

Create `src/lib/style-dna/StyleDnaRepository.ts`:

```ts
import type { SupabaseClient } from '@supabase/supabase-js';

export class StyleDnaRepository {
  constructor(private supabase: SupabaseClient<any>) {}

  async createJob(input: { id: string; userId: string; name: string; now: string }) {
    const { data, error } = await this.supabase
      .from('style_dna_jobs')
      .insert({
        id: input.id,
        user_id: input.userId,
        name: input.name,
        status: 'pending',
        created_at: input.now,
        updated_at: input.now,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }
}
```

- [ ] **Step 4: Run repository test**

Run: `npm run test -- src/lib/style-dna/StyleDnaRepository.test.ts`

Expected: PASS.

---

### Task 5: Google Audio Provider And Analysis Route

**Files:**
- Create: `src/lib/style-dna/GoogleAudioAnalysisProvider.ts`
- Modify: `src/lib/style-dna/StyleDnaRepository.ts`
- Create: `src/app/api/style-dna/analyze/route.ts`

- [ ] **Step 1: Implement provider**

Create `src/lib/style-dna/GoogleAudioAnalysisProvider.ts`:

```ts
import { GoogleGenAI } from '@google/genai';
import { TRACK_ANALYSIS_JSON_PROMPT, buildStyleDnaAggregationPrompt } from './googlePrompts';
import { parseStrictJsonObject } from './jsonRepair';
import type { TrackAnalysis } from '@/types/style-dna';

export class GoogleAudioAnalysisProvider {
  private ai: GoogleGenAI;

  constructor(apiKey = process.env.GEMINI_API_KEY || '') {
    if (!apiKey) throw new Error('GEMINI_API_KEY is not configured');
    this.ai = new GoogleGenAI({ apiKey });
  }

  async analyzeTrack(input: { audioBase64: string; mimeType: string }) {
    const response = await this.ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [{
        role: 'user',
        parts: [
          { inlineData: { mimeType: input.mimeType, data: input.audioBase64 } },
          { text: TRACK_ANALYSIS_JSON_PROMPT },
        ],
      }],
    });

    const text = response.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('') || '';
    return parseStrictJsonObject(text);
  }

  async aggregate(analyses: TrackAnalysis[]) {
    const response = await this.ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [{ role: 'user', parts: [{ text: buildStyleDnaAggregationPrompt(analyses) }] }],
    });

    const text = response.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('') || '';
    return parseStrictJsonObject(text);
  }
}
```

- [ ] **Step 2: Expand repository methods**

Add methods to `StyleDnaRepository`:

```ts
async updateJobStatus(id: string, userId: string, status: string, errorMessage?: string) {
  const { error } = await this.supabase
    .from('style_dna_jobs')
    .update({ status, error_message: errorMessage || null, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId);
  if (error) throw error;
}

async createSourceTrack(row: Record<string, unknown>) {
  const { data, error } = await this.supabase.from('style_dna_source_tracks').insert(row).select().single();
  if (error) throw error;
  return data;
}

async createTrackAnalysis(row: Record<string, unknown>) {
  const { data, error } = await this.supabase.from('track_analyses').insert(row).select().single();
  if (error) throw error;
  return data;
}

async createStyleDna(row: Record<string, unknown>) {
  const { data, error } = await this.supabase.from('style_dnas').insert(row).select().single();
  if (error) throw error;
  return data;
}

async createPromptPackage(row: Record<string, unknown>) {
  const { data, error } = await this.supabase.from('suno_prompt_packages').insert(row).select().single();
  if (error) throw error;
  return data;
}
```

- [ ] **Step 3: Implement analyze route**

Create `src/app/api/style-dna/analyze/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/supabase/auth-helpers';
import { supabaseAdmin } from '@/lib/supabase/server';
import { StyleDnaRepository } from '@/lib/style-dna/StyleDnaRepository';
import { GoogleAudioAnalysisProvider } from '@/lib/style-dna/GoogleAudioAnalysisProvider';
import { aggregateStyleDnaLocally } from '@/lib/style-dna/StyleDnaAggregator';
import { composeSunoPromptPackage } from '@/lib/style-dna/PromptComposer';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const MAX_TRACKS = 5;
const MAX_FILE_SIZE = 50 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/wave']);

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Please sign in first' }, { status: 401 });

  const formData = await req.formData();
  const files = formData.getAll('files').filter((value): value is File => value instanceof File);
  const name = String(formData.get('name') || 'Style DNA').trim() || 'Style DNA';
  const instrumental = String(formData.get('instrumental') || 'false') === 'true';

  if (files.length < 1) return NextResponse.json({ error: 'Upload at least one reference track' }, { status: 400 });
  if (files.length > MAX_TRACKS) return NextResponse.json({ error: `Upload no more than ${MAX_TRACKS} tracks` }, { status: 400 });
  for (const file of files) {
    if (!ALLOWED_TYPES.has(file.type)) return NextResponse.json({ error: 'Only MP3/WAV audio is supported' }, { status: 400 });
    if (file.size > MAX_FILE_SIZE) return NextResponse.json({ error: 'Each file must be 50MB or smaller' }, { status: 400 });
  }

  const now = new Date().toISOString();
  const jobId = createId('style-job');
  const repo = new StyleDnaRepository(supabaseAdmin as any);
  const provider = new GoogleAudioAnalysisProvider();

  await repo.createJob({ id: jobId, userId: user.id, name, now });
  await repo.updateJobStatus(jobId, user.id, 'analyzing');

  try {
    const analyses = [];
    for (const [index, file] of files.entries()) {
      const sourceTrackId = createId('style-track');
      const ext = file.name.split('.').pop() || 'mp3';
      const storagePath = `${user.id}/style-dna/${jobId}/${sourceTrackId}.${ext}`;
      const buffer = Buffer.from(await file.arrayBuffer());

      const { error: uploadError } = await supabaseAdmin.storage.from('generations').upload(storagePath, buffer, {
        upsert: true,
        contentType: file.type,
      });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabaseAdmin.storage.from('generations').getPublicUrl(storagePath);
      await repo.createSourceTrack({
        id: sourceTrackId,
        job_id: jobId,
        user_id: user.id,
        file_name: file.name,
        storage_path: storagePath,
        public_url: urlData.publicUrl,
        mime_type: file.type,
        size_bytes: file.size,
        status: 'analyzing',
        created_at: now,
      });

      const raw = await provider.analyzeTrack({ audioBase64: buffer.toString('base64'), mimeType: file.type });
      const analysis = {
        id: createId('track-analysis'),
        sourceTrackId,
        title: file.name,
        duration: null,
        confidence: Number(raw.confidence || 0),
        bpmEstimate: Number(raw.estimated_bpm || 0) || null,
        bpmRange: String(raw.bpm_range || 'unknown'),
        keyEstimate: String(raw.estimated_key || 'unknown'),
        mode: raw.mode === 'major' || raw.mode === 'minor' || raw.mode === 'modal' ? raw.mode : 'unknown',
        genreCandidates: Array.isArray(raw.genre_candidates) ? raw.genre_candidates.map(String) : [],
        moodTags: Array.isArray(raw.mood_tags) ? raw.mood_tags.map(String) : [],
        energyCurve: typeof raw.energy_curve === 'object' && raw.energy_curve ? raw.energy_curve as any : {},
        sectionMap: Array.isArray(raw.section_map) ? raw.section_map.map((section: any) => ({
          section: String(section.section || 'Unknown'),
          startTime: String(section.start_time || 'unknown'),
          endTime: String(section.end_time || 'unknown'),
          arrangementNotes: String(section.arrangement_notes || ''),
        })) : [],
        instrumentation: raw.instrumentation as any || { primary: [], secondary: [], notableAbsentElements: [] },
        drumStyle: raw.drum_style as any || { type: 'unknown', density: 'unknown', description: '' },
        bassStyle: raw.bass_style as any || { type: 'unknown', description: '' },
        harmonyStyle: raw.harmony_style as any || { complexity: 'unknown', traits: [], description: '' },
        arrangementDensity: raw.arrangement_density as any || {},
        vocalPresence: String((raw.production_texture as any)?.vocal_forwardness || 'unknown'),
        productionTexture: raw.production_texture as any || {},
        mixTraits: [],
        signatureArrangementMoves: Array.isArray(raw.signature_arrangement_moves) ? raw.signature_arrangement_moves.map(String) : [],
        avoidElements: Array.isArray(raw.avoid_elements) ? raw.avoid_elements.map(String) : [],
        sunoRelevantTraits: Array.isArray(raw.suno_relevant_traits) ? raw.suno_relevant_traits.map(String) : [],
        rawGoogleResponse: raw,
        createdAt: now,
      };

      analyses.push(analysis);
      await repo.createTrackAnalysis({
        id: analysis.id,
        job_id: jobId,
        source_track_id: sourceTrackId,
        user_id: user.id,
        title: analysis.title,
        duration: analysis.duration,
        confidence: analysis.confidence,
        bpm_estimate: analysis.bpmEstimate,
        bpm_range: analysis.bpmRange,
        key_estimate: analysis.keyEstimate,
        mode: analysis.mode,
        genre_candidates: analysis.genreCandidates,
        mood_tags: analysis.moodTags,
        energy_curve: analysis.energyCurve,
        section_map: analysis.sectionMap,
        instrumentation: analysis.instrumentation,
        drum_style: analysis.drumStyle,
        bass_style: analysis.bassStyle,
        harmony_style: analysis.harmonyStyle,
        arrangement_density: analysis.arrangementDensity,
        vocal_presence: analysis.vocalPresence,
        production_texture: analysis.productionTexture,
        mix_traits: analysis.mixTraits,
        signature_arrangement_moves: analysis.signatureArrangementMoves,
        avoid_elements: analysis.avoidElements,
        raw_google_response: analysis.rawGoogleResponse,
        created_at: now,
      });
    }

    await repo.updateJobStatus(jobId, user.id, 'aggregating');
    const dna = aggregateStyleDnaLocally(createId('style-dna'), name, analyses, now);
    const pkg = composeSunoPromptPackage(dna, { id: createId('suno-pkg'), title: name, instrumental, createdAt: now });
    await repo.createStyleDna({
      id: dna.id,
      job_id: jobId,
      user_id: user.id,
      name: dna.name,
      source_track_ids: dna.sourceTrackIds,
      summary: dna.summary,
      genre: dna.genre,
      tempo_range: dna.tempoRange,
      key_mood: dna.keyMood,
      primary_instruments: dna.primaryInstruments,
      secondary_instruments: dna.secondaryInstruments,
      drum_pattern: dna.drumPattern,
      bass_pattern: dna.bassPattern,
      harmony_language: dna.harmonyLanguage,
      arrangement_formula: dna.arrangementFormula,
      section_structure: dna.sectionStructure,
      production_texture: dna.productionTexture,
      emotional_arc: dna.emotionalArc,
      chinese_pop_specific_traits: dna.chinesePopSpecificTraits,
      suno_friendly_style_tags: dna.sunoFriendlyStyleTags,
      avoid_tags: dna.avoidTags,
      high_frequency_traits: dna.highFrequencyTraits,
      low_frequency_traits: dna.lowFrequencyTraits,
      uncertain_traits: dna.uncertainTraits,
      confidence: dna.confidence,
      version: dna.version,
      created_at: dna.createdAt,
      updated_at: dna.updatedAt,
    });
    await repo.createPromptPackage({
      id: pkg.id,
      style_dna_id: dna.id,
      job_id: jobId,
      user_id: user.id,
      title: pkg.title,
      style_prompt_short: pkg.stylePromptShort,
      style_prompt_medium: pkg.stylePromptMedium,
      style_prompt_long: pkg.stylePromptLong,
      style_prompt: pkg.stylePrompt,
      lyric_prompt: pkg.lyricPrompt,
      instrumental_prompt: pkg.instrumentalPrompt,
      structure_prompt: pkg.structurePrompt,
      negative_prompt: pkg.negativePrompt,
      custom_mode: pkg.customMode,
      instrumental: pkg.instrumental,
      provider_payload: pkg.providerPayload,
      prompt_version: pkg.promptVersion,
      change_summary: pkg.changeSummary || null,
      created_at: pkg.createdAt,
    });
    await repo.updateJobStatus(jobId, user.id, 'prompt_ready');

    return NextResponse.json({ jobId, styleDna: dna, promptPackage: pkg, analyses });
  } catch (error: any) {
    await repo.updateJobStatus(jobId, user.id, 'failed', error?.message || 'Style DNA analysis failed');
    return NextResponse.json({ error: error?.message || 'Style DNA analysis failed', jobId }, { status: 500 });
  }
}
```

- [ ] **Step 4: Run typecheck**

Run: `npm run typecheck`

Expected: Fix only errors caused by new files.

---

### Task 6: Read, Compose, Feedback, And Generate Routes

**Files:**
- Modify: `src/lib/style-dna/StyleDnaRepository.ts`
- Create: `src/app/api/style-dna/[id]/route.ts`
- Create: `src/app/api/style-dna/[id]/compose/route.ts`
- Create: `src/app/api/style-dna/[id]/feedback/route.ts`
- Create: `src/app/api/style-dna/[id]/generate/route.ts`

- [ ] **Step 1: Add repository read methods**

Add methods:

```ts
async getJobBundle(jobId: string, userId: string) {
  const [job, tracks, analyses, dnas, packages] = await Promise.all([
    this.supabase.from('style_dna_jobs').select('*').eq('id', jobId).eq('user_id', userId).maybeSingle(),
    this.supabase.from('style_dna_source_tracks').select('*').eq('job_id', jobId).eq('user_id', userId),
    this.supabase.from('track_analyses').select('*').eq('job_id', jobId).eq('user_id', userId),
    this.supabase.from('style_dnas').select('*').eq('job_id', jobId).eq('user_id', userId).order('version', { ascending: false }),
    this.supabase.from('suno_prompt_packages').select('*').eq('job_id', jobId).eq('user_id', userId).order('prompt_version', { ascending: false }),
  ]);
  if (job.error) throw job.error;
  if (tracks.error) throw tracks.error;
  if (analyses.error) throw analyses.error;
  if (dnas.error) throw dnas.error;
  if (packages.error) throw packages.error;
  return { job: job.data, tracks: tracks.data || [], analyses: analyses.data || [], styleDnas: dnas.data || [], promptPackages: packages.data || [] };
}
```

- [ ] **Step 2: Implement GET/PATCH bundle route**

Create `src/app/api/style-dna/[id]/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/supabase/auth-helpers';
import { supabaseAdmin } from '@/lib/supabase/server';
import { StyleDnaRepository } from '@/lib/style-dna/StyleDnaRepository';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Please sign in first' }, { status: 401 });
  const { id } = await params;
  const repo = new StyleDnaRepository(supabaseAdmin as any);
  const bundle = await repo.getJobBundle(id, user.id);
  return NextResponse.json(bundle);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Please sign in first' }, { status: 401 });
  const { id } = await params;
  const body = await req.json();
  const { error } = await supabaseAdmin
    .from('style_dnas')
    .update({
      genre: body.genre,
      tempo_range: body.tempoRange,
      key_mood: body.keyMood,
      primary_instruments: body.primaryInstruments,
      secondary_instruments: body.secondaryInstruments,
      drum_pattern: body.drumPattern,
      bass_pattern: body.bassPattern,
      harmony_language: body.harmonyLanguage,
      arrangement_formula: body.arrangementFormula,
      production_texture: body.productionTexture,
      avoid_tags: body.avoidTags,
      updated_at: new Date().toISOString(),
    } as any)
    .eq('job_id', id)
    .eq('user_id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
```

- [ ] **Step 3: Implement compose route**

Create `src/app/api/style-dna/[id]/compose/route.ts` using latest `style_dnas`, `composeSunoPromptPackage`, and `repo.createPromptPackage`.

- [ ] **Step 4: Implement feedback route**

Create `src/app/api/style-dna/[id]/feedback/route.ts` to insert `generation_feedback`, load latest DNA/package, call `refinePromptPackage`, and save the new package.

- [ ] **Step 5: Implement generate route**

Create `src/app/api/style-dna/[id]/generate/route.ts` to:

1. Auth user.
2. Load latest package and first source track.
3. Create `generation_batches` and `generation_tasks`.
4. Call `KieSunoProvider.uploadAndCover` with `uploadUrl`, `prompt`, `style`, `title`, `negativeTags`, `customMode`, `instrumental`, `model`.
5. Save `raw_audio_path = kie:${result.taskId}`.
6. Return `taskId`, `localTaskId`, `batchId`, and `/api/kie/upload-cover/status` polling compatibility.

- [ ] **Step 6: Run typecheck**

Run: `npm run typecheck`

Expected: Fix only errors introduced by these routes.

---

### Task 7: Style DNA Workbench UI

**Files:**
- Create: `src/app/studio/style-dna/page.tsx`
- Create: `src/components/studio/style-dna/StyleDnaWorkbench.tsx`

- [ ] **Step 1: Create page wrapper**

Create `src/app/studio/style-dna/page.tsx`:

```tsx
import StyleDnaWorkbench from '@/components/studio/style-dna/StyleDnaWorkbench';

export default function StyleDnaPage() {
  return <StyleDnaWorkbench />;
}
```

- [ ] **Step 2: Build client workbench**

Create `StyleDnaWorkbench.tsx` as a client component with:

- file input supporting multiple files
- upload/analyze submit button
- three panel desktop grid
- mobile stacked layout via CSS media query
- editable inputs for StyleDNA fields
- prompt preview and copy buttons
- generate and feedback buttons

Use the existing dark HookCraft CSS variables (`--hc-bg`, `--hc-panel`, `--hc-border`, `--hc-text`, `--hc-text-muted`, `--hc-lime`) and avoid nested cards.

- [ ] **Step 3: Wire API calls**

Implement local handlers:

```ts
async function handleAnalyze(files: File[]) {
  const formData = new FormData();
  formData.append('name', name || 'Style DNA');
  formData.append('instrumental', String(instrumental));
  for (const file of files) formData.append('files', file);
  const res = await fetch('/api/style-dna/analyze', { method: 'POST', body: formData });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Style DNA analysis failed');
  setJobId(data.jobId);
  setStyleDna(data.styleDna);
  setPromptPackage(data.promptPackage);
  setAnalyses(data.analyses || []);
}
```

```ts
async function handleGenerate() {
  if (!jobId || generating) return;
  setGenerating(true);
  const res = await fetch(`/api/style-dna/${jobId}/generate`, { method: 'POST' });
  const data = await res.json();
  setGenerating(false);
  if (!res.ok) throw new Error(data.error || 'Generation failed');
  setGenerationInfo(data);
}
```

- [ ] **Step 4: Add responsive CSS**

Use CSS inside the component:

```tsx
<style>{`
  .style-dna-workbench {
    min-height: 100vh;
    background: var(--hc-bg);
    color: var(--hc-text);
    padding: 28px;
  }
  .style-dna-grid {
    display: grid;
    grid-template-columns: minmax(260px, 320px) minmax(0, 1fr) minmax(300px, 380px);
    gap: 18px;
    align-items: start;
  }
  .style-dna-panel {
    border: 1px solid var(--hc-border);
    background: var(--hc-panel);
    border-radius: 8px;
    padding: 16px;
    min-width: 0;
  }
  .style-dna-button {
    min-height: 44px;
    border-radius: 999px;
    border: 0;
    background: var(--hc-lime);
    color: #08090c;
    font-weight: 900;
    cursor: pointer;
  }
  @media (max-width: 920px) {
    .style-dna-workbench { padding: 16px; }
    .style-dna-grid { grid-template-columns: 1fr; }
  }
`}</style>
```

- [ ] **Step 5: Run typecheck**

Run: `npm run typecheck`

Expected: PASS or only unrelated existing errors.

---

### Task 8: Verification And Browser QA

**Files:**
- Modify only files needed to fix errors discovered in this task.

- [ ] **Step 1: Run focused unit tests**

Run:

```powershell
npm run test -- src/lib/style-dna/jsonRepair.test.ts src/lib/style-dna/PromptComposer.test.ts src/lib/style-dna/StyleDnaAggregator.test.ts src/lib/style-dna/PromptRefiner.test.ts src/lib/style-dna/StyleDnaRepository.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run full test suite**

Run: `npm run test`

Expected: PASS. If unrelated existing tests fail, record exact failures and do not hide them.

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck`

Expected: PASS. If unrelated existing dirty-worktree errors fail, report them separately.

- [ ] **Step 4: Run build**

Run: `npm run build`

Expected: PASS.

- [ ] **Step 5: Start dev server**

Run: `npm run dev`

Expected: Next.js dev server starts. Open `/studio/style-dna`.

- [ ] **Step 6: Browser verify desktop and mobile**

Check:

- Desktop layout has left reference tracks, center Style DNA, right prompt/generate panel.
- Mobile layout stacks vertically with no horizontal scroll.
- Primary buttons are at least 44px tall.
- Repeated generate clicks are disabled while generating.
- Prompt preview does not include artist imitation phrases.
- Copy buttons copy the expected text.

---

## Self-Review

Spec coverage:

- TrackAnalysis, StyleDNA, SunoPromptPackage, GenerationFeedback: Task 1 and Task 4.
- Google strict JSON analysis prompt: Task 1 and Task 5.
- Multi-track aggregation: Task 3 and Task 5.
- PromptComposer: Task 2.
- Editable UI: Task 7.
- Feedback V2: Task 3 and Task 6.
- Status persistence: Task 4, Task 5, Task 6.
- Error handling: Task 5 and Task 6.
- Verification: Task 8.

Placeholder scan:

- No open-ended placeholder markers are intentionally left in this plan.
- Task 6 route details are procedural because they depend on repository row mapping from Task 5; each required behavior is explicitly listed with route file targets.

Type consistency:

- Public type names match `src/types/style-dna.ts`.
- Composer/refiner signatures match tests.
- Route payload fields use camelCase in TypeScript and snake_case at Supabase boundary.
