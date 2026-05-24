'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent } from 'react';
import {
  defaultStemMasterState,
  normalizeStemMasterState,
  type StemMasterState,
} from '@/lib/stems/stemMixState';
import { resolveStemEditorShortcut } from '@/lib/stems/stemEditorShortcuts';

export interface EditableStem {
  type: string;
  label: string;
  url: string;
  waveform?: StemWaveform | null;
}

export interface StemWaveform {
  duration: number;
  peaks: number[];
}

interface StemTrackState {
  volume: number;
  pan: number;
  muted: boolean;
  solo: boolean;
  trimStart: number;
  trimEnd: number | null;
  fadeIn: number;
  fadeOut: number;
}

export interface StemEditState {
  tracks: Record<string, StemTrackState>;
  master?: StemMasterState;
  savedAt?: string;
}

type MixPreset = 'balanced' | 'vocal-focus' | 'instrumental-wide';
type ExportMode = 'current-mix' | 'all-tracks' | 'solo-only';
type ExportReadiness = 'ready-only' | 'wait-all';
type TrackViewMode = 'all' | 'active' | 'audible';
type EditorPreferences = {
  exportMode?: ExportMode;
  exportReadiness?: ExportReadiness;
  showAdvancedControls?: boolean;
  trackViewMode?: TrackViewMode;
};

interface StemMixerEditorProps {
  stems: EditableStem[];
  versionLabel: string;
  jobId?: string;
  initialEditState?: StemEditState | null;
}

function defaultTrackState(): StemTrackState {
  return { volume: 1, pan: 0, muted: false, solo: false, trimStart: 0, trimEnd: null, fadeIn: 0, fadeOut: 0 };
}

function normalizeTrackState(value: Partial<StemTrackState> | undefined | null): StemTrackState {
  return {
    volume: typeof value?.volume === 'number' ? Math.max(0, Math.min(1, value.volume)) : 1,
    pan: typeof value?.pan === 'number' ? Math.max(-1, Math.min(1, value.pan)) : 0,
    muted: value?.muted === true,
    solo: value?.solo === true,
    trimStart: typeof value?.trimStart === 'number' ? Math.max(0, value.trimStart) : 0,
    trimEnd: typeof value?.trimEnd === 'number' ? Math.max(0, value.trimEnd) : null,
    fadeIn: typeof value?.fadeIn === 'number' ? Math.max(0, value.fadeIn) : 0,
    fadeOut: typeof value?.fadeOut === 'number' ? Math.max(0, value.fadeOut) : 0,
  };
}

function createTrackState(stems: EditableStem[], editState?: StemEditState | null) {
  return Object.fromEntries(stems.map((stem) => {
    const savedState = editState?.tracks?.[stem.type];
    return [
      stem.type,
      savedState ? normalizeTrackState(savedState) : defaultTrackState(),
    ];
  })) as Record<string, StemTrackState>;
}

function areTrackStatesEqual(left: Record<string, StemTrackState>, right: Record<string, StemTrackState>) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds)) return '0:00';
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remaining = safeSeconds % 60;
  return `${minutes}:${String(remaining).padStart(2, '0')}`;
}

function formatPan(pan: number) {
  if (Math.abs(pan) < 0.01) return 'C';
  return pan < 0 ? `L${Math.round(Math.abs(pan) * 100)}` : `R${Math.round(pan * 100)}`;
}

function normalizeStemType(type: string) {
  return type.toLowerCase().replaceAll('-', '_').replaceAll(' ', '_');
}

function getStemDisplayName(stem: EditableStem) {
  const normalized = normalizeStemType(stem.type);
  const nameMap: Record<string, { zh: string; en: string }> = {
    vocals: { zh: '人声', en: 'Vocals' },
    lead_vocals: { zh: '主唱', en: 'Lead Vocals' },
    backing_vocals: { zh: '和声', en: 'Backing Vocals' },
    drums: { zh: '鼓组', en: 'Drums' },
    bass: { zh: '贝斯', en: 'Bass' },
    guitar: { zh: '吉他', en: 'Guitar' },
    piano: { zh: '钢琴', en: 'Piano' },
    keyboard: { zh: '键盘', en: 'Keyboard' },
    percussion: { zh: '打击乐', en: 'Percussion' },
    strings: { zh: '弦乐', en: 'Strings' },
    synth: { zh: '合成器', en: 'Synth' },
    fx: { zh: '音效', en: 'FX' },
    brass: { zh: '铜管', en: 'Brass' },
    woodwinds: { zh: '木管', en: 'Woodwinds' },
    other: { zh: '其他', en: 'Other' },
    instrumental: { zh: '伴奏', en: 'Instrumental' },
    origin: { zh: '原始混音', en: 'Original Mix' },
  };

  return nameMap[normalized] || {
    zh: stem.label || stem.type,
    en: stem.type.replaceAll('_', ' '),
  };
}

function isVocalStem(type: string) {
  const normalized = normalizeStemType(type);
  return normalized === 'vocals' || normalized === 'lead_vocals' || normalized === 'backing_vocals' || normalized.includes('vocal');
}

function stemHasDetectedContent(stem: EditableStem, buffer: AudioBuffer | null | undefined) {
  return waveformHasContent(stem.waveform) || bufferHasContent(buffer);
}

function presetPanForType(type: string) {
  const normalized = normalizeStemType(type);
  if (normalized === 'vocals' || normalized === 'lead_vocals' || normalized === 'bass' || normalized === 'drums') return 0;
  if (normalized === 'backing_vocals') return -0.28;
  if (normalized === 'guitar') return 0.34;
  if (normalized === 'keyboard' || normalized === 'piano') return -0.34;
  if (normalized === 'strings') return 0.46;
  if (normalized === 'synth') return -0.46;
  if (normalized === 'percussion') return 0.22;
  if (normalized === 'fx') return -0.58;
  if (normalized === 'brass') return 0.5;
  if (normalized === 'woodwinds') return -0.5;
  return 0;
}

function presetVolumeForType(type: string, preset: MixPreset) {
  const normalized = normalizeStemType(type);
  const isVocal = normalized === 'vocals' || normalized === 'lead_vocals';
  const isBacking = normalized === 'backing_vocals';
  const isFoundation = normalized === 'drums' || normalized === 'bass';
  const isTexture = normalized === 'fx' || normalized === 'synth' || normalized === 'strings';

  if (preset === 'vocal-focus') {
    if (isVocal) return 1;
    if (isBacking) return 0.55;
    if (isFoundation) return 0.72;
    if (isTexture) return 0.48;
    return 0.62;
  }

  if (preset === 'instrumental-wide') {
    if (isVocal || isBacking) return 0;
    if (isFoundation) return 0.9;
    if (isTexture) return 0.82;
    return 0.78;
  }

  if (isVocal) return 0.92;
  if (isBacking) return 0.68;
  if (isFoundation) return 0.86;
  if (isTexture) return 0.72;
  return 0.76;
}

function isMutedByPreset(type: string, preset: MixPreset) {
  if (preset !== 'instrumental-wide') return false;
  const normalized = normalizeStemType(type);
  return normalized === 'vocals' || normalized === 'lead_vocals' || normalized === 'backing_vocals';
}

function loadEditorPreferences(): EditorPreferences {
  if (typeof window === 'undefined') return {};
  try {
    const parsed = JSON.parse(window.localStorage.getItem('hookcraft-stem-editor-prefs') || '{}') as EditorPreferences;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function exportModeLabel(mode: ExportMode) {
  if (mode === 'all-tracks') return '完整混音';
  if (mode === 'solo-only') return '只导出独奏';
  return '当前混音';
}

function exportModeFileLabel(mode: ExportMode) {
  if (mode === 'all-tracks') return 'full-mix';
  if (mode === 'solo-only') return 'solo-only';
  return 'current-mix';
}

function formatExportTimestamp(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0');
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join('') + '-' + [
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join('');
}

const STEM_LOAD_CONCURRENCY = 3;
const INITIAL_STEM_LOAD_COUNT = 6;
const DEFERRED_STEM_LOAD_DELAY_MS = 2200;
const STEM_AUDIO_CACHE_NAME = 'hookcraft-stem-audio-v2';
const LEGACY_STEM_AUDIO_CACHE_NAMES = ['hookcraft-stem-audio-v1', STEM_AUDIO_CACHE_NAME];
const PRIORITY_STEM_TYPES = [
  'vocals',
  'drums',
  'bass',
  'guitar',
  'keyboard',
  'piano',
  'strings',
  'synth',
];

function sortStemsByLoadPriority(stems: EditableStem[]) {
  return [...stems].sort((left, right) => {
    const leftIndex = PRIORITY_STEM_TYPES.indexOf(left.type);
    const rightIndex = PRIORITY_STEM_TYPES.indexOf(right.type);
    const leftRank = leftIndex === -1 ? PRIORITY_STEM_TYPES.length : leftIndex;
    const rightRank = rightIndex === -1 ? PRIORITY_STEM_TYPES.length : rightIndex;
    return leftRank - rightRank;
  });
}

function isAudioLikeResponse(response: Response) {
  const contentType = response.headers.get('content-type')?.toLowerCase() || '';
  return (
    !contentType ||
    contentType.startsWith('audio/') ||
    contentType.includes('octet-stream') ||
    contentType.includes('mpeg') ||
    contentType.includes('mp4') ||
    contentType.includes('wav') ||
    contentType.includes('ogg')
  );
}

async function readStemArrayBuffer(url: string, signal: AbortSignal, forceNetwork = false) {
  if ('caches' in window) {
    const cache = await caches.open(STEM_AUDIO_CACHE_NAME);
    const cached = forceNetwork ? null : await cache.match(url);
    if (cached && isAudioLikeResponse(cached)) {
      return {
        buffer: await cached.arrayBuffer(),
        source: 'browser-cache' as const,
      };
    }
    if (cached) {
      await cache.delete(url).catch(() => false);
    }

    const response = await fetch(url, {
      cache: 'no-store',
      credentials: 'same-origin',
      signal,
    });
    if (!response.ok) throw new Error('Stem request failed');
    if (!isAudioLikeResponse(response)) throw new Error('Stem response is not audio');

    const clone = response.clone();
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength === 0) throw new Error('Stem response is empty');
    if (!signal.aborted) {
      await cache.put(url, clone).catch(() => undefined);
    }
    return { buffer, source: 'network' as const };
  }

  const response = await fetch(url, {
    cache: 'no-store',
    credentials: 'same-origin',
    signal,
  });
  if (!response.ok) throw new Error('Stem request failed');
  if (!isAudioLikeResponse(response)) throw new Error('Stem response is not audio');
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength === 0) throw new Error('Stem response is empty');
  return {
    buffer,
    source: 'network' as const,
  };
}

async function readAndDecodeStemAudio(
  context: BaseAudioContext,
  stem: EditableStem,
  signal: AbortSignal,
) {
  const loaded = await readStemArrayBuffer(stem.url, signal);
  try {
    return {
      audioBuffer: await context.decodeAudioData(loaded.buffer),
      source: loaded.source,
    };
  } catch (error) {
    if (signal.aborted || loaded.source !== 'browser-cache') throw error;
    if ('caches' in window) {
      const cache = await caches.open(STEM_AUDIO_CACHE_NAME);
      await cache.delete(stem.url).catch(() => false);
    }
    const reloaded = await readStemArrayBuffer(stem.url, signal, true);
    return {
      audioBuffer: await context.decodeAudioData(reloaded.buffer),
      source: 'network-retry' as const,
    };
  }
}

function sleep(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve) => {
    if (signal.aborted) {
      resolve();
      return;
    }
    window.setTimeout(resolve, ms);
  });
}

