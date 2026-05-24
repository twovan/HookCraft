'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent } from 'react';

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
  muted: boolean;
  solo: boolean;
  trimStart: number;
  trimEnd: number | null;
}

export interface StemEditState {
  tracks: Record<string, StemTrackState>;
  savedAt?: string;
}

interface StemMixerEditorProps {
  stems: EditableStem[];
  versionLabel: string;
  jobId?: string;
  initialEditState?: StemEditState | null;
}

function defaultTrackState(): StemTrackState {
  return { volume: 1, muted: false, solo: false, trimStart: 0, trimEnd: null };
}

function normalizeTrackState(value: Partial<StemTrackState> | undefined | null): StemTrackState {
  return {
    volume: typeof value?.volume === 'number' ? Math.max(0, Math.min(1, value.volume)) : 1,
    muted: value?.muted === true,
    solo: value?.solo === true,
    trimStart: typeof value?.trimStart === 'number' ? Math.max(0, value.trimStart) : 0,
    trimEnd: typeof value?.trimEnd === 'number' ? Math.max(0, value.trimEnd) : null,
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

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds)) return '0:00';
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remaining = safeSeconds % 60;
  return `${minutes}:${String(remaining).padStart(2, '0')}`;
}

const STEM_LOAD_CONCURRENCY = 3;
const INITIAL_STEM_LOAD_COUNT = 6;
const DEFERRED_STEM_LOAD_DELAY_MS = 2200;
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

