export type StemType =
  | 'vocals'
  | 'backing_vocals'
  | 'drums'
  | 'bass'
  | 'guitar'
  | 'piano'
  | 'keyboard'
  | 'percussion'
  | 'strings'
  | 'synth'
  | 'fx'
  | 'brass'
  | 'woodwinds'
  | 'other'
  | 'origin'
  | 'instrumental';

export interface NormalizedStem {
  type: StemType;
  label: string;
  url: string;
}

interface StemField {
  type: StemType;
  label: string;
  callbackKey: string;
  recordKey: string;
}

const STEM_FIELDS: StemField[] = [
  { type: 'vocals', label: 'Vocals', callbackKey: 'vocal_url', recordKey: 'vocalUrl' },
  { type: 'backing_vocals', label: 'Backing Vocals', callbackKey: 'backing_vocals_url', recordKey: 'backingVocalsUrl' },
  { type: 'drums', label: 'Drums', callbackKey: 'drums_url', recordKey: 'drumsUrl' },
  { type: 'bass', label: 'Bass', callbackKey: 'bass_url', recordKey: 'bassUrl' },
  { type: 'guitar', label: 'Guitar', callbackKey: 'guitar_url', recordKey: 'guitarUrl' },
  { type: 'piano', label: 'Piano', callbackKey: 'piano_url', recordKey: 'pianoUrl' },
  { type: 'keyboard', label: 'Keyboard', callbackKey: 'keyboard_url', recordKey: 'keyboardUrl' },
  { type: 'percussion', label: 'Percussion', callbackKey: 'percussion_url', recordKey: 'percussionUrl' },
  { type: 'strings', label: 'Strings', callbackKey: 'strings_url', recordKey: 'stringsUrl' },
  { type: 'synth', label: 'Synth', callbackKey: 'synth_url', recordKey: 'synthUrl' },
  { type: 'fx', label: 'FX', callbackKey: 'fx_url', recordKey: 'fxUrl' },
  { type: 'brass', label: 'Brass', callbackKey: 'brass_url', recordKey: 'brassUrl' },
  { type: 'woodwinds', label: 'Woodwinds', callbackKey: 'woodwinds_url', recordKey: 'woodwindsUrl' },
  { type: 'other', label: 'Other', callbackKey: 'other_url', recordKey: 'otherUrl' },
  { type: 'instrumental', label: 'Instrumental', callbackKey: 'instrumental_url', recordKey: 'instrumentalUrl' },
  { type: 'origin', label: 'Original Mix', callbackKey: 'origin_url', recordKey: 'originUrl' },
];

function buildStems(source: Record<string, unknown> | null, key: 'callbackKey' | 'recordKey') {
  if (!source) return [];

  return STEM_FIELDS.flatMap((field) => {
    const url = source[field[key]];
    return typeof url === 'string' && url.trim()
      ? [{ type: field.type, label: field.label, url }]
      : [];
  });
}

export function normalizeKieStemCallback(payload: unknown) {
  const value = payload && typeof payload === 'object'
    ? payload as Record<string, any>
    : {};
  const info = value.data?.vocal_separation_info || value.data?.vocal_removal_info || null;
  const providerTaskId = typeof value.data?.task_id === 'string'
    ? value.data.task_id
    : typeof value.data?.taskId === 'string'
      ? value.data.taskId
    : null;
  const completed = value.code === 200 && Boolean(info);
  const failed = typeof value.code === 'number' && value.code !== 200;

  return {
    providerTaskId,
    status: completed ? 'completed' as const : failed ? 'failed' as const : 'processing' as const,
    errorMessage: failed ? String(value.msg || 'KIE stem split failed') : null,
    stems: buildStems(info, 'callbackKey'),
  };
}

export function readNormalizedStems(resultPayload: unknown): NormalizedStem[] {
  const value = resultPayload && typeof resultPayload === 'object'
    ? resultPayload as Record<string, any>
    : {};

  if (Array.isArray(value.normalizedStems)) {
    return value.normalizedStems.filter((stem): stem is NormalizedStem => (
      stem &&
      typeof stem.type === 'string' &&
      typeof stem.label === 'string' &&
      typeof stem.url === 'string'
    ));
  }

  const callbackInfo = value.data?.vocal_separation_info || value.data?.vocal_removal_info || null;
  if (callbackInfo) {
    return buildStems(callbackInfo, 'callbackKey');
  }

  if (value.providerPayload && typeof value.providerPayload === 'object') {
    const providerPayloadStems = readNormalizedStems(value.providerPayload);
    if (providerPayloadStems.length > 0) {
      return providerPayloadStems;
    }
  }

  const recordInfo = value.data?.response || value.response || null;
  return buildStems(recordInfo, 'recordKey');
}