function calculateWaveform(buffer: AudioBuffer, bucketCount = 480): StemWaveform {
  const channel = buffer.getChannelData(0);
  const samplesPerBucket = Math.max(1, Math.floor(channel.length / bucketCount));
  const peaks = Array.from({ length: bucketCount }, (_, index) => {
    const start = index * samplesPerBucket;
    const end = Math.min(channel.length, start + samplesPerBucket);
    let peak = 0;
    for (let sampleIndex = start; sampleIndex < end; sampleIndex += 1) {
      peak = Math.max(peak, Math.abs(channel[sampleIndex] || 0));
    }
    return Number(Math.min(1, peak).toFixed(4));
  });

  return {
    duration: Number(buffer.duration.toFixed(3)),
    peaks,
  };
}

function waveformHasContent(waveform: StemWaveform | null | undefined, threshold = 0.012) {
  return (waveform?.peaks || []).some((peak) => peak > threshold);
}

function bufferHasContent(buffer: AudioBuffer | null | undefined, threshold = 0.006) {
  if (!buffer || buffer.length === 0) return false;
  const channel = buffer.getChannelData(0);
  const step = Math.max(1, Math.floor(channel.length / 1200));
  for (let index = 0; index < channel.length; index += step) {
    if (Math.abs(channel[index] || 0) > threshold) return true;
  }
  return false;
}

function stemHasKnownEmptyWaveform(stem: EditableStem) {
  return Boolean(stem.waveform?.peaks?.length) && !waveformHasContent(stem.waveform);
}

async function persistWaveform(jobId: string | undefined, stemType: string, waveform: StemWaveform) {
  if (!jobId) return;

  await fetch('/api/stems/waveforms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jobId, stemType, waveform }),
  }).catch(() => undefined);
}