async function readStemArrayBuffer(url: string, signal: AbortSignal) {
  if ('caches' in window) {
    const cache = await caches.open('hookcraft-stem-audio-v1');
    const cached = await cache.match(url);
    if (cached) {
      return {
        buffer: await cached.arrayBuffer(),
        source: 'browser-cache' as const,
      };
    }

    const response = await fetch(url, {
      cache: 'force-cache',
      credentials: 'same-origin',
      signal,
    });
    if (!response.ok) throw new Error('Stem request failed');

    const clone = response.clone();
    const buffer = await response.arrayBuffer();
    if (!signal.aborted) {
      await cache.put(url, clone).catch(() => undefined);
    }
    return { buffer, source: 'network' as const };
  }

  const response = await fetch(url, {
    cache: 'force-cache',
    credentials: 'same-origin',
    signal,
  });
  if (!response.ok) throw new Error('Stem request failed');
  return {
    buffer: await response.arrayBuffer(),
    source: 'network' as const,
  };
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

export default function StemMixerEditor({ stems, versionLabel, jobId, initialEditState }: StemMixerEditorProps) {
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioBuffersRef = useRef<Record<string, AudioBuffer>>({});
  const gainNodesRef = useRef<Record<string, GainNode>>({});
  const sourceNodesRef = useRef<Record<string, AudioBufferSourceNode>>({});
  const playbackStartedAtRef = useRef(0);
  const playbackOffsetRef = useRef(0);
  const frameRef = useRef<number | null>(null);
  const [tracks, setTracks] = useState<Record<string, StemTrackState>>(() => createTrackState(stems, initialEditState));
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(() => getInitialWaveformDuration(stems));
  const [loadingCount, setLoadingCount] = useState(stems.length);
  const [failedLoadCount, setFailedLoadCount] = useState(0);
  const [cachedLoadCount, setCachedLoadCount] = useState(0);
  const [bufferVersion, setBufferVersion] = useState(0);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<string | null>(initialEditState?.savedAt ? '已读取上次保存的编辑状态。' : null);
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const masterStem = stems[0] || null;
  const hasSoloTrack = useMemo(
    () => Object.values(tracks).some((track) => track.solo),
    [tracks],
  );

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
      source.disconnect();
    });
    sourceNodesRef.current = {};
  }, []);

  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }
    return audioContextRef.current;
  }, []);

  useEffect(() => {
    setTracks(createTrackState(stems, initialEditState));
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(getInitialWaveformDuration(stems));
    setLoadingCount(stems.length);
    setFailedLoadCount(0);
    setCachedLoadCount(0);
    setBufferVersion(0);
    setPlaybackError(null);
    setSaveStatus(initialEditState?.savedAt ? '已读取上次保存的编辑状态。' : null);
    playbackStartedAtRef.current = 0;
    playbackOffsetRef.current = 0;
    audioBuffersRef.current = {};
    stopSources();
    stopFrame();

    const context = getAudioContext();
    const abortController = new AbortController();

    const prioritizedStems = sortStemsByLoadPriority(stems);
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
        const loaded = await readStemArrayBuffer(stem.url, abortController.signal);
        if (abortController.signal.aborted) return;
        if (loaded.source === 'browser-cache') {
          setCachedLoadCount((count) => count + 1);
        }

        const audioBuffer = await context.decodeAudioData(loaded.buffer);
        if (abortController.signal.aborted) return;

        audioBuffersRef.current[stem.type] = audioBuffer;
        setBufferVersion((version) => version + 1);
        setDuration((current) => Math.max(current, audioBuffer.duration || 0));

        if (!stem.waveform?.peaks?.length) {
          void persistWaveform(jobId, stem.type, calculateWaveform(audioBuffer));
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
  }, [getAudioContext, initialEditState, jobId, stems, stopFrame, stopSources]);

  useEffect(() => () => {
    stopSources();
    stopFrame();
    const context = audioContextRef.current;
    audioContextRef.current = null;
    void context?.close();
  }, [stopFrame, stopSources]);

  useEffect(() => {
    stems.forEach((stem) => {
      const gain = gainNodesRef.current[stem.type];
      const state = tracks[stem.type];
      if (!gain || !state) return;

      const isAudible = !state.muted && (!hasSoloTrack || state.solo);
      gain.gain.value = isAudible ? state.volume : 0;
    });
  }, [hasSoloTrack, stems, tracks]);

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

      const startAt = context.currentTime + 0.04;
      playableStems.forEach((stem) => {
        const source = context.createBufferSource();
        const gain = context.createGain();
        const state = tracks[stem.type] || { volume: 1, muted: false, solo: false, trimStart: 0, trimEnd: null };
        const isAudible = !state.muted && (!hasSoloTrack || state.solo);
        const trimStart = Math.max(0, Math.min(duration, state.trimStart));
        const trimEnd = Math.max(trimStart, Math.min(duration, state.trimEnd ?? duration));
        const cursor = playbackOffsetRef.current;
        const isInClip = cursor < trimEnd;
        const startDelay = Math.max(0, trimStart - cursor);
        const bufferOffset = Math.max(trimStart, cursor);
        const playableDuration = Math.max(0, trimEnd - bufferOffset);

        source.buffer = audioBuffersRef.current[stem.type];
        gain.gain.value = isAudible ? state.volume : 0;
        source.connect(gain);
        gain.connect(context.destination);
        gainNodesRef.current[stem.type] = gain;
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
  }, [getAudioContext, hasSoloTrack, loadingCount, masterStem, pauseAll, stems, stopFrame, stopSources, tracks, duration]);

  const handleTogglePlayback = useCallback(() => {
    if (isPlaying) {
      pauseAll();
      return;
    }

    void playAll();
  }, [isPlaying, pauseAll, playAll]);

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
    setTracks((current) => ({
      ...current,
      [type]: {
        ...(current[type] || { volume: 1, muted: false, solo: false, trimStart: 0, trimEnd: null }),
        [flag]: !current[type]?.[flag],
      },
    }));
  }, []);

  const setTrackVolume = useCallback((type: string, volume: number) => {
    setTracks((current) => ({
      ...current,
      [type]: {
        ...(current[type] || { volume: 1, muted: false, solo: false, trimStart: 0, trimEnd: null }),
        volume,
      },
    }));
  }, []);

  const setTrackTrim = useCallback((type: string, edge: 'start' | 'end', value: number) => {
    setTracks((current) => {
      const state = current[type] || { volume: 1, muted: false, solo: false, trimStart: 0, trimEnd: null };
      const currentEnd = state.trimEnd ?? duration;
      const nextTrim = clampTrimEdge(edge, value, state.trimStart, currentEnd, duration);

      return {
        ...current,
        [type]: {
          ...state,
          trimStart: nextTrim.trimStart,
          trimEnd: Math.min(duration, nextTrim.trimEnd),
        },
      };
    });
  }, [duration]);

  const resetMix = useCallback(() => {
    setTracks(createTrackState(stems));
    setSaveStatus('混音已重置，保存后下次进入会使用新状态。');
  }, [stems]);

  const saveEditState = useCallback(async () => {
    if (!jobId) {
      setSaveStatus('当前分轨任务还没有缓存 ID，暂时不能保存编辑状态。');
      return;
    }

    setIsSaving(true);
    setSaveStatus(null);
    try {
      const response = await fetch('/api/stems/edit-state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, editState: { tracks } }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || '保存编辑状态失败');
      }
      setSaveStatus('编辑状态已保存，下次进入会自动恢复。');
    } catch (error) {
      setSaveStatus(error instanceof Error ? error.message : '保存编辑状态失败');
    } finally {
      setIsSaving(false);
    }
  }, [jobId, tracks]);

  const exportMix = useCallback(async () => {
    const loadedStems = stems.filter((stem) => audioBuffersRef.current[stem.type]);
    if (loadedStems.length === 0) {
      setPlaybackError('还没有可导出的分轨，请等待至少一条轨道缓存完成。');
      return;
    }

    const missingCount = stems.length - loadedStems.length;
    setIsExporting(true);
    setPlaybackError(missingCount > 0
      ? `还有 ${missingCount} 条分轨未加载，本次只导出已就绪的 ${loadedStems.length} 条。`
      : null);

    try {
      const sampleRate = loadedStems
        .map((stem) => audioBuffersRef.current[stem.type]?.sampleRate)
        .find((value): value is number => typeof value === 'number') || 44100;
      const renderDuration = Math.max(
        duration,
        ...loadedStems.map((stem) => audioBuffersRef.current[stem.type]?.duration || 0),
      );
      const frameCount = Math.max(1, Math.ceil(renderDuration * sampleRate));
      const offlineContext = new OfflineAudioContext(2, frameCount, sampleRate);
      const anySolo = Object.values(tracks).some((track) => track.solo);

      loadedStems.forEach((stem) => {
        const audioBuffer = audioBuffersRef.current[stem.type];
        if (!audioBuffer) return;
        const state = tracks[stem.type] || defaultTrackState();
        const isAudible = !state.muted && (!anySolo || state.solo);
        const trimStart = Math.max(0, Math.min(renderDuration, state.trimStart));
        const trimEnd = Math.max(trimStart, Math.min(renderDuration, state.trimEnd ?? renderDuration));
        const clipDuration = Math.max(0, Math.min(audioBuffer.duration, trimEnd) - trimStart);
        if (!isAudible || clipDuration <= 0) return;

        const source = offlineContext.createBufferSource();
        const gain = offlineContext.createGain();
        source.buffer = audioBuffer;
        gain.gain.value = state.volume;
        source.connect(gain);
        gain.connect(offlineContext.destination);
        source.start(trimStart, trimStart, clipDuration);
      });

      const rendered = await offlineContext.startRendering();
      const blob = encodeWav(rendered);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `hookcraft-mix-${new Date().toISOString().slice(0, 19).replaceAll(':', '-')}.wav`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setSaveStatus('混音 WAV 已导出。');
    } catch (error) {
      setPlaybackError(error instanceof Error ? error.message : '导出混音失败，请稍后重试。');
    } finally {
      setIsExporting(false);
    }
  }, [duration, stems, tracks]);

  const readyStemCount = stems.length - loadingCount - failedLoadCount;

  return (
    <section style={editorStyle}>
      <div style={editorHeaderStyle}>
        <div>
          <div style={editorEyebrowStyle}>{versionLabel}</div>
          <h4 style={editorTitleStyle}>分轨编辑</h4>
        </div>
        <div style={editorActionStyle}>
          <button type="button" onClick={saveEditState} disabled={isSaving} style={primarySmallButtonStyle}>
            {isSaving ? '保存中' : '保存编辑'}
          </button>
          <button type="button" onClick={() => void exportMix()} disabled={isExporting} style={primarySmallButtonStyle}>
            {isExporting ? '导出中' : '导出 WAV'}
          </button>
          <button type="button" onClick={resetMix} style={ghostButtonStyle}>
            重置混音
          </button>
        </div>
      </div>

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
            ? `缓存中 ${readyStemCount}/${stems.length}${cachedLoadCount > 0 ? `，本地命中 ${cachedLoadCount}` : ''}`
            : failedLoadCount > 0
              ? `可播放 ${stems.length - failedLoadCount}/${stems.length}`
              : `轨道就绪${cachedLoadCount > 0 ? `，本地命中 ${cachedLoadCount}` : ''}`}
        </span>
      </div>

      {loadingCount > 0 && (
        <div style={loadingNoticeStyle}>分轨在后台缓存中，已就绪的轨道可以先播放和编辑。</div>
      )}
      {saveStatus && <div style={saveNoticeStyle}>{saveStatus}</div>}
      {playbackError && <div style={playbackErrorStyle}>{playbackError}</div>}

      <div style={trackListStyle}>
        {stems.map((stem) => {
          const state = tracks[stem.type] || { volume: 1, muted: false, solo: false, trimStart: 0, trimEnd: null };
          const trimEnd = state.trimEnd ?? duration;
          const isAudible = !state.muted && (!hasSoloTrack || state.solo);
          return (
            <div key={`${stem.type}-${stem.url}`} style={stemTrackStyle(isAudible, state.solo)}>
              <div style={stemNameStyle}>
                <span style={stemColorStyle(stem.type)} />
                <div>
                  <div style={stemLabelStyle}>{stem.label}</div>
                  <div style={stemTypeStyle}>{stem.type.replaceAll('_', ' ')}</div>
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

              <div style={trimEditorStyle}>
                <div style={trimHeaderStyle}>
                  <span>裁剪</span>
                  <div style={trimHeaderActionsStyle}>
                    <span>{formatTime(state.trimStart)} - {formatTime(trimEnd)}</span>
                    <button
                      type="button"
                      style={trimResetButtonStyle}
                      onClick={() => {
                        setTrackTrim(stem.type, 'start', 0);
                        setTrackTrim(stem.type, 'end', duration);
                      }}
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
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

const editorStyle: CSSProperties = {
  marginTop: 12,
  borderRadius: 12,
  border: '1px solid rgba(117, 54, 213, 0.28)',
  background: 'rgba(8, 10, 20, 0.72)',
  padding: 16,
};

const editorHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
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

const transportStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '72px 44px minmax(0, 1fr) 44px',
  gap: 10,
  alignItems: 'center',
  marginTop: 14,
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
  gap: 8,
  marginTop: 10,
  color: '#9ca3af',
  fontSize: 11,
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

const trackListStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  marginTop: 12,
};

function stemTrackStyle(audible: boolean, selected: boolean): CSSProperties {
  return {
    display: 'grid',
    gridTemplateColumns: 'minmax(150px, 0.65fr) minmax(260px, 1.35fr) auto minmax(140px, 180px) minmax(220px, 0.95fr)',
    alignItems: 'center',
    gap: 12,
    borderRadius: 10,
    border: selected ? '1px solid rgba(156, 108, 255, 0.82)' : '1px solid #262a40',
    background: selected ? 'rgba(117, 54, 213, 0.12)' : '#101321',
    boxShadow: selected ? '0 0 0 1px rgba(156, 108, 255, 0.12)' : 'none',
    opacity: audible ? 1 : 0.46,
    padding: '10px 12px',
    transition: 'opacity 140ms ease, border-color 140ms ease, background 140ms ease',
  };
}

const stemNameStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  minWidth: 0,
};

const stemLabelStyle: CSSProperties = {
  color: '#f0f1fb',
  fontSize: 13,
  fontWeight: 800,
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
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pendingSeekRef = useRef<{ x: number; time: number; moved: boolean } | null>(null);

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

    pendingSeekRef.current = { x: event.clientX, time, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  }, [duration]);

  const handlePointerMove = useCallback((event: PointerEvent<HTMLCanvasElement>) => {
    if (pendingSeekRef.current && Math.abs(event.clientX - pendingSeekRef.current.x) > 4) {
      pendingSeekRef.current.moved = true;
    }
  }, []);

  const handlePointerUp = useCallback((event: PointerEvent<HTMLCanvasElement>) => {
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // Pointer capture may already be released if the browser cancelled it.
    }

    const pendingSeek = pendingSeekRef.current;
    pendingSeekRef.current = null;
    if (pendingSeek && !pendingSeek.moved) {
      onSeek(pendingSeek.time);
    }
  }, [onSeek]);

  return (
    <canvas
      ref={canvasRef}
      aria-label="Stem waveform"
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
    cursor: muted ? 'not-allowed' : 'pointer',
    opacity: muted ? 0.72 : 1,
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

