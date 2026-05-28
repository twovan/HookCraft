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

export interface StyleDnaTemplate {
  id: string;
  userId: string;
  styleDnaId: string;
  name: string;
  description: string;
  styleDnaSnapshot: StyleDNA;
  promptPackageSnapshot?: SunoPromptPackage | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
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