function encodeWav(audioBuffer: AudioBuffer) {
  const channelCount = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const bytesPerSample = 2;
  const blockAlign = channelCount * bytesPerSample;
  const dataLength = audioBuffer.length * blockAlign;
  const buffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(buffer);

  const writeString = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(offset + index, value.charCodeAt(index));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channelCount, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bytesPerSample * 8, true);
  writeString(36, 'data');
  view.setUint32(40, dataLength, true);

  let offset = 44;
  for (let sampleIndex = 0; sampleIndex < audioBuffer.length; sampleIndex += 1) {
    for (let channelIndex = 0; channelIndex < channelCount; channelIndex += 1) {
      const sample = Math.max(-1, Math.min(1, audioBuffer.getChannelData(channelIndex)[sampleIndex] || 0));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += bytesPerSample;
    }
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

function getInitialWaveformDuration(stems: EditableStem[]) {
  return stems.reduce((maxDuration, stem) => (
    Math.max(maxDuration, stem.waveform?.duration || 0)
  ), 0);
}

function clampTrimEdge(
  edge: 'start' | 'end',
  value: number,
  currentStart: number,
  currentEnd: number,
  duration: number,
) {
  const nextValue = Math.max(0, Math.min(duration, value));
  if (edge === 'start') {
    return {
      trimStart: Math.min(nextValue, Math.max(0, currentEnd - 0.25)),
      trimEnd: currentEnd,
    };
  }

  return {
    trimStart: currentStart,
    trimEnd: Math.max(nextValue, currentStart + 0.25),
  };
}

function getFadeFactorAt(time: number, trimStart: number, trimEnd: number, fadeIn: number, fadeOut: number) {
  const fadeInFactor = fadeIn > 0 ? Math.max(0, Math.min(1, (time - trimStart) / fadeIn)) : 1;
  const fadeOutFactor = fadeOut > 0 ? Math.max(0, Math.min(1, (trimEnd - time) / fadeOut)) : 1;
  return Math.min(fadeInFactor, fadeOutFactor);
}

function scheduleTrackGain({
  gain,
  baseVolume,
  startAt,
  playbackFrom,
  trimStart,
  trimEnd,
  fadeIn,
  fadeOut,
}: {
  gain: AudioParam;
  baseVolume: number;
  startAt: number;
  playbackFrom: number;
  trimStart: number;
  trimEnd: number;
  fadeIn: number;
  fadeOut: number;
}) {
  const safeFadeIn = Math.max(0, Math.min(fadeIn, Math.max(0, trimEnd - trimStart)));
  const safeFadeOut = Math.max(0, Math.min(fadeOut, Math.max(0, trimEnd - trimStart)));
  const initialFactor = getFadeFactorAt(playbackFrom, trimStart, trimEnd, safeFadeIn, safeFadeOut);
  const fadeInEnd = trimStart + safeFadeIn;
  const fadeOutStart = trimEnd - safeFadeOut;

  gain.cancelScheduledValues(startAt);
  gain.setValueAtTime(baseVolume * initialFactor, startAt);

  if (safeFadeIn > 0 && fadeInEnd > playbackFrom) {
    gain.linearRampToValueAtTime(baseVolume, startAt + Math.max(0, fadeInEnd - playbackFrom));
  }

  if (safeFadeOut > 0 && fadeOutStart > playbackFrom) {
    const fadeOutStartTime = startAt + Math.max(0, fadeOutStart - playbackFrom);
    gain.setValueAtTime(baseVolume * getFadeFactorAt(fadeOutStart, trimStart, trimEnd, safeFadeIn, safeFadeOut), fadeOutStartTime);
    gain.linearRampToValueAtTime(0, startAt + Math.max(0, trimEnd - playbackFrom));
  } else if (safeFadeOut > 0 && trimEnd > playbackFrom) {
    gain.linearRampToValueAtTime(0, startAt + Math.max(0, trimEnd - playbackFrom));
  }
}

function connectWithPan(
  context: BaseAudioContext,
  source: AudioNode,
  gain: GainNode,
  destination: AudioNode,
  pan: number,
) {
  source.connect(gain);
  if ('createStereoPanner' in context) {
    const panner = context.createStereoPanner();
    panner.pan.value = Math.max(-1, Math.min(1, pan));
    gain.connect(panner);
    panner.connect(destination);
    return panner;
  }
  gain.connect(destination);
  return null;
}

function configureLimiter(compressor: DynamicsCompressorNode) {
  compressor.threshold.value = -12;
  compressor.knee.value = 20;
  compressor.ratio.value = 12;
  compressor.attack.value = 0.004;
  compressor.release.value = 0.18;
}

function createMasterOutputChain(context: BaseAudioContext, masterState: StemMasterState) {
  const masterGain = context.createGain();
  masterGain.gain.value = masterState.volume;

  if (!masterState.limiter) {
    masterGain.connect(context.destination);
    return {
      input: masterGain,
      gain: masterGain,
      compressor: null,
    };
  }

  const compressor = context.createDynamicsCompressor();
  configureLimiter(compressor);
  masterGain.connect(compressor);
  compressor.connect(context.destination);

  return {
    input: masterGain,
    gain: masterGain,
    compressor,
  };
}

export default function StemMixerEditor({ stems, versionLabel, jobId, initialEditState }: StemMixerEditorProps) {
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioBuffersRef = useRef<Record<string, AudioBuffer>>({});
  const gainNodesRef = useRef<Record<string, GainNode>>({});
  const panNodesRef = useRef<Record<string, StereoPannerNode>>({});
  const masterGainNodeRef = useRef<GainNode | null>(null);
  const masterCompressorNodeRef = useRef<DynamicsCompressorNode | null>(null);
  const sourceNodesRef = useRef<Record<string, AudioBufferSourceNode>>({});
  const playbackStartedAtRef = useRef(0);
  const playbackOffsetRef = useRef(0);
  const frameRef = useRef<number | null>(null);
  const loadingCountRef = useRef(stems.length);
  const failedLoadCountRef = useRef(0);
  const autoSaveTimerRef = useRef<number | null>(null);
  const skipNextAutoSaveRef = useRef(true);
  const undoStackRef = useRef<Record<string, StemTrackState>[]>([]);
  const redoStackRef = useRef<Record<string, StemTrackState>[]>([]);
  const [tracks, setTracks] = useState<Record<string, StemTrackState>>(() => createTrackState(stems, initialEditState));
  const [masterState, setMasterState] = useState<StemMasterState>(() => normalizeStemMasterState(initialEditState?.master));
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(() => getInitialWaveformDuration(stems));
  const [loadingCount, setLoadingCount] = useState(stems.length);
  const [failedLoadCount, setFailedLoadCount] = useState(0);
  const [cachedLoadCount, setCachedLoadCount] = useState(0);
  const [skippedEmptyCount, setSkippedEmptyCount] = useState(0);
  const [bufferVersion, setBufferVersion] = useState(0);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<string | null>(initialEditState?.savedAt ? '已读取上次保存的编辑状态。' : null);
  const [autoSaveStatus, setAutoSaveStatus] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportingStemType, setExportingStemType] = useState<string | null>(null);
  const [editorPreferencesLoaded, setEditorPreferencesLoaded] = useState(false);
  const [exportMode, setExportMode] = useState<ExportMode>('current-mix');
  const [exportReadiness, setExportReadiness] = useState<ExportReadiness>('wait-all');
  const [showAdvancedControls, setShowAdvancedControls] = useState(false);
  const [trackViewMode, setTrackViewMode] = useState<TrackViewMode>('all');
  const [audioReloadNonce, setAudioReloadNonce] = useState(0);
  const [historyVersion, setHistoryVersion] = useState(0);
  const [selectedTrackType, setSelectedTrackType] = useState<string | null>(() => stems[0]?.type ?? null);

  const masterStem = stems[0] || null;
  const hasSoloTrack = useMemo(
    () => Object.values(tracks).some((track) => track.solo),
    [tracks],
  );

  const loadableStemCount = Math.max(0, stems.length - skippedEmptyCount);
  const readyStemCount = Math.max(0, loadableStemCount - loadingCount - failedLoadCount);
  const exportSummary = useMemo(() => {
    const exportSourceStems = stems.filter((stem) => !stemHasKnownEmptyWaveform(stem));
    const loadedStems = exportSourceStems.filter((stem) => audioBuffersRef.current[stem.type]);
    const plannedStems = exportSourceStems.filter((stem) => {
      const state = tracks[stem.type] || defaultTrackState();
      if (exportMode === 'all-tracks') return state.volume > 0;
      if (exportMode === 'solo-only') return state.solo && state.volume > 0;
      return !state.muted && (!hasSoloTrack || state.solo) && state.volume > 0;
    });
    const selectedStems = loadedStems.filter((stem) => {
      const state = tracks[stem.type] || defaultTrackState();
      if (exportMode === 'all-tracks') return state.volume > 0;
      if (exportMode === 'solo-only') return state.solo && state.volume > 0;
      return !state.muted && (!hasSoloTrack || state.solo) && state.volume > 0;
    });
    const missingCount = Math.max(0, plannedStems.length - selectedStems.length);
    const mutedOrSkippedCount = Math.max(0, loadedStems.length - selectedStems.length);

    return {
      selectedCount: selectedStems.length,
      plannedCount: plannedStems.length,
      loadedCount: loadedStems.length,
      missingCount,
      mutedOrSkippedCount,
      canExport: !isExporting && (exportReadiness === 'wait-all' ? plannedStems.length > 0 : selectedStems.length > 0),
    };
  }, [bufferVersion, exportMode, exportReadiness, hasSoloTrack, isExporting, stems, tracks]);

  useEffect(() => {
    loadingCountRef.current = loadingCount;
  }, [loadingCount]);

  useEffect(() => {
    failedLoadCountRef.current = failedLoadCount;
  }, [failedLoadCount]);

  useEffect(() => {
    const preferences = loadEditorPreferences();
    if (preferences.exportMode === 'current-mix' || preferences.exportMode === 'all-tracks' || preferences.exportMode === 'solo-only') {
      setExportMode(preferences.exportMode);
    }
    if (preferences.exportReadiness === 'ready-only' || preferences.exportReadiness === 'wait-all') {
      setExportReadiness(preferences.exportReadiness);
    }
    if (preferences.trackViewMode === 'all' || preferences.trackViewMode === 'active' || preferences.trackViewMode === 'audible') {
      setTrackViewMode(preferences.trackViewMode);
    }
    if (typeof preferences.showAdvancedControls === 'boolean') {
      setShowAdvancedControls(preferences.showAdvancedControls);
    }
    setEditorPreferencesLoaded(true);
  }, []);

  useEffect(() => {
    if (!editorPreferencesLoaded) return;
    window.localStorage.setItem('hookcraft-stem-editor-prefs', JSON.stringify({
      exportMode,
      exportReadiness,
      showAdvancedControls,
      trackViewMode,
    }));
  }, [editorPreferencesLoaded, exportMode, exportReadiness, showAdvancedControls, trackViewMode]);

  const visibleStems = useMemo(() => stems.filter((stem) => {
    if (trackViewMode === 'all') return true;

    const state = tracks[stem.type] || defaultTrackState();
    const isAudible = !state.muted && (!hasSoloTrack || state.solo) && state.volume > 0;
    if (trackViewMode === 'audible') return isAudible;

    return stemHasDetectedContent(stem, audioBuffersRef.current[stem.type]);
  }), [bufferVersion, hasSoloTrack, stems, trackViewMode, tracks]);

  const activeStemCount = useMemo(() => stems.filter((stem) => (
    stemHasDetectedContent(stem, audioBuffersRef.current[stem.type])
  )).length, [bufferVersion, stems]);

  const audibleStemCount = useMemo(() => stems.filter((stem) => {
    const state = tracks[stem.type] || defaultTrackState();
    return !state.muted && (!hasSoloTrack || state.solo) && state.volume > 0;
  }).length, [hasSoloTrack, stems, tracks]);
  const selectedTrack = useMemo(
    () => stems.find((stem) => stem.type === selectedTrackType) || visibleStems[0] || null,
    [selectedTrackType, stems, visibleStems],
  );
  const canUndo = historyVersion >= 0 && undoStackRef.current.length > 0;
  const canRedo = historyVersion >= 0 && redoStackRef.current.length > 0;

  const commitTrackChange = useCallback((
    updater: Record<string, StemTrackState> | ((current: Record<string, StemTrackState>) => Record<string, StemTrackState>),
  ) => {
    setTracks((current) => {
      const next = typeof updater === 'function' ? updater(current) : updater;
      if (areTrackStatesEqual(current, next)) return current;
      undoStackRef.current = [...undoStackRef.current.slice(-59), current];
      redoStackRef.current = [];
      return next;
    });
    setHistoryVersion((version) => version + 1);
  }, []);

  const undoTrackChange = useCallback(() => {
    const previous = undoStackRef.current.pop();
    if (!previous) return;
    setTracks((current) => {
      redoStackRef.current = [...redoStackRef.current.slice(-59), current];
      return previous;
    });
    setHistoryVersion((version) => version + 1);
    setSaveStatus('已撤销上一步编辑，自动保存后下次进入会恢复。');
  }, []);

  const redoTrackChange = useCallback(() => {
    const next = redoStackRef.current.pop();
    if (!next) return;
    setTracks((current) => {
      undoStackRef.current = [...undoStackRef.current.slice(-59), current];
      return next;
    });
    setHistoryVersion((version) => version + 1);
    setSaveStatus('已重做上一步编辑，自动保存后下次进入会恢复。');
  }, []);

  const stopFrame = useCallback(() => {
    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
  }, []);

  const stopSources = useCallback(() => {
    Object.values(sourceNodesRef.current).forEach((source) => {
      source.onended = null;
      try {
        source.stop();
      } catch {
        // The source may already be stopped by the audio clock.
      }
      try {
        source.disconnect();
      } catch {
        // Already disconnected.
      }
    });
    sourceNodesRef.current = {};

    Object.values(gainNodesRef.current).forEach((gain) => {
      try {
        gain.disconnect();
      } catch {
        // Already disconnected.
      }
    });
    gainNodesRef.current = {};

    Object.values(panNodesRef.current).forEach((panner) => {
      try {
        panner.disconnect();
      } catch {
        // Already disconnected.
      }
    });
    panNodesRef.current = {};

    if (masterGainNodeRef.current) {
      try {
        masterGainNodeRef.current.disconnect();
      } catch {
        // Already disconnected.
      }
      masterGainNodeRef.current = null;
    }

    if (masterCompressorNodeRef.current) {
      try {
        masterCompressorNodeRef.current.disconnect();
      } catch {
        // Already disconnected.
      }
      masterCompressorNodeRef.current = null;
    }
  }, []);

  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }
    return audioContextRef.current;
  }, []);

  useEffect(() => {
    setTracks(createTrackState(stems, initialEditState));
    setMasterState(normalizeStemMasterState(initialEditState?.master));
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(getInitialWaveformDuration(stems));
    const stemsToLoad = stems.filter((stem) => !stemHasKnownEmptyWaveform(stem));
    const knownEmptyCount = stems.length - stemsToLoad.length;
    setLoadingCount(stemsToLoad.length);
    setFailedLoadCount(0);
    loadingCountRef.current = stemsToLoad.length;
    failedLoadCountRef.current = 0;
    setCachedLoadCount(0);
    setSkippedEmptyCount(knownEmptyCount);
    setBufferVersion(0);
    setPlaybackError(null);
    setSaveStatus(initialEditState?.savedAt ? '已读取上次保存的编辑状态。' : null);
    setAutoSaveStatus(null);
    setExportingStemType(null);
    setSelectedTrackType(stems[0]?.type ?? null);
    skipNextAutoSaveRef.current = true;
    undoStackRef.current = [];
    redoStackRef.current = [];
    setHistoryVersion((version) => version + 1);
    playbackStartedAtRef.current = 0;
    playbackOffsetRef.current = 0;
    audioBuffersRef.current = {};
    stopSources();
    stopFrame();

    const context = getAudioContext();
    const abortController = new AbortController();

    const prioritizedStems = sortStemsByLoadPriority(stemsToLoad);
    let nextStemIndex = 0;
    let deferredLoadReleased = false;

    const loadNextStem = async (): Promise<void> => {
      if (
        !deferredLoadReleased &&
        nextStemIndex >= INITIAL_STEM_LOAD_COUNT &&
        prioritizedStems.length > INITIAL_STEM_LOAD_COUNT
      ) {
        deferredLoadReleased = true;
        await sleep(DEFERRED_STEM_LOAD_DELAY_MS, abortController.signal);
      }

      const stem = prioritizedStems[nextStemIndex];
      nextStemIndex += 1;
      if (!stem || abortController.signal.aborted) return;

      try {
        const loaded = await readAndDecodeStemAudio(context, stem, abortController.signal);
        if (abortController.signal.aborted) return;
        if (loaded.source === 'browser-cache') {
          setCachedLoadCount((count) => count + 1);
        }

        audioBuffersRef.current[stem.type] = loaded.audioBuffer;
        setBufferVersion((version) => version + 1);
        setDuration((current) => Math.max(current, loaded.audioBuffer.duration || 0));

        if (!stem.waveform?.peaks?.length) {
          void persistWaveform(jobId, stem.type, calculateWaveform(loaded.audioBuffer));
        }
      } catch {
        if (!abortController.signal.aborted) {
          setFailedLoadCount((count) => count + 1);
        }
      } finally {
        if (!abortController.signal.aborted) {
          setLoadingCount((count) => Math.max(0, count - 1));
          await loadNextStem();
        }
      }
    };

    Array.from({ length: Math.min(STEM_LOAD_CONCURRENCY, prioritizedStems.length) })
      .forEach(() => {
        void loadNextStem();
      });

    return () => {
      abortController.abort();
    };
  }, [audioReloadNonce, getAudioContext, initialEditState, jobId, stems, stopFrame, stopSources]);

  useEffect(() => () => {
    if (autoSaveTimerRef.current !== null) {
      window.clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
    stopSources();
    stopFrame();
    const context = audioContextRef.current;
    audioContextRef.current = null;
    void context?.close();
  }, [stopFrame, stopSources]);

  useEffect(() => {
    stems.forEach((stem) => {
      const gain = gainNodesRef.current[stem.type];
      const panner = panNodesRef.current[stem.type];
      const state = tracks[stem.type];
      if (!gain || !state) return;

      const isAudible = !state.muted && (!hasSoloTrack || state.solo);
      gain.gain.value = isAudible ? state.volume : 0;
      if (panner) {
        panner.pan.value = Math.max(-1, Math.min(1, state.pan));
      }
    });
  }, [hasSoloTrack, stems, tracks]);

  useEffect(() => {
    if (masterGainNodeRef.current) {
      masterGainNodeRef.current.gain.value = masterState.volume;
    }
  }, [masterState.volume]);

  const pauseAll = useCallback(() => {
    const context = audioContextRef.current;
    if (context && playbackStartedAtRef.current > 0) {
      playbackOffsetRef.current = Math.min(
        duration,
        playbackOffsetRef.current + Math.max(0, context.currentTime - playbackStartedAtRef.current),
      );
      setCurrentTime(playbackOffsetRef.current);
    }
    playbackStartedAtRef.current = 0;
    stopSources();
    stopFrame();
    setIsPlaying(false);
  }, [duration, stopFrame, stopSources]);

  const playAll = useCallback(async () => {
    if (!masterStem) return;

    const playableStems = stems.filter((stem) => audioBuffersRef.current[stem.type]);
    if (playableStems.length === 0) {
      setPlaybackError('分轨正在缓存中，第一条轨道完成后即可开始预听。');
      return;
    }

    setPlaybackError(loadingCount > 0
      ? `仍有 ${loadingCount} 条分轨在后台缓存，当前先播放已就绪的 ${playableStems.length} 条。`
      : null);

    try {
      const context = getAudioContext();
      await context.resume();
      stopSources();
      const masterOutput = createMasterOutputChain(context, masterState);
      masterGainNodeRef.current = masterOutput.gain;
      masterCompressorNodeRef.current = masterOutput.compressor;

      const startAt = context.currentTime + 0.04;
      playableStems.forEach((stem) => {
        const source = context.createBufferSource();
        const gain = context.createGain();
        const state = tracks[stem.type] || defaultTrackState();
        const isAudible = !state.muted && (!hasSoloTrack || state.solo);
        const trimStart = Math.max(0, Math.min(duration, state.trimStart));
        const trimEnd = Math.max(trimStart, Math.min(duration, state.trimEnd ?? duration));
        const cursor = playbackOffsetRef.current;
        const isInClip = cursor < trimEnd;
        const startDelay = Math.max(0, trimStart - cursor);
        const bufferOffset = Math.max(trimStart, cursor);
        const playableDuration = Math.max(0, trimEnd - bufferOffset);

        source.buffer = audioBuffersRef.current[stem.type];
        if (isAudible) {
          scheduleTrackGain({
            gain: gain.gain,
            baseVolume: state.volume,
            startAt: startAt + startDelay,
            playbackFrom: bufferOffset,
            trimStart,
            trimEnd,
            fadeIn: state.fadeIn,
            fadeOut: state.fadeOut,
          });
        } else {
          gain.gain.value = 0;
        }
        const panner = connectWithPan(context, source, gain, masterOutput.input, state.pan);
        gainNodesRef.current[stem.type] = gain;
        if (panner) {
          panNodesRef.current[stem.type] = panner;
        }
        sourceNodesRef.current[stem.type] = source;
        if (isInClip && playableDuration > 0) {
          source.start(startAt + startDelay, bufferOffset, playableDuration);
        }
      });

      playbackStartedAtRef.current = startAt;
      setIsPlaying(true);
      const updateTransport = () => {
        const activeContext = audioContextRef.current;
        if (!activeContext || playbackStartedAtRef.current <= 0) return;

        const nextTime = Math.min(
          duration,
          playbackOffsetRef.current + Math.max(0, activeContext.currentTime - playbackStartedAtRef.current),
        );
        setCurrentTime(nextTime);

        if (duration > 0 && nextTime >= duration) {
          playbackOffsetRef.current = 0;
          setCurrentTime(0);
          playbackStartedAtRef.current = 0;
          stopSources();
          setIsPlaying(false);
          return;
        }

        frameRef.current = window.requestAnimationFrame(updateTransport);
      };
      stopFrame();
      frameRef.current = window.requestAnimationFrame(updateTransport);
    } catch {
      pauseAll();
      setPlaybackError('分轨混音启动失败，请刷新页面后重试。');
    }
  }, [duration, getAudioContext, hasSoloTrack, loadingCount, masterState, masterStem, pauseAll, stems, stopFrame, stopSources, tracks]);

  const handleTogglePlayback = useCallback(() => {
    if (isPlaying) {
      pauseAll();
      return;
    }

    void playAll();
  }, [isPlaying, pauseAll, playAll]);

  const copyProjectLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setSaveStatus('已复制当前编辑链接。');
      setPlaybackError(null);
    } catch {
      setPlaybackError('复制链接失败，可以直接复制浏览器地址栏。');
    }
  }, []);

  const reloadAudioCache = useCallback(async () => {
    pauseAll();
    setPlaybackError(null);
    setSaveStatus('正在重新加载音频缓存。');

    if ('caches' in window) {
      await Promise.all(LEGACY_STEM_AUDIO_CACHE_NAMES.map(async (cacheName) => {
        const cache = await caches.open(cacheName);
        await Promise.all(stems.map((stem) => cache.delete(stem.url).catch(() => false)));
      }));
    }

    setAudioReloadNonce((value) => value + 1);
  }, [pauseAll, stems]);

  const handleSeek = useCallback((nextTime: number) => {
    const safeTime = Math.max(0, Math.min(duration || nextTime, nextTime));
    playbackOffsetRef.current = safeTime;
    setCurrentTime(safeTime);
    if (isPlaying) {
      playbackStartedAtRef.current = 0;
      stopSources();
      void playAll();
    }
  }, [duration, isPlaying, playAll, stopSources]);

  const toggleTrackFlag = useCallback((type: string, flag: 'muted' | 'solo') => {
    commitTrackChange((current) => ({
      ...current,
      [type]: {
        ...(current[type] || defaultTrackState()),
        [flag]: !current[type]?.[flag],
      },
    }));
  }, [commitTrackChange]);

  const setTrackVolume = useCallback((type: string, volume: number) => {
    commitTrackChange((current) => ({
      ...current,
      [type]: {
        ...(current[type] || defaultTrackState()),
        volume,
      },
    }));
  }, [commitTrackChange]);

  const setTrackPan = useCallback((type: string, pan: number) => {
    commitTrackChange((current) => ({
      ...current,
      [type]: {
        ...(current[type] || defaultTrackState()),
        pan: Math.max(-1, Math.min(1, pan)),
      },
    }));
  }, [commitTrackChange]);

  const setTrackFade = useCallback((type: string, edge: 'in' | 'out', value: number) => {
    commitTrackChange((current) => {
      const state = current[type] || defaultTrackState();
      const trimEnd = state.trimEnd ?? duration;
      const clipDuration = Math.max(0, trimEnd - state.trimStart);
      const nextValue = Math.max(0, Math.min(clipDuration, value));
      return {
        ...current,
        [type]: {
          ...state,
          [edge === 'in' ? 'fadeIn' : 'fadeOut']: nextValue,
        },
      };
    });
  }, [commitTrackChange, duration]);

  const setTrackTrim = useCallback((type: string, edge: 'start' | 'end', value: number) => {
    commitTrackChange((current) => {
      const state = current[type] || defaultTrackState();
      const currentEnd = state.trimEnd ?? duration;
      const nextTrim = clampTrimEdge(edge, value, state.trimStart, currentEnd, duration);
      const nextClipDuration = Math.max(0, Math.min(duration, nextTrim.trimEnd) - nextTrim.trimStart);

      return {
        ...current,
        [type]: {
          ...state,
          trimStart: nextTrim.trimStart,
          trimEnd: Math.min(duration, nextTrim.trimEnd),
          fadeIn: Math.min(state.fadeIn, nextClipDuration),
          fadeOut: Math.min(state.fadeOut, nextClipDuration),
        },
      };
    });
  }, [commitTrackChange, duration]);

  const resetTrackEdit = useCallback((type: string) => {
    commitTrackChange((current) => ({
      ...current,
      [type]: {
        ...(current[type] || defaultTrackState()),
        trimStart: 0,
        trimEnd: duration,
        fadeIn: 0,
        fadeOut: 0,
      },
    }));
  }, [commitTrackChange, duration]);

  const setMasterVolume = useCallback((volume: number) => {
    setMasterState((current) => normalizeStemMasterState({
      ...current,
      volume,
    }));
  }, []);

  const toggleMasterLimiter = useCallback(() => {
    setMasterState((current) => normalizeStemMasterState({
      ...current,
      limiter: !current.limiter,
    }));
    setSaveStatus('母带防爆音设置已更新，自动保存后下次进入会恢复。');
  }, []);

  const resetMix = useCallback(() => {
    commitTrackChange(createTrackState(stems));
    setMasterState(defaultStemMasterState());
    setSaveStatus('混音已重置，保存后下次进入会使用新状态。');
  }, [commitTrackChange, stems]);

  const applyMixPreset = useCallback((preset: MixPreset) => {
    commitTrackChange((current) => Object.fromEntries(stems.map((stem) => {
      const existing = current[stem.type] || defaultTrackState();
      const muted = isMutedByPreset(stem.type, preset);
      return [
        stem.type,
        {
          ...existing,
          volume: presetVolumeForType(stem.type, preset),
          pan: preset === 'balanced' ? presetPanForType(stem.type) * 0.55 : presetPanForType(stem.type),
          muted,
          solo: false,
        },
      ];
    })) as Record<string, StemTrackState>);

    const presetName = preset === 'balanced'
      ? '标准平衡'
      : preset === 'vocal-focus'
        ? '人声突出'
        : '伴奏铺开';
    setSaveStatus(`已应用“${presetName}”混音预设，保存后下次进入会恢复。`);
  }, [commitTrackChange, stems]);

  const applyQuickTrackAction = useCallback((action: 'vocals-only' | 'instrumental-only' | 'mute-empty' | 'clear-flags') => {
    commitTrackChange((current) => Object.fromEntries(stems.map((stem) => {
      const existing = current[stem.type] || defaultTrackState();
      const isVocal = isVocalStem(stem.type);
      const hasContent = stemHasDetectedContent(stem, audioBuffersRef.current[stem.type]);

      if (action === 'vocals-only') {
        return [stem.type, { ...existing, muted: !isVocal, solo: false, volume: isVocal ? Math.max(existing.volume, 0.86) : existing.volume }];
      }
      if (action === 'instrumental-only') {
        return [stem.type, { ...existing, muted: isVocal, solo: false }];
      }
      if (action === 'mute-empty') {
        return [stem.type, { ...existing, muted: !hasContent || existing.muted, solo: false }];
      }
      return [stem.type, { ...existing, muted: false, solo: false }];
    })) as Record<string, StemTrackState>);

    const actionLabel = action === 'vocals-only'
      ? '只听人声'
      : action === 'instrumental-only'
        ? '只听伴奏'
        : action === 'mute-empty'
          ? '静音空轨'
      : '清除静音/独奏';
    setSaveStatus(`已应用“${actionLabel}”，自动保存后下次进入会恢复。`);
  }, [bufferVersion, commitTrackChange, stems]);

  const persistEditState = useCallback(async (source: 'manual' | 'auto') => {
    if (!jobId) {
      if (source === 'manual') {
        setSaveStatus('当前分轨任务还没有缓存 ID，暂时不能保存编辑状态。');
      }
      return;
    }

    if (source === 'manual') {
      setIsSaving(true);
      setSaveStatus(null);
    } else {
      setAutoSaveStatus('自动保存中...');
    }

    try {
      const response = await fetch('/api/stems/edit-state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, editState: { tracks, master: masterState } }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || '保存编辑状态失败');
      }
      if (source === 'manual') {
        setSaveStatus('编辑状态已保存，下次进入会自动恢复。');
      }
      setAutoSaveStatus(`已自动保存 ${new Date().toLocaleTimeString('zh-CN', { hour12: false })}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : '保存编辑状态失败';
      if (source === 'manual') {
        setSaveStatus(message);
      } else {
        setAutoSaveStatus(`自动保存失败：${message}`);
      }
    } finally {
      if (source === 'manual') {
        setIsSaving(false);
      }
    }
  }, [jobId, masterState, tracks]);

  const saveEditState = useCallback(async () => {
    await persistEditState('manual');
  }, [persistEditState]);

  const selectAdjacentTrack = useCallback((direction: -1 | 1) => {
    setSelectedTrackType((currentType) => {
      if (visibleStems.length === 0) return currentType;
      const currentIndex = visibleStems.findIndex((stem) => stem.type === currentType);
      const fallbackIndex = direction > 0 ? -1 : 0;
      const nextIndex = (currentIndex >= 0 ? currentIndex : fallbackIndex) + direction;
      const boundedIndex = Math.min(Math.max(0, nextIndex), visibleStems.length - 1);
      return visibleStems[boundedIndex]?.type ?? currentType;
    });
  }, [visibleStems]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const action = resolveStemEditorShortcut(event);
      if (!action) return;

      event.preventDefault();
      if (action === 'toggle-playback') {
        handleTogglePlayback();
        return;
      }
      if (action === 'save') {
        void saveEditState();
        return;
      }
      if (action === 'undo') {
        undoTrackChange();
        return;
      }
      if (action === 'redo') {
        redoTrackChange();
        return;
      }
      if (action === 'select-previous-track') {
        selectAdjacentTrack(-1);
        return;
      }
      if (action === 'select-next-track') {
        selectAdjacentTrack(1);
        return;
      }
      if (!selectedTrack) return;
      if (action === 'toggle-selected-mute') {
        toggleTrackFlag(selectedTrack.type, 'muted');
        return;
      }
      if (action === 'toggle-selected-solo') {
        toggleTrackFlag(selectedTrack.type, 'solo');
        return;
      }
      resetTrackEdit(selectedTrack.type);
      setSaveStatus(`已重置“${getStemDisplayName(selectedTrack).zh}”的裁剪和淡入淡出。`);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    handleTogglePlayback,
    redoTrackChange,
    resetTrackEdit,
    saveEditState,
    selectAdjacentTrack,
    selectedTrack,
    toggleTrackFlag,
    undoTrackChange,
  ]);

  useEffect(() => {
    if (!jobId) return;
    if (skipNextAutoSaveRef.current) {
      skipNextAutoSaveRef.current = false;
      return;
    }

    if (autoSaveTimerRef.current !== null) {
      window.clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = window.setTimeout(() => {
      autoSaveTimerRef.current = null;
      void persistEditState('auto');
    }, 1400);

    return () => {
      if (autoSaveTimerRef.current !== null) {
        window.clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
    };
  }, [jobId, masterState, persistEditState, tracks]);

  const waitForStemLoadingToSettle = useCallback(async () => {
    const startedAt = Date.now();
    const timeoutMs = 90000;

    while (loadingCountRef.current > 0) {
      const loadedCount = Object.keys(audioBuffersRef.current).length;
      const targetCount = Math.max(0, stems.length - skippedEmptyCount);
      setSaveStatus(`等待分轨缓存完成：已加载 ${loadedCount}/${targetCount}，剩余 ${loadingCountRef.current} 条。`);
      await new Promise((resolve) => { window.setTimeout(resolve, 500); });

      if (Date.now() - startedAt > timeoutMs) {
        throw new Error('等待分轨缓存超时，请稍后再试或切换为“立即导出已加载”。');
      }
    }
  }, [skippedEmptyCount, stems.length]);

  const exportMix = useCallback(async () => {
    setIsExporting(true);
    setPlaybackError(null);
    setSaveStatus(null);

    try {
      if (exportReadiness === 'wait-all' && loadingCountRef.current > 0) {
        await waitForStemLoadingToSettle();
      }

      const exportSourceStems = stems.filter((stem) => !stemHasKnownEmptyWaveform(stem));
      const loadedStems = exportSourceStems.filter((stem) => audioBuffersRef.current[stem.type]);
      if (loadedStems.length === 0) {
        throw new Error('还没有可导出的分轨，请等待至少一条轨道缓存完成。');
      }

      const missingCount = exportSourceStems.length - loadedStems.length;
      const anySolo = Object.values(tracks).some((track) => track.solo);
      const exportableStems = loadedStems.filter((stem) => {
        const state = tracks[stem.type] || defaultTrackState();
        if (exportMode === 'all-tracks') return state.volume > 0;
        if (exportMode === 'solo-only') return state.solo && state.volume > 0;
        return !state.muted && (!anySolo || state.solo) && state.volume > 0;
      });

      if (exportableStems.length === 0) {
        throw new Error(exportMode === 'solo-only'
          ? '当前没有独奏轨道，请先选择至少一条独奏后再导出。'
          : '当前没有可导出的有声轨道，请检查静音、独奏和音量设置。');
      }

      setPlaybackError(missingCount > 0
        ? `还有 ${missingCount} 条分轨未加载，本次以“${exportModeLabel(exportMode)}”导出已就绪的 ${exportableStems.length} 条。`
        : null);
      setSaveStatus(`正在准备“${exportModeLabel(exportMode)}”导出，共 ${exportableStems.length} 条轨道。`);

      const sampleRate = exportableStems
        .map((stem) => audioBuffersRef.current[stem.type]?.sampleRate)
        .find((value): value is number => typeof value === 'number') || 44100;
      const renderDuration = Math.max(
        duration,
        ...exportableStems.map((stem) => audioBuffersRef.current[stem.type]?.duration || 0),
      );
      const frameCount = Math.max(1, Math.ceil(renderDuration * sampleRate));
      const offlineContext = new OfflineAudioContext(2, frameCount, sampleRate);
      const masterOutput = createMasterOutputChain(offlineContext, masterState);

      exportableStems.forEach((stem) => {
        const audioBuffer = audioBuffersRef.current[stem.type];
        if (!audioBuffer) return;
        const state = tracks[stem.type] || defaultTrackState();
        const trimStart = Math.max(0, Math.min(renderDuration, state.trimStart));
        const trimEnd = Math.max(trimStart, Math.min(renderDuration, state.trimEnd ?? renderDuration));
        const clipDuration = Math.max(0, Math.min(audioBuffer.duration, trimEnd) - trimStart);
        if (clipDuration <= 0) return;

        const source = offlineContext.createBufferSource();
        const gain = offlineContext.createGain();
        source.buffer = audioBuffer;
        scheduleTrackGain({
          gain: gain.gain,
          baseVolume: state.volume,
          startAt: trimStart,
          playbackFrom: trimStart,
          trimStart,
          trimEnd,
          fadeIn: state.fadeIn,
          fadeOut: state.fadeOut,
        });
        connectWithPan(offlineContext, source, gain, masterOutput.input, state.pan);
        source.start(trimStart, trimStart, clipDuration);
      });

      const rendered = await offlineContext.startRendering();
      const blob = encodeWav(rendered);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `hookcraft-${exportModeFileLabel(exportMode)}-${formatExportTimestamp(new Date())}.wav`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setSaveStatus(`“${exportModeLabel(exportMode)}”WAV 已导出。`);
    } catch (error) {
      setPlaybackError(error instanceof Error ? error.message : '导出混音失败，请稍后重试。');
    } finally {
      setIsExporting(false);
    }
  }, [duration, exportMode, exportReadiness, masterState, stems, tracks, waitForStemLoadingToSettle]);

  const exportSingleStem = useCallback(async (stem: EditableStem) => {
    setExportingStemType(stem.type);
    setPlaybackError(null);
    setSaveStatus(null);

    try {
      const audioBuffer = audioBuffersRef.current[stem.type];
      if (!audioBuffer) {
        throw new Error('这条分轨还没有缓存完成，请稍后再导出。');
      }

      const state = tracks[stem.type] || defaultTrackState();
      const trimStart = Math.max(0, Math.min(audioBuffer.duration, state.trimStart));
      const trimEnd = Math.max(trimStart, Math.min(audioBuffer.duration, state.trimEnd ?? audioBuffer.duration));
      const clipDuration = Math.max(0, trimEnd - trimStart);
      if (clipDuration <= 0) {
        throw new Error('这条分轨的裁剪区间为空，请调整入点和出点。');
      }

      setSaveStatus(`正在导出“${getStemDisplayName(stem).zh}”单轨。`);
      const sampleRate = audioBuffer.sampleRate || 44100;
      const frameCount = Math.max(1, Math.ceil(clipDuration * sampleRate));
      const offlineContext = new OfflineAudioContext(2, frameCount, sampleRate);
      const source = offlineContext.createBufferSource();
      const gain = offlineContext.createGain();

      source.buffer = audioBuffer;
      scheduleTrackGain({
        gain: gain.gain,
        baseVolume: state.volume,
        startAt: 0,
        playbackFrom: trimStart,
        trimStart,
        trimEnd,
        fadeIn: state.fadeIn,
        fadeOut: state.fadeOut,
      });
      connectWithPan(offlineContext, source, gain, offlineContext.destination, state.pan);
      source.start(0, trimStart, clipDuration);

      const rendered = await offlineContext.startRendering();
      const blob = encodeWav(rendered);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `hookcraft-${normalizeStemType(stem.type)}-${formatExportTimestamp(new Date())}.wav`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setSaveStatus(`“${getStemDisplayName(stem).zh}”单轨 WAV 已导出。`);
    } catch (error) {
      setPlaybackError(error instanceof Error ? error.message : '导出单轨失败，请稍后重试。');
    } finally {
      setExportingStemType(null);
    }
  }, [tracks]);

  return (
    <section style={editorStyle}>
      <div style={editorHeaderStyle}>
        <div>
          <div style={editorEyebrowStyle}>{versionLabel}</div>
          <h4 style={editorTitleStyle}>分轨编辑</h4>
        </div>
        <div style={editorActionStyle}>
          <button type="button" onClick={undoTrackChange} disabled={!canUndo} style={historyButtonStyle(canUndo)}>
            撤销
          </button>
          <button type="button" onClick={redoTrackChange} disabled={!canRedo} style={historyButtonStyle(canRedo)}>
            重做
          </button>
          <button type="button" onClick={saveEditState} disabled={isSaving} style={primarySmallButtonStyle}>
            {isSaving ? '保存中' : '保存编辑'}
          </button>
          <button type="button" onClick={() => void exportMix()} disabled={!exportSummary.canExport} style={primarySmallButtonStyle}>
            {isExporting ? '导出中' : '导出 WAV'}
          </button>
          <button type="button" onClick={() => setShowAdvancedControls((value) => !value)} style={ghostButtonStyle}>
            {showAdvancedControls ? '收起高级' : '高级参数'}
          </button>
          <button type="button" onClick={copyProjectLink} style={ghostButtonStyle}>
            复制链接
          </button>
          <button type="button" onClick={() => void reloadAudioCache()} style={ghostButtonStyle}>
            重载音频
          </button>
          <button type="button" onClick={resetMix} style={ghostButtonStyle}>
            重置混音
          </button>
        </div>
      </div>

      <div style={workbenchTopStyle}>
        <div style={transportPanelStyle}>
          <div style={transportStyle}>
            <button type="button" onClick={handleTogglePlayback} style={playButtonStyle}>
              {isPlaying ? '暂停' : '播放'}
            </button>
            <span style={timeStyle}>{formatTime(currentTime)}</span>
            <input
              aria-label="分轨播放进度"
              type="range"
              min={0}
              max={Math.max(duration, 0.1)}
              step={0.05}
              value={Math.min(currentTime, duration || currentTime)}
              onChange={(event) => handleSeek(Number(event.target.value))}
              style={timelineStyle}
            />
            <span style={timeStyle}>{formatTime(duration)}</span>
          </div>
          <div style={mixerSummaryStyle}>
            <span>{stems.length} 条分轨</span>
            <span>{hasSoloTrack ? '独奏模式' : '全轨预听'}</span>
            <span>
              {loadingCount > 0
                ? `缓存中 ${readyStemCount}/${loadableStemCount}${cachedLoadCount > 0 ? `，本地命中 ${cachedLoadCount}` : ''}`
                : failedLoadCount > 0
                  ? `可播放 ${loadableStemCount - failedLoadCount}/${loadableStemCount}`
                  : `轨道就绪${cachedLoadCount > 0 ? `，本地命中 ${cachedLoadCount}` : ''}`}
            </span>
            {skippedEmptyCount > 0 && <span>已跳过空轨 {skippedEmptyCount}</span>}
          </div>
        </div>

        <div style={controlGridStyle}>
          <div style={controlPanelStyle}>
            <span style={presetLabelStyle}>混音预设</span>
            <div style={buttonWrapStyle}>
              <button type="button" style={presetButtonStyle} onClick={() => applyMixPreset('balanced')}>
                标准平衡
              </button>
              <button type="button" style={presetButtonStyle} onClick={() => applyMixPreset('vocal-focus')}>
                人声突出
              </button>
              <button type="button" style={presetButtonStyle} onClick={() => applyMixPreset('instrumental-wide')}>
                伴奏铺开
              </button>
            </div>
          </div>

          <div style={controlPanelStyle}>
            <span style={presetLabelStyle}>快速操作</span>
            <div style={buttonWrapStyle}>
              <button type="button" style={presetButtonStyle} onClick={() => applyQuickTrackAction('vocals-only')}>
                只听人声
              </button>
              <button type="button" style={presetButtonStyle} onClick={() => applyQuickTrackAction('instrumental-only')}>
                只听伴奏
              </button>
              <button type="button" style={presetButtonStyle} onClick={() => applyQuickTrackAction('mute-empty')}>
                静音空轨
              </button>
              <button type="button" style={presetButtonStyle} onClick={() => applyQuickTrackAction('clear-flags')}>
                清除静音/独奏
              </button>
            </div>
          </div>

          <div style={controlPanelStyle}>
            <span style={presetLabelStyle}>轨道视图</span>
            <div style={buttonWrapStyle}>
              <button type="button" style={viewModeButtonStyle(trackViewMode === 'all')} onClick={() => setTrackViewMode('all')}>
                全部 {stems.length}
              </button>
              <button type="button" style={viewModeButtonStyle(trackViewMode === 'active')} onClick={() => setTrackViewMode('active')}>
                有内容 {activeStemCount}
              </button>
              <button type="button" style={viewModeButtonStyle(trackViewMode === 'audible')} onClick={() => setTrackViewMode('audible')}>
                当前有声 {audibleStemCount}
              </button>
            </div>
          </div>

          <div style={controlPanelStyle}>
            <span style={presetLabelStyle}>母带输出</span>
            <label style={masterOutputControlStyle}>
              <span>{Math.round(masterState.volume * 100)}%</span>
              <input
                aria-label="母带输出音量"
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={masterState.volume}
                onChange={(event) => setMasterVolume(Number(event.target.value))}
              />
            </label>
            <div style={buttonWrapStyle}>
              <button type="button" style={viewModeButtonStyle(masterState.limiter)} onClick={toggleMasterLimiter}>
                防爆音压缩 {masterState.limiter ? '开' : '关'}
              </button>
            </div>
          </div>

          <div style={exportPanelStyle}>
            <div style={exportPanelHeaderStyle}>
              <span style={presetLabelStyle}>导出设置</span>
              <span>
                已加载 {exportSummary.loadedCount}/{loadableStemCount}，将导出 {exportSummary.selectedCount} 条
              </span>
            </div>
            <div style={exportModeGridStyle}>
              <button type="button" style={exportModeButtonStyle(exportMode === 'current-mix')} onClick={() => setExportMode('current-mix')}>
                当前混音
              </button>
              <button type="button" style={exportModeButtonStyle(exportMode === 'all-tracks')} onClick={() => setExportMode('all-tracks')}>
                完整混音
              </button>
              <button type="button" style={exportModeButtonStyle(exportMode === 'solo-only')} onClick={() => setExportMode('solo-only')}>
                只导出独奏
              </button>
            </div>
            <div style={exportReadinessGridStyle}>
              <button type="button" style={exportModeButtonStyle(exportReadiness === 'wait-all')} onClick={() => setExportReadiness('wait-all')}>
                等全部缓存
              </button>
              <button type="button" style={exportModeButtonStyle(exportReadiness === 'ready-only')} onClick={() => setExportReadiness('ready-only')}>
                立即导出已加载
              </button>
            </div>
            <div style={exportHintStyle}>
              {exportMode === 'current-mix' && '按当前静音、独奏、音量、声像、裁剪和淡入淡出导出。'}
              {exportMode === 'all-tracks' && '忽略静音和独奏，只按音量、声像、裁剪和淡入淡出导出全部已加载分轨。'}
              {exportMode === 'solo-only' && '只导出已选择独奏的轨道，适合单独导出人声或乐器组。'}
              {exportSummary.missingCount > 0 && exportReadiness === 'wait-all' && ` 还有 ${exportSummary.missingCount} 条未加载，点击导出后会等待缓存完成。`}
              {exportSummary.missingCount > 0 && exportReadiness === 'ready-only' && ` 还有 ${exportSummary.missingCount} 条未加载，本次只导出已就绪轨道。`}
              {exportSummary.mutedOrSkippedCount > 0 && exportMode !== 'all-tracks' && ` 当前模式会跳过 ${exportSummary.mutedOrSkippedCount} 条轨道。`}
            </div>
          </div>
        </div>
      </div>

      {loadingCount > 0 && (
        <div style={loadingNoticeStyle}>
          分轨在后台缓存中，已就绪的轨道可以先播放和编辑。
          {skippedEmptyCount > 0 ? ` 已根据缓存波形跳过 ${skippedEmptyCount} 条空轨。` : ''}
        </div>
      )}
      {failedLoadCount > 0 && (
        <div style={playbackErrorStyle}>
          {failedLoadCount} 条分轨加载失败，系统已自动清理坏缓存并跳过不可用轨道。
          <button type="button" onClick={() => void reloadAudioCache()} style={inlineRetryButtonStyle}>
            重试加载
          </button>
        </div>
      )}
      {saveStatus && <div style={saveNoticeStyle}>{saveStatus}</div>}
      {autoSaveStatus && <div style={autoSaveNoticeStyle}>{autoSaveStatus}</div>}
      {playbackError && <div style={playbackErrorStyle}>{playbackError}</div>}

      <div style={trackListStyle}>
        {visibleStems.map((stem) => {
          const state = tracks[stem.type] || defaultTrackState();
          const trimEnd = state.trimEnd ?? duration;
          const clipDuration = Math.max(0, trimEnd - state.trimStart);
          const isAudible = !state.muted && (!hasSoloTrack || state.solo);
          const displayName = getStemDisplayName(stem);
          const isSelectedTrack = selectedTrack?.type === stem.type;
          return (
            <div
              key={`${stem.type}-${stem.url}`}
              onClick={() => setSelectedTrackType(stem.type)}
              style={stemTrackStyle(isAudible, state.solo, showAdvancedControls, isSelectedTrack)}
            >
              <div style={stemNameStyle}>
                <span style={stemColorStyle(stem.type)} />
                <div>
                  <div style={stemLabelRowStyle}>
                    <span style={stemLabelStyle}>{displayName.zh}</span>
                    {isSelectedTrack && <span style={selectedTrackBadgeStyle}>已选</span>}
                  </div>
                  <div style={stemTypeStyle}>{displayName.en}</div>
                </div>
              </div>

              <WaveformTrackCanvas
                buffer={audioBuffersRef.current[stem.type] || null}
                waveform={stem.waveform || null}
                color={stemColorForType(stem.type)}
                currentTime={currentTime}
                duration={duration}
                trimStart={state.trimStart}
                trimEnd={trimEnd}
                muted={!isAudible}
                selected={state.solo}
                bufferVersion={bufferVersion}
                onSeek={handleSeek}
                onTrimChange={(edge, time) => setTrackTrim(stem.type, edge, time)}
              />

              <div style={stemButtonsStyle}>
                <button
                  type="button"
                  aria-pressed={state.muted}
                  onClick={() => toggleTrackFlag(stem.type, 'muted')}
                  style={trackToggleStyle(state.muted)}
                >
                  静音
                </button>
                <button
                  type="button"
                  aria-pressed={state.solo}
                  onClick={() => toggleTrackFlag(stem.type, 'solo')}
                  style={trackToggleStyle(state.solo)}
                >
                  独奏
                </button>
                <button
                  type="button"
                  disabled={!audioBuffersRef.current[stem.type] || exportingStemType === stem.type}
                  onClick={() => void exportSingleStem(stem)}
                  style={trackToggleStyle(exportingStemType === stem.type)}
                >
                  {exportingStemType === stem.type ? '导出中' : '导出'}
                </button>
              </div>

              <label style={volumeStyle}>
                <span>{Math.round(state.volume * 100)}%</span>
                <input
                  aria-label={`${stem.label} 音量`}
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={state.volume}
                  onChange={(event) => setTrackVolume(stem.type, Number(event.target.value))}
                />
              </label>

              {showAdvancedControls && (
                <>
                  <label style={panStyle}>
                    <span>{formatPan(state.pan)}</span>
                    <input
                      aria-label={`${stem.label} 声像`}
                      type="range"
                      min={-1}
                      max={1}
                      step={0.01}
                      value={state.pan}
                      onChange={(event) => setTrackPan(stem.type, Number(event.target.value))}
                    />
                  </label>

                  <div style={trimEditorStyle}>
                    <div style={trimHeaderStyle}>
                      <span>裁剪</span>
                      <div style={trimHeaderActionsStyle}>
                        <span>{formatTime(state.trimStart)} - {formatTime(trimEnd)}</span>
                        <button
                          type="button"
                          style={trimResetButtonStyle}
                          onClick={() => resetTrackEdit(stem.type)}
                        >
                          重置
                        </button>
                      </div>
                    </div>
                    <label style={trimControlStyle}>
                      <span>入点</span>
                      <input
                        aria-label={`${stem.label} 裁剪入点`}
                        type="range"
                        min={0}
                        max={Math.max(duration, 0.1)}
                        step={0.05}
                        value={state.trimStart}
                        onChange={(event) => setTrackTrim(stem.type, 'start', Number(event.target.value))}
                      />
                      <input
                        aria-label={`${stem.label} 入点秒数`}
                        type="number"
                        min={0}
                        max={Math.max(duration, 0.1)}
                        step={0.05}
                        value={Number(state.trimStart.toFixed(2))}
                        onChange={(event) => setTrackTrim(stem.type, 'start', Number(event.target.value))}
                        style={trimNumberInputStyle}
                      />
                    </label>
                    <label style={trimControlStyle}>
                      <span>出点</span>
                      <input
                        aria-label={`${stem.label} 裁剪出点`}
                        type="range"
                        min={0}
                        max={Math.max(duration, 0.1)}
                        step={0.05}
                        value={trimEnd}
                        onChange={(event) => setTrackTrim(stem.type, 'end', Number(event.target.value))}
                      />
                      <input
                        aria-label={`${stem.label} 出点秒数`}
                        type="number"
                        min={0}
                        max={Math.max(duration, 0.1)}
                        step={0.05}
                        value={Number(trimEnd.toFixed(2))}
                        onChange={(event) => setTrackTrim(stem.type, 'end', Number(event.target.value))}
                        style={trimNumberInputStyle}
                      />
                    </label>
                    <label style={trimControlStyle}>
                      <span>淡入</span>
                      <input
                        aria-label={`${stem.label} 淡入时长`}
                        type="range"
                        min={0}
                        max={Math.max(clipDuration, 0.1)}
                        step={0.05}
                        value={Math.min(state.fadeIn, clipDuration)}
                        onChange={(event) => setTrackFade(stem.type, 'in', Number(event.target.value))}
                      />
                      <input
                        aria-label={`${stem.label} 淡入秒数`}
                        type="number"
                        min={0}
                        max={Math.max(clipDuration, 0.1)}
                        step={0.05}
                        value={Number(Math.min(state.fadeIn, clipDuration).toFixed(2))}
                        onChange={(event) => setTrackFade(stem.type, 'in', Number(event.target.value))}
                        style={trimNumberInputStyle}
                      />
                    </label>
                    <label style={trimControlStyle}>
                      <span>淡出</span>
                      <input
                        aria-label={`${stem.label} 淡出时长`}
                        type="range"
                        min={0}
                        max={Math.max(clipDuration, 0.1)}
                        step={0.05}
                        value={Math.min(state.fadeOut, clipDuration)}
                        onChange={(event) => setTrackFade(stem.type, 'out', Number(event.target.value))}
                      />
                      <input
                        aria-label={`${stem.label} 淡出秒数`}
                        type="number"
                        min={0}
                        max={Math.max(clipDuration, 0.1)}
                        step={0.05}
                        value={Number(Math.min(state.fadeOut, clipDuration).toFixed(2))}
                        onChange={(event) => setTrackFade(stem.type, 'out', Number(event.target.value))}
                        style={trimNumberInputStyle}
                      />
                    </label>
                  </div>
                </>
              )}
            </div>
          );
        })}
        {visibleStems.length === 0 && (
          <div style={emptyTrackNoticeStyle}>
            当前筛选下没有可显示的轨道，可以切回“全部”查看完整分轨列表。
          </div>
        )}
      </div>
    </section>
  );
}

const editorStyle: CSSProperties = {
  marginTop: 12,
  borderRadius: 12,
  border: '1px solid rgba(117, 54, 213, 0.28)',
  background: 'linear-gradient(180deg, rgba(18, 20, 38, 0.92), rgba(8, 10, 20, 0.78))',
  padding: 18,
};

const editorHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  paddingBottom: 14,
  borderBottom: '1px solid rgba(48, 52, 76, 0.74)',
};

const editorActionStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: 8,
  flexWrap: 'wrap',
};

const primarySmallButtonStyle: CSSProperties = {
  minHeight: 32,
  borderRadius: 8,
  border: '1px solid rgba(156, 108, 255, 0.6)',
  background: '#7536d5',
  color: '#fff',
  padding: '6px 11px',
  cursor: 'pointer',
  fontSize: 12,
  fontWeight: 800,
};

const editorEyebrowStyle: CSSProperties = {
  color: '#8f92aa',
  fontSize: 11,
  fontWeight: 700,
};

const editorTitleStyle: CSSProperties = {
  margin: '4px 0 0',
  color: '#f4f4fb',
  fontSize: 16,
  fontWeight: 800,
};

const ghostButtonStyle: CSSProperties = {
  minHeight: 32,
  borderRadius: 8,
  border: '1px solid #30344c',
  background: '#141727',
  color: '#d8d9e6',
  padding: '6px 11px',
  cursor: 'pointer',
  fontSize: 12,
  fontWeight: 700,
};

function historyButtonStyle(enabled: boolean): CSSProperties {
  return {
    ...ghostButtonStyle,
    opacity: enabled ? 1 : 0.45,
    cursor: enabled ? 'pointer' : 'not-allowed',
  };
}

const workbenchTopStyle: CSSProperties = {
  marginTop: 14,
  display: 'grid',
  gridTemplateColumns: 'minmax(320px, 1fr) minmax(360px, 0.92fr)',
  gap: 12,
  alignItems: 'stretch',
};

const transportPanelStyle: CSSProperties = {
  borderRadius: 12,
  border: '1px solid rgba(48, 52, 76, 0.76)',
  background: 'rgba(7, 9, 18, 0.66)',
  padding: 14,
  minWidth: 0,
};

const transportStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '72px 50px minmax(0, 1fr) 50px',
  gap: 10,
  alignItems: 'center',
};

const playButtonStyle: CSSProperties = {
  minHeight: 36,
  border: 'none',
  borderRadius: 8,
  background: '#7536d5',
  color: '#fff',
  fontSize: 13,
  fontWeight: 800,
  cursor: 'pointer',
};

const timeStyle: CSSProperties = {
  color: '#cfd0dc',
  fontSize: 12,
  fontVariantNumeric: 'tabular-nums',
  textAlign: 'center',
};

const timelineStyle: CSSProperties = {
  width: '100%',
  accentColor: '#9c6cff',
};

const mixerSummaryStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 10,
  marginTop: 12,
  color: '#9ca3af',
  fontSize: 11,
};

const controlGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 10,
  minWidth: 0,
};

const controlPanelStyle: CSSProperties = {
  minWidth: 0,
  borderRadius: 12,
  border: '1px solid rgba(48, 52, 76, 0.74)',
  background: 'rgba(12, 15, 27, 0.74)',
  padding: '10px 12px',
};

const buttonWrapStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: 8,
  marginTop: 8,
};

const masterOutputControlStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '44px minmax(0, 1fr)',
  alignItems: 'center',
  gap: 8,
  marginTop: 8,
  color: '#cfd0dc',
  fontSize: 12,
  fontWeight: 800,
};

const presetLabelStyle: CSSProperties = {
  color: '#9ca3af',
  fontSize: 12,
  fontWeight: 800,
  marginRight: 2,
};

const presetButtonStyle: CSSProperties = {
  minHeight: 30,
  borderRadius: 7,
  border: '1px solid rgba(156, 108, 255, 0.42)',
  background: 'rgba(117, 54, 213, 0.16)',
  color: '#dfd7ff',
  padding: '5px 10px',
  cursor: 'pointer',
  fontSize: 12,
  fontWeight: 800,
};

function viewModeButtonStyle(active: boolean): CSSProperties {
  return {
    ...presetButtonStyle,
    border: active ? '1px solid rgba(156, 108, 255, 0.82)' : presetButtonStyle.border,
    background: active ? 'rgba(117, 54, 213, 0.34)' : presetButtonStyle.background,
    color: active ? '#f2ebff' : presetButtonStyle.color,
  };
}

const exportPanelStyle: CSSProperties = {
  minWidth: 0,
  padding: '10px 12px',
  borderRadius: 12,
  border: '1px solid rgba(48, 52, 76, 0.74)',
  background: 'rgba(12, 15, 27, 0.84)',
};

const exportPanelHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 10,
  color: '#9ca3af',
  fontSize: 12,
  fontWeight: 700,
};

const exportModeGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: 8,
  marginTop: 8,
};

const exportReadinessGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 8,
  marginTop: 8,
};

function exportModeButtonStyle(active: boolean): CSSProperties {
  return {
    minHeight: 32,
    borderRadius: 8,
    border: active ? '1px solid rgba(156, 108, 255, 0.86)' : '1px solid rgba(48, 52, 76, 0.9)',
    background: active ? 'rgba(117, 54, 213, 0.34)' : '#141727',
    color: active ? '#f2ebff' : '#c9ccdc',
    padding: '6px 8px',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 800,
  };
}

const exportHintStyle: CSSProperties = {
  marginTop: 8,
  color: '#8f92aa',
  fontSize: 11,
  lineHeight: 1.6,
};

const playbackErrorStyle: CSSProperties = {
  marginTop: 10,
  borderRadius: 8,
  border: '1px solid rgba(248, 113, 113, 0.28)',
  background: 'rgba(239, 68, 68, 0.1)',
  color: '#fca5a5',
  padding: '8px 10px',
  fontSize: 12,
};

const inlineRetryButtonStyle: CSSProperties = {
  marginLeft: 10,
  minHeight: 26,
  borderRadius: 7,
  border: '1px solid rgba(248, 113, 113, 0.42)',
  background: 'rgba(239, 68, 68, 0.14)',
  color: '#fecaca',
  padding: '4px 9px',
  cursor: 'pointer',
  fontSize: 12,
  fontWeight: 800,
};

const loadingNoticeStyle: CSSProperties = {
  marginTop: 10,
  borderRadius: 8,
  border: '1px solid rgba(192, 167, 252, 0.22)',
  background: 'rgba(117, 54, 213, 0.1)',
  color: '#cbb8ff',
  padding: '8px 10px',
  fontSize: 12,
};

const saveNoticeStyle: CSSProperties = {
  marginTop: 10,
  borderRadius: 8,
  border: '1px solid rgba(34, 197, 94, 0.28)',
  background: 'rgba(34, 197, 94, 0.1)',
  color: '#86efac',
  padding: '8px 10px',
  fontSize: 12,
};

const autoSaveNoticeStyle: CSSProperties = {
  marginTop: 10,
  borderRadius: 8,
  border: '1px solid rgba(59, 130, 246, 0.24)',
  background: 'rgba(37, 99, 235, 0.1)',
  color: '#bfdbfe',
  padding: '8px 10px',
  fontSize: 12,
};

const trackListStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 9,
  marginTop: 14,
  paddingTop: 12,
  borderTop: '1px solid rgba(48, 52, 76, 0.74)',
};

const emptyTrackNoticeStyle: CSSProperties = {
  borderRadius: 10,
  border: '1px dashed rgba(156, 108, 255, 0.32)',
  background: 'rgba(117, 54, 213, 0.08)',
  color: '#cbb8ff',
  padding: '18px 14px',
  fontSize: 12,
  textAlign: 'center',
};

function stemTrackStyle(audible: boolean, solo: boolean, advanced: boolean, selectedTrack: boolean): CSSProperties {
  return {
    display: 'grid',
    gridTemplateColumns: advanced
      ? 'minmax(150px, 0.62fr) minmax(240px, 1.25fr) auto minmax(130px, 160px) minmax(130px, 160px) minmax(220px, 0.95fr)'
      : 'minmax(150px, 0.7fr) minmax(280px, 1.6fr) auto minmax(140px, 180px)',
    alignItems: 'center',
    gap: 12,
    borderRadius: 10,
    border: selectedTrack
      ? '1px solid rgba(125, 211, 252, 0.78)'
      : solo
        ? '1px solid rgba(156, 108, 255, 0.82)'
        : '1px solid #262a40',
    background: selectedTrack
      ? 'rgba(14, 165, 233, 0.1)'
      : solo
        ? 'rgba(117, 54, 213, 0.12)'
        : '#101321',
    boxShadow: selectedTrack
      ? '0 0 0 1px rgba(125, 211, 252, 0.12)'
      : solo
        ? '0 0 0 1px rgba(156, 108, 255, 0.12)'
        : 'none',
    opacity: audible ? 1 : 0.46,
    padding: '12px 14px',
    cursor: 'pointer',
    transition: 'opacity 140ms ease, border-color 140ms ease, background 140ms ease',
  };
}

const stemNameStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  minWidth: 0,
};

const stemLabelRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 7,
  minWidth: 0,
};

const stemLabelStyle: CSSProperties = {
  color: '#f0f1fb',
  fontSize: 13,
  fontWeight: 800,
};

const selectedTrackBadgeStyle: CSSProperties = {
  borderRadius: 999,
  border: '1px solid rgba(125, 211, 252, 0.42)',
  background: 'rgba(14, 165, 233, 0.14)',
  color: '#bae6fd',
  padding: '1px 6px',
  fontSize: 10,
  fontWeight: 800,
  whiteSpace: 'nowrap',
};

const stemTypeStyle: CSSProperties = {
  color: '#717791',
  fontSize: 11,
  marginTop: 2,
  textTransform: 'capitalize',
};

const stemButtonsStyle: CSSProperties = {
  display: 'flex',
  gap: 6,
};

function trackToggleStyle(active: boolean): CSSProperties {
  return {
    width: 42,
    minHeight: 30,
    borderRadius: 7,
    border: active ? '1px solid rgba(156, 108, 255, 0.75)' : '1px solid #30344c',
    background: active ? 'rgba(117, 54, 213, 0.28)' : '#171a2c',
    color: active ? '#eadcff' : '#aeb2c9',
    cursor: 'pointer',
    fontSize: 11,
    fontWeight: 800,
  };
}

const volumeStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '42px minmax(0, 1fr)',
  alignItems: 'center',
  gap: 8,
  color: '#9ca3af',
  fontSize: 11,
  fontWeight: 700,
};

const panStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '42px minmax(0, 1fr)',
  alignItems: 'center',
  gap: 8,
  color: '#9ca3af',
  fontSize: 11,
  fontWeight: 700,
};

const trimEditorStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 5,
  minWidth: 0,
};

const trimHeaderStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 8,
  color: '#9ca3af',
  fontSize: 11,
  fontWeight: 700,
};

const trimHeaderActionsStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: 6,
  minWidth: 0,
};

const trimResetButtonStyle: CSSProperties = {
  minHeight: 22,
  borderRadius: 6,
  border: '1px solid #30344c',
  background: '#171a2c',
  color: '#aeb2c9',
  padding: '2px 7px',
  cursor: 'pointer',
  fontSize: 10,
  fontWeight: 800,
};

const trimControlStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '30px minmax(0, 1fr) 58px',
  alignItems: 'center',
  gap: 8,
  color: '#717791',
  fontSize: 10,
};

const trimNumberInputStyle: CSSProperties = {
  width: '100%',
  minHeight: 24,
  borderRadius: 6,
  border: '1px solid #30344c',
  background: '#0f1220',
  color: '#cfd0dc',
  padding: '2px 5px',
  fontSize: 10,
  fontVariantNumeric: 'tabular-nums',
};

function WaveformTrackCanvas({
  buffer,
  waveform,
  color,
  currentTime,
  duration,
  trimStart,
  trimEnd,
  muted,
  selected,
  bufferVersion,
  onSeek,
  onTrimChange,
}: {
  buffer: AudioBuffer | null;
  waveform: StemWaveform | null;
  color: string;
  currentTime: number;
  duration: number;
  trimStart: number;
  trimEnd: number;
  muted: boolean;
  selected: boolean;
  bufferVersion: number;
  onSeek: (time: number) => void;
  onTrimChange: (edge: 'start' | 'end', time: number) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pendingSeekRef = useRef<{ x: number; time: number; moved: boolean } | null>(null);
  const trimDragRef = useRef<{ edge: 'start' | 'end'; moved: boolean } | null>(null);
  const pendingTrimTimeRef = useRef<number | null>(null);
  const trimFrameRef = useRef<number | null>(null);

  const timeFromPointer = useCallback((event: PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = rect.width > 0
      ? Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width))
      : 0;
    return ratio * duration;
  }, [duration]);

  const scheduleTrimChange = useCallback((time: number) => {
    pendingTrimTimeRef.current = time;
    if (trimFrameRef.current !== null) return;

    trimFrameRef.current = window.requestAnimationFrame(() => {
      trimFrameRef.current = null;
      const dragState = trimDragRef.current;
      const nextTime = pendingTrimTimeRef.current;
      pendingTrimTimeRef.current = null;
      if (!dragState || nextTime === null) return;
      onTrimChange(dragState.edge, nextTime);
    });
  }, [onTrimChange]);

  const cancelScheduledTrimChange = useCallback(() => {
    if (trimFrameRef.current !== null) {
      window.cancelAnimationFrame(trimFrameRef.current);
      trimFrameRef.current = null;
    }
    pendingTrimTimeRef.current = null;
  }, []);

  useEffect(() => () => {
    cancelScheduledTrimChange();
  }, [cancelScheduledTrimChange]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;
      const width = Math.max(1, Math.floor(rect.width * ratio));
      const height = Math.max(1, Math.floor(rect.height * ratio));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      const context = canvas.getContext('2d');
      if (!context) return;

      context.clearRect(0, 0, width, height);
      context.fillStyle = '#0b0e1c';
      context.fillRect(0, 0, width, height);

      const centerY = height / 2;
      context.strokeStyle = 'rgba(255,255,255,0.08)';
      context.beginPath();
      context.moveTo(0, centerY);
      context.lineTo(width, centerY);
      context.stroke();

      if (!buffer && waveform?.peaks?.length && duration > 0) {
        context.strokeStyle = muted ? 'rgba(148, 163, 184, 0.46)' : color;
        context.lineWidth = Math.max(1, ratio);
        context.beginPath();
        const step = Math.max(1, Math.floor(width / waveform.peaks.length));
        waveform.peaks.forEach((peak, index) => {
          const x = index * step;
          const y = Math.max(1, Math.min(centerY, peak * centerY * 0.9));
          context.moveTo(x, centerY - y);
          context.lineTo(x, centerY + y);
        });
        context.stroke();
      }

      if (!buffer && !waveform?.peaks?.length) {
        context.fillStyle = 'rgba(156, 108, 255, 0.13)';
        context.fillRect(0, 0, width, height);
        context.fillStyle = '#8f92aa';
        context.font = `${Math.max(10, 11 * ratio)}px sans-serif`;
        context.textAlign = 'center';
        context.fillText('正在准备波形', width / 2, centerY + 4 * ratio);
        return;
      }

      if (buffer) {
        const samples = buffer.getChannelData(0);
        const samplesPerPixel = Math.max(1, Math.floor(samples.length / width));
        context.strokeStyle = muted ? 'rgba(148, 163, 184, 0.46)' : color;
        context.lineWidth = Math.max(1, ratio);
        context.beginPath();

        for (let x = 0; x < width; x += Math.max(1, Math.floor(ratio))) {
          const start = x * samplesPerPixel;
          const end = Math.min(samples.length, start + samplesPerPixel);
          let min = 0;
          let max = 0;
          for (let i = start; i < end; i += 1) {
            const sample = samples[i] || 0;
            if (sample < min) min = sample;
            if (sample > max) max = sample;
          }
          context.moveTo(x, centerY + min * centerY * 0.9);
          context.lineTo(x, centerY + max * centerY * 0.9);
        }
        context.stroke();
      }

      const startX = (Math.max(0, trimStart) / duration) * width;
      const endX = (Math.min(duration, trimEnd) / duration) * width;
      context.fillStyle = 'rgba(5, 7, 14, 0.58)';
      context.fillRect(0, 0, startX, height);
      context.fillRect(endX, 0, Math.max(0, width - endX), height);

      context.fillStyle = selected ? 'rgba(156, 108, 255, 0.11)' : 'rgba(255,255,255,0.04)';
      context.fillRect(startX, 0, Math.max(0, endX - startX), height);

      context.strokeStyle = selected ? '#d8c9ff' : '#a855f7';
      context.lineWidth = Math.max(2, 2 * ratio);
      context.beginPath();
      context.moveTo(startX, 0);
      context.lineTo(startX, height);
      context.moveTo(endX, 0);
      context.lineTo(endX, height);
      context.stroke();

      context.fillStyle = selected ? '#d8c9ff' : '#a855f7';
      context.fillRect(startX - 5 * ratio, 0, 10 * ratio, height);
      context.fillRect(endX - 5 * ratio, 0, 10 * ratio, height);
      context.fillStyle = 'rgba(255,255,255,0.95)';
      context.fillRect(startX - 1 * ratio, 6 * ratio, 2 * ratio, height - 12 * ratio);
      context.fillRect(endX - 1 * ratio, 6 * ratio, 2 * ratio, height - 12 * ratio);

      context.fillStyle = 'rgba(255,255,255,0.78)';
      context.font = `${Math.max(9, 10 * ratio)}px sans-serif`;
      context.textAlign = 'center';
      context.fillText('入', Math.max(10 * ratio, Math.min(width - 10 * ratio, startX)), 12 * ratio);
      context.fillText('出', Math.max(10 * ratio, Math.min(width - 10 * ratio, endX)), height - 6 * ratio);

      const playheadX = (Math.min(duration, Math.max(0, currentTime)) / duration) * width;
      context.strokeStyle = 'rgba(255,255,255,0.58)';
      context.lineWidth = Math.max(1, ratio);
      context.beginPath();
      context.moveTo(playheadX, 0);
      context.lineTo(playheadX, height);
      context.stroke();
    };

    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [buffer, bufferVersion, color, currentTime, duration, muted, selected, trimEnd, trimStart, waveform]);

  const handlePointerDown = useCallback((event: PointerEvent<HTMLCanvasElement>) => {
    if (duration <= 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    const time = ratio * duration;
    const startX = (Math.max(0, trimStart) / duration) * rect.width;
    const endX = (Math.min(duration, trimEnd) / duration) * rect.width;
    const pointerX = event.clientX - rect.left;
    const hitSize = 14;
    const startDistance = Math.abs(pointerX - startX);
    const endDistance = Math.abs(pointerX - endX);

    if (startDistance <= hitSize || endDistance <= hitSize) {
      trimDragRef.current = {
        edge: startDistance <= endDistance ? 'start' : 'end',
        moved: false,
      };
      pendingSeekRef.current = null;
      event.preventDefault();
    } else {
      pendingSeekRef.current = { x: event.clientX, time, moved: false };
      trimDragRef.current = null;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
  }, [duration, trimEnd, trimStart]);

  const handlePointerMove = useCallback((event: PointerEvent<HTMLCanvasElement>) => {
    if (trimDragRef.current) {
      trimDragRef.current.moved = true;
      scheduleTrimChange(timeFromPointer(event));
      event.preventDefault();
      return;
    }

    if (pendingSeekRef.current && Math.abs(event.clientX - pendingSeekRef.current.x) > 4) {
      pendingSeekRef.current.moved = true;
    }
  }, [scheduleTrimChange, timeFromPointer]);

  const handlePointerUp = useCallback((event: PointerEvent<HTMLCanvasElement>) => {
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // Pointer capture may already be released if the browser cancelled it.
    }

    if (trimDragRef.current) {
      cancelScheduledTrimChange();
      if (!trimDragRef.current.moved) {
        onTrimChange(trimDragRef.current.edge, timeFromPointer(event));
      } else {
        onTrimChange(trimDragRef.current.edge, timeFromPointer(event));
      }
      trimDragRef.current = null;
      pendingSeekRef.current = null;
      return;
    }

    const pendingSeek = pendingSeekRef.current;
    pendingSeekRef.current = null;
    if (pendingSeek && !pendingSeek.moved) {
      onSeek(pendingSeek.time);
    }
  }, [cancelScheduledTrimChange, onSeek, onTrimChange, timeFromPointer]);

  return (
    <canvas
      ref={canvasRef}
      aria-label="Stem waveform. Click to seek, drag trim handles to edit this track."
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={waveformCanvasStyle(selected, muted)}
    />
  );
}

function waveformCanvasStyle(selected: boolean, muted: boolean): CSSProperties {
  return {
    width: '100%',
    height: 58,
    borderRadius: 8,
    border: selected ? '1px solid rgba(156, 108, 255, 0.78)' : '1px solid rgba(48, 52, 76, 0.86)',
    background: '#0b0e1c',
    cursor: 'pointer',
    opacity: muted ? 0.72 : 1,
    touchAction: 'none',
    userSelect: 'none',
  };
}

function stemColorForType(type: string) {
  const colorMap: Record<string, string> = {
    vocals: '#4d8cff',
    backing_vocals: '#38bdf8',
    drums: '#fb923c',
    bass: '#facc15',
    guitar: '#f97316',
    piano: '#a78bfa',
    keyboard: '#c084fc',
    percussion: '#ef4444',
    strings: '#34d399',
    synth: '#2dd4bf',
    fx: '#f472b6',
    brass: '#f59e0b',
    woodwinds: '#84cc16',
  };

  return colorMap[type] || '#94a3b8';
}

function stemColorStyle(type: string): CSSProperties {
  return {
    width: 8,
    height: 32,
    flexShrink: 0,
    borderRadius: 999,
    background: stemColorForType(type),
  };
}

