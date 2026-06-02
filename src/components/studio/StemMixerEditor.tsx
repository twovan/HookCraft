'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, CSSProperties, MouseEvent, PointerEvent } from 'react';
import {
  defaultStemMasterState,
  normalizeStemMasterState,
  type StemMasterState,
} from '@/lib/stems/stemMixState';
import {
  buildDawEditorLayoutMetrics,
  resolveDawTrackHeight,
  type DawEditorLayoutMetrics,
} from '@/lib/stems/stemEditorDawLayout';
import { resolveStemEditorShortcut } from '@/lib/stems/stemEditorShortcuts';
import { resolveStemEditSaveBadge, type StemEditSaveBadgeTone } from '@/lib/stems/stemEditSaveBadge';
import { resolveVisibleStemSelection } from '@/lib/stems/stemSelection';
import { buildWaveformPeaksFromSamples } from '@/lib/stems/waveformPeaks';
import { selectStemTypesForAudioLoad } from '@/lib/stems/stemAudioLoadPlan';
import {
  resolveWaveformPointerIntent,
} from '@/lib/stems/waveformPointerIntent';
import {
  resolveStemTrackAudioStatus,
  type StemTrackAudioStatus,
} from '@/lib/stems/stemTrackAudioStatus';
import {
  addDeletedStemType,
  filterDeletedStems,
  normalizeDeletedStemTypes,
} from '@/lib/stems/stemTrackDeletion';
import {
  buildStemEditorReadiness,
  type StemEditorReadinessLevel,
} from '@/lib/stems/stemEditorReadiness';
import {
  buildStemExportPreflight,
  type StemExportMode,
} from '@/lib/stems/stemExportPreflight';
import {
  appendStemExportRecord,
  buildStemExportHistoryStorageKey,
  clearStemExportRecords,
  createStemExportRecord,
  formatStemExportRecord,
  parseStemExportRecords,
  serializeStemExportRecords,
  type StemExportRecord,
} from '@/lib/stems/stemExportHistory';
import {
  resolveStemExportStatus,
  type StemExportStatusInput,
  type StemExportStatusTone,
} from '@/lib/stems/stemExportStatus';
import { resolveStemExportSaveIntent } from '@/lib/stems/stemExportSaveIntent';
import { clampStemTimecodeInput, formatStemTimecode, parseStemTimecode } from '@/lib/stems/stemTimecode';
import { nudgeStemTrimEdge, resolveStemTrimControlValues, shiftStemTrimRange } from '@/lib/stems/stemTrackControls';
import {
  addStemMutedRange,
  buildAudibleStemSegments,
  clearStemMutedRangesInRange,
  mapStemMutedRangesToPixels,
  normalizeStemMutedRanges,
  removeStemMutedRangeAtIndex,
  type StemMutedRange,
} from '@/lib/stems/stemMuteRanges';
import {
  cloneStemClipForPaste,
  findStemClipAtTime,
  getStemClipDuration,
  moveStemClip,
  normalizeStemClipState,
  removeStemClipAtTime,
  resizeStemClipEdge,
  resolveStemClipDragTarget,
  sliceStemClipPeaks,
  splitStemClipAtTime,
  type StemClip,
} from '@/lib/stems/stemClips';

export interface EditableStem {
  type: string;
  label: string;
  url: string;
  waveform?: StemWaveform | null;
  displayLabel?: string;
  isPlaceholder?: boolean;
  storagePath?: string;
}

export interface StemWaveform {
  duration: number;
  peaks: number[];
}

type StemClipWaveformSource = {
  duration: number;
  peaks: number[];
  label: string;
};

interface StemTrackState {
  volume: number;
  pan: number;
  muted: boolean;
  solo: boolean;
  collapsed?: boolean;
  trimStart: number;
  trimEnd: number | null;
  fadeIn: number;
  fadeOut: number;
  mutedRanges: StemMutedRange[];
  clips?: StemClip[];
}

export interface StemEditState {
  tracks: Record<string, StemTrackState>;
  master?: StemMasterState;
  trackLabels?: Record<string, string>;
  trackColors?: Record<string, string>;
  trackOrder?: string[];
  deletedTrackTypes?: string[];
  customStems?: EditableStem[];
  skippedEmptyCount?: number;
  savedAt?: string;
}

type MixPreset = 'balanced' | 'vocal-focus' | 'instrumental-wide';
type ExportMode = StemExportMode;
type ExportReadiness = 'ready-only' | 'wait-all';
type TrackViewMode = 'all' | 'active' | 'audible';
type TrackDensity = 'comfortable' | 'compact';
type InspectorTab = 'track' | 'mix' | 'export';
type TimelineScrollState = {
  canScroll: boolean;
  progress: number;
  viewRatio: number;
};
type TimelinePanState = {
  pointerId: number;
  startX: number;
  startY: number;
  scrollLeft: number;
  moved: boolean;
};
type TimelineRulerTrimDragState = {
  pointerId: number;
  kind: 'edge' | 'range';
  edge?: 'start' | 'end';
  anchorTime: number;
  trimStart: number;
  trimEnd: number;
  moved: boolean;
};
type TrackReorderDragState = {
  pointerId: number;
  trackType: string;
  startX: number;
  startY: number;
  moved: boolean;
};
type StemEditorHistorySnapshot = {
  tracks: Record<string, StemTrackState>;
  master: StemMasterState;
  trackLabels: Record<string, string>;
  trackColors: Record<string, string>;
  trackOrder: string[];
  deletedTrackTypes: string[];
  customStems: EditableStem[];
  skippedEmptyCount: number;
  selectedTrackType: string | null;
};
type StemHistoryMode = 'immediate' | 'deferred' | 'none';
type StemInteractionPhase = 'preview' | 'commit';
type RecordingInputChannel = 'channel-1' | 'channel-2' | 'stereo';
type RecordingSelectMenu = 'device' | 'channel' | null;
type StemClipClipboard = {
  clip: StemClip;
  sourceTrackType: string;
};
type SelectedClipSelection = {
  trackType: string;
  clipId: string;
} | null;
type ClipDragPreview = {
  sourceTrackType: string;
  targetTrackType: string;
  clipId: string;
  previewClipId: string;
  clip: StemClip;
};

const RECORDING_CHANNEL_OPTIONS: Array<{ value: RecordingInputChannel; label: string }> = [
  { value: 'channel-1', label: '通道 1' },
  { value: 'channel-2', label: '通道 2' },
  { value: 'stereo', label: '立体声' },
];
type TrackClipAudioSegment = {
  sourceTrackType: string;
  sourceStart: number;
  sourceEnd: number;
  timelineStart: number;
  timelineEnd: number;
};
type TrackContextMenuState = {
  x: number;
  y: number;
  trackType: string;
  time: number;
  clipId: string | null;
  colorOpen: boolean;
  colorDraft: string;
};
type StemEditorDialogState =
  | {
    kind: 'rename-track';
    trackType: string;
    label: string;
    value: string;
  }
  | {
    kind: 'delete-track';
    trackType: string;
    label: string;
  }
  | {
    kind: 'delete-clip';
    trackType: string;
    label: string;
    time: number;
  };
type EditorPreferences = {
  exportMode?: ExportMode;
  exportReadiness?: ExportReadiness;
  trackViewMode?: TrackViewMode;
  inspectorTab?: InspectorTab;
  timelineZoom?: number;
  followPlayhead?: boolean;
  snapToGrid?: boolean;
  magnetSnap?: boolean;
  snapStepSeconds?: number;
  compactTransport?: boolean;
  inspectorCollapsed?: boolean;
  trackDensity?: TrackDensity;
};

const SELECTED_TRIM_NUDGE_SECONDS = 0.1;
const STATUS_TOAST_VISIBLE_MS = 3600;
const STATUS_TOAST_FADE_MS = 360;
const TRACK_COLOR_PALETTE = [
  '#4d8cff',
  '#38bdf8',
  '#2dd4bf',
  '#34d399',
  '#84cc16',
  '#facc15',
  '#fb923c',
  '#f97316',
  '#ef4444',
  '#f472b6',
  '#c084fc',
  '#a78bfa',
];
const TIMELINE_SNAP_STEPS_SECONDS = [0.1, 0.25, 0.5, 1] as const;
const DEFAULT_TIMELINE_SNAP_STEP_SECONDS = 0.25;
const MIN_TIMELINE_ZOOM = 1;
const MAX_TIMELINE_ZOOM = 2.5;
const TIMELINE_LABEL_WIDTH = 286;
const TIMELINE_SIMPLE_BUTTON_WIDTH = 94;
const TIMELINE_ADVANCED_BUTTON_WIDTH = 112;
const TIMELINE_VOLUME_WIDTH = 112;
const TIMELINE_ADVANCED_VOLUME_WIDTH = 126;
const TIMELINE_TRIM_WIDTH = 240;
const TIMELINE_GRID_GAP = 7;
const TIMELINE_ROW_PADDING_X = 18;

type TimelineChromeWidths = {
  label: number;
  buttons: number;
  volume: number;
  pan: number;
  trim: number;
  compact: boolean;
};

function clampTimelineZoom(value: number) {
  if (!Number.isFinite(value)) return MIN_TIMELINE_ZOOM;
  return Math.max(MIN_TIMELINE_ZOOM, Math.min(MAX_TIMELINE_ZOOM, Number(value.toFixed(2))));
}

function normalizeTimelineSnapStep(value: number | undefined) {
  return TIMELINE_SNAP_STEPS_SECONDS.includes(value as typeof TIMELINE_SNAP_STEPS_SECONDS[number])
    ? value as typeof TIMELINE_SNAP_STEPS_SECONDS[number]
    : DEFAULT_TIMELINE_SNAP_STEP_SECONDS;
}

function getNextTimelineSnapStep(value: number) {
  const currentIndex = TIMELINE_SNAP_STEPS_SECONDS.findIndex((step) => step === value);
  return TIMELINE_SNAP_STEPS_SECONDS[(currentIndex + 1) % TIMELINE_SNAP_STEPS_SECONDS.length];
}

function snapStemEditorTime(value: number, duration: number, enabled: boolean, stepSeconds: number) {
  if (!enabled || !Number.isFinite(value)) return value;
  const safeStep = normalizeTimelineSnapStep(stepSeconds);
  const snapped = Math.round(value / safeStep) * safeStep;
  return Math.max(0, Math.min(duration || snapped, Number(snapped.toFixed(3))));
}

function snapStemClipStartToNeighborEdges(
  clips: StemClip[],
  clipId: string,
  proposedStart: number,
  rawStart: number,
  originalStart: number | null,
  clipDuration: number,
  duration: number,
  enabled: boolean,
  stepSeconds: number,
) {
  if (!enabled || clipDuration <= 0 || !Number.isFinite(proposedStart)) return proposedStart;
  const threshold = Math.max(0.08, Math.min(0.25, normalizeTimelineSnapStep(stepSeconds) * 0.75));
  const maxStart = Math.max(0, duration - clipDuration);
  const originalEnd = originalStart === null ? null : originalStart + clipDuration;
  const isEscapingOriginalStart = originalStart !== null
    && Math.abs(proposedStart - originalStart) <= 0.001
    && rawStart > originalStart + 0.001;
  const isEscapingOriginalEnd = originalEnd !== null
    && Math.abs(proposedStart + clipDuration - originalEnd) <= 0.001
    && rawStart + clipDuration < originalEnd - 0.001;
  const initialStart = isEscapingOriginalStart || isEscapingOriginalEnd ? rawStart : proposedStart;
  let bestStart = Math.max(0, Math.min(maxStart, initialStart));
  let bestDistance = threshold;
  const proposedEnd = bestStart + clipDuration;

  clips.forEach((clip) => {
    if (clip.id === clipId) return;
    const clipStart = clip.start;
    const clipEnd = clip.start + getStemClipDuration(clip);
    [clipStart, clipEnd].forEach((edge) => {
      const edgeIsOriginalStart = originalStart !== null && Math.abs(edge - originalStart) <= 0.001;
      const edgeIsOriginalEnd = originalEnd !== null && Math.abs(edge - originalEnd) <= 0.001;
      const startDistance = Math.abs(bestStart - edge);
      if (!(edgeIsOriginalStart && rawStart > originalStart + 0.001) && startDistance <= bestDistance) {
        bestDistance = startDistance;
        bestStart = edge;
      }
      const endDistance = Math.abs(proposedEnd - edge);
      if (!(edgeIsOriginalEnd && rawStart + clipDuration < originalEnd - 0.001) && endDistance <= bestDistance) {
        bestDistance = endDistance;
        bestStart = edge - clipDuration;
      }
    });
  });

  return Number(Math.max(0, Math.min(maxStart, bestStart)).toFixed(3));
}

function snapStemClipEdgeToNeighborEdges(
  clips: StemClip[],
  clipId: string,
  edge: 'start' | 'end',
  proposedTime: number,
  duration: number,
  enabled: boolean,
  stepSeconds: number,
) {
  if (!enabled || !Number.isFinite(proposedTime)) return proposedTime;
  const threshold = Math.max(0.08, Math.min(0.28, normalizeTimelineSnapStep(stepSeconds) * 0.85));
  const safeTime = Math.max(0, Math.min(duration, proposedTime));
  let bestTime = safeTime;
  let bestDistance = threshold;

  clips.forEach((clip) => {
    if (clip.id === clipId) return;
    const clipStart = clip.start;
    const clipEnd = clip.start + getStemClipDuration(clip);
    [clipStart, clipEnd].forEach((neighborEdge) => {
      const distance = Math.abs(safeTime - neighborEdge);
      if (distance <= bestDistance) {
        bestDistance = distance;
        bestTime = neighborEdge;
      }
    });
  });

  return Number(Math.max(0, Math.min(duration, bestTime)).toFixed(3));
}

type TransportIconName = 'skipStart' | 'skipEnd' | 'back' | 'forward' | 'play' | 'pause' | 'stop' | 'collapse' | 'expand' | 'chevronRight' | 'chevronDown';

function TransportIcon({ name }: { name: TransportIconName }) {
  const common = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" focusable="false" style={{ display: 'block' }}>
      {name === 'skipStart' && (
        <>
          <path {...common} d="M6 5v14" />
          <path {...common} d="M18 6l-9 6 9 6V6z" />
        </>
      )}
      {name === 'skipEnd' && (
        <>
          <path {...common} d="M18 5v14" />
          <path {...common} d="M6 6l9 6-9 6V6z" />
        </>
      )}
      {name === 'back' && (
        <>
          <path {...common} d="M11 7l-5 5 5 5" />
          <path {...common} d="M18 7l-5 5 5 5" />
        </>
      )}
      {name === 'forward' && (
        <>
          <path {...common} d="M13 7l5 5-5 5" />
          <path {...common} d="M6 7l5 5-5 5" />
        </>
      )}
      {name === 'play' && <path d="M8 5v14l11-7L8 5z" fill="currentColor" />}
      {name === 'pause' && (
        <>
          <path d="M8 5h3v14H8z" fill="currentColor" />
          <path d="M13 5h3v14h-3z" fill="currentColor" />
        </>
      )}
      {name === 'stop' && <path d="M7 7h10v10H7z" fill="currentColor" />}
      {name === 'collapse' && <path {...common} d="M7 15l5-5 5 5" />}
      {name === 'expand' && <path {...common} d="M7 9l5 5 5-5" />}
      {name === 'chevronRight' && <path {...common} d="M9 6l6 6-6 6" />}
      {name === 'chevronDown' && <path {...common} d="M6 9l6 6 6-6" />}
    </svg>
  );
}

function shouldAutoDismissStatusToast(message: string) {
  if (!message.trim()) return false;
  if (/失败|错误|不能|不可用|还没有|暂时/.test(message)) return false;
  if (/保存中|检查中/.test(message)) return false;
  return true;
}

function resolveTimelineChromeWidths(advanced: boolean, viewportWidth = 0): TimelineChromeWidths {
  const compact = Number.isFinite(viewportWidth) && viewportWidth > 0 && viewportWidth < 1120;
  if (!compact) {
    return {
      label: TIMELINE_LABEL_WIDTH,
      buttons: advanced ? TIMELINE_ADVANCED_BUTTON_WIDTH : TIMELINE_SIMPLE_BUTTON_WIDTH,
      volume: advanced ? TIMELINE_ADVANCED_VOLUME_WIDTH : TIMELINE_VOLUME_WIDTH,
      pan: TIMELINE_ADVANCED_VOLUME_WIDTH,
      trim: TIMELINE_TRIM_WIDTH,
      compact: false,
    };
  }

  return {
    label: TIMELINE_LABEL_WIDTH,
    buttons: advanced ? 92 : 80,
    volume: advanced ? 102 : 88,
    pan: 102,
    trim: 190,
    compact: true,
  };
}

function buildTimelineGridColumns(advanced: boolean, laneWidth: number, viewportWidth = 0) {
  const widths = resolveTimelineChromeWidths(advanced, viewportWidth);
  return advanced
    ? `${widths.label}px ${laneWidth}px ${widths.buttons}px ${widths.volume}px ${widths.pan}px ${widths.trim}px`
    : `${widths.label}px ${laneWidth}px`;
}

function getTimelineFixedWidth(advanced: boolean, viewportWidth = 0) {
  const widths = resolveTimelineChromeWidths(advanced, viewportWidth);
  return advanced
    ? widths.label + widths.buttons + widths.volume + widths.pan + widths.trim
    : widths.label;
}

function getTimelineGapCount(advanced: boolean) {
  return advanced ? 5 : 1;
}

function resolveTimelineBaseLaneWidth(advanced: boolean, viewportWidth: number) {
  const designLaneWidth = advanced ? 420 : 520;
  if (!Number.isFinite(viewportWidth) || viewportWidth <= 0) return designLaneWidth;

  const widths = resolveTimelineChromeWidths(advanced, viewportWidth);
  const minimumLaneWidth = widths.compact ? (advanced ? 140 : 160) : (advanced ? 180 : 220);
  const availableLaneWidth = viewportWidth
    - getTimelineFixedWidth(advanced, viewportWidth)
    - TIMELINE_GRID_GAP * getTimelineGapCount(advanced)
    - TIMELINE_ROW_PADDING_X
    - 16;

  return Math.max(minimumLaneWidth, availableLaneWidth);
}

function buildTimelineMinWidth(advanced: boolean, laneWidth: number, viewportWidth = 0) {
  const fixedWidth = getTimelineFixedWidth(advanced, viewportWidth);
  const gapCount = getTimelineGapCount(advanced);
  return fixedWidth + laneWidth + TIMELINE_GRID_GAP * gapCount + TIMELINE_ROW_PADDING_X;
}

interface StemMixerEditorProps {
  stems: EditableStem[];
  versionLabel: string;
  jobId?: string;
  initialEditState?: StemEditState | null;
}

function defaultTrackState(): StemTrackState {
  return { volume: 1, pan: 0, muted: false, solo: false, collapsed: false, trimStart: 0, trimEnd: null, fadeIn: 0, fadeOut: 0, mutedRanges: [] };
}

function normalizeTrackState(value: Partial<StemTrackState> | undefined | null, duration?: number): StemTrackState {
  const safeDuration = Number.isFinite(duration) && duration && duration > 0 ? duration : 0;
  const rawTrimStart = typeof value?.trimStart === 'number' && Number.isFinite(value.trimStart)
    ? value.trimStart
    : 0;
  const rawTrimEnd = typeof value?.trimEnd === 'number' && Number.isFinite(value.trimEnd)
    ? value.trimEnd
    : null;
  const hasValidDuration = safeDuration > 0;
  const savedRangeIsOutsideDuration = hasValidDuration && (
    rawTrimStart >= safeDuration ||
    (rawTrimEnd !== null && rawTrimEnd <= 0) ||
    (rawTrimEnd !== null && rawTrimEnd <= rawTrimStart)
  );
  const normalizedTrimStart = hasValidDuration
    ? Math.max(0, Math.min(safeDuration, savedRangeIsOutsideDuration ? 0 : rawTrimStart))
    : Math.max(0, rawTrimStart);
  const normalizedTrimEnd = rawTrimEnd === null
    ? null
    : hasValidDuration
      ? Math.max(normalizedTrimStart, Math.min(safeDuration, savedRangeIsOutsideDuration ? safeDuration : rawTrimEnd))
      : Math.max(0, rawTrimEnd);
  const normalized: StemTrackState = {
    volume: typeof value?.volume === 'number' ? Math.max(0, Math.min(1, value.volume)) : 1,
    pan: typeof value?.pan === 'number' ? Math.max(-1, Math.min(1, value.pan)) : 0,
    muted: value?.muted === true,
    solo: value?.solo === true,
    collapsed: value?.collapsed === true,
    trimStart: normalizedTrimStart,
    trimEnd: normalizedTrimEnd,
    fadeIn: typeof value?.fadeIn === 'number' ? Math.max(0, value.fadeIn) : 0,
    fadeOut: typeof value?.fadeOut === 'number' ? Math.max(0, value.fadeOut) : 0,
    mutedRanges: normalizeStemMutedRanges(value?.mutedRanges, (normalizedTrimEnd ?? safeDuration) || Number.MAX_SAFE_INTEGER),
  };

  if (!hasValidDuration) {
    return Array.isArray(value?.clips) && value.clips.length > 0
      ? { ...normalized, clips: value.clips }
      : normalized;
  }

  const clipState = normalizeStemClipState({
    clips: value?.clips,
    duration: safeDuration,
    trimStart: normalized.trimStart,
    trimEnd: normalized.trimEnd,
  });

  return clipState.clips.length > 0
    ? {
        ...normalized,
        trimStart: clipState.trimStart,
        trimEnd: clipState.trimEnd,
        clips: clipState.clips,
      }
    : {
        ...normalized,
        trimStart: 0,
        trimEnd: safeDuration,
      };
}

function normalizeSavedCustomStems(value: unknown): EditableStem[] {
  if (!Array.isArray(value)) return [];

  const stems: EditableStem[] = [];
  value.forEach((stem) => {
      const item = stem && typeof stem === 'object'
        ? stem as Record<string, unknown>
        : null;
      if (!item) return;

      const type = typeof item.type === 'string' ? item.type.trim().slice(0, 80) : '';
      const label = sanitizeTrackLabel(String(item.label || item.displayLabel || ''));
      const url = typeof item.url === 'string' ? item.url.trim() : '';
      const storagePath = typeof item.storagePath === 'string' ? item.storagePath.trim().slice(0, 400) : '';
      const rawWaveform = item.waveform && typeof item.waveform === 'object'
        ? item.waveform as Record<string, unknown>
        : null;
      const duration = typeof rawWaveform?.duration === 'number' && Number.isFinite(rawWaveform.duration)
        ? Math.max(0, rawWaveform.duration)
        : 0;
      const peaks = Array.isArray(rawWaveform?.peaks)
        ? rawWaveform.peaks
            .map((peak) => (typeof peak === 'number' && Number.isFinite(peak) ? Math.max(0, Math.min(1, peak)) : 0))
            .slice(0, 1200)
        : [];
      const isPlaceholder = item.isPlaceholder === true || (!url && peaks.length > 0 && !waveformHasContent({ duration, peaks }));

      if (!type || (!url && !isPlaceholder)) return;

      stems.push({
        type,
        label: label || type,
        displayLabel: label || type,
        url,
        isPlaceholder,
        ...(storagePath ? { storagePath } : {}),
        ...(duration > 0 && peaks.length > 0 ? { waveform: { duration, peaks } } : {}),
      });
    });

  return stems
    .filter((stem, index, stems) => stems.findIndex((candidate) => candidate.type === stem.type) === index)
    .slice(0, 48);
}

function createTrackState(stems: EditableStem[], editState?: StemEditState | null) {
  const fallbackDuration = stems.reduce((maxDuration, stem) => (
    Math.max(maxDuration, stem.waveform?.duration || 0)
  ), 0);

  return Object.fromEntries(stems.map((stem) => {
    const savedState = editState?.tracks?.[stem.type];
    const stemDuration = stem.waveform?.duration || fallbackDuration;
    return [
      stem.type,
      savedState ? normalizeTrackState(savedState, stemDuration) : defaultTrackState(),
    ];
  })) as Record<string, StemTrackState>;
}

function resolveTrackClipState(state: StemTrackState, duration: number) {
  return normalizeStemClipState({
    clips: state.clips,
    duration,
    trimStart: state.trimStart,
    trimEnd: state.trimEnd,
  });
}

function areTrackStatesEqual(left: Record<string, StemTrackState>, right: Record<string, StemTrackState>) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function cloneEditorHistorySnapshot(snapshot: StemEditorHistorySnapshot): StemEditorHistorySnapshot {
  return {
    tracks: JSON.parse(JSON.stringify(snapshot.tracks)) as Record<string, StemTrackState>,
    master: JSON.parse(JSON.stringify(snapshot.master)) as StemMasterState,
    trackLabels: { ...snapshot.trackLabels },
    trackColors: { ...snapshot.trackColors },
    trackOrder: [...snapshot.trackOrder],
    deletedTrackTypes: [...snapshot.deletedTrackTypes],
    customStems: snapshot.customStems.map((stem) => ({
      ...stem,
      waveform: stem.waveform
        ? { ...stem.waveform, peaks: [...stem.waveform.peaks] }
        : stem.waveform,
    })),
    skippedEmptyCount: snapshot.skippedEmptyCount,
    selectedTrackType: snapshot.selectedTrackType,
  };
}

function areEditorHistorySnapshotsEqual(left: StemEditorHistorySnapshot, right: StemEditorHistorySnapshot) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function colorWithAlpha(hexColor: string, alpha: number) {
  const normalized = hexColor.replace('#', '');
  if (!/^[0-9a-f]{6}$/i.test(normalized)) return `rgba(148, 163, 184, ${alpha})`;
  const red = parseInt(normalized.slice(0, 2), 16);
  const green = parseInt(normalized.slice(2, 4), 16);
  const blue = parseInt(normalized.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
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
  const customLabel = stem.displayLabel?.trim();
  if (customLabel) {
    return {
      zh: customLabel,
      en: stem.type.replaceAll('_', ' '),
    };
  }

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

function formatExportPreflightLabels(labels: string[]) {
  if (labels.length === 0) return '无';
  const visibleLabels = labels.slice(0, 4).join(' / ');
  return labels.length > 4 ? `${visibleLabels} / +${labels.length - 4}` : visibleLabels;
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

function triggerDownloadUrl(url: string, fileName: string) {
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function downloadBlob(blob: Blob, fileName: string, revokeDelayMs = 1000) {
  const url = URL.createObjectURL(blob);
  triggerDownloadUrl(url, fileName);
  window.setTimeout(() => URL.revokeObjectURL(url), revokeDelayMs);
}

const STEM_LOAD_CONCURRENCY = 3;
const INITIAL_STEM_LOAD_COUNT = 6;
const DEFERRED_STEM_LOAD_DELAY_MS = 2200;
const STEM_AUDIO_CACHE_NAME = 'hookcraft-stem-audio-v2';
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
  return {
    duration: Number(buffer.duration.toFixed(3)),
    peaks: buildWaveformPeaksFromSamples(buffer.getChannelData(0), bucketCount),
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

async function uploadCustomStemAudio({
  jobId,
  stemType,
  blob,
  label,
}: {
  jobId: string;
  stemType: string;
  blob: Blob;
  label: string;
}) {
  const form = new FormData();
  form.set('jobId', jobId);
  form.set('stemType', stemType);
  form.set('label', label);
  form.set('file', blob, `${stemType}.webm`);

  const response = await fetch('/api/stems/custom-audio', {
    method: 'POST',
    body: form,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data?.url || !data?.storagePath) {
    const message = data?.error || '自定义轨道音频上传失败';
    const error = new Error(message) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }

  return {
    url: String(data.url),
    storagePath: String(data.storagePath),
  };
}

function isEditorAuthError(status: number, message: string) {
  const normalized = message.toLowerCase();
  return status === 401
    || normalized.includes('sign in first')
    || normalized.includes('please sign in')
    || normalized.includes('请先登录')
    || normalized.includes('登录已过期');
}

function redirectToLoginFromStemEditor() {
  if (typeof window === 'undefined') return;
  const currentPath = `${window.location.pathname}${window.location.search}`;
  window.location.assign(`/login?redirectTo=${encodeURIComponent(currentPath)}`);
}

function safelySetPointerCapture(target: Element, pointerId: number) {
  try {
    target.setPointerCapture(pointerId);
  } catch {
    // Synthetic or cancelled pointer events may not have an active pointer to capture.
  }
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

function buildTrackClipAudioSegments(
  state: StemTrackState,
  timelineDuration: number,
  audioDurationByTrack: number | Record<string, number>,
  cursor = 0,
  fallbackSourceTrackType = '',
): TrackClipAudioSegment[] {
  const fallbackAudioDuration = typeof audioDurationByTrack === 'number'
    ? audioDurationByTrack
    : audioDurationByTrack[fallbackSourceTrackType] || timelineDuration;
  const clipState = resolveTrackClipState(state, Math.max(timelineDuration, fallbackAudioDuration));

  return clipState.clips.flatMap((clip) => {
    const sourceTrackType = clip.sourceTrackType || fallbackSourceTrackType;
    const audioDuration = typeof audioDurationByTrack === 'number'
      ? audioDurationByTrack
      : audioDurationByTrack[sourceTrackType] || fallbackAudioDuration;
    const timelineStart = clip.start;
    const timelineEnd = clip.start + getStemClipDuration(clip);
    if (timelineEnd <= cursor) return [];

    const cursorSourceOffset = Math.max(0, cursor - timelineStart);
    const sourceStart = Math.max(clip.sourceStart, Math.min(audioDuration, clip.sourceStart + cursorSourceOffset));
    const sourceEnd = Math.max(sourceStart, Math.min(audioDuration, clip.sourceEnd));
    if (sourceEnd - sourceStart <= 0.001) return [];

    return buildAudibleStemSegments({
      start: sourceStart,
      end: sourceEnd,
      mutedRanges: state.mutedRanges,
    }).map((segment) => ({
      sourceTrackType,
      sourceStart: segment.start,
      sourceEnd: segment.end,
      timelineStart: clip.start + (segment.start - clip.sourceStart),
      timelineEnd: clip.start + (segment.end - clip.sourceStart),
    }));
  });
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

function connectGainWithPan(
  context: BaseAudioContext,
  gain: GainNode,
  destination: AudioNode,
  pan: number,
) {
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

export default function StemMixerEditor({ stems: initialStems, versionLabel, jobId, initialEditState }: StemMixerEditorProps) {
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioBuffersRef = useRef<Record<string, AudioBuffer>>({});
  const gainNodesRef = useRef<Record<string, GainNode>>({});
  const panNodesRef = useRef<Record<string, StereoPannerNode>>({});
  const masterGainNodeRef = useRef<GainNode | null>(null);
  const masterCompressorNodeRef = useRef<DynamicsCompressorNode | null>(null);
  const sourceNodesRef = useRef<Record<string, AudioBufferSourceNode[]>>({});
  const playbackStartedAtRef = useRef(0);
  const playbackOffsetRef = useRef(0);
  const playbackStopAtRef = useRef<number | null>(null);
  const previewStemTypeRef = useRef<string | null>(null);
  const loopSelectionPreviewRef = useRef(false);
  const loopPreviewTimerRef = useRef<number | null>(null);
  const frameRef = useRef<number | null>(null);
  const skipNextTimeInputCommitRef = useRef(false);
  const skipNextTrimInputCommitRef = useRef(false);
  const initialCustomStems = useMemo(
    () => normalizeSavedCustomStems(initialEditState?.customStems),
    [initialEditState?.customStems],
  );
  const initialAllStems = useMemo(
    () => [...initialStems, ...initialCustomStems],
    [initialCustomStems, initialStems],
  );
  const loadingCountRef = useRef(initialAllStems.filter((stem) => !stemHasKnownEmptyWaveform(stem)).length);
  const failedLoadCountRef = useRef(0);
  const autoSaveTimerRef = useRef<number | null>(null);
  const skipNextAutoSaveRef = useRef(true);
  const lastAutoSaveSignatureRef = useRef<string | null>(null);
  const undoStackRef = useRef<StemEditorHistorySnapshot[]>([]);
  const redoStackRef = useRef<StemEditorHistorySnapshot[]>([]);
  const deferredHistorySnapshotRef = useRef<StemEditorHistorySnapshot | null>(null);
  const deferredHistoryChangedRef = useRef(false);
  const initialDeletedTrackTypes = useMemo(
    () => normalizeDeletedStemTypes(initialEditState?.deletedTrackTypes, initialAllStems),
    [initialAllStems, initialEditState?.deletedTrackTypes],
  );
  const editorHistoryRef = useRef<StemEditorHistorySnapshot>({
    tracks: createTrackState(initialAllStems, initialEditState),
    master: normalizeStemMasterState(initialEditState?.master),
    trackLabels: normalizeTrackLabels(initialEditState?.trackLabels),
    trackColors: normalizeTrackColors(initialEditState?.trackColors),
    trackOrder: normalizeTrackOrderForStems(initialEditState?.trackOrder, initialAllStems),
    deletedTrackTypes: initialDeletedTrackTypes,
    customStems: initialCustomStems,
    skippedEmptyCount: typeof initialEditState?.skippedEmptyCount === 'number' ? Math.max(0, initialEditState.skippedEmptyCount) : 0,
    selectedTrackType: filterDeletedStems(initialAllStems, initialDeletedTrackTypes)[0]?.type ?? null,
  });
  const timelineViewportRef = useRef<HTMLDivElement | null>(null);
  const inspectorViewportRef = useRef<HTMLDivElement | null>(null);
  const timelinePanRef = useRef<TimelinePanState | null>(null);
  const timelineRulerTrimDragRef = useRef<TimelineRulerTrimDragState | null>(null);
  const trackReorderDragRef = useRef<TrackReorderDragState | null>(null);
  const ignoreNextTrackClickRef = useRef(false);
  const trackRowRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const customObjectUrlsRef = useRef<Set<string>>(new Set());
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const monitoringPreviewStreamRef = useRef<MediaStream | null>(null);
  const recordingProcessedStreamRef = useRef<MediaStream | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const recordingAudioContextRef = useRef<AudioContext | null>(null);
  const recordingInputGainRef = useRef<GainNode | null>(null);
  const recordingMonitorGainRef = useRef<GainNode | null>(null);
  const recordingWaveformFrameRef = useRef<number | null>(null);
  const importTargetTypeRef = useRef<string | null>(null);
  const [customStems, setCustomStems] = useState<EditableStem[]>(() => initialCustomStems);
  const [trackLabels, setTrackLabels] = useState<Record<string, string>>(() => normalizeTrackLabels(initialEditState?.trackLabels));
  const [trackColors, setTrackColors] = useState<Record<string, string>>(() => normalizeTrackColors(initialEditState?.trackColors));
  const [trackOrder, setTrackOrder] = useState<string[]>(() => normalizeTrackOrderForStems(initialEditState?.trackOrder, initialAllStems));
  const [deletedTrackTypes, setDeletedTrackTypes] = useState<string[]>(() => initialDeletedTrackTypes);
  const sourceStems = useMemo(() => {
    const activeInitialStems = filterDeletedStems(initialStems, deletedTrackTypes);
    return applyTrackOrder([...activeInitialStems, ...customStems], trackOrder);
  }, [customStems, deletedTrackTypes, initialStems, trackOrder]);
  const stems = useMemo(() => sourceStems.map((stem) => {
    const label = trackLabels[stem.type];
    return label ? { ...stem, displayLabel: label } : stem;
  }), [sourceStems, trackLabels]);
  const getTrackColor = useCallback((type: string) => trackColors[type] || stemColorForType(type), [trackColors]);
  const [tracks, setTracks] = useState<Record<string, StemTrackState>>(() => createTrackState(initialAllStems, initialEditState));
  const [masterState, setMasterState] = useState<StemMasterState>(() => normalizeStemMasterState(initialEditState?.master));
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(() => getInitialWaveformDuration(initialAllStems));
  const [loadingCount, setLoadingCount] = useState(initialAllStems.filter((stem) => !stemHasKnownEmptyWaveform(stem)).length);
  const [failedLoadCount, setFailedLoadCount] = useState(0);
  const [cachedLoadCount, setCachedLoadCount] = useState(0);
  const [skippedEmptyCount, setSkippedEmptyCount] = useState(() => initialAllStems.filter((stem) => stemHasKnownEmptyWaveform(stem)).length);
  const [loadingStemTypes, setLoadingStemTypes] = useState<Set<string>>(() => new Set(initialAllStems.filter((stem) => !stemHasKnownEmptyWaveform(stem)).map((stem) => stem.type)));
  const [failedStemTypes, setFailedStemTypes] = useState<Set<string>>(() => new Set());
  const [bufferVersion, setBufferVersion] = useState(0);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<string | null>(initialEditState?.savedAt ? '已读取上次保存的编辑状态。' : null);
  const [autoSaveStatus, setAutoSaveStatus] = useState<string | null>(null);
  const [saveStatusDismissing, setSaveStatusDismissing] = useState(false);
  const [autoSaveStatusDismissing, setAutoSaveStatusDismissing] = useState(false);
  const [hasPendingEditChanges, setHasPendingEditChanges] = useState(false);
  const [isContinuousEditing, setIsContinuousEditing] = useState(false);
  const [saveRequestVersion, setSaveRequestVersion] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportingStemType, setExportingStemType] = useState<string | null>(null);
  const [exportStatusInput, setExportStatusInput] = useState<StemExportStatusInput>({ phase: 'idle' });
  const [latestExportDownload, setLatestExportDownload] = useState<{
    url: string;
    fileName: string;
    label: string;
  } | null>(null);
  const [exportRecords, setExportRecords] = useState<StemExportRecord[]>([]);
  const [exportHistoryLoadedKey, setExportHistoryLoadedKey] = useState<string | null>(null);
  const [isAudioRetrying, setIsAudioRetrying] = useState(false);
  const [editorPreferencesLoaded, setEditorPreferencesLoaded] = useState(false);
  const [exportMode, setExportMode] = useState<ExportMode>('current-mix');
  const [exportReadiness, setExportReadiness] = useState<ExportReadiness>('wait-all');
  const showAdvancedControls = false;
  const [trackViewMode, setTrackViewMode] = useState<TrackViewMode>('all');
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('track');
  const [loopSelectionPreview, setLoopSelectionPreview] = useState(false);
  const [timelineZoom, setTimelineZoom] = useState(1);
  const [timelineViewportWidth, setTimelineViewportWidth] = useState(0);
  const [followPlayhead, setFollowPlayhead] = useState(true);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [magnetSnap, setMagnetSnap] = useState(true);
  const [snapStepSeconds, setSnapStepSeconds] = useState(DEFAULT_TIMELINE_SNAP_STEP_SECONDS);
  const [compactTransport, setCompactTransport] = useState(true);
  const [inspectorCollapsed, setInspectorCollapsed] = useState(false);
  const [trackDensity, setTrackDensity] = useState<TrackDensity>('comfortable');
  const [showShortcutHelp, setShowShortcutHelp] = useState(false);
  const [clipClipboard, setClipClipboard] = useState<StemClipClipboard | null>(null);
  const [selectedClipSelection, setSelectedClipSelection] = useState<SelectedClipSelection>(null);
  const [clipDragPreview, setClipDragPreview] = useState<ClipDragPreview | null>(null);
  const [trackContextMenu, setTrackContextMenu] = useState<TrackContextMenuState | null>(null);
  const [editorDialog, setEditorDialog] = useState<StemEditorDialogState | null>(null);
  const [isTimelinePanning, setIsTimelinePanning] = useState(false);
  const [timelineScrollState, setTimelineScrollState] = useState<TimelineScrollState>({
    canScroll: false,
    progress: 0,
    viewRatio: 1,
  });
  const [timelineRulerGuide, setTimelineRulerGuide] = useState<{
    ratio: number;
    time: number;
    active: boolean;
    snapBypassed: boolean;
  } | null>(null);
  const [historyVersion, setHistoryVersion] = useState(0);
  const [selectedTrackType, setSelectedTrackType] = useState<string | null>(() => (
    filterDeletedStems(initialStems, initialDeletedTrackTypes)[0]?.type ?? null
  ));
  const [currentTimeInputDraft, setCurrentTimeInputDraft] = useState<string | null>(null);
  const [selectedTrimInputDraft, setSelectedTrimInputDraft] = useState<{
    edge: 'start' | 'end';
    type: string;
    value: string;
  } | null>(null);
  const [isAddTrackPanelOpen, setIsAddTrackPanelOpen] = useState(false);
  const [addTrackMode, setAddTrackMode] = useState<'import' | 'record'>('import');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingStatus, setRecordingStatus] = useState<string | null>(null);
  const [, setRecordingWaveform] = useState<number[]>(() => Array.from({ length: 28 }, () => 0.08));
  const [recordingTrackType, setRecordingTrackType] = useState<string | null>(null);
  const [recordingTrackWaveform, setRecordingTrackWaveform] = useState<number[]>(() => Array.from({ length: 220 }, () => 0));
  const [recordingLevel, setRecordingLevel] = useState(0);
  const [audioInputDevices, setAudioInputDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudioInputDeviceId, setSelectedAudioInputDeviceId] = useState('');
  const [recordingInputChannel, setRecordingInputChannel] = useState<RecordingInputChannel>('channel-1');
  const [recordingInputLevel, setRecordingInputLevel] = useState(0.78);
  const [monitoringEnabled, setMonitoringEnabled] = useState(false);
  const [isMonitoringPreview, setIsMonitoringPreview] = useState(false);
  const [recordingSelectMenu, setRecordingSelectMenu] = useState<RecordingSelectMenu>(null);
  const timelineZoomRef = useRef(timelineZoom);

  const masterStem = stems[0] || null;
  const hasSoloTrack = useMemo(
    () => Object.values(tracks).some((track) => track.solo),
    [tracks],
  );

  const loadableStemCount = Math.max(0, stems.length - skippedEmptyCount);
  const readyStemCount = Math.max(0, loadableStemCount - loadingCount - failedLoadCount);
  const exportHistoryStorageKey = useMemo(
    () => buildStemExportHistoryStorageKey(jobId || versionLabel),
    [jobId, versionLabel],
  );
  const exportStatus = useMemo(() => resolveStemExportStatus(exportStatusInput), [exportStatusInput]);
  const recentExportRecords = useMemo(
    () => exportRecords.map((record) => ({ ...record, view: formatStemExportRecord(record) })),
    [exportRecords],
  );
  const recordingDeviceOptions = useMemo(() => (
    audioInputDevices.length === 0
      ? [{ value: '', label: '默认麦克风' }]
      : audioInputDevices.map((device, index) => ({
        value: device.deviceId,
        label: device.label || `麦克风 ${index + 1}`,
      }))
  ), [audioInputDevices]);
  const selectedRecordingDeviceLabel = useMemo(() => (
    recordingDeviceOptions.find((option) => option.value === selectedAudioInputDeviceId)?.label
      || recordingDeviceOptions[0]?.label
      || '默认麦克风'
  ), [recordingDeviceOptions, selectedAudioInputDeviceId]);
  const selectedRecordingChannelLabel = useMemo(() => (
    RECORDING_CHANNEL_OPTIONS.find((option) => option.value === recordingInputChannel)?.label || '通道 1'
  ), [recordingInputChannel]);

  useEffect(() => {
    editorHistoryRef.current = {
      tracks,
      master: masterState,
      trackLabels,
      trackColors,
      trackOrder,
      deletedTrackTypes,
      customStems,
      skippedEmptyCount,
      selectedTrackType,
    };
  }, [customStems, deletedTrackTypes, masterState, selectedTrackType, skippedEmptyCount, trackColors, trackLabels, trackOrder, tracks]);

  useEffect(() => () => {
    if (latestExportDownload?.url) {
      URL.revokeObjectURL(latestExportDownload.url);
    }
  }, [latestExportDownload?.url]);

  useEffect(() => {
    timelineZoomRef.current = timelineZoom;
  }, [timelineZoom]);

  useEffect(() => {
    if (!selectedClipSelection) return;
    const state = tracks[selectedClipSelection.trackType];
    if (!state) {
      setSelectedClipSelection(null);
      return;
    }
    const clipState = resolveTrackClipState(state, duration);
    if (!clipState.clips.some((clip) => clip.id === selectedClipSelection.clipId)) {
      setSelectedClipSelection(null);
    }
  }, [duration, selectedClipSelection, tracks]);

  useEffect(() => {
    if (!recordingSelectMenu) return undefined;
    const closeRecordingSelect = (event: globalThis.PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('[data-recording-select="true"]')) return;
      setRecordingSelectMenu(null);
    };
    window.addEventListener('pointerdown', closeRecordingSelect);
    return () => window.removeEventListener('pointerdown', closeRecordingSelect);
  }, [recordingSelectMenu]);

  useEffect(() => () => {
    customObjectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    customObjectUrlsRef.current.clear();
    recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
    monitoringPreviewStreamRef.current?.getTracks().forEach((track) => track.stop());
    recordingProcessedStreamRef.current?.getTracks().forEach((track) => track.stop());
    if (recordingWaveformFrameRef.current !== null) {
      window.cancelAnimationFrame(recordingWaveformFrameRef.current);
      recordingWaveformFrameRef.current = null;
    }
    const recordingContext = recordingAudioContextRef.current;
    recordingAudioContextRef.current = null;
    recordingInputGainRef.current = null;
    recordingMonitorGainRef.current = null;
    void recordingContext?.close();
  }, []);

  const refreshAudioInputDevices = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const inputs = devices.filter((device) => device.kind === 'audioinput');
      setAudioInputDevices(inputs);
      setSelectedAudioInputDeviceId((current) => current || inputs[0]?.deviceId || '');
    } catch {
      setAudioInputDevices([]);
    }
  }, []);

  useEffect(() => {
    void refreshAudioInputDevices();
    if (typeof navigator === 'undefined' || !navigator.mediaDevices) return;
    navigator.mediaDevices.addEventListener?.('devicechange', refreshAudioInputDevices);
    return () => {
      navigator.mediaDevices.removeEventListener?.('devicechange', refreshAudioInputDevices);
    };
  }, [refreshAudioInputDevices]);
  const timelineLaneWidth = useMemo(
    () => Math.round(resolveTimelineBaseLaneWidth(showAdvancedControls, timelineViewportWidth) * timelineZoom),
    [showAdvancedControls, timelineViewportWidth, timelineZoom],
  );
  const timelineLabelWidth = useMemo(
    () => resolveTimelineChromeWidths(showAdvancedControls, timelineViewportWidth).label,
    [showAdvancedControls, timelineViewportWidth],
  );
  const timelineMinWidth = useMemo(
    () => buildTimelineMinWidth(showAdvancedControls, timelineLaneWidth, timelineViewportWidth),
    [showAdvancedControls, timelineLaneWidth, timelineViewportWidth],
  );
  const timelineGridColumns = useMemo(
    () => buildTimelineGridColumns(showAdvancedControls, timelineLaneWidth, timelineViewportWidth),
    [showAdvancedControls, timelineLaneWidth, timelineViewportWidth],
  );
  const shouldAllowTimelineHorizontalScroll = timelineZoom > 1.01
    || (timelineViewportWidth > 0 && timelineMinWidth > timelineViewportWidth + 8);
  const timelineRulerMarks = useMemo(() => {
    const markCount = Math.max(5, Math.min(18, Math.floor(timelineLaneWidth / 84) + 1));
    return Array.from({ length: markCount }, (_, index) => (
      markCount <= 1 ? 0 : index / (markCount - 1)
    ));
  }, [timelineLaneWidth]);
  const exportSummary = useMemo(() => {
    const preflight = buildStemExportPreflight({
      tracks: stems.map((stem) => {
        const state = tracks[stem.type] || defaultTrackState();
        return {
          type: stem.type,
          label: getStemDisplayName(stem).zh,
          loaded: Boolean(audioBuffersRef.current[stem.type]),
          knownEmpty: stemHasKnownEmptyWaveform(stem),
          muted: state.muted,
          solo: state.solo,
          volume: state.volume,
        };
      }),
      mode: exportMode,
      hasSoloTrack,
      waitForAll: exportReadiness === 'wait-all',
    });

    return {
      selectedCount: preflight.exportableTypes.length,
      plannedCount: preflight.plannedTypes.length,
      loadedCount: preflight.loadedCount,
      missingCount: preflight.missingTypes.length,
      mutedOrSkippedCount: preflight.skippedTypes.length,
      emptyCount: preflight.emptyTypes.length,
      plannedLabels: preflight.plannedLabels,
      exportableLabels: preflight.exportableLabels,
      missingLabels: preflight.missingLabels,
      skippedLabels: preflight.skippedLabels,
      emptyLabels: preflight.emptyLabels,
      disabledReason: preflight.disabledReason,
      summary: preflight.summary,
      canExport: !isExporting && preflight.canExport,
    };
  }, [bufferVersion, exportMode, exportReadiness, hasSoloTrack, isExporting, stems, tracks]);
  const mixExportDisabledReason = isExporting ? '正在导出中' : exportSummary.disabledReason;
  const batchExportDisabledReason = isExporting
    ? '正在导出中'
    : exportSummary.loadedCount === 0
      ? '等待至少一条分轨缓存完成'
      : null;
  const editorReadiness = useMemo(() => buildStemEditorReadiness({
    loadableStemCount,
    readyStemCount,
    loadingStemCount: loadingStemTypes.size,
    failedStemCount: failedStemTypes.size,
    skippedStemCount: skippedEmptyCount,
    exportSelectedCount: exportSummary.selectedCount,
    exportMissingCount: exportSummary.missingCount,
  }), [
    exportSummary.missingCount,
    exportSummary.selectedCount,
    failedStemTypes,
    loadableStemCount,
    loadingStemTypes,
    readyStemCount,
    skippedEmptyCount,
  ]);

  useEffect(() => {
    loadingCountRef.current = loadingCount;
  }, [loadingCount]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setExportRecords(parseStemExportRecords(window.localStorage.getItem(exportHistoryStorageKey)));
    setExportHistoryLoadedKey(exportHistoryStorageKey);
  }, [exportHistoryStorageKey]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (exportHistoryLoadedKey !== exportHistoryStorageKey) return;
    if (exportRecords.length === 0) {
      window.localStorage.removeItem(exportHistoryStorageKey);
      return;
    }
    window.localStorage.setItem(exportHistoryStorageKey, serializeStemExportRecords(exportRecords));
  }, [exportHistoryLoadedKey, exportHistoryStorageKey, exportRecords]);

  useEffect(() => {
    failedLoadCountRef.current = failedLoadCount;
  }, [failedLoadCount]);

  useEffect(() => {
    loopSelectionPreviewRef.current = loopSelectionPreview;
  }, [loopSelectionPreview]);

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
    if (preferences.inspectorTab === 'track' || preferences.inspectorTab === 'mix' || preferences.inspectorTab === 'export') {
      setInspectorTab(preferences.inspectorTab);
    }
    if (typeof preferences.timelineZoom === 'number' && Number.isFinite(preferences.timelineZoom)) {
      setTimelineZoom(clampTimelineZoom(preferences.timelineZoom));
    }
    if (typeof preferences.followPlayhead === 'boolean') {
      setFollowPlayhead(preferences.followPlayhead);
    }
    if (typeof preferences.snapToGrid === 'boolean') {
      setSnapToGrid(preferences.snapToGrid);
    }
    if (typeof preferences.magnetSnap === 'boolean') {
      setMagnetSnap(preferences.magnetSnap);
    }
    if (typeof preferences.snapStepSeconds === 'number') {
      setSnapStepSeconds(normalizeTimelineSnapStep(preferences.snapStepSeconds));
    }
    if (typeof preferences.compactTransport === 'boolean') {
      setCompactTransport(preferences.compactTransport);
    }
    if (typeof preferences.inspectorCollapsed === 'boolean') {
      setInspectorCollapsed(preferences.inspectorCollapsed);
    }
    if (preferences.trackDensity === 'comfortable' || preferences.trackDensity === 'compact') {
      setTrackDensity(preferences.trackDensity);
    }
    setEditorPreferencesLoaded(true);
  }, []);

  useEffect(() => {
    if (!editorPreferencesLoaded) return;
    window.localStorage.setItem('hookcraft-stem-editor-prefs', JSON.stringify({
      exportMode,
      exportReadiness,
      trackViewMode,
      inspectorTab,
      timelineZoom,
      followPlayhead,
      snapToGrid,
      magnetSnap,
      snapStepSeconds,
      compactTransport,
      inspectorCollapsed,
      trackDensity,
    }));
  }, [compactTransport, editorPreferencesLoaded, exportMode, exportReadiness, followPlayhead, inspectorCollapsed, inspectorTab, magnetSnap, snapStepSeconds, snapToGrid, timelineZoom, trackDensity, trackViewMode]);

  useEffect(() => {
    setSaveStatusDismissing(false);
    if (!saveStatus || !shouldAutoDismissStatusToast(saveStatus)) return;

    const statusSnapshot = saveStatus;
    const fadeTimer = window.setTimeout(() => {
      setSaveStatusDismissing(true);
    }, STATUS_TOAST_VISIBLE_MS);
    const clearTimer = window.setTimeout(() => {
      setSaveStatus((current) => (current === statusSnapshot ? null : current));
    }, STATUS_TOAST_VISIBLE_MS + STATUS_TOAST_FADE_MS);

    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(clearTimer);
    };
  }, [saveStatus]);

  useEffect(() => {
    setAutoSaveStatusDismissing(false);
    if (!autoSaveStatus || !shouldAutoDismissStatusToast(autoSaveStatus)) return;

    const statusSnapshot = autoSaveStatus;
    const fadeTimer = window.setTimeout(() => {
      setAutoSaveStatusDismissing(true);
    }, STATUS_TOAST_VISIBLE_MS);
    const clearTimer = window.setTimeout(() => {
      setAutoSaveStatus((current) => (current === statusSnapshot ? null : current));
    }, STATUS_TOAST_VISIBLE_MS + STATUS_TOAST_FADE_MS);

    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(clearTimer);
    };
  }, [autoSaveStatus]);

  useEffect(() => {
    if (!followPlayhead || !isPlaying || duration <= 0) return;
    const viewport = timelineViewportRef.current;
    if (!viewport) return;

    const timelineScrollWidth = Math.max(viewport.scrollWidth, timelineMinWidth);
    const playheadX = (Math.max(0, Math.min(duration, currentTime)) / duration) * timelineScrollWidth;
    const comfortableLeft = viewport.clientWidth * 0.42;
    const nextScrollLeft = Math.max(0, Math.min(viewport.scrollWidth - viewport.clientWidth, playheadX - comfortableLeft));

    if (Math.abs(viewport.scrollLeft - nextScrollLeft) > 24) {
      viewport.scrollTo({ left: nextScrollLeft, behavior: 'smooth' });
    }
  }, [currentTime, duration, followPlayhead, isPlaying, timelineMinWidth]);

  useEffect(() => {
    const viewport = timelineViewportRef.current;
    if (!viewport) return;

    const updateTimelineScrollState = () => {
      const maxScroll = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
      setTimelineViewportWidth((current) => (
        Math.abs(current - viewport.clientWidth) > 2 ? viewport.clientWidth : current
      ));
      setTimelineScrollState({
        canScroll: maxScroll > 8,
        progress: maxScroll > 0 ? Math.max(0, Math.min(1, viewport.scrollLeft / maxScroll)) : 0,
        viewRatio: viewport.scrollWidth > 0 ? Math.max(0.08, Math.min(1, viewport.clientWidth / viewport.scrollWidth)) : 1,
      });
    };

    updateTimelineScrollState();
    viewport.addEventListener('scroll', updateTimelineScrollState, { passive: true });
    const observer = new ResizeObserver(updateTimelineScrollState);
    observer.observe(viewport);

    return () => {
      viewport.removeEventListener('scroll', updateTimelineScrollState);
      observer.disconnect();
    };
  }, [bufferVersion, stems.length, timelineMinWidth, trackViewMode]);

  const scrollTimelineFromNavigatorPointer = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const viewport = timelineViewportRef.current;
    if (!viewport) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = rect.width > 0
      ? Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width))
      : 0;
    const maxScroll = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
    viewport.scrollTo({ left: maxScroll * ratio, behavior: 'auto' });
  }, []);

  const handleTimelineNavigatorPointerDown = useCallback((event: PointerEvent<HTMLDivElement>) => {
    scrollTimelineFromNavigatorPointer(event);
    safelySetPointerCapture(event.currentTarget, event.pointerId);
  }, [scrollTimelineFromNavigatorPointer]);

  const handleTimelineNavigatorPointerMove = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (event.buttons !== 1) return;
    scrollTimelineFromNavigatorPointer(event);
  }, [scrollTimelineFromNavigatorPointer]);

  const centerTimelineOnPlaybackPosition = useCallback((
    time = currentTime,
    laneWidth = timelineLaneWidth,
    behavior: ScrollBehavior = 'smooth',
  ) => {
    window.requestAnimationFrame(() => {
      const viewport = timelineViewportRef.current;
      if (!viewport || duration <= 0) return;

      const maxScroll = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
      const labelWidth = resolveTimelineChromeWidths(showAdvancedControls, timelineViewportWidth).label;
      const playheadX = 8 + labelWidth + TIMELINE_GRID_GAP + (Math.max(0, Math.min(duration, time)) / duration) * laneWidth;
      const nextScrollLeft = Math.max(0, Math.min(maxScroll, playheadX - viewport.clientWidth * 0.44));
      viewport.scrollTo({ left: nextScrollLeft, behavior });
    });
  }, [currentTime, duration, showAdvancedControls, timelineLaneWidth, timelineViewportWidth]);

  const applyTimelineZoom = useCallback((nextZoom: number) => {
    const safeZoom = clampTimelineZoom(nextZoom);
    setTimelineZoom(safeZoom);
    const nextLaneWidth = Math.round(resolveTimelineBaseLaneWidth(showAdvancedControls, timelineViewportWidth) * safeZoom);
    centerTimelineOnPlaybackPosition(currentTime, nextLaneWidth);
  }, [centerTimelineOnPlaybackPosition, currentTime, showAdvancedControls, timelineViewportWidth]);

  useEffect(() => {
    const viewport = timelineViewportRef.current;
    if (!viewport) return;

    const handleNativeTimelineWheel = (event: globalThis.WheelEvent) => {
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
        event.stopPropagation();
        const zoomStep = event.deltaY < 0 ? 0.15 : -0.15;
        applyTimelineZoom(timelineZoomRef.current + zoomStep);
        return;
      }

      if (event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
        event.preventDefault();
        event.stopPropagation();
        viewport.scrollLeft += event.deltaX + event.deltaY;
      }
    };

    viewport.addEventListener('wheel', handleNativeTimelineWheel, { passive: false });
    return () => {
      viewport.removeEventListener('wheel', handleNativeTimelineWheel);
    };
  }, [applyTimelineZoom]);

  const shouldStartTimelinePan = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return false;
    if (event.button !== 0 && event.button !== 1) return false;
    if (target.closest('button,input,textarea,select,a,canvas')) return false;
    if (target.closest('[data-timeline-seek-zone="true"]')) return false;
    return event.button === 1 || Boolean(target.closest('[data-timeline-pan-zone="true"]'));
  }, []);

  const handleTimelinePanPointerDown = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const viewport = timelineViewportRef.current;
    if (!viewport || !shouldStartTimelinePan(event)) return;
    if (viewport.scrollWidth <= viewport.clientWidth + 4) return;

    timelinePanRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      scrollLeft: viewport.scrollLeft,
      moved: false,
    };
    setIsTimelinePanning(true);
    setFollowPlayhead(false);
    safelySetPointerCapture(event.currentTarget, event.pointerId);
    event.preventDefault();
  }, [shouldStartTimelinePan]);

  const handleTimelinePanPointerMove = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const panState = timelinePanRef.current;
    const viewport = timelineViewportRef.current;
    if (!panState || !viewport || panState.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - panState.startX;
    const deltaY = event.clientY - panState.startY;
    if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
      panState.moved = true;
    }
    viewport.scrollLeft = panState.scrollLeft - deltaX;
    event.preventDefault();
  }, []);

  const finishTimelinePan = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const panState = timelinePanRef.current;
    if (!panState || panState.pointerId !== event.pointerId) return;

    if (panState.moved) {
      ignoreNextTrackClickRef.current = true;
      window.setTimeout(() => {
        ignoreNextTrackClickRef.current = false;
      }, 0);
    }
    timelinePanRef.current = null;
    setIsTimelinePanning(false);
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // The browser may have already released capture on cancel.
    }
  }, []);

  const visibleStems = useMemo(() => stems.filter((stem) => {
    if (trackViewMode === 'all') return true;

    const state = tracks[stem.type] || defaultTrackState();
    const isAudible = !state.muted && (!hasSoloTrack || state.solo) && state.volume > 0;
    if (trackViewMode === 'audible') return isAudible;

    return stemHasDetectedContent(stem, audioBuffersRef.current[stem.type]);
  }), [bufferVersion, hasSoloTrack, stems, trackViewMode, tracks]);

  const clipWaveformSources = useMemo<Record<string, StemClipWaveformSource>>(() => {
    const nextSources: Record<string, StemClipWaveformSource> = {};
    stems.forEach((stem) => {
      const buffer = audioBuffersRef.current[stem.type] || null;
      const waveform = stem.waveform;
      const peaks = waveform?.peaks?.length
        ? waveform.peaks
        : buffer
          ? buildWaveformPeaksFromSamples(buffer.getChannelData(0), 720)
          : [];
      nextSources[stem.type] = {
        duration: Math.max(waveform?.duration || 0, buffer?.duration || 0, duration),
        peaks,
        label: getStemDisplayName(stem).zh,
      };
    });
    return nextSources;
  }, [bufferVersion, duration, stems]);

  useEffect(() => {
    if (!selectedTrackType) return;
    const selectedRow = trackRowRefs.current[selectedTrackType];
    if (!selectedRow) return;

    selectedRow.scrollIntoView({
      block: 'nearest',
      inline: 'nearest',
    });
  }, [selectedTrackType, trackViewMode]);

  const activeStemCount = useMemo(() => stems.filter((stem) => (
    stemHasDetectedContent(stem, audioBuffersRef.current[stem.type])
  )).length, [bufferVersion, stems]);

  const audibleStemCount = useMemo(() => stems.filter((stem) => {
    const state = tracks[stem.type] || defaultTrackState();
    return !state.muted && (!hasSoloTrack || state.solo) && state.volume > 0;
  }).length, [hasSoloTrack, stems, tracks]);
  const selectedTrack = useMemo(
    () => {
      const selectedVisibleType = resolveVisibleStemSelection(
        visibleStems.map((stem) => stem.type),
        selectedTrackType,
      );
      return visibleStems.find((stem) => stem.type === selectedVisibleType) || null;
    },
    [selectedTrackType, visibleStems],
  );
  const selectedTrackState = selectedTrack
    ? (tracks[selectedTrack.type] || defaultTrackState())
    : null;
  const selectedTrackTrimControls = selectedTrackState
    ? resolveStemTrimControlValues({
      duration,
      trimStart: selectedTrackState.trimStart,
      trimEnd: selectedTrackState.trimEnd,
      fadeIn: selectedTrackState.fadeIn,
      fadeOut: selectedTrackState.fadeOut,
    })
    : null;
  const selectedTrackTrimEnd = selectedTrackTrimControls?.trimEnd ?? duration;
  const selectedTrackClipDuration = selectedTrackTrimControls?.clipDuration ?? 0;
  const selectedTrackClipState = selectedTrackState
    ? resolveTrackClipState(selectedTrackState, duration)
    : null;
  const selectedTrackClipCount = selectedTrackClipState?.clips.length ?? 0;
  const selectedClip = useMemo(() => {
    if (!selectedClipSelection) return null;
    const state = tracks[selectedClipSelection.trackType] || defaultTrackState();
    const clipState = resolveTrackClipState(state, duration);
    return clipState.clips.find((clip) => clip.id === selectedClipSelection.clipId) || null;
  }, [duration, selectedClipSelection, tracks]);
  const selectedTrackMutedRanges = selectedTrackState
    ? normalizeStemMutedRanges(selectedTrackState.mutedRanges, duration)
    : [];
  const selectedTrackBuffer = selectedTrack
    ? (audioBuffersRef.current[selectedTrack.type] || null)
    : null;
  const selectedTrackIsCustom = selectedTrack
    ? customStems.some((stem) => stem.type === selectedTrack.type)
    : false;
  const selectedTrackNeedsAudio = Boolean(selectedTrack && (selectedTrack.isPlaceholder || !selectedTrackBuffer));
  const playbackNudgeStepSeconds = normalizeTimelineSnapStep(snapToGrid ? snapStepSeconds : DEFAULT_TIMELINE_SNAP_STEP_SECONDS);
  const selectedTrackAudioStatus = selectedTrack
    ? resolveStemTrackAudioStatus({
      knownEmpty: stemHasKnownEmptyWaveform(selectedTrack),
      loaded: Boolean(selectedTrackBuffer),
      loading: loadingStemTypes.has(selectedTrack.type),
        failed: failedStemTypes.has(selectedTrack.type),
      })
    : null;
  const canUndo = historyVersion >= 0 && undoStackRef.current.length > 0;
  const canRedo = historyVersion >= 0 && redoStackRef.current.length > 0;
  const saveBadge = resolveStemEditSaveBadge({
    hasPendingChanges: hasPendingEditChanges,
    isSaving,
    autoSaveStatus,
    jobId,
  });

  const pushHistorySnapshot = useCallback((snapshot: StemEditorHistorySnapshot) => {
    undoStackRef.current = [...undoStackRef.current.slice(-59), cloneEditorHistorySnapshot(snapshot)];
    redoStackRef.current = [];
    setHistoryVersion((version) => version + 1);
  }, []);

  const beginDeferredHistory = useCallback((snapshot?: StemEditorHistorySnapshot) => {
    if (!deferredHistorySnapshotRef.current) {
      deferredHistorySnapshotRef.current = cloneEditorHistorySnapshot(snapshot || editorHistoryRef.current);
      deferredHistoryChangedRef.current = false;
    }
    setIsContinuousEditing(true);
  }, []);

  const commitDeferredHistory = useCallback(() => {
    const snapshot = deferredHistorySnapshotRef.current;
    deferredHistorySnapshotRef.current = null;
    const hasChanged = deferredHistoryChangedRef.current;
    deferredHistoryChangedRef.current = false;
    setIsContinuousEditing(false);
    if (!snapshot) return;
    if (!hasChanged && areEditorHistorySnapshotsEqual(snapshot, editorHistoryRef.current)) return;
    pushHistorySnapshot(snapshot);
    setSaveRequestVersion((version) => version + 1);
  }, [pushHistorySnapshot]);

  const rememberEditorHistory = useCallback(() => {
    pushHistorySnapshot(editorHistoryRef.current);
  }, [pushHistorySnapshot]);

  const restoreEditorHistorySnapshot = useCallback((snapshot: StemEditorHistorySnapshot) => {
    const next = cloneEditorHistorySnapshot(snapshot);
    setTracks(next.tracks);
    setMasterState(next.master);
    setTrackLabels(next.trackLabels);
    setTrackColors(next.trackColors);
    setTrackOrder(next.trackOrder);
    setDeletedTrackTypes(next.deletedTrackTypes);
    setCustomStems(next.customStems);
    setSkippedEmptyCount(next.skippedEmptyCount);
    setSelectedTrackType(next.selectedTrackType);
    editorHistoryRef.current = next;
  }, []);

  const commitTrackChange = useCallback((
    updater: Record<string, StemTrackState> | ((current: Record<string, StemTrackState>) => Record<string, StemTrackState>),
    historyMode: StemHistoryMode = 'immediate',
  ) => {
    if (historyMode === 'deferred') {
      beginDeferredHistory();
      deferredHistoryChangedRef.current = true;
    }
    setTracks((current) => {
      const next = typeof updater === 'function' ? updater(current) : updater;
      if (areTrackStatesEqual(current, next)) return current;
      if (historyMode === 'immediate') {
        pushHistorySnapshot({ ...editorHistoryRef.current, tracks: current });
      } else if (historyMode === 'deferred') {
        beginDeferredHistory({ ...editorHistoryRef.current, tracks: current });
        deferredHistoryChangedRef.current = true;
      }
      return next;
    });
  }, [beginDeferredHistory, pushHistorySnapshot]);

  const undoTrackChange = useCallback(() => {
    deferredHistorySnapshotRef.current = null;
    deferredHistoryChangedRef.current = false;
    setIsContinuousEditing(false);
    const previous = undoStackRef.current.pop();
    if (!previous) return;
    redoStackRef.current = [...redoStackRef.current.slice(-59), cloneEditorHistorySnapshot(editorHistoryRef.current)];
    restoreEditorHistorySnapshot(previous);
    setHistoryVersion((version) => version + 1);
    setSaveStatus('已回到上一步，自动保存后下次进入会恢复。');
  }, [restoreEditorHistorySnapshot]);

  const redoTrackChange = useCallback(() => {
    deferredHistorySnapshotRef.current = null;
    deferredHistoryChangedRef.current = false;
    setIsContinuousEditing(false);
    const next = redoStackRef.current.pop();
    if (!next) return;
    undoStackRef.current = [...undoStackRef.current.slice(-59), cloneEditorHistorySnapshot(editorHistoryRef.current)];
    restoreEditorHistorySnapshot(next);
    setHistoryVersion((version) => version + 1);
    setSaveStatus('已前进到下一步，自动保存后下次进入会恢复。');
  }, [restoreEditorHistorySnapshot]);

  const moveTrackOrderByPointer = useCallback((trackType: string, clientY: number) => {
    const visibleTypes = visibleStems.map((stem) => stem.type);
    if (!visibleTypes.includes(trackType)) return false;

    const targetType = visibleTypes.find((type) => {
      if (type === trackType) return false;
      const row = trackRowRefs.current[type];
      if (!row) return false;
      const rect = row.getBoundingClientRect();
      return clientY >= rect.top && clientY <= rect.bottom;
    });
    if (!targetType) return false;

    const targetRow = trackRowRefs.current[targetType];
    if (!targetRow) return false;
    const targetRect = targetRow.getBoundingClientRect();
    const insertAfterTarget = clientY > targetRect.top + targetRect.height / 2;

    let changed = false;
    setTrackOrder((current) => {
      const normalizedOrder = normalizeTrackOrderForStems(current, stems);
      const withoutMoving = normalizedOrder.filter((type) => type !== trackType);
      const targetIndex = withoutMoving.indexOf(targetType);
      if (targetIndex < 0) return current;

      const insertIndex = targetIndex + (insertAfterTarget ? 1 : 0);
      const nextOrder = [
        ...withoutMoving.slice(0, insertIndex),
        trackType,
        ...withoutMoving.slice(insertIndex),
      ];
      if (nextOrder.join('\u0000') === normalizedOrder.join('\u0000')) return current;
      changed = true;
      return nextOrder;
    });

    if (changed) {
      deferredHistoryChangedRef.current = true;
      setSaveStatus('轨道顺序已调整，自动保存后下次进入会恢复。');
    }
    return changed;
  }, [stems, visibleStems]);

  const handleTrackHeaderPointerDown = useCallback((event: PointerEvent<HTMLDivElement>, trackType: string) => {
    const target = event.target;
    if (event.button !== 0 || !(target instanceof HTMLElement)) return;
    if (target.closest('button,input,textarea,select,a,canvas')) return;

    trackReorderDragRef.current = {
      pointerId: event.pointerId,
      trackType,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
    };
    setSelectedTrackType(trackType);
    setSelectedClipSelection(null);
    safelySetPointerCapture(event.currentTarget, event.pointerId);
    event.preventDefault();
    event.stopPropagation();
  }, []);

  const handleTrackHeaderPointerMove = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const drag = trackReorderDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;
    if (!drag.moved && Math.abs(deltaY) < 8 && Math.abs(deltaY) <= Math.abs(deltaX)) {
      return;
    }

    if (!drag.moved) {
      drag.moved = true;
      beginDeferredHistory();
      deferredHistoryChangedRef.current = false;
    }
    moveTrackOrderByPointer(drag.trackType, event.clientY);
    event.preventDefault();
    event.stopPropagation();
  }, [beginDeferredHistory, moveTrackOrderByPointer]);

  const handleTrackHeaderPointerUp = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const drag = trackReorderDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    trackReorderDragRef.current = null;
    if (drag.moved) {
      ignoreNextTrackClickRef.current = true;
      window.setTimeout(() => {
        ignoreNextTrackClickRef.current = false;
      }, 0);
      commitDeferredHistory();
    }
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // Pointer capture may already be released on cancel.
    }
    event.preventDefault();
    event.stopPropagation();
  }, [commitDeferredHistory]);

  const stopFrame = useCallback(() => {
    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
  }, []);

  const stopSources = useCallback(() => {
    Object.values(sourceNodesRef.current).forEach((sources) => {
      sources.forEach((source) => {
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

  const clearLoopPreviewTimer = useCallback(() => {
    if (loopPreviewTimerRef.current !== null) {
      window.clearInterval(loopPreviewTimerRef.current);
      loopPreviewTimerRef.current = null;
    }
  }, []);

  useEffect(() => () => {
    clearLoopPreviewTimer();
  }, [clearLoopPreviewTimer]);

  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }
    return audioContextRef.current;
  }, []);

  useEffect(() => {
    setTracks(createTrackState(initialAllStems, initialEditState));
    setMasterState(normalizeStemMasterState(initialEditState?.master));
    setTrackLabels(normalizeTrackLabels(initialEditState?.trackLabels));
    setTrackColors(normalizeTrackColors(initialEditState?.trackColors));
    setTrackOrder(normalizeTrackOrderForStems(initialEditState?.trackOrder, initialAllStems));
    const nextDeletedTrackTypes = normalizeDeletedStemTypes(initialEditState?.deletedTrackTypes, initialAllStems);
    setDeletedTrackTypes(nextDeletedTrackTypes);
    customObjectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    customObjectUrlsRef.current.clear();
    setCustomStems(initialCustomStems);
    editorHistoryRef.current = {
      tracks: createTrackState(initialAllStems, initialEditState),
      master: normalizeStemMasterState(initialEditState?.master),
      trackLabels: normalizeTrackLabels(initialEditState?.trackLabels),
      trackColors: normalizeTrackColors(initialEditState?.trackColors),
      trackOrder: normalizeTrackOrderForStems(initialEditState?.trackOrder, initialAllStems),
      deletedTrackTypes: nextDeletedTrackTypes,
      customStems: initialCustomStems,
      skippedEmptyCount: 0,
      selectedTrackType: filterDeletedStems(initialAllStems, nextDeletedTrackTypes)[0]?.type ?? null,
    };
    setRecordingStatus(null);
    setRecordingWaveform(Array.from({ length: 28 }, () => 0.08));
    setRecordingTrackType(null);
    setRecordingTrackWaveform(Array.from({ length: 220 }, () => 0));
    setRecordingLevel(0);
    importTargetTypeRef.current = null;
    if (recordingWaveformFrameRef.current !== null) {
      window.cancelAnimationFrame(recordingWaveformFrameRef.current);
      recordingWaveformFrameRef.current = null;
    }
    const recordingContext = recordingAudioContextRef.current;
    recordingAudioContextRef.current = null;
    void recordingContext?.close();
    setIsPlaying(false);
    setCurrentTime(0);
    const activeInitialStems = filterDeletedStems(initialAllStems, nextDeletedTrackTypes);
    setDuration(getInitialWaveformDuration(activeInitialStems.length > 0 ? activeInitialStems : initialAllStems));
    const stemsToLoad = activeInitialStems.filter((stem) => !stemHasKnownEmptyWaveform(stem));
    const knownEmptyCount = activeInitialStems.length - stemsToLoad.length;
    setLoadingCount(stemsToLoad.length);
    setFailedLoadCount(0);
    loadingCountRef.current = stemsToLoad.length;
    failedLoadCountRef.current = 0;
    setLoadingStemTypes(new Set(stemsToLoad.map((stem) => stem.type)));
    setFailedStemTypes(new Set());
    setCachedLoadCount(0);
    setSkippedEmptyCount(knownEmptyCount);
    editorHistoryRef.current = {
      ...editorHistoryRef.current,
      skippedEmptyCount: knownEmptyCount,
    };
    setBufferVersion(0);
    setPlaybackError(null);
    setSaveStatus(initialEditState?.savedAt ? '已读取上次保存的编辑状态。' : null);
    setAutoSaveStatus(null);
    setHasPendingEditChanges(false);
    setExportingStemType(null);
    setExportStatusInput({ phase: 'idle' });
    setSelectedTrackType(activeInitialStems[0]?.type ?? null);
    skipNextAutoSaveRef.current = true;
    lastAutoSaveSignatureRef.current = null;
    undoStackRef.current = [];
    redoStackRef.current = [];
    setHistoryVersion((version) => version + 1);
    playbackStartedAtRef.current = 0;
    playbackOffsetRef.current = 0;
    playbackStopAtRef.current = null;
    previewStemTypeRef.current = null;
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
        setLoadingStemTypes((current) => {
          const next = new Set(current);
          next.delete(stem.type);
          return next;
        });
        setFailedStemTypes((current) => {
          const next = new Set(current);
          next.delete(stem.type);
          return next;
        });
        setBufferVersion((version) => version + 1);
        setDuration((current) => Math.max(current, loaded.audioBuffer.duration || 0));

        if (!stem.waveform?.peaks?.length) {
          void persistWaveform(jobId, stem.type, calculateWaveform(loaded.audioBuffer));
        }
      } catch {
        if (!abortController.signal.aborted) {
          setFailedLoadCount((count) => count + 1);
          setFailedStemTypes((current) => new Set(current).add(stem.type));
          setLoadingStemTypes((current) => {
            const next = new Set(current);
            next.delete(stem.type);
            return next;
          });
        }
      } finally {
        if (!abortController.signal.aborted) {
          setLoadingStemTypes((current) => {
            const next = new Set(current);
            next.delete(stem.type);
            return next;
          });
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
  }, [getAudioContext, initialAllStems, initialCustomStems, initialEditState, jobId, stopFrame, stopSources]);

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
    clearLoopPreviewTimer();
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
  }, [clearLoopPreviewTimer, duration, stopFrame, stopSources]);

  const playAll = useCallback(async () => {
    if (!masterStem) return;

    const previewStemType = previewStemTypeRef.current;
    const audioDurations = Object.fromEntries(
      Object.entries(audioBuffersRef.current).map(([type, buffer]) => [type, buffer.duration]),
    );
    const playableStems = stems.filter((stem) => {
      if (previewStemType && stem.type !== previewStemType) return false;
      const state = tracks[stem.type] || defaultTrackState();
      const clipState = resolveTrackClipState(state, Math.max(duration, audioDurations[stem.type] || 0));
      return clipState.clips.some((clip) => Boolean(audioBuffersRef.current[clip.sourceTrackType || stem.type]));
    });
    if (playableStems.length === 0) {
      setPlaybackError('分轨正在缓存中，第一条轨道完成后即可开始预听。');
      return;
    }

    const unavailableCount = previewStemType ? 0 : Math.max(0, loadableStemCount - playableStems.length);
    setPlaybackError(unavailableCount > 0
      ? `当前先播放已就绪的 ${playableStems.length} 条，自动跳过 ${unavailableCount} 条未就绪分轨。`
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
        const gain = context.createGain();
        const state = tracks[stem.type] || defaultTrackState();
        const isAudible = previewStemType ? state.volume > 0 : !state.muted && (!hasSoloTrack || state.solo);
        const trimStart = Math.max(0, Math.min(duration, state.trimStart));
        const trimEnd = Math.max(trimStart, Math.min(duration, state.trimEnd ?? duration));
        const cursor = playbackOffsetRef.current;
        const bufferOffset = Math.max(trimStart, cursor);
        const gainScheduleStartAt = startAt + Math.max(0, trimStart - cursor);
        const segments = buildTrackClipAudioSegments(state, duration, audioDurations, cursor, stem.type);

        if (isAudible) {
          scheduleTrackGain({
            gain: gain.gain,
            baseVolume: state.volume,
            startAt: gainScheduleStartAt,
            playbackFrom: bufferOffset,
            trimStart,
            trimEnd,
            fadeIn: state.fadeIn,
            fadeOut: state.fadeOut,
          });
        } else {
          gain.gain.value = 0;
        }
        const panner = connectGainWithPan(context, gain, masterOutput.input, state.pan);
        gainNodesRef.current[stem.type] = gain;
        if (panner) {
          panNodesRef.current[stem.type] = panner;
        }
        sourceNodesRef.current[stem.type] = segments.flatMap((segment) => {
          const audioBuffer = audioBuffersRef.current[segment.sourceTrackType];
          if (!audioBuffer) return [];
          const source = context.createBufferSource();
          source.buffer = audioBuffer;
          source.connect(gain);
          source.start(
            startAt + Math.max(0, segment.timelineStart - cursor),
            segment.sourceStart,
            Math.max(0, segment.sourceEnd - segment.sourceStart),
          );
          return [source];
        });
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

        const stopAt = playbackStopAtRef.current ?? duration;
        if (stopAt > 0 && nextTime >= stopAt) {
          playbackOffsetRef.current = playbackStopAtRef.current === null ? 0 : stopAt;
          setCurrentTime(playbackStopAtRef.current === null ? 0 : stopAt);
          playbackStartedAtRef.current = 0;
          playbackStopAtRef.current = null;
          previewStemTypeRef.current = null;
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
  }, [duration, getAudioContext, hasSoloTrack, loadableStemCount, masterState, masterStem, pauseAll, stems, stopFrame, stopSources, tracks]);

  const handleTogglePlayback = useCallback(() => {
    if (isPlaying) {
      pauseAll();
      return;
    }

    clearLoopPreviewTimer();
    playbackStopAtRef.current = null;
    previewStemTypeRef.current = null;
    void playAll();
  }, [clearLoopPreviewTimer, isPlaying, pauseAll, playAll]);

  const stopPlaybackPreview = useCallback(() => {
    pauseAll();
    playbackStopAtRef.current = null;
    previewStemTypeRef.current = null;
    loopSelectionPreviewRef.current = false;
    setLoopSelectionPreview(false);
    setPlaybackError(null);
    setSaveStatus('已停止播放并退出选区预听。');
  }, [pauseAll]);

  const clearExportHistory = useCallback(() => {
    setExportRecords((records) => clearStemExportRecords(records));
    setSaveStatus('最近导出记录已清空。');
    setPlaybackError(null);
  }, []);

  const reloadAudioCache = useCallback(async () => {
    if (loadingCountRef.current > 0 || isAudioRetrying) {
      setSaveStatus('音频仍在加载中，请稍等当前队列完成。');
      return;
    }

    const stemTypesToLoad = new Set(selectStemTypesForAudioLoad(stems.map((stem) => ({
      type: stem.type,
      knownEmpty: stemHasKnownEmptyWaveform(stem),
      loaded: Boolean(audioBuffersRef.current[stem.type]),
    }))));

    const stemsToLoad = stems.filter((stem) => stemTypesToLoad.has(stem.type));
    if (stemsToLoad.length === 0) {
      setPlaybackError(null);
      setSaveStatus('音频检查完成：所有可用分轨都已就绪，无需重新加载。');
      return;
    }

    pauseAll();
    setIsAudioRetrying(true);
    setPlaybackError(null);
    setSaveStatus(`正在检查音频，只补载 ${stemsToLoad.length} 条未就绪分轨。`);
    setFailedLoadCount(0);
    failedLoadCountRef.current = 0;
    setLoadingCount(stemsToLoad.length);
    loadingCountRef.current = stemsToLoad.length;
    setLoadingStemTypes(new Set(stemsToLoad.map((stem) => stem.type)));
    setFailedStemTypes(new Set());

    const context = getAudioContext();
    const abortController = new AbortController();
    const prioritizedStems = sortStemsByLoadPriority(stemsToLoad);
    let nextStemIndex = 0;
    let loadedCount = 0;
    let failedCount = 0;

    const loadNextStem = async (): Promise<void> => {
      const stem = prioritizedStems[nextStemIndex];
      nextStemIndex += 1;
      if (!stem || abortController.signal.aborted) return;

      try {
        const loaded = await readAndDecodeStemAudio(context, stem, abortController.signal);
        if (abortController.signal.aborted) return;
        if (loaded.source === 'browser-cache') {
          setCachedLoadCount((count) => count + 1);
        }

        loadedCount += 1;
        audioBuffersRef.current[stem.type] = loaded.audioBuffer;
        setLoadingStemTypes((current) => {
          const next = new Set(current);
          next.delete(stem.type);
          return next;
        });
        setFailedStemTypes((current) => {
          const next = new Set(current);
          next.delete(stem.type);
          return next;
        });
        setBufferVersion((version) => version + 1);
        setDuration((current) => Math.max(current, loaded.audioBuffer.duration || 0));

        if (!stem.waveform?.peaks?.length) {
          void persistWaveform(jobId, stem.type, calculateWaveform(loaded.audioBuffer));
        }
      } catch {
        if (!abortController.signal.aborted) {
          failedCount += 1;
          setFailedLoadCount((count) => count + 1);
          setFailedStemTypes((current) => new Set(current).add(stem.type));
          setLoadingStemTypes((current) => {
            const next = new Set(current);
            next.delete(stem.type);
            return next;
          });
        }
      } finally {
        if (!abortController.signal.aborted) {
          setLoadingStemTypes((current) => {
            const next = new Set(current);
            next.delete(stem.type);
            return next;
          });
          setLoadingCount((count) => Math.max(0, count - 1));
          await loadNextStem();
        }
      }
    };

    try {
      await Promise.all(Array.from({ length: Math.min(STEM_LOAD_CONCURRENCY, prioritizedStems.length) }, () => loadNextStem()));
      setSaveStatus(
        failedCount > 0
          ? `音频检查完成：补载成功 ${loadedCount} 条，仍有 ${failedCount} 条暂不可用。`
          : `音频检查完成：已补载 ${loadedCount} 条分轨。`,
      );
    } finally {
      setIsAudioRetrying(false);
      loadingCountRef.current = 0;
    }
  }, [getAudioContext, isAudioRetrying, jobId, pauseAll, stems]);

  const retrySingleStemAudio = useCallback(async (stem: EditableStem) => {
    if (stemHasKnownEmptyWaveform(stem)) {
      setSaveStatus(`“${getStemDisplayName(stem).zh}”是空轨，无需加载音频。`);
      return;
    }
    if (audioBuffersRef.current[stem.type]) {
      setSaveStatus(`“${getStemDisplayName(stem).zh}”音频已就绪。`);
      return;
    }
    if (loadingStemTypes.has(stem.type) || isAudioRetrying) {
      setSaveStatus(`“${getStemDisplayName(stem).zh}”正在加载中，请稍等。`);
      return;
    }

    pauseAll();
    setIsAudioRetrying(true);
    setPlaybackError(null);
    setSaveStatus(`正在重试“${getStemDisplayName(stem).zh}”音频。`);
    setLoadingCount((count) => count + 1);
    loadingCountRef.current += 1;
    if (failedStemTypes.has(stem.type)) {
      setFailedLoadCount((count) => Math.max(0, count - 1));
      failedLoadCountRef.current = Math.max(0, failedLoadCountRef.current - 1);
    }
    setFailedStemTypes((current) => {
      const next = new Set(current);
      next.delete(stem.type);
      return next;
    });
    setLoadingStemTypes((current) => new Set(current).add(stem.type));

    try {
      const context = getAudioContext();
      const loaded = await readAndDecodeStemAudio(context, stem, new AbortController().signal);
      if (loaded.source === 'browser-cache') {
        setCachedLoadCount((count) => count + 1);
      }

      audioBuffersRef.current[stem.type] = loaded.audioBuffer;
      setBufferVersion((version) => version + 1);
      setDuration((current) => Math.max(current, loaded.audioBuffer.duration || 0));
      setSaveStatus(`“${getStemDisplayName(stem).zh}”音频已就绪。`);

      if (!stem.waveform?.peaks?.length) {
        void persistWaveform(jobId, stem.type, calculateWaveform(loaded.audioBuffer));
      }
    } catch {
      setFailedLoadCount((count) => count + 1);
      failedLoadCountRef.current += 1;
      setFailedStemTypes((current) => new Set(current).add(stem.type));
      setPlaybackError(`“${getStemDisplayName(stem).zh}”音频暂时不可用，可以稍后再重试。`);
    } finally {
      setLoadingCount((count) => Math.max(0, count - 1));
      loadingCountRef.current = Math.max(0, loadingCountRef.current - 1);
      setLoadingStemTypes((current) => {
        const next = new Set(current);
        next.delete(stem.type);
        return next;
      });
      setIsAudioRetrying(false);
    }
  }, [failedStemTypes, getAudioContext, isAudioRetrying, jobId, loadingStemTypes, pauseAll]);

  const renameTrack = useCallback((type: string, value: string, historyMode: StemHistoryMode = 'immediate') => {
    const label = sanitizeTrackLabel(value);
    const fallback = stems.find((stem) => stem.type === type);
    if (historyMode === 'deferred') {
      beginDeferredHistory();
      deferredHistoryChangedRef.current = true;
    }
    setTrackLabels((current) => {
      const next = { ...current };
      if (!label || label === getStemDisplayName({ ...(fallback || { type, label: type, url: '' }), displayLabel: undefined }).zh) {
        delete next[type];
      } else {
        next[type] = label;
      }
      if (JSON.stringify(current) !== JSON.stringify(next)) {
        if (historyMode === 'immediate') {
          pushHistorySnapshot({ ...editorHistoryRef.current, trackLabels: current });
        } else if (historyMode === 'deferred') {
          beginDeferredHistory({ ...editorHistoryRef.current, trackLabels: current });
          deferredHistoryChangedRef.current = true;
        }
      }
      return next;
    });
    setSaveStatus(label ? `轨道已重命名为“${label}”。` : '轨道名称已恢复默认。');
  }, [beginDeferredHistory, pushHistorySnapshot, stems]);

  const setTrackColor = useCallback((type: string, value: string) => {
    const color = sanitizeTrackColor(value);
    if (!color) return;

    setTrackColors((current) => {
      const fallbackColor = stemColorForType(type);
      const next = { ...current };
      if (color === fallbackColor.toLowerCase()) {
        delete next[type];
      } else {
        next[type] = color;
      }
      if (JSON.stringify(current) !== JSON.stringify(next)) {
        pushHistorySnapshot({ ...editorHistoryRef.current, trackColors: current });
      }
      return next;
    });
    setSaveStatus(`轨道颜色已更新为 ${color}。`);
  }, [pushHistorySnapshot]);

  const createEmptyCustomTrack = useCallback(() => {
    const type = `custom_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    const displayLabel = `空轨道 ${customStems.length + 1}`;
    const placeholderDuration = Math.max(1, Number(duration.toFixed(3)) || 1);
    const stem: EditableStem = {
      type,
      label: displayLabel,
      displayLabel,
      url: '',
      isPlaceholder: true,
      waveform: {
        duration: placeholderDuration,
        peaks: Array.from({ length: 96 }, () => 0),
      },
    };

    rememberEditorHistory();
    setCustomStems((current) => [...current, stem]);
    setTrackOrder((current) => [...current.filter((item) => item !== type), type]);
    setTracks((current) => ({
      ...current,
      [type]: defaultTrackState(),
    }));
    setSkippedEmptyCount((count) => count + 1);
    setSelectedTrackType(type);
    setTrackViewMode('all');
    setInspectorTab('track');
    setInspectorCollapsed(false);
    setAddTrackMode('import');
    setIsAddTrackPanelOpen(true);
    setRecordingStatus(null);
    setSaveStatus(`已添加“${displayLabel}”，可在右侧导入音频或现场录音。`);
    return type;
  }, [customStems.length, duration, rememberEditorHistory]);

  const resolveAudioInputTargetType = useCallback(() => {
    if (selectedTrack && customStems.some((stem) => stem.type === selectedTrack.type)) {
      return selectedTrack.type;
    }
    return createEmptyCustomTrack();
  }, [createEmptyCustomTrack, customStems, selectedTrack]);

  const addCustomStemFromBlob = useCallback(async (blob: Blob, label: string, targetType?: string | null) => {
    if (!blob.size) {
      setPlaybackError('没有收到可用音频，请重新选择文件或重新录音。');
      return;
    }

    try {
      pauseAll();
      setPlaybackError(null);
      setRecordingStatus('正在解析音频...');

      const context = getAudioContext();
      const arrayBuffer = await blob.arrayBuffer();
      const audioBuffer = await context.decodeAudioData(arrayBuffer);
      const existingStem = targetType
        ? customStems.find((stem) => stem.type === targetType)
        : null;
      const type = existingStem?.type || `custom_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
      const shouldUseIncomingLabel = !existingStem
        || existingStem.isPlaceholder
        || getStemDisplayName(existingStem).zh.startsWith('空轨道');
      const displayLabel = shouldUseIncomingLabel
        ? (sanitizeTrackLabel(label) || `新增轨道 ${customStems.length + 1}`)
        : getStemDisplayName(existingStem).zh;
      let url = URL.createObjectURL(blob);
      let storagePath = '';
      if (jobId) {
        setRecordingStatus('正在上传音频...');
        const uploaded = await uploadCustomStemAudio({
          jobId,
          stemType: type,
          blob,
          label: displayLabel,
        });
        URL.revokeObjectURL(url);
        url = uploaded.url;
        storagePath = uploaded.storagePath;
      }
      const stem: EditableStem = {
        type,
        label: displayLabel,
        displayLabel,
        url,
        isPlaceholder: false,
        waveform: calculateWaveform(audioBuffer),
        ...(storagePath ? { storagePath } : {}),
      };

      rememberEditorHistory();
      if (existingStem?.url && customObjectUrlsRef.current.has(existingStem.url)) {
        URL.revokeObjectURL(existingStem.url);
        customObjectUrlsRef.current.delete(existingStem.url);
      }
      if (!storagePath) {
        customObjectUrlsRef.current.add(url);
      }
      audioBuffersRef.current[type] = audioBuffer;
      setCustomStems((current) => {
        const existingIndex = current.findIndex((item) => item.type === type);
        if (existingIndex < 0) return [...current, stem];
        const next = [...current];
        next[existingIndex] = stem;
        return next;
      });
      setTrackOrder((current) => (
        existingStem
          ? current.includes(type) ? current : [...current, type]
          : [...current.filter((item) => item !== type), type]
      ));
      setTracks((current) => ({
        ...current,
        [type]: current[type] || defaultTrackState(),
      }));
      if (existingStem && stemHasKnownEmptyWaveform(existingStem)) {
        setSkippedEmptyCount((count) => Math.max(0, count - 1));
      }
      setSelectedTrackType(type);
      setTrackViewMode('all');
      setInspectorTab('track');
      setInspectorCollapsed(false);
      setDuration((current) => Math.max(current, audioBuffer.duration || 0));
      setBufferVersion((version) => version + 1);
      setRecordingStatus(null);
      setRecordingWaveform(Array.from({ length: 28 }, () => 0.08));
      setRecordingTrackType(null);
      setRecordingTrackWaveform(Array.from({ length: 220 }, () => 0));
      setRecordingLevel(0);
      setIsAddTrackPanelOpen(true);
      setSaveStatus(jobId
        ? `已为“${displayLabel}”载入并保存音频，可参与预听、混音和导出。`
        : `已为“${displayLabel}”载入音频；当前没有缓存 ID，刷新后不能恢复。`);
    } catch (error) {
      setRecordingStatus(null);
      const message = error instanceof Error ? error.message : '音频解析或上传失败，请换一个常见格式文件，或重新录音。';
      if (isEditorAuthError((error as { status?: number })?.status ?? 0, message)) {
        setPlaybackError('登录已过期，正在跳转登录页。');
        redirectToLoginFromStemEditor();
        return;
      }
      setPlaybackError(message);
    }
  }, [customStems, getAudioContext, jobId, pauseAll, rememberEditorHistory]);

  const importTrackFile = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const label = file.name.replace(/\.[^/.]+$/, '');
    const targetType = importTargetTypeRef.current || resolveAudioInputTargetType();
    importTargetTypeRef.current = null;
    void addCustomStemFromBlob(file, label, targetType);
  }, [addCustomStemFromBlob, resolveAudioInputTargetType]);

  const importAudioToSelectedTrack = useCallback(() => {
    importTargetTypeRef.current = resolveAudioInputTargetType();
    setAddTrackMode('import');
    setIsAddTrackPanelOpen(true);
    fileInputRef.current?.click();
  }, [resolveAudioInputTargetType]);

  const stopRecordingMeter = useCallback(() => {
    if (recordingWaveformFrameRef.current !== null) {
      window.cancelAnimationFrame(recordingWaveformFrameRef.current);
      recordingWaveformFrameRef.current = null;
    }
    const context = recordingAudioContextRef.current;
    recordingAudioContextRef.current = null;
    recordingInputGainRef.current = null;
    recordingMonitorGainRef.current = null;
    recordingProcessedStreamRef.current?.getTracks().forEach((track) => track.stop());
    recordingProcessedStreamRef.current = null;
    void context?.close();
    setRecordingLevel(0);
  }, []);

  const stopMonitoringPreview = useCallback(() => {
    monitoringPreviewStreamRef.current?.getTracks().forEach((track) => track.stop());
    monitoringPreviewStreamRef.current = null;
    setIsMonitoringPreview(false);
    if (!isRecording) {
      stopRecordingMeter();
      setRecordingStatus((current) => current === '监听中...' ? null : current);
    }
  }, [isRecording, stopRecordingMeter]);

  useEffect(() => {
    if (recordingInputGainRef.current) {
      recordingInputGainRef.current.gain.value = recordingInputLevel;
    }
    if (recordingMonitorGainRef.current) {
      recordingMonitorGainRef.current.gain.value = monitoringEnabled ? 1 : 0;
    }
  }, [monitoringEnabled, recordingInputLevel]);

  const startRecordingMeter = useCallback((stream: MediaStream, forceMonitoring = monitoringEnabled) => {
    stopRecordingMeter();
    const context = new AudioContext();
    const source = context.createMediaStreamSource(stream);
    const inputGain = context.createGain();
    const monitorGain = context.createGain();
    const analyser = context.createAnalyser();
    const recordingDestination = context.createMediaStreamDestination();
    analyser.fftSize = 256;
    inputGain.gain.value = recordingInputLevel;
    monitorGain.gain.value = forceMonitoring ? 1 : 0;
    void context.resume().catch(() => undefined);

    if (recordingInputChannel === 'stereo') {
      source.connect(inputGain);
    } else {
      const splitter = context.createChannelSplitter(2);
      source.connect(splitter);
      try {
        splitter.connect(inputGain, recordingInputChannel === 'channel-2' ? 1 : 0);
      } catch {
        splitter.connect(inputGain, 0);
      }
    }

    inputGain.connect(analyser);
    inputGain.connect(recordingDestination);
    inputGain.connect(monitorGain);
    monitorGain.connect(context.destination);
    recordingAudioContextRef.current = context;
    recordingInputGainRef.current = inputGain;
    recordingMonitorGainRef.current = monitorGain;
    recordingProcessedStreamRef.current = recordingDestination.stream;

    const samples = new Uint8Array(analyser.fftSize);
    const tick = () => {
      analyser.getByteTimeDomainData(samples);
      let sum = 0;
      let peak = 0;
      for (let index = 0; index < samples.length; index += 1) {
        const centered = (samples[index] - 128) / 128;
        sum += centered * centered;
        peak = Math.max(peak, Math.abs(centered));
      }
      const rms = Math.sqrt(sum / samples.length);
      const level = Math.max(0.08, Math.min(1, rms * 5.2));
      const trackPeak = Math.max(0.01, Math.min(1, peak * 1.4));
      setRecordingWaveform((current) => [...current.slice(-27), level]);
      setRecordingTrackWaveform((current) => [...current.slice(1), trackPeak]);
      setRecordingLevel(Math.min(1, Math.max(level, trackPeak * 0.72)));
      recordingWaveformFrameRef.current = window.requestAnimationFrame(tick);
    };

    tick();
    return recordingDestination.stream;
  }, [monitoringEnabled, recordingInputChannel, recordingInputLevel, stopRecordingMeter]);

  const toggleInputMonitoring = useCallback(async () => {
    if (monitoringEnabled) {
      setMonitoringEnabled(false);
      if (recordingMonitorGainRef.current) {
        recordingMonitorGainRef.current.gain.value = 0;
      }
      if (!isRecording) {
        stopMonitoringPreview();
      }
      return;
    }

    setMonitoringEnabled(true);
    if (recordingAudioContextRef.current && recordingMonitorGainRef.current) {
      await recordingAudioContextRef.current.resume().catch(() => undefined);
      recordingMonitorGainRef.current.gain.value = 1;
      if (!isRecording) {
        setIsMonitoringPreview(true);
        setRecordingStatus('监听中...');
      }
      return;
    }

    if (isRecording) return;

    if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setMonitoringEnabled(false);
      setPlaybackError('当前浏览器不支持麦克风监听。');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: selectedAudioInputDeviceId ? { exact: selectedAudioInputDeviceId } : undefined,
          channelCount: recordingInputChannel === 'channel-1' ? { ideal: 1 } : { ideal: 2 },
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
      monitoringPreviewStreamRef.current = stream;
      startRecordingMeter(stream, true);
      setIsMonitoringPreview(true);
      setRecordingStatus('监听中...');
      setPlaybackError(null);
      void refreshAudioInputDevices();
    } catch {
      setMonitoringEnabled(false);
      setIsMonitoringPreview(false);
      stopRecordingMeter();
      setPlaybackError('无法打开麦克风监听，请检查浏览器权限和输入设备。');
    }
  }, [
    isRecording,
    monitoringEnabled,
    recordingInputChannel,
    refreshAudioInputDevices,
    selectedAudioInputDeviceId,
    startRecordingMeter,
    stopMonitoringPreview,
    stopRecordingMeter,
  ]);

  const openAddTrackPanel = useCallback((mode: 'import' | 'record' = 'import') => {
    setAddTrackMode(mode);
    setIsAddTrackPanelOpen(true);
    setInspectorTab('track');
    setInspectorCollapsed(false);
    setRecordingStatus(null);
  }, []);

  const startRecordingTrack = useCallback(async () => {
    if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia || !('MediaRecorder' in window)) {
      setPlaybackError('当前浏览器不支持现场录音，请改用导入音频。');
      return;
    }

    try {
      stopMonitoringPreview();
      const targetType = resolveAudioInputTargetType();
      setSelectedTrackType(targetType);
      setRecordingTrackType(targetType);
      setRecordingTrackWaveform(Array.from({ length: 220 }, () => 0));
      setRecordingLevel(0);
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: selectedAudioInputDeviceId ? { exact: selectedAudioInputDeviceId } : undefined,
          channelCount: recordingInputChannel === 'channel-1' ? { ideal: 1 } : { ideal: 2 },
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
      void refreshAudioInputDevices();
      const processedStream = startRecordingMeter(stream, monitoringEnabled);
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : '';
      const recorder = new MediaRecorder(processedStream, mimeType ? { mimeType } : undefined);
      recordingChunksRef.current = [];
      recordingStreamRef.current = stream;
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordingChunksRef.current.push(event.data);
        }
      };
      recorder.onstop = () => {
        const chunks = recordingChunksRef.current;
        const type = recorder.mimeType || 'audio/webm';
        stream.getTracks().forEach((track) => track.stop());
        processedStream.getTracks().forEach((track) => track.stop());
        recordingStreamRef.current = null;
        recordingProcessedStreamRef.current = null;
        mediaRecorderRef.current = null;
        stopRecordingMeter();
        setIsRecording(false);
        setMonitoringEnabled(false);
        setIsMonitoringPreview(false);

        if (chunks.length === 0) {
          setRecordingStatus(null);
          setRecordingTrackType(null);
          setRecordingTrackWaveform(Array.from({ length: 220 }, () => 0));
          setRecordingLevel(0);
          setPlaybackError('录音没有捕获到音频，请检查麦克风权限后重试。');
          return;
        }

        const blob = new Blob(chunks, { type });
        void addCustomStemFromBlob(blob, `现场录音 ${customStems.length + 1}`, targetType);
      };

      recorder.start();
      setIsRecording(true);
      setAddTrackMode('record');
      setIsAddTrackPanelOpen(true);
      setRecordingStatus('正在录音...');
      setPlaybackError(null);
    } catch {
      stopRecordingMeter();
      setIsRecording(false);
      setMonitoringEnabled(false);
      setIsMonitoringPreview(false);
      setRecordingStatus(null);
      setRecordingTrackType(null);
      setRecordingTrackWaveform(Array.from({ length: 220 }, () => 0));
      setRecordingLevel(0);
      setPlaybackError('无法打开麦克风，请检查浏览器录音权限。');
    }
  }, [addCustomStemFromBlob, customStems.length, monitoringEnabled, recordingInputChannel, refreshAudioInputDevices, resolveAudioInputTargetType, selectedAudioInputDeviceId, startRecordingMeter, stopMonitoringPreview, stopRecordingMeter]);

  const stopRecordingTrack = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      setRecordingStatus('正在生成录音轨道...');
      recorder.stop();
      return;
    }

    recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
    recordingStreamRef.current = null;
    recordingProcessedStreamRef.current?.getTracks().forEach((track) => track.stop());
    recordingProcessedStreamRef.current = null;
    stopRecordingMeter();
    setIsRecording(false);
    setMonitoringEnabled(false);
    setIsMonitoringPreview(false);
    setRecordingTrackType(null);
  }, [stopRecordingMeter]);

  const performDeleteTrack = useCallback((trackToDelete: EditableStem) => {
    const label = getStemDisplayName(trackToDelete).zh;
    rememberEditorHistory();
    pauseAll();

    const deletedType = trackToDelete.type;
    const nextStems = stems.filter((stem) => stem.type !== deletedType);
    const deletedIndex = stems.findIndex((stem) => stem.type === deletedType);
    const nextSelectedTrack = nextStems[Math.min(Math.max(deletedIndex, 0), Math.max(nextStems.length - 1, 0))] || null;

    setCustomStems((current) => current.filter((stem) => stem.type !== deletedType));
    setDeletedTrackTypes((current) => addDeletedStemType(current, deletedType, initialStems));
    setTrackOrder((current) => current.filter((type) => type !== deletedType));
    setTrackLabels((current) => {
      const next = { ...current };
      delete next[deletedType];
      return next;
    });
    setTrackColors((current) => {
      const next = { ...current };
      delete next[deletedType];
      return next;
    });
    setTracks((current) => {
      const next = { ...current };
      delete next[deletedType];
      return next;
    });
    setLoadingStemTypes((current) => {
      const next = new Set(current);
      next.delete(deletedType);
      return next;
    });
    setFailedStemTypes((current) => {
      const next = new Set(current);
      next.delete(deletedType);
      return next;
    });
    if (stemHasKnownEmptyWaveform(trackToDelete)) {
      setSkippedEmptyCount((count) => Math.max(0, count - 1));
    }
    setSelectedTrackType(nextSelectedTrack?.type ?? null);
    setSelectedClipSelection(null);
    setRecordingStatus(null);
    setSaveStatus(`已删除“${label}”，可用上一步恢复。`);
  }, [initialStems, pauseAll, rememberEditorHistory, stems]);

  const deleteSelectedTrack = useCallback((targetType?: string) => {
    const trackToDelete = targetType
      ? stems.find((stem) => stem.type === targetType) || null
      : selectedTrack;
    if (!trackToDelete) {
      setPlaybackError('请先选中一条轨道，再执行删除。');
      return;
    }
    if (isRecording) {
      setPlaybackError('请先停止当前录音，再删除轨道。');
      return;
    }

    performDeleteTrack(trackToDelete);
  }, [isRecording, performDeleteTrack, selectedTrack, stems]);

  const handleSeek = useCallback((nextTime: number) => {
    const safeTime = Math.max(0, Math.min(duration || nextTime, nextTime));
    clearLoopPreviewTimer();
    playbackStopAtRef.current = null;
    previewStemTypeRef.current = null;
    playbackOffsetRef.current = safeTime;
    setCurrentTime(safeTime);
    if (isPlaying) {
      playbackStartedAtRef.current = 0;
      stopSources();
      void playAll();
    }
  }, [clearLoopPreviewTimer, duration, isPlaying, playAll, stopSources]);

  const setTrackTrim = useCallback((type: string, edge: 'start' | 'end', value: number, shouldSnap = snapToGrid, historyMode: StemHistoryMode = 'immediate') => {
    commitTrackChange((current) => {
      const state = current[type] || defaultTrackState();
      const currentEnd = state.trimEnd ?? duration;
      const nextTrim = clampTrimEdge(edge, snapStemEditorTime(value, duration, shouldSnap, snapStepSeconds), state.trimStart, currentEnd, duration);
      const nextClipDuration = Math.max(0, Math.min(duration, nextTrim.trimEnd) - nextTrim.trimStart);
      const clipState = normalizeStemClipState({
        clips: null,
        duration,
        trimStart: nextTrim.trimStart,
        trimEnd: nextTrim.trimEnd,
      });

      return {
        ...current,
        [type]: {
          ...state,
          trimStart: clipState.trimStart,
          trimEnd: Math.min(duration, clipState.trimEnd ?? nextTrim.trimEnd),
          fadeIn: Math.min(state.fadeIn, nextClipDuration),
          fadeOut: Math.min(state.fadeOut, nextClipDuration),
          clips: clipState.clips,
        },
      };
    }, historyMode);
  }, [commitTrackChange, duration, snapStepSeconds, snapToGrid]);

  const setTrackClipTrim = useCallback((
    type: string,
    clipId: string,
    edge: 'start' | 'end',
    value: number,
    shouldSnap = snapToGrid,
    historyMode: StemHistoryMode = 'immediate',
  ) => {
    commitTrackChange((current) => {
      const state = current[type] || defaultTrackState();
      const currentClipState = resolveTrackClipState(state, duration);
      if (!currentClipState.clips.some((clip) => clip.id === clipId)) return current;

      const nextClips = resizeStemClipEdge(
        currentClipState.clips,
        clipId,
        edge,
        snapStemClipEdgeToNeighborEdges(
          currentClipState.clips,
          clipId,
          edge,
          snapStemEditorTime(value, duration, shouldSnap, snapStepSeconds),
          duration,
          magnetSnap,
          snapStepSeconds,
        ),
        duration,
      );
      const nextClipState = normalizeStemClipState({
        clips: nextClips,
        duration,
        trimStart: state.trimStart,
        trimEnd: state.trimEnd,
      });
      const nextClipDuration = Math.max(0, (nextClipState.trimEnd ?? 0) - nextClipState.trimStart);

      return {
        ...current,
        [type]: {
          ...state,
          trimStart: nextClipState.trimStart,
          trimEnd: nextClipState.trimEnd,
          fadeIn: Math.min(state.fadeIn, nextClipDuration),
          fadeOut: Math.min(state.fadeOut, nextClipDuration),
          clips: nextClipState.clips,
        },
      };
    }, historyMode);
  }, [commitTrackChange, duration, magnetSnap, snapStepSeconds, snapToGrid]);

  const setTrackTrimRange = useCallback((type: string, nextStart: number, shouldSnap = snapToGrid, historyMode: StemHistoryMode = 'immediate') => {
    commitTrackChange((current) => {
      const state = current[type] || defaultTrackState();
      const currentEnd = state.trimEnd ?? duration;
      const snappedStart = snapStemEditorTime(nextStart, duration, shouldSnap, snapStepSeconds);
      const nextTrim = shiftStemTrimRange({
        duration,
        trimStart: state.trimStart,
        trimEnd: currentEnd,
        nextStart: snappedStart,
      });
      const nextClipDuration = Math.max(0, nextTrim.trimEnd - nextTrim.trimStart);
      const clipState = normalizeStemClipState({
        clips: null,
        duration,
        trimStart: nextTrim.trimStart,
        trimEnd: nextTrim.trimEnd,
      });

      return {
        ...current,
        [type]: {
          ...state,
          trimStart: clipState.trimStart,
          trimEnd: clipState.trimEnd ?? nextTrim.trimEnd,
          fadeIn: Math.min(state.fadeIn, nextClipDuration),
          fadeOut: Math.min(state.fadeOut, nextClipDuration),
          clips: clipState.clips,
        },
      };
    }, historyMode);
  }, [commitTrackChange, duration, snapStepSeconds, snapToGrid]);

  const setTrackClips = useCallback((type: string, clips: StemClip[]) => {
    commitTrackChange((current) => {
      const state = current[type] || defaultTrackState();
      if (clips.length === 0) {
        return {
          ...current,
          [type]: {
            ...state,
            trimStart: 0,
            trimEnd: 0,
            fadeIn: 0,
            fadeOut: 0,
            clips: [],
          },
        };
      }

      const clipState = normalizeStemClipState({
        clips,
        duration,
        trimStart: state.trimStart,
        trimEnd: state.trimEnd,
      });
      const clipDuration = Math.max(0, (clipState.trimEnd ?? 0) - clipState.trimStart);

      return {
        ...current,
        [type]: {
          ...state,
          trimStart: clipState.trimStart,
          trimEnd: clipState.trimEnd,
          fadeIn: Math.min(state.fadeIn, clipDuration),
          fadeOut: Math.min(state.fadeOut, clipDuration),
          clips: clipState.clips,
        },
      };
    });
  }, [commitTrackChange, duration]);

  const splitSelectedTrackClipAtPlayhead = useCallback(() => {
    if (!selectedTrack || !selectedTrackState || duration <= 0) return;

    const clipState = resolveTrackClipState(selectedTrackState, duration);
    const nextClips = splitStemClipAtTime(clipState.clips, currentTime, duration);
    if (nextClips.length === clipState.clips.length) {
      setPlaybackError('播放头没有落在可切分的片段内部。');
      return;
    }

    setTrackClips(selectedTrack.type, nextClips);
    setPlaybackError(null);
    setSaveStatus(`已在 ${formatStemTimecode(currentTime)} 切分“${getStemDisplayName(selectedTrack).zh}”。`);
  }, [currentTime, duration, selectedTrack, selectedTrackState, setTrackClips]);

  const deleteTrackClipById = useCallback((trackType: string, clipId: string) => {
    const stem = stems.find((candidate) => candidate.type === trackType) || null;
    const state = tracks[trackType] || defaultTrackState();
    const clipState = resolveTrackClipState(state, duration);
    const targetClip = clipState.clips.find((clip) => clip.id === clipId);
    if (!targetClip) {
      setPlaybackError('当前片段已经不存在。');
      setSelectedClipSelection(null);
      return false;
    }

    const nextClips = clipState.clips.filter((clip) => clip.id !== clipId);
    setTrackClips(trackType, nextClips);
    setSelectedTrackType(trackType);
    setSelectedClipSelection(null);
    setPlaybackError(null);
    setSaveStatus(`已删除“${stem ? getStemDisplayName(stem).zh : '轨道'}”片段，可用上一步恢复。`);
    return true;
  }, [duration, setTrackClips, stems, tracks]);

  const deleteSelectedClipOrActiveTrackClip = useCallback(() => {
    if (!selectedTrack || duration <= 0) return;

    const state = tracks[selectedTrack.type] || selectedTrackState || defaultTrackState();
    const clipState = resolveTrackClipState(state, duration);
    const targetClip = selectedClipSelection?.trackType === selectedTrack.type
      ? clipState.clips.find((clip) => clip.id === selectedClipSelection.clipId) || null
      : selectedClip
        || (clipState.clips.length === 1 ? clipState.clips[0] : null)
        || findStemClipAtTime(clipState.clips, currentTime);

    if (!targetClip) {
      setPlaybackError('请先选中要删除的片段。');
      return;
    }

    deleteTrackClipById(selectedTrack.type, targetClip.id);
  }, [currentTime, deleteTrackClipById, duration, selectedClip, selectedClipSelection, selectedTrack, selectedTrackState, tracks]);

  const resolveTrackDropTarget = useCallback((clientX?: number, clientY?: number) => {
    if (typeof document === 'undefined' || !Number.isFinite(clientX) || !Number.isFinite(clientY)) return null;
    const target = document.elementFromPoint(clientX as number, clientY as number);
    const row = target instanceof HTMLElement
      ? target.closest<HTMLElement>('[data-stem-track-type]')
      : null;
    return row?.dataset.stemTrackType || null;
  }, []);

  const previewTrackClipMove = useCallback((
    type: string,
    clipId: string,
    nextStart: number,
    shouldSnap = snapToGrid,
    clientX?: number,
    clientY?: number,
  ) => {
    const state = tracks[type] || defaultTrackState();
    const clipState = resolveTrackClipState(state, duration);
    const movingClip = clipState.clips.find((clip) => clip.id === clipId);
    if (!movingClip) {
      setClipDragPreview(null);
      return;
    }

    const dropTargetType = resolveTrackDropTarget(clientX, clientY);
    const targetType = dropTargetType && stems.some((stem) => stem.type === dropTargetType)
      ? dropTargetType
      : type;
    const targetState = tracks[targetType] || defaultTrackState();
    const targetClipState = targetType === type
      ? clipState
      : resolveTrackClipState(targetState, duration);
    const snappedStart = snapStemClipStartToNeighborEdges(
      targetClipState.clips,
      clipId,
      snapStemEditorTime(nextStart, duration, shouldSnap, snapStepSeconds),
      nextStart,
      movingClip.start,
      getStemClipDuration(movingClip),
      duration,
      magnetSnap,
      snapStepSeconds,
    );
    const previewClipId = `${clipId}-drag-preview`;
    setClipDragPreview({
      sourceTrackType: type,
      targetTrackType: targetType,
      clipId,
      previewClipId,
      clip: {
        ...movingClip,
        id: previewClipId,
        start: snappedStart,
        sourceTrackType: movingClip.sourceTrackType || type,
      },
    });
    setSelectedTrackType(targetType);
  }, [duration, magnetSnap, resolveTrackDropTarget, snapStepSeconds, snapToGrid, stems, tracks]);

  const moveTrackClip = useCallback((
    type: string,
    clipId: string,
    nextStart: number,
    shouldSnap = snapToGrid,
    historyMode: StemHistoryMode = 'immediate',
    dropClientX?: number,
    dropClientY?: number,
  ) => {
    setClipDragPreview(null);
    const stateBeforeMove = tracks[type] || defaultTrackState();
    const clipStateBeforeMove = resolveTrackClipState(stateBeforeMove, duration);
    const movingClip = clipStateBeforeMove.clips.find((clip) => clip.id === clipId);
    const dropTargetType = resolveTrackDropTarget(dropClientX, dropClientY);
    const targetType = dropTargetType && stems.some((stem) => stem.type === dropTargetType)
      ? dropTargetType
      : type;
    const targetStateBeforeMove = tracks[targetType] || defaultTrackState();
    const targetClipStateBeforeMove = targetType === type
      ? clipStateBeforeMove
      : resolveTrackClipState(targetStateBeforeMove, duration);
    const snappedStart = movingClip
      ? snapStemClipStartToNeighborEdges(
        targetClipStateBeforeMove.clips,
        clipId,
        snapStemEditorTime(nextStart, duration, shouldSnap, snapStepSeconds),
        nextStart,
        movingClip.start,
        getStemClipDuration(movingClip),
        duration,
        magnetSnap,
        snapStepSeconds,
      )
      : snapStemEditorTime(nextStart, duration, shouldSnap, snapStepSeconds);
    const nextDuration = movingClip
      ? Math.max(duration, snappedStart + getStemClipDuration(movingClip))
      : duration;
    if (nextDuration > duration) {
      setDuration(Number(nextDuration.toFixed(3)));
    }

    if (targetType !== type && movingClip) {
      const movedClipId = `${clipId}-moved-${targetType}-${Date.now().toString(36)}`;
      const movedClip: StemClip = {
        ...movingClip,
        id: movedClipId,
        start: snappedStart,
        sourceTrackType: movingClip.sourceTrackType || type,
      };

      commitTrackChange((current) => {
        const sourceState = current[type] || defaultTrackState();
        const targetState = current[targetType] || defaultTrackState();
        const sourceClipState = resolveTrackClipState(sourceState, nextDuration);
        const targetClipState = resolveTrackClipState(targetState, nextDuration);
        const nextSourceClips = sourceClipState.clips.filter((clip) => clip.id !== clipId);
        const nextTargetClips = [
          ...targetClipState.clips.filter((clip) => clip.id !== movedClipId),
          movedClip,
        ];
        const normalizedTargetClipState = normalizeStemClipState({
          clips: nextTargetClips,
          duration: nextDuration,
          trimStart: targetState.trimStart,
          trimEnd: targetState.trimEnd,
        });
        const targetClipDuration = Math.max(0, (normalizedTargetClipState.trimEnd ?? 0) - normalizedTargetClipState.trimStart);
        const nextSourceState = nextSourceClips.length > 0
          ? (() => {
            const normalizedSourceClipState = normalizeStemClipState({
              clips: nextSourceClips,
              duration: nextDuration,
              trimStart: sourceState.trimStart,
              trimEnd: sourceState.trimEnd,
            });
            const sourceClipDuration = Math.max(0, (normalizedSourceClipState.trimEnd ?? 0) - normalizedSourceClipState.trimStart);
            return {
              ...sourceState,
              trimStart: normalizedSourceClipState.trimStart,
              trimEnd: normalizedSourceClipState.trimEnd,
              fadeIn: Math.min(sourceState.fadeIn, sourceClipDuration),
              fadeOut: Math.min(sourceState.fadeOut, sourceClipDuration),
              clips: normalizedSourceClipState.clips,
            };
          })()
          : {
            ...sourceState,
            trimStart: 0,
            trimEnd: 0,
            fadeIn: 0,
            fadeOut: 0,
            clips: [],
          };

        return {
          ...current,
          [type]: nextSourceState,
          [targetType]: {
            ...targetState,
            trimStart: normalizedTargetClipState.trimStart,
            trimEnd: normalizedTargetClipState.trimEnd,
            fadeIn: Math.min(targetState.fadeIn, targetClipDuration),
            fadeOut: Math.min(targetState.fadeOut, targetClipDuration),
            clips: normalizedTargetClipState.clips,
          },
        };
      }, historyMode);
      setSelectedTrackType(targetType);
      setSelectedClipSelection({ trackType: targetType, clipId: movedClipId });
      const sourceStem = stems.find((stem) => stem.type === type);
      const targetStem = stems.find((stem) => stem.type === targetType);
      setSaveStatus(`已把“${sourceStem ? getStemDisplayName(sourceStem).zh : '片段'}”片段移动到“${targetStem ? getStemDisplayName(targetStem).zh : '目标轨道'}”。`);
      return;
    }

    commitTrackChange((current) => {
      const state = current[type] || defaultTrackState();
      const clipState = resolveTrackClipState(state, nextDuration);
      const movedClips = moveStemClip(
        clipState.clips,
        clipId,
        snappedStart,
        nextDuration,
      );
      const nextClipState = normalizeStemClipState({
        clips: movedClips,
        duration: nextDuration,
        trimStart: state.trimStart,
        trimEnd: state.trimEnd,
      });
      const clipDuration = Math.max(0, (nextClipState.trimEnd ?? 0) - nextClipState.trimStart);

      return {
        ...current,
        [type]: {
          ...state,
          trimStart: nextClipState.trimStart,
          trimEnd: nextClipState.trimEnd,
          fadeIn: Math.min(state.fadeIn, clipDuration),
          fadeOut: Math.min(state.fadeOut, clipDuration),
          clips: nextClipState.clips,
        },
      };
    }, historyMode);
  }, [commitTrackChange, duration, magnetSnap, resolveTrackDropTarget, snapStepSeconds, snapToGrid, stems, tracks]);

  const resolveTimelineRulerPointer = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = rect.width > 0 ? Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)) : 0;
    const shouldSnap = snapToGrid && !event.altKey;
    return {
      ratio,
      shouldSnap,
      time: snapStemEditorTime(duration * ratio, duration, shouldSnap, snapStepSeconds),
    };
  }, [duration, snapStepSeconds, snapToGrid]);

  const updateTimelineRulerGuide = useCallback((event: PointerEvent<HTMLDivElement>, active: boolean) => {
    if (duration <= 0) return;
    const guide = resolveTimelineRulerPointer(event);
    setTimelineRulerGuide({
      ratio: guide.ratio,
      time: guide.time,
      active,
      snapBypassed: snapToGrid && !guide.shouldSnap,
    });
  }, [duration, resolveTimelineRulerPointer, snapToGrid]);

  const handleTimelineRulerPointerDown = useCallback((event: PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const guide = resolveTimelineRulerPointer(event);
    timelineRulerTrimDragRef.current = null;
    handleSeek(guide.time);
    updateTimelineRulerGuide(event, true);
    safelySetPointerCapture(event.currentTarget, event.pointerId);
  }, [handleSeek, resolveTimelineRulerPointer, updateTimelineRulerGuide]);

  const handleTimelineRulerPointerMove = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (event.buttons === 1) {
      const guide = resolveTimelineRulerPointer(event);
      handleSeek(guide.time);
      updateTimelineRulerGuide(event, true);
      event.preventDefault();
      return;
    }

    updateTimelineRulerGuide(event, false);
  }, [handleSeek, resolveTimelineRulerPointer, updateTimelineRulerGuide]);

  const handleTimelineRulerPointerUp = useCallback((event: PointerEvent<HTMLDivElement>) => {
    timelineRulerTrimDragRef.current = null;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // Pointer capture may already be released by the browser.
    }
    updateTimelineRulerGuide(event, false);
  }, [updateTimelineRulerGuide]);

  const commitCurrentTimeInput = useCallback((value: string) => {
    const parsedTime = parseStemTimecode(value);
    if (parsedTime === null) {
      setPlaybackError('播放头时间格式不正确，可以输入秒数或 1:23.45。');
      setCurrentTimeInputDraft(formatStemTimecode(currentTime));
      return;
    }

    handleSeek(parsedTime);
    setPlaybackError(null);
    setCurrentTimeInputDraft(null);
  }, [currentTime, handleSeek]);

  const toggleTrackFlag = useCallback((type: string, flag: 'muted' | 'solo') => {
    commitTrackChange((current) => ({
      ...current,
      [type]: {
        ...(current[type] || defaultTrackState()),
        [flag]: !current[type]?.[flag],
      },
    }));
  }, [commitTrackChange]);

  const toggleTrackCollapsed = useCallback((type: string) => {
    commitTrackChange((current) => {
      const state = current[type] || defaultTrackState();
      return {
        ...current,
        [type]: {
          ...state,
          collapsed: !state.collapsed,
        },
      };
    });
  }, [commitTrackChange]);

  const soloOnlyTrack = useCallback((type: string) => {
    commitTrackChange((current) => Object.fromEntries(stems.map((stem) => {
      const existing = current[stem.type] || defaultTrackState();
      const isTarget = stem.type === type;
      return [
        stem.type,
        {
          ...existing,
          muted: false,
          solo: isTarget,
          volume: isTarget ? Math.max(existing.volume, 0.75) : existing.volume,
        },
      ];
    })) as Record<string, StemTrackState>);

    const stem = stems.find((candidate) => candidate.type === type);
    setSaveStatus(stem
      ? `已切换为只听“${getStemDisplayName(stem).zh}”。`
      : '已切换为只听当前轨道。');
  }, [commitTrackChange, stems]);

  const setTrackVolume = useCallback((type: string, volume: number, historyMode: StemHistoryMode = 'immediate') => {
    commitTrackChange((current) => ({
      ...current,
      [type]: {
        ...(current[type] || defaultTrackState()),
        volume,
      },
    }), historyMode);
  }, [commitTrackChange]);

  const setTrackPan = useCallback((type: string, pan: number, historyMode: StemHistoryMode = 'immediate') => {
    commitTrackChange((current) => ({
      ...current,
      [type]: {
        ...(current[type] || defaultTrackState()),
        pan: Math.max(-1, Math.min(1, pan)),
      },
    }), historyMode);
  }, [commitTrackChange]);

  const setTrackFade = useCallback((type: string, edge: 'in' | 'out', value: number, historyMode: StemHistoryMode = 'immediate') => {
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
    }, historyMode);
  }, [commitTrackChange, duration]);

  const copyTrackClipAtTime = useCallback((type: string, time: number) => {
    const state = tracks[type] || defaultTrackState();
    const clipState = resolveTrackClipState(state, duration);
    const clip = findStemClipAtTime(clipState.clips, time);
    if (!clip) {
      setPlaybackError('当前位置没有可复制的片段。');
      return false;
    }

    const sourceTrackType = clip.sourceTrackType || type;
    setClipClipboard({ clip: { ...clip, sourceTrackType }, sourceTrackType });
    setPlaybackError(null);
    setSaveStatus('片段已复制，可在目标时间点粘贴。');
    return true;
  }, [duration, tracks]);

  const cutTrackClipAtTime = useCallback((type: string, time: number) => {
    if (!copyTrackClipAtTime(type, time)) return;
    const state = tracks[type] || defaultTrackState();
    const clipState = resolveTrackClipState(state, duration);
    setTrackClips(type, removeStemClipAtTime(clipState.clips, time));
    setSaveStatus('片段已剪切，可在目标时间点粘贴。');
  }, [copyTrackClipAtTime, duration, setTrackClips, tracks]);

  const pasteClipToTrack = useCallback((type: string, time: number) => {
    if (!clipClipboard) {
      setPlaybackError('剪贴板里还没有片段。');
      return;
    }

    const pasteStart = snapStemEditorTime(time, Math.max(duration, time), snapToGrid, snapStepSeconds);
    const clonedClip = cloneStemClipForPaste(clipClipboard.clip, pasteStart);
    const nextDuration = Math.max(duration, clonedClip.start + getStemClipDuration(clonedClip));
    if (nextDuration > duration) {
      setDuration(Number(nextDuration.toFixed(3)));
    }

    commitTrackChange((current) => {
      const state = current[type] || defaultTrackState();
      const clipState = resolveTrackClipState(state, nextDuration);
      const nextClipState = normalizeStemClipState({
        clips: [...clipState.clips, clonedClip],
        duration: nextDuration,
        trimStart: state.trimStart,
        trimEnd: state.trimEnd,
      });
      const clipDuration = Math.max(0, (nextClipState.trimEnd ?? 0) - nextClipState.trimStart);

      return {
        ...current,
        [type]: {
          ...state,
          trimStart: nextClipState.trimStart,
          trimEnd: nextClipState.trimEnd,
          fadeIn: Math.min(state.fadeIn, clipDuration),
          fadeOut: Math.min(state.fadeOut, clipDuration),
          clips: nextClipState.clips,
        },
      };
    });
    setPlaybackError(null);
    setSaveStatus('片段已粘贴到当前轨道。');
  }, [clipClipboard, commitTrackChange, duration, snapStepSeconds, snapToGrid]);

  const openTrackContextMenu = useCallback((event: MouseEvent<Element>, type: string, time: number) => {
    event.preventDefault();
    event.stopPropagation();
    const state = tracks[type] || defaultTrackState();
    const clipState = resolveTrackClipState(state, duration);
    const safeTime = Math.max(0, Math.min(Math.max(duration, time), Number.isFinite(time) ? time : currentTime));
    const targetClip = findStemClipAtTime(clipState.clips, safeTime);
    const menuWidth = 256;
    const menuHeight = 420;
    const x = typeof window === 'undefined'
      ? event.clientX
      : Math.min(event.clientX, Math.max(12, window.innerWidth - menuWidth - 12));
    const y = typeof window === 'undefined'
      ? event.clientY
      : Math.min(event.clientY, Math.max(12, window.innerHeight - menuHeight - 12));

    setSelectedTrackType(type);
    setSelectedClipSelection(targetClip ? { trackType: type, clipId: targetClip.id } : null);
    handleSeek(safeTime);
    setTrackContextMenu({
      x,
      y,
      trackType: type,
      time: safeTime,
      clipId: targetClip?.id ?? null,
      colorOpen: false,
      colorDraft: getTrackColor(type),
    });
  }, [currentTime, duration, getTrackColor, handleSeek, tracks]);

  const closeTrackContextMenu = useCallback(() => {
    setTrackContextMenu(null);
  }, []);

  const renameTrackFromMenu = useCallback((type: string) => {
    const stem = stems.find((candidate) => candidate.type === type);
    const currentLabel = stem ? getStemDisplayName(stem).zh : type;
    setEditorDialog({
      kind: 'rename-track',
      trackType: type,
      label: currentLabel,
      value: currentLabel,
    });
  }, [stems]);

  const performTrackContextMenuAction = useCallback((action: 'copy' | 'cut' | 'paste' | 'rename' | 'delete' | 'color') => {
    if (!trackContextMenu) return;
    const { trackType, time } = trackContextMenu;

    if (action === 'copy') {
      copyTrackClipAtTime(trackType, time);
      closeTrackContextMenu();
      return;
    }
    if (action === 'cut') {
      cutTrackClipAtTime(trackType, time);
      closeTrackContextMenu();
      return;
    }
    if (action === 'paste') {
      pasteClipToTrack(trackType, time);
      closeTrackContextMenu();
      return;
    }
    if (action === 'rename') {
      renameTrackFromMenu(trackType);
      closeTrackContextMenu();
      return;
    }
    if (action === 'delete') {
      if (trackContextMenu.clipId) {
        deleteTrackClipById(trackType, trackContextMenu.clipId);
      } else {
        deleteSelectedTrack(trackType);
      }
      closeTrackContextMenu();
      return;
    }
    setTrackContextMenu((current) => current ? { ...current, colorOpen: !current.colorOpen } : current);
  }, [closeTrackContextMenu, copyTrackClipAtTime, cutTrackClipAtTime, deleteSelectedTrack, deleteTrackClipById, pasteClipToTrack, renameTrackFromMenu, trackContextMenu]);

  useEffect(() => {
    if (!trackContextMenu) return;
    const close = () => closeTrackContextMenu();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeTrackContextMenu();
    };
    window.addEventListener('pointerdown', close);
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [closeTrackContextMenu, trackContextMenu]);

  const closeEditorDialog = useCallback(() => {
    setEditorDialog(null);
  }, []);

  const confirmEditorDialog = useCallback(() => {
    if (!editorDialog) return;

    if (editorDialog.kind === 'rename-track') {
      renameTrack(editorDialog.trackType, editorDialog.value);
      setEditorDialog(null);
      return;
    }

    if (editorDialog.kind === 'delete-track') {
      const trackToDelete = stems.find((stem) => stem.type === editorDialog.trackType);
      if (trackToDelete) {
        performDeleteTrack(trackToDelete);
      }
      setEditorDialog(null);
      return;
    }

    const state = tracks[editorDialog.trackType] || defaultTrackState();
    const clipState = resolveTrackClipState(state, duration);
    setTrackClips(editorDialog.trackType, removeStemClipAtTime(clipState.clips, editorDialog.time));
    setPlaybackError(null);
    setSaveStatus(`已删除“${editorDialog.label}”在 ${formatStemTimecode(editorDialog.time)} 的片段。`);
    setEditorDialog(null);
  }, [duration, editorDialog, performDeleteTrack, renameTrack, setTrackClips, stems, tracks]);

  const commitSelectedTrimInput = useCallback((edge: 'start' | 'end', value: string) => {
    if (!selectedTrack) return;

    const parsed = clampStemTimecodeInput(value, duration);
    if (!parsed.ok) {
      setPlaybackError('裁剪时间格式不正确，可以输入秒数或 1:23.45。');
      setSelectedTrimInputDraft(null);
      return;
    }

    setTrackTrim(selectedTrack.type, edge, parsed.time, false);
    setPlaybackError(null);
    setSelectedTrimInputDraft(null);
  }, [duration, selectedTrack, setTrackTrim]);

  const nudgeSelectedTrackTrim = useCallback((edge: 'start' | 'end', delta: number) => {
    if (!selectedTrack || !selectedTrackState) return;

    const trimControls = resolveStemTrimControlValues({
      duration,
      trimStart: selectedTrackState.trimStart,
      trimEnd: selectedTrackState.trimEnd,
      fadeIn: selectedTrackState.fadeIn,
      fadeOut: selectedTrackState.fadeOut,
    });
    const nextValue = nudgeStemTrimEdge({
      edge,
      delta,
      duration,
      trimStart: trimControls.trimStart,
      trimEnd: trimControls.trimEnd,
    });

    setTrackTrim(selectedTrack.type, edge, nextValue);
    setSaveStatus(`已微调“${getStemDisplayName(selectedTrack).zh}”${edge === 'start' ? '入点' : '出点'}到 ${formatTime(nextValue)}。`);
  }, [duration, selectedTrack, selectedTrackState, setTrackTrim]);

  const muteSelectedTrackRange = useCallback(() => {
    if (!selectedTrack || !selectedTrackState) return;
    const trimStart = selectedTrackTrimControls?.trimStart ?? selectedTrackState.trimStart;
    const trimEnd = selectedTrackTrimControls?.trimEnd ?? duration;
    if (trimEnd - trimStart <= 0.001) {
      setPlaybackError('当前选区为空，先调整入点和出点再静音。');
      return;
    }

    commitTrackChange((current) => {
      const state = current[selectedTrack.type] || defaultTrackState();
      return {
        ...current,
        [selectedTrack.type]: {
          ...state,
          mutedRanges: addStemMutedRange(state.mutedRanges, { start: trimStart, end: trimEnd }, duration),
        },
      };
    });
    setPlaybackError(null);
    setSaveStatus(`已把“${getStemDisplayName(selectedTrack).zh}”当前选区设为静音。`);
  }, [commitTrackChange, duration, selectedTrack, selectedTrackState, selectedTrackTrimControls]);

  const restoreSelectedTrackRange = useCallback(() => {
    if (!selectedTrack || !selectedTrackState) return;
    const trimStart = selectedTrackTrimControls?.trimStart ?? selectedTrackState.trimStart;
    const trimEnd = selectedTrackTrimControls?.trimEnd ?? duration;

    commitTrackChange((current) => {
      const state = current[selectedTrack.type] || defaultTrackState();
      return {
        ...current,
        [selectedTrack.type]: {
          ...state,
          mutedRanges: clearStemMutedRangesInRange(state.mutedRanges, { start: trimStart, end: trimEnd }, duration),
        },
      };
    });
    setPlaybackError(null);
    setSaveStatus(`已恢复“${getStemDisplayName(selectedTrack).zh}”当前选区声音。`);
  }, [commitTrackChange, duration, selectedTrack, selectedTrackState, selectedTrackTrimControls]);

  const restoreSelectedTrackMutedRange = useCallback((index: number) => {
    if (!selectedTrack) return;

    commitTrackChange((current) => {
      const state = current[selectedTrack.type] || defaultTrackState();
      return {
        ...current,
        [selectedTrack.type]: {
          ...state,
          mutedRanges: removeStemMutedRangeAtIndex(state.mutedRanges, index, duration),
        },
      };
    });
    setPlaybackError(null);
    setSaveStatus(`已恢复“${getStemDisplayName(selectedTrack).zh}”第 ${index + 1} 个静音片段。`);
  }, [commitTrackChange, duration, selectedTrack]);

  const resetTrackEdit = useCallback((type: string) => {
    commitTrackChange((current) => {
      const clipState = normalizeStemClipState({
        clips: null,
        duration,
        trimStart: 0,
        trimEnd: duration,
      });

      return {
        ...current,
        [type]: {
          ...(current[type] || defaultTrackState()),
          trimStart: clipState.trimStart,
          trimEnd: clipState.trimEnd ?? duration,
          fadeIn: 0,
          fadeOut: 0,
          mutedRanges: [],
          clips: clipState.clips,
        },
      };
    });
  }, [commitTrackChange, duration]);

  const resetSelectedTrackTrimRange = useCallback(() => {
    if (!selectedTrack) return;

    commitTrackChange((current) => {
      const state = current[selectedTrack.type] || defaultTrackState();
      const clipState = normalizeStemClipState({
        clips: null,
        duration,
        trimStart: 0,
        trimEnd: duration,
      });
      return {
        ...current,
        [selectedTrack.type]: {
          ...state,
          trimStart: clipState.trimStart,
          trimEnd: clipState.trimEnd ?? duration,
          fadeIn: Math.min(state.fadeIn, duration),
          fadeOut: Math.min(state.fadeOut, duration),
          clips: clipState.clips,
        },
      };
    });
    setPlaybackError(null);
    setSaveStatus(`已把“${getStemDisplayName(selectedTrack).zh}”选区恢复为全长。`);
  }, [commitTrackChange, duration, selectedTrack]);

  const previewSelectedTrackRange = useCallback(() => {
    if (!selectedTrack || !selectedTrackState || !selectedTrackBuffer) {
      setPlaybackError('当前轨道还没有音频，等缓存完成后再预听。');
      return;
    }

    const trimStart = Math.max(0, Math.min(selectedTrackBuffer.duration, selectedTrackState.trimStart));
    const trimEnd = Math.max(trimStart, Math.min(selectedTrackBuffer.duration, selectedTrackState.trimEnd ?? selectedTrackBuffer.duration));
    if (trimEnd - trimStart <= 0.05) {
      setPlaybackError('当前轨道的裁剪区间太短，请先调整入点和出点。');
      return;
    }

    pauseAll();
    playbackOffsetRef.current = trimStart;
    playbackStopAtRef.current = trimEnd;
    previewStemTypeRef.current = selectedTrack.type;
    setCurrentTime(trimStart);
    setSaveStatus(loopSelectionPreviewRef.current
      ? `正在循环预听“${getStemDisplayName(selectedTrack).zh}”选区。`
      : `正在预听“${getStemDisplayName(selectedTrack).zh}”选区。`);
    void playAll();

    if (loopSelectionPreviewRef.current) {
      const loopDelayMs = Math.max(160, (trimEnd - trimStart) * 1000 + 120);
      loopPreviewTimerRef.current = window.setInterval(() => {
        if (!loopSelectionPreviewRef.current) {
          clearLoopPreviewTimer();
          return;
        }
        playbackOffsetRef.current = trimStart;
        playbackStopAtRef.current = trimEnd;
        previewStemTypeRef.current = selectedTrack.type;
        setCurrentTime(trimStart);
        void playAll();
      }, loopDelayMs);
    }
  }, [clearLoopPreviewTimer, pauseAll, playAll, selectedTrack, selectedTrackBuffer, selectedTrackState]);

  const toggleLoopSelectionPreview = useCallback(() => {
    setLoopSelectionPreview((current) => {
      const next = !current;
      loopSelectionPreviewRef.current = next;
      if (!next) {
        clearLoopPreviewTimer();
      }
      return next;
    });
  }, [clearLoopPreviewTimer]);

  const beginContinuousControlEdit = useCallback(() => {
    beginDeferredHistory();
  }, [beginDeferredHistory]);

  const finishContinuousControlEdit = useCallback(() => {
    commitDeferredHistory();
  }, [commitDeferredHistory]);

  const setMasterVolume = useCallback((volume: number, historyMode: StemHistoryMode = 'immediate') => {
    if (historyMode === 'immediate') {
      rememberEditorHistory();
    } else if (historyMode === 'deferred') {
      beginDeferredHistory({ ...editorHistoryRef.current, master: masterState });
      deferredHistoryChangedRef.current = true;
    }
    setMasterState((current) => normalizeStemMasterState({
      ...current,
      volume,
    }));
  }, [beginDeferredHistory, masterState, rememberEditorHistory]);

  const toggleMasterLimiter = useCallback(() => {
    rememberEditorHistory();
    setMasterState((current) => normalizeStemMasterState({
      ...current,
      limiter: !current.limiter,
    }));
    setSaveStatus('母带防爆音设置已更新，自动保存后下次进入会恢复。');
  }, [rememberEditorHistory]);

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

  const persistEditState = useCallback(async (source: 'manual' | 'auto' | 'export') => {
    if (!jobId) {
      if (source === 'manual') {
        setSaveStatus('当前分轨任务还没有缓存 ID，暂时不能保存编辑状态。');
      }
      return false;
    }

    if (source === 'manual') {
      setIsSaving(true);
      setSaveStatus(null);
    } else if (source === 'export') {
      setAutoSaveStatus('导出前保存编辑中...');
    } else {
      setAutoSaveStatus('自动保存中...');
    }

    try {
      const response = await fetch('/api/stems/edit-state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId,
          editState: {
            tracks,
            master: masterState,
            trackLabels,
            trackColors,
            trackOrder: stems.map((stem) => stem.type),
            deletedTrackTypes,
            customStems,
            skippedEmptyCount,
          },
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = data.error || '保存编辑状态失败';
        if (isEditorAuthError(response.status, message)) {
          redirectToLoginFromStemEditor();
          throw new Error('登录已过期，正在跳转登录页。');
        }
        throw new Error(message);
      }
      if (source === 'manual') {
        setSaveStatus('编辑状态已保存，下次进入会自动恢复。');
      } else if (source === 'export') {
        setAutoSaveStatus(`导出前已保存 ${new Date().toLocaleTimeString('zh-CN', { hour12: false })}`);
      } else {
        setAutoSaveStatus(`已自动保存 ${new Date().toLocaleTimeString('zh-CN', { hour12: false })}`);
      }
      setHasPendingEditChanges(false);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : '保存编辑状态失败';
      setHasPendingEditChanges(true);
      if (source === 'manual') {
        setSaveStatus(message);
      } else if (source === 'export') {
        setAutoSaveStatus(`导出前保存失败：${message}，仍按当前页面状态导出。`);
      } else {
        setAutoSaveStatus(`自动保存失败：${message}`);
      }
      return false;
    } finally {
      if (source === 'manual') {
        setIsSaving(false);
      }
    }
  }, [customStems, deletedTrackTypes, jobId, masterState, skippedEmptyCount, stems, trackColors, trackLabels, tracks]);

  const saveEditState = useCallback(async () => {
    await persistEditState('manual');
  }, [persistEditState]);

  const returnToCreationsAfterSave = useCallback(async () => {
    setPlaybackError(null);
    setSaveStatus('正在自动保存当前项目，保存完成后返回我的作品...');
    const saved = await persistEditState('manual');
    if (!saved) return;

    setSaveStatus('当前项目已自动保存，正在返回我的作品。');
    window.setTimeout(() => {
      window.location.assign('/account/creations');
    }, 180);
  }, [persistEditState]);

  const savePendingEditsBeforeExport = useCallback(async () => {
    const intent = resolveStemExportSaveIntent({
      hasPendingChanges: hasPendingEditChanges,
      canPersist: Boolean(jobId),
    });

    if (intent.status === 'cannot-save') {
      setAutoSaveStatus('当前分轨任务还没有缓存 ID，本次导出只使用当前页面状态。');
      return false;
    }

    if (!intent.shouldSave) return true;

    if (autoSaveTimerRef.current !== null) {
      window.clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }

    return persistEditState('export');
  }, [hasPendingEditChanges, jobId, persistEditState]);

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

  const seekSelectedTrackTrimEdge = useCallback((edge: 'start' | 'end') => {
    if (!selectedTrack || !selectedTrackTrimControls) return;

    const time = edge === 'start'
      ? selectedTrackTrimControls.trimStart
      : selectedTrackTrimControls.trimEnd;
    handleSeek(time);
    centerTimelineOnPlaybackPosition(time);
    setSaveStatus(`已定位到“${getStemDisplayName(selectedTrack).zh}”${edge === 'start' ? '入点' : '出点'}。`);
  }, [centerTimelineOnPlaybackPosition, handleSeek, selectedTrack, selectedTrackTrimControls]);

  const nudgePlaybackHead = useCallback((direction: -1 | 1, largeStep = false) => {
    const step = largeStep ? 1 : playbackNudgeStepSeconds;
    const nextTime = Math.max(0, Math.min(duration || currentTime, currentTime + direction * step));
    handleSeek(nextTime);
    centerTimelineOnPlaybackPosition(nextTime);
    setPlaybackError(null);
    setSaveStatus(`播放头已${direction < 0 ? '后退' : '前进'} ${step}s 到 ${formatStemTimecode(nextTime)}。`);
  }, [centerTimelineOnPlaybackPosition, currentTime, duration, handleSeek, playbackNudgeStepSeconds]);

  const setSelectedTrackTrimToCurrentTime = useCallback((edge: 'start' | 'end') => {
    if (!selectedTrack || !selectedTrackState) return;

    const proposedTime = snapStemEditorTime(currentTime, duration, snapToGrid, snapStepSeconds);
    const currentEnd = selectedTrackState.trimEnd ?? duration;
    const nextTrim = clampTrimEdge(edge, proposedTime, selectedTrackState.trimStart, currentEnd, duration);
    const actualTime = edge === 'start' ? nextTrim.trimStart : nextTrim.trimEnd;
    const wasClamped = Math.abs(actualTime - proposedTime) > 0.001;

    setTrackTrim(selectedTrack.type, edge, actualTime, false);
    centerTimelineOnPlaybackPosition(actualTime);
    setPlaybackError(null);
    setSaveStatus(wasClamped
      ? `播放头离另一侧边界太近，已把“${getStemDisplayName(selectedTrack).zh}”${edge === 'start' ? '入点' : '出点'}安全设到 ${formatTime(actualTime)}。`
      : `已把“${getStemDisplayName(selectedTrack).zh}”${edge === 'start' ? '入点' : '出点'}设到 ${formatTime(actualTime)}。`);
  }, [centerTimelineOnPlaybackPosition, currentTime, duration, selectedTrack, selectedTrackState, setTrackTrim, snapStepSeconds, snapToGrid]);

  const focusSelectedTrackRange = useCallback(() => {
    if (!selectedTrack || !selectedTrackTrimControls || duration <= 0) return;

    const clipDuration = Math.max(0.1, selectedTrackTrimControls.trimEnd - selectedTrackTrimControls.trimStart);
    const midpoint = selectedTrackTrimControls.trimStart + clipDuration / 2;
    const nextZoom = clampTimelineZoom((duration / clipDuration) * 0.52);
    const nextLaneWidth = Math.round((showAdvancedControls ? 420 : 520) * nextZoom);
    setTimelineZoom(nextZoom);
    centerTimelineOnPlaybackPosition(midpoint, nextLaneWidth);
    setSaveStatus(`已聚焦“${getStemDisplayName(selectedTrack).zh}”选区 ${formatStemTimecode(clipDuration)}。`);
  }, [centerTimelineOnPlaybackPosition, duration, selectedTrack, selectedTrackTrimControls, showAdvancedControls]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (editorDialog) {
        if (event.key === 'Escape') {
          event.preventDefault();
          closeEditorDialog();
        }
        return;
      }

      const action = resolveStemEditorShortcut(event);
      if (!action) return;

      event.preventDefault();
      if (action === 'toggle-playback') {
        handleTogglePlayback();
        return;
      }
      if (action === 'stop-playback') {
        stopPlaybackPreview();
        return;
      }
      if (action === 'toggle-shortcut-help') {
        setShowShortcutHelp((value) => !value);
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
      if (action === 'seek-start') {
        handleSeek(0);
        return;
      }
      if (action === 'seek-end') {
        handleSeek(duration);
        return;
      }
      if (action === 'seek-backward') {
        nudgePlaybackHead(-1);
        return;
      }
      if (action === 'seek-forward') {
        nudgePlaybackHead(1);
        return;
      }
      if (action === 'seek-backward-large') {
        nudgePlaybackHead(-1, true);
        return;
      }
      if (action === 'seek-forward-large') {
        nudgePlaybackHead(1, true);
        return;
      }
      if (action === 'zoom-in') {
        applyTimelineZoom(timelineZoom + 0.25);
        return;
      }
      if (action === 'zoom-out') {
        applyTimelineZoom(timelineZoom - 0.25);
        return;
      }
      if (action === 'zoom-reset') {
        applyTimelineZoom(MIN_TIMELINE_ZOOM);
        return;
      }
      if (action === 'toggle-follow-playhead') {
        setFollowPlayhead((value) => !value);
        return;
      }
      if (action === 'toggle-snap-grid') {
        setSnapToGrid((value) => {
          const next = !value;
          setSaveStatus(next ? `已开启时间吸附，当前步长 ${snapStepSeconds}s。` : '已关闭时间吸附。');
          return next;
        });
        return;
      }
      if (action === 'toggle-track-density') {
        setTrackDensity((value) => {
          const next = value === 'compact' ? 'comfortable' : 'compact';
          setSaveStatus(next === 'compact' ? '轨道视图已切换为紧凑模式。' : '轨道视图已切换为舒展模式。');
          return next;
        });
        return;
      }
      if (action === 'cycle-snap-step') {
        setSnapToGrid(true);
        setSnapStepSeconds((value) => {
          const next = getNextTimelineSnapStep(value);
          setSaveStatus(`吸附步长已切换为 ${next}s。`);
          return next;
        });
        return;
      }
      if (!selectedTrack) return;
      if (action === 'copy-selected-clip') {
        copyTrackClipAtTime(selectedTrack.type, currentTime);
        return;
      }
      if (action === 'cut-selected-clip') {
        cutTrackClipAtTime(selectedTrack.type, currentTime);
        return;
      }
      if (action === 'paste-clip') {
        pasteClipToTrack(selectedTrack.type, currentTime);
        return;
      }
      if (action === 'edit-selected-track-color') {
        setTrackContextMenu({
          x: typeof window === 'undefined' ? 24 : Math.max(16, window.innerWidth - 300),
          y: 98,
          trackType: selectedTrack.type,
          time: currentTime,
          clipId: null,
          colorOpen: true,
          colorDraft: getTrackColor(selectedTrack.type),
        });
        return;
      }
      if (action === 'focus-selected-range') {
        focusSelectedTrackRange();
        return;
      }
      if (action === 'preview-selected-range') {
        previewSelectedTrackRange();
        return;
      }
      if (action === 'split-selected-clip') {
        splitSelectedTrackClipAtPlayhead();
        return;
      }
      if (action === 'toggle-loop-preview') {
        toggleLoopSelectionPreview();
        return;
      }
      if (action === 'toggle-selected-mute') {
        toggleTrackFlag(selectedTrack.type, 'muted');
        return;
      }
      if (action === 'toggle-selected-solo') {
        toggleTrackFlag(selectedTrack.type, 'solo');
        return;
      }
      if (action === 'set-selected-trim-start') {
        setSelectedTrackTrimToCurrentTime('start');
        return;
      }
      if (action === 'set-selected-trim-end') {
        setSelectedTrackTrimToCurrentTime('end');
        return;
      }
      if (action === 'nudge-selected-trim-start-back') {
        nudgeSelectedTrackTrim('start', -SELECTED_TRIM_NUDGE_SECONDS);
        return;
      }
      if (action === 'nudge-selected-trim-end-forward') {
        nudgeSelectedTrackTrim('end', SELECTED_TRIM_NUDGE_SECONDS);
        return;
      }
      if (action === 'mute-selected-range') {
        muteSelectedTrackRange();
        return;
      }
      if (action === 'restore-selected-range') {
        restoreSelectedTrackRange();
        return;
      }
      if (action === 'reset-selected-trim-range') {
        resetSelectedTrackTrimRange();
        return;
      }
      if (action === 'delete-selected-clip') {
        deleteSelectedClipOrActiveTrackClip();
        return;
      }
      resetTrackEdit(selectedTrack.type);
      setSaveStatus(`已重置“${getStemDisplayName(selectedTrack).zh}”的裁剪和淡入淡出。`);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    applyTimelineZoom,
    handleTogglePlayback,
    handleSeek,
    currentTime,
    copyTrackClipAtTime,
    cutTrackClipAtTime,
    deleteSelectedClipOrActiveTrackClip,
    deleteTrackClipById,
    duration,
    editorDialog,
    focusSelectedTrackRange,
    getTrackColor,
    nudgePlaybackHead,
    pasteClipToTrack,
    redoTrackChange,
    resetTrackEdit,
    resetSelectedTrackTrimRange,
    nudgeSelectedTrackTrim,
    muteSelectedTrackRange,
    previewSelectedTrackRange,
    restoreSelectedTrackRange,
    saveEditState,
    selectAdjacentTrack,
    selectedClip,
    selectedClipSelection,
    selectedTrack,
    closeEditorDialog,
    setSelectedTrackTrimToCurrentTime,
    splitSelectedTrackClipAtPlayhead,
    setTrackTrim,
    snapStepSeconds,
    stopPlaybackPreview,
    timelineZoom,
    toggleLoopSelectionPreview,
    toggleTrackFlag,
    undoTrackChange,
  ]);

  const editStateSignature = useMemo(() => JSON.stringify({
    tracks,
    master: masterState,
    trackLabels,
    trackColors,
    trackOrder: stems.map((stem) => stem.type),
    deletedTrackTypes,
    customStems,
    skippedEmptyCount,
  }), [customStems, deletedTrackTypes, masterState, skippedEmptyCount, stems, trackColors, trackLabels, tracks]);

  useEffect(() => {
    if (!jobId) return;
    if (skipNextAutoSaveRef.current) {
      skipNextAutoSaveRef.current = false;
      lastAutoSaveSignatureRef.current = editStateSignature;
      return;
    }
    if (lastAutoSaveSignatureRef.current === editStateSignature) return;

    setHasPendingEditChanges(true);
    setAutoSaveStatus('有未保存编辑，稍后自动保存...');

    if (isContinuousEditing) {
      return;
    }

    if (autoSaveTimerRef.current !== null) {
      window.clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = window.setTimeout(() => {
      autoSaveTimerRef.current = null;
      lastAutoSaveSignatureRef.current = editStateSignature;
      void persistEditState('auto');
    }, 1400);

    return () => {
      if (autoSaveTimerRef.current !== null) {
        window.clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
    };
  }, [editStateSignature, isContinuousEditing, jobId, persistEditState, saveRequestVersion]);

  const waitForStemLoadingToSettle = useCallback(async () => {
    const startedAt = Date.now();
    const timeoutMs = 90000;

    while (loadingCountRef.current > 0) {
      const loadedCount = Object.keys(audioBuffersRef.current).length;
      const targetCount = Math.max(0, stems.length - skippedEmptyCount);
      setExportStatusInput({
        phase: 'waiting-cache',
        loadedCount,
        totalCount: targetCount,
      });
      setSaveStatus(`等待分轨缓存完成：已加载 ${loadedCount}/${targetCount}，剩余 ${loadingCountRef.current} 条。`);
      await new Promise((resolve) => { window.setTimeout(resolve, 500); });

      if (Date.now() - startedAt > timeoutMs) {
        throw new Error('等待分轨缓存超时，请稍后再试或切换为“立即导出已加载”。');
      }
    }
  }, [skippedEmptyCount, stems.length]);

  const exportMix = useCallback(async () => {
    setInspectorTab('export');
    setInspectorCollapsed(false);
    setIsExporting(true);
    setPlaybackError(null);
    setSaveStatus(null);
    setLatestExportDownload(null);
    setExportStatusInput({
      phase: 'preparing',
      message: `正在准备“${exportModeLabel(exportMode)}”导出。`,
    });

    try {
      await savePendingEditsBeforeExport();

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
        const audioBuffer = audioBuffersRef.current[stem.type];
        const clipState = resolveTrackClipState(state, Math.max(duration, audioBuffer?.duration || 0));
        const hasClipAudio = (clipState.trimEnd ?? 0) - clipState.trimStart > 0.01;
        if (exportMode === 'all-tracks') return state.volume > 0 && hasClipAudio;
        if (exportMode === 'solo-only') return state.solo && state.volume > 0 && hasClipAudio;
        return !state.muted && (!anySolo || state.solo) && state.volume > 0 && hasClipAudio;
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
      setExportStatusInput({
        phase: 'preparing',
        message: `已选中 ${exportableStems.length} 条轨道，正在建立离线渲染。`,
      });

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
        const segments = buildTrackClipAudioSegments(state, renderDuration, audioBuffer.duration);
        if (segments.length === 0) return;

        const gain = offlineContext.createGain();
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
        connectGainWithPan(offlineContext, gain, masterOutput.input, state.pan);
        segments.forEach((segment) => {
          const source = offlineContext.createBufferSource();
          source.buffer = audioBuffer;
          source.connect(gain);
          source.start(
            Math.max(0, segment.timelineStart),
            segment.sourceStart,
            Math.max(0, segment.sourceEnd - segment.sourceStart),
          );
        });
      });

      setExportStatusInput({
        phase: 'rendering',
        message: `正在渲染 ${exportableStems.length} 条轨道。`,
      });
      const rendered = await offlineContext.startRendering();
      setExportStatusInput({ phase: 'encoding', fileType: 'WAV' });
      const blob = encodeWav(rendered);
      const fileName = `hookcraft-${exportModeFileLabel(exportMode)}-${formatExportTimestamp(new Date())}.wav`;
      const url = URL.createObjectURL(blob);
      setExportStatusInput({ phase: 'downloading', fileType: 'WAV' });
      setLatestExportDownload({ url, fileName, label: `${exportModeLabel(exportMode)} WAV` });
      triggerDownloadUrl(url, fileName);
      setExportStatusInput({
        phase: 'done',
        fileType: 'WAV',
        exportedCount: exportableStems.length,
        message: 'WAV 已生成。如果浏览器没有自动下载，请点击下方下载链接。',
      });
      setExportRecords((records) => appendStemExportRecord(records, createStemExportRecord({
        scope: 'mix',
        label: exportModeLabel(exportMode),
        trackCount: exportableStems.length,
        fileType: 'WAV',
      })));
      setSaveStatus(`“${exportModeLabel(exportMode)}”WAV 已导出。`);
    } catch (error) {
      const message = error instanceof Error ? error.message : '导出混音失败，请稍后重试。';
      setExportStatusInput({ phase: 'error', message });
      setPlaybackError(message);
    } finally {
      setIsExporting(false);
    }
  }, [duration, exportMode, exportReadiness, masterState, savePendingEditsBeforeExport, stems, tracks, waitForStemLoadingToSettle]);

  const exportSingleStem = useCallback(async (stem: EditableStem) => {
    setInspectorTab('export');
    setInspectorCollapsed(false);
    setExportingStemType(stem.type);
    setPlaybackError(null);
    setSaveStatus(null);
    setLatestExportDownload(null);
    setExportStatusInput({
      phase: 'preparing',
      message: `正在准备导出“${getStemDisplayName(stem).zh}”单轨。`,
    });

    try {
      await savePendingEditsBeforeExport();

      const audioBuffer = audioBuffersRef.current[stem.type];
      if (!audioBuffer) {
        throw new Error('这条分轨还没有缓存完成，请稍后再导出。');
      }

      const state = tracks[stem.type] || defaultTrackState();
      const timelineDuration = Math.max(duration, audioBuffer.duration);
      const clipState = resolveTrackClipState(state, timelineDuration);
      const trimStart = clipState.trimStart;
      const trimEnd = clipState.trimEnd ?? trimStart;
      const clipDuration = Math.max(0, trimEnd - trimStart);
      const segments = buildTrackClipAudioSegments(state, timelineDuration, audioBuffer.duration);
      if (clipDuration <= 0) {
        throw new Error('这条分轨的裁剪区间为空，请调整入点和出点。');
      }
      if (segments.length === 0) {
        throw new Error('这条分轨没有可导出的片段，请检查是否已删除全部片段。');
      }

      setSaveStatus(`正在导出“${getStemDisplayName(stem).zh}”单轨。`);
      setExportStatusInput({
        phase: 'rendering',
        message: `正在渲染“${getStemDisplayName(stem).zh}”单轨。`,
      });
      const sampleRate = audioBuffer.sampleRate || 44100;
      const frameCount = Math.max(1, Math.ceil(clipDuration * sampleRate));
      const offlineContext = new OfflineAudioContext(2, frameCount, sampleRate);
      const gain = offlineContext.createGain();

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
      connectGainWithPan(offlineContext, gain, offlineContext.destination, state.pan);
      segments.forEach((segment) => {
        const source = offlineContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(gain);
        source.start(
          Math.max(0, segment.timelineStart - trimStart),
          segment.sourceStart,
          Math.max(0, segment.sourceEnd - segment.sourceStart),
        );
      });

      const rendered = await offlineContext.startRendering();
      setExportStatusInput({ phase: 'encoding', fileType: 'WAV' });
      const blob = encodeWav(rendered);
      const fileName = `hookcraft-${normalizeStemType(stem.type)}-${formatExportTimestamp(new Date())}.wav`;
      const url = URL.createObjectURL(blob);
      setExportStatusInput({ phase: 'downloading', fileType: 'WAV' });
      setLatestExportDownload({ url, fileName, label: `${getStemDisplayName(stem).zh} 单轨 WAV` });
      triggerDownloadUrl(url, fileName);
      setExportStatusInput({
        phase: 'done',
        fileType: 'WAV',
        exportedCount: 1,
        message: '单轨 WAV 已生成。如果浏览器没有自动下载，请点击下方下载链接。',
      });
      setExportRecords((records) => appendStemExportRecord(records, createStemExportRecord({
        scope: 'stem',
        label: getStemDisplayName(stem).zh,
        trackCount: 1,
        fileType: 'WAV',
      })));
      setSaveStatus(`“${getStemDisplayName(stem).zh}”单轨 WAV 已导出。`);
    } catch (error) {
      const message = error instanceof Error ? error.message : '导出单轨失败，请稍后重试。';
      setExportStatusInput({ phase: 'error', message });
      setPlaybackError(message);
    } finally {
      setExportingStemType(null);
    }
  }, [duration, savePendingEditsBeforeExport, tracks]);

  const exportAllReadyStems = useCallback(async () => {
    setInspectorTab('export');
    setInspectorCollapsed(false);
    setIsExporting(true);
    setExportingStemType(null);
    setPlaybackError(null);
    setSaveStatus(null);
    setLatestExportDownload(null);
    setExportStatusInput({
      phase: 'preparing',
      message: '正在准备批量导出所有已缓存分轨。',
    });

    try {
      await savePendingEditsBeforeExport();

      if (exportReadiness === 'wait-all' && loadingCountRef.current > 0) {
        await waitForStemLoadingToSettle();
      }

      const readyStems = stems.filter((stem) => {
        const audioBuffer = audioBuffersRef.current[stem.type];
        if (!audioBuffer || stemHasKnownEmptyWaveform(stem)) return false;
        const state = tracks[stem.type] || defaultTrackState();
        const clipState = resolveTrackClipState(state, Math.max(duration, audioBuffer.duration));
        return state.volume > 0 && (clipState.trimEnd ?? 0) - clipState.trimStart > 0.01;
      });

      if (readyStems.length === 0) {
        throw new Error('当前没有可批量导出的已缓存分轨，请等待缓存完成或检查音量/裁剪区间。');
      }

      const timestamp = formatExportTimestamp(new Date());
      setSaveStatus(`正在批量导出 ${readyStems.length} 条单轨 WAV。`);

      for (let index = 0; index < readyStems.length; index += 1) {
        const stem = readyStems[index];
        const audioBuffer = audioBuffersRef.current[stem.type];
        if (!audioBuffer) continue;

        setExportingStemType(stem.type);
        setExportStatusInput({
          phase: 'rendering',
          message: `正在渲染 ${index + 1}/${readyStems.length}：“${getStemDisplayName(stem).zh}”。`,
        });

        const state = tracks[stem.type] || defaultTrackState();
        const timelineDuration = Math.max(duration, audioBuffer.duration);
        const clipState = resolveTrackClipState(state, timelineDuration);
        const trimStart = clipState.trimStart;
        const trimEnd = clipState.trimEnd ?? trimStart;
        const clipDuration = Math.max(0, trimEnd - trimStart);
        const segments = buildTrackClipAudioSegments(state, timelineDuration, audioBuffer.duration);
        if (clipDuration <= 0) continue;
        if (segments.length === 0) continue;

        const sampleRate = audioBuffer.sampleRate || 44100;
        const frameCount = Math.max(1, Math.ceil(clipDuration * sampleRate));
        const offlineContext = new OfflineAudioContext(2, frameCount, sampleRate);
        const gain = offlineContext.createGain();

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
        connectGainWithPan(offlineContext, gain, offlineContext.destination, state.pan);
        segments.forEach((segment) => {
          const source = offlineContext.createBufferSource();
          source.buffer = audioBuffer;
          source.connect(gain);
          source.start(
            Math.max(0, segment.timelineStart - trimStart),
            segment.sourceStart,
            Math.max(0, segment.sourceEnd - segment.sourceStart),
          );
        });

        const rendered = await offlineContext.startRendering();
        setExportStatusInput({
          phase: 'encoding',
          fileType: 'WAV',
          message: `正在编码 ${index + 1}/${readyStems.length}：“${getStemDisplayName(stem).zh}”。`,
        });
        downloadBlob(
          encodeWav(rendered),
          `hookcraft-stems-${timestamp}-${String(index + 1).padStart(2, '0')}-${normalizeStemType(stem.type)}.wav`,
          4000,
        );

        if (index < readyStems.length - 1) {
          await new Promise((resolve) => { window.setTimeout(resolve, 160); });
        }
      }

      setExportStatusInput({ phase: 'done', fileType: 'WAV', exportedCount: readyStems.length });
      setExportRecords((records) => appendStemExportRecord(records, createStemExportRecord({
        scope: 'stem',
        label: '全部单轨',
        trackCount: readyStems.length,
        fileType: 'WAV',
      })));
      setSaveStatus(`已批量导出 ${readyStems.length} 条单轨 WAV。`);
    } catch (error) {
      const message = error instanceof Error ? error.message : '批量导出单轨失败，请稍后重试。';
      setExportStatusInput({ phase: 'error', message });
      setPlaybackError(message);
    } finally {
      setExportingStemType(null);
      setIsExporting(false);
    }
  }, [duration, exportReadiness, savePendingEditsBeforeExport, stems, tracks, waitForStemLoadingToSettle]);

  const selectInspectorTab = useCallback((tab: InspectorTab) => {
    setInspectorTab(tab);
  }, []);

  useEffect(() => {
    if (inspectorViewportRef.current) {
      inspectorViewportRef.current.scrollTop = 0;
    }
  }, [inspectorCollapsed, inspectorTab]);

  const dawLayoutMetrics = useMemo(() => buildDawEditorLayoutMetrics({
    compactTransport,
    inspectorCollapsed,
  }), [compactTransport, inspectorCollapsed]);

  return (
    <section className="stem-mixer-editor" style={editorStyle(dawLayoutMetrics)}>
      <style dangerouslySetInnerHTML={{ __html: timelineScrollbarCss }} />
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        onChange={importTrackFile}
        style={hiddenFileInputStyle}
      />
      <div className="stem-mixer-editor-header" style={editorHeaderStyle}>
        <div className="stem-mixer-editor-header-primary" style={editorHeaderPrimaryStyle}>
          <Link href="/" aria-label="返回 HookCraft 首页" style={editorBrandStyle}>
            <Image src="/logo-nav.svg" alt="HookCraft" width={140} height={36} priority />
          </Link>
          <div style={editorProjectTitleStyle}>
            <span style={editorTitleStyle}>歌曲编辑</span>
          </div>
          <div style={editorStatusClusterStyle}>
            <span style={saveBadgeStyle(saveBadge.tone)}>{saveBadge.label}</span>
            <span>{formatStemTimecode(currentTime)}</span>
          </div>
        </div>
        <div className="stem-mixer-editor-actions" style={editorActionStyle}>
          <button
            type="button"
            onClick={undoTrackChange}
            disabled={!canUndo}
            title="回到上一步编辑"
            style={historyButtonStyle(canUndo)}
          >
            上一步
          </button>
          <button
            type="button"
            onClick={redoTrackChange}
            disabled={!canRedo}
            title="前进到下一步编辑"
            style={historyButtonStyle(canRedo)}
          >
            下一步
          </button>
          <button
            type="button"
            onClick={() => void returnToCreationsAfterSave()}
            disabled={isSaving}
            title="自动保存当前项目后返回我的作品"
            style={ghostButtonStyle}
          >
            返回
          </button>
          <button type="button" onClick={saveEditState} disabled={isSaving} style={primarySmallButtonStyle}>
            {isSaving ? '保存中' : '保存'}
          </button>
          {inspectorCollapsed && (
            <button
              type="button"
              onClick={() => {
                setInspectorTab('export');
                setInspectorCollapsed(false);
                setSaveStatus('已打开导出中心。');
              }}
              style={ghostButtonStyle}
            >
              导出
            </button>
          )}
        </div>
      </div>

      <div style={workbenchTopStyle}>
        <div style={transportPanelStyle(true)}>
          <div style={transportStyle}>
            <div style={transportButtonGroupStyle}>
              <button type="button" aria-label="回到开头" title="回到开头" onClick={() => handleSeek(0)} style={transportIconButtonStyle(false)}>
                <TransportIcon name="skipStart" />
              </button>
              <button type="button" aria-label="后退 1 秒" title="后退 1 秒" onClick={() => nudgePlaybackHead(-1, true)} style={transportIconButtonStyle(false)}>
                <TransportIcon name="back" />
                <span style={transportNudgeBadgeStyle}>1s</span>
              </button>
              <button type="button" aria-label={isPlaying ? '暂停' : '播放'} title="播放/暂停" onClick={handleTogglePlayback} style={playButtonStyle}>
                <TransportIcon name={isPlaying ? 'pause' : 'play'} />
              </button>
              <button type="button" aria-label="停止预听" title="停止预听" onClick={stopPlaybackPreview} style={transportIconButtonStyle(false)}>
                <TransportIcon name="stop" />
              </button>
              <button type="button" aria-label="前进 1 秒" title="前进 1 秒" onClick={() => nudgePlaybackHead(1, true)} style={transportIconButtonStyle(false)}>
                <TransportIcon name="forward" />
                <span style={transportNudgeBadgeStyle}>1s</span>
              </button>
              <button type="button" aria-label="跳到结尾" title="跳到结尾" onClick={() => handleSeek(duration)} style={transportIconButtonStyle(false)}>
                <TransportIcon name="skipEnd" />
              </button>
            </div>
            <input
              aria-label="播放头时间"
              type="text"
              inputMode="decimal"
              value={currentTimeInputDraft ?? formatStemTimecode(currentTime)}
              onFocus={() => setCurrentTimeInputDraft(formatStemTimecode(currentTime))}
              onChange={(event) => setCurrentTimeInputDraft(event.target.value)}
              onBlur={(event) => {
                if (skipNextTimeInputCommitRef.current) {
                  skipNextTimeInputCommitRef.current = false;
                  setCurrentTimeInputDraft(null);
                  return;
                }
                commitCurrentTimeInput(event.target.value);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.currentTarget.blur();
                }
                if (event.key === 'Escape') {
                  skipNextTimeInputCommitRef.current = true;
                  setCurrentTimeInputDraft(null);
                  event.currentTarget.blur();
                }
              }}
              style={timeInputStyle}
            />
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
            <span style={timeStyle}>{formatStemTimecode(duration)}</span>
          </div>
        </div>

        <div style={readinessDockStyle}>
          <div style={readinessPanelStyle(editorReadiness.level)}>
            <div>
              <div style={readinessTitleStyle}>{editorReadiness.title}</div>
              <div style={readinessDetailStyle}>{editorReadiness.detail}</div>
            </div>
            <div style={readinessMetricsStyle}>
              <span style={readinessMetricStyle}>就绪 {readyStemCount}/{loadableStemCount}</span>
              <span style={readinessMetricStyle}>加载 {loadingStemTypes.size}</span>
              <span style={readinessMetricStyle}>失败 {failedStemTypes.size}</span>
              <span style={readinessMetricStyle}>导出 {exportSummary.selectedCount}</span>
            </div>
          </div>
        </div>

        <div
          id="stem-editor-inspector"
          ref={inspectorViewportRef}
          className="stem-editor-inspector-dock stem-editor-vertical-scroll"
          style={controlGridStyle(inspectorCollapsed, dawLayoutMetrics)}
        >
          <div style={inspectorHeaderStyle(inspectorCollapsed)}>
            <div>
              <div style={inspectorEyebrowStyle}>Inspector</div>
              <div style={inspectorTitleStyle}>
                {inspectorCollapsed && '检查器'}
                {!inspectorCollapsed && inspectorTab === 'track' && '轨道检查器'}
                {!inspectorCollapsed && inspectorTab === 'mix' && '混音控制'}
                {!inspectorCollapsed && inspectorTab === 'export' && '导出中心'}
              </div>
            </div>
            {!inspectorCollapsed && <span style={inspectorBadgeStyle}>
              {inspectorTab === 'track' && (selectedTrack ? getStemDisplayName(selectedTrack).zh : '未选')}
              {inspectorTab === 'mix' && `${audibleStemCount} 条有声`}
              {inspectorTab === 'export' && `${exportSummary.selectedCount} 条导出`}
            </span>}
            <button
              type="button"
              title={inspectorCollapsed ? '展开右侧检查器' : '收起右侧检查器'}
              aria-pressed={inspectorCollapsed}
              onClick={() => setInspectorCollapsed((value) => !value)}
              style={inspectorCollapseButtonStyle(inspectorCollapsed)}
            >
              {inspectorCollapsed ? '展开' : '收起'}
            </button>
          </div>
          {!inspectorCollapsed && <div style={inspectorTabsStyle}>
            <button type="button" aria-pressed={inspectorTab === 'track'} style={inspectorTabButtonStyle(inspectorTab === 'track')} onClick={() => selectInspectorTab('track')}>
              轨道
            </button>
            <button type="button" aria-pressed={inspectorTab === 'mix'} style={inspectorTabButtonStyle(inspectorTab === 'mix')} onClick={() => selectInspectorTab('mix')}>
              混音
            </button>
            <button type="button" aria-pressed={inspectorTab === 'export'} style={inspectorTabButtonStyle(inspectorTab === 'export')} onClick={() => selectInspectorTab('export')}>
              导出
            </button>
          </div>}
          {!inspectorCollapsed && inspectorTab === 'track' && (
          <>
          <div style={addTrackPanelStyle(isAddTrackPanelOpen)}>
            <div style={panelHeadingStyle}>
              <span style={presetLabelStyle}>轨道素材</span>
              <span style={panelHeadingMetaStyle}>导入 / 录音</span>
            </div>
            <div style={addTrackHintStyle}>
              {selectedTrack
                ? selectedTrackIsCustom
                  ? selectedTrackNeedsAudio
                    ? `当前选中“${getStemDisplayName(selectedTrack).zh}”，导入或录音后会填入这条空轨。`
                    : `当前选中“${getStemDisplayName(selectedTrack).zh}”，可以重新导入或重新录音替换素材。`
                  : '当前是系统分轨。需要新增素材时，先点击时间线下方 + 创建一条空轨。'
                : '先点击时间线下方 + 创建一条空轨。'}
            </div>
            <div style={addTrackModeGridStyle}>
              <button
                type="button"
                aria-pressed={addTrackMode === 'import'}
                style={exportModeButtonStyle(addTrackMode === 'import')}
                onClick={importAudioToSelectedTrack}
              >
                导入音频
              </button>
              <button
                type="button"
                aria-pressed={addTrackMode === 'record'}
                style={exportModeButtonStyle(addTrackMode === 'record')}
                onClick={() => openAddTrackPanel('record')}
              >
                现场录音
              </button>
            </div>
            {isAddTrackPanelOpen && addTrackMode === 'import' && (
              <div style={addTrackHintStyle}>
                选择 WAV、MP3、M4A 或 WebM 音频后，会填入当前空轨并生成波形。
              </div>
            )}
            {isAddTrackPanelOpen && addTrackMode === 'record' && (
              <>
                <div style={recordingInputPanelStyle}>
                  <div style={recordingInputLabelStyle}>输入</div>
                  <div style={recordingSelectGroupStyle} data-recording-select="true">
                    <button
                      type="button"
                      aria-haspopup="listbox"
                      aria-expanded={recordingSelectMenu === 'device'}
                      disabled={isRecording || isMonitoringPreview}
                      onClick={() => setRecordingSelectMenu((current) => (current === 'device' ? null : 'device'))}
                      style={recordingSelectButtonStyle(isRecording || isMonitoringPreview)}
                    >
                      <span style={recordingSelectTextStyle}>{selectedRecordingDeviceLabel}</span>
                      <span aria-hidden="true" style={recordingSelectChevronStyle}>⌄</span>
                    </button>
                    {recordingSelectMenu === 'device' && (
                      <div role="listbox" aria-label="录音输入设备" style={recordingSelectMenuStyle}>
                        {recordingDeviceOptions.map((option) => (
                          <button
                            key={option.value || 'default-device'}
                            type="button"
                            role="option"
                            aria-selected={option.value === selectedAudioInputDeviceId}
                            style={recordingSelectOptionButtonStyle(option.value === selectedAudioInputDeviceId)}
                            onClick={() => {
                              setSelectedAudioInputDeviceId(option.value);
                              setRecordingSelectMenu(null);
                            }}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div style={recordingSelectGroupStyle} data-recording-select="true">
                    <button
                      type="button"
                      aria-haspopup="listbox"
                      aria-expanded={recordingSelectMenu === 'channel'}
                      disabled={isRecording || isMonitoringPreview}
                      onClick={() => setRecordingSelectMenu((current) => (current === 'channel' ? null : 'channel'))}
                      style={recordingSelectButtonStyle(isRecording || isMonitoringPreview)}
                    >
                      <span style={recordingSelectTextStyle}>{selectedRecordingChannelLabel}</span>
                      <span aria-hidden="true" style={recordingSelectChevronStyle}>⌄</span>
                    </button>
                    {recordingSelectMenu === 'channel' && (
                      <div role="listbox" aria-label="录音输入通道" style={recordingSelectMenuStyle}>
                        {RECORDING_CHANNEL_OPTIONS.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            role="option"
                            aria-selected={option.value === recordingInputChannel}
                            style={recordingSelectOptionButtonStyle(option.value === recordingInputChannel)}
                            onClick={() => {
                              setRecordingInputChannel(option.value);
                              setRecordingSelectMenu(null);
                            }}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div style={recordingInputFooterStyle}>
                    <label style={recordingInputLevelStyle}>
                      <span>输入电平</span>
                      <input
                        aria-label="录音输入电平"
                        type="range"
                        min={0}
                        max={1.4}
                        step={0.01}
                        value={recordingInputLevel}
                        onChange={(event) => setRecordingInputLevel(Number(event.target.value))}
                        style={recordingInputRangeStyle}
                      />
                    </label>
                    <button
                      type="button"
                      aria-pressed={monitoringEnabled}
                      title={monitoringEnabled ? '关闭监听' : '开启监听'}
                      style={monitoringButtonStyle(monitoringEnabled)}
                      onClick={() => void toggleInputMonitoring()}
                    >
                      {monitoringEnabled ? '监听中' : '监听'}
                    </button>
                  </div>
                </div>
                <div style={recordPanelStyle}>
                  <div style={recordingStatusBlockStyle}>
                    <span style={recordingStatusTitleStyle}>{recordingStatus || (isMonitoringPreview ? '监听中...' : '准备录音')}</span>
                    <span style={recordingStatusHintStyle}>
                      {isRecording ? '波形正在当前轨道实时生成。' : isMonitoringPreview ? '已打开麦克风监听，开始录音会写入当前空轨。' : '点击开始后会录到当前空轨。'}
                    </span>
                  </div>
                  <div style={recordingMeterStyle(isRecording || isMonitoringPreview)} aria-label={`录音电平 ${Math.round(recordingLevel * 100)}%`}>
                    <div style={recordingMeterScaleStyle}>
                      <span>0</span>
                      <span>-6</span>
                      <span>-20</span>
                      <span>-60</span>
                    </div>
                    <div style={recordingMeterTrackStyle}>
                      <span style={recordingMeterFillStyle(recordingLevel, isRecording || isMonitoringPreview)} />
                      <span style={recordingMeterPeakStyle(recordingLevel)} />
                    </div>
                  </div>
                  <button
                    type="button"
                    style={recordingActionButtonStyle(isRecording)}
                    onClick={isRecording ? stopRecordingTrack : () => void startRecordingTrack()}
                  >
                    {isRecording ? '停止录音' : '开始录音'}
                  </button>
                </div>
              </>
            )}
          </div>
          <div style={selectedTrackPanelStyle}>
            {selectedTrack && selectedTrackState ? (
              <>
                <div style={selectedTrackHeaderStyle}>
                  <div style={selectedTrackTitleGroupStyle}>
                    <span style={stemColorStyle(selectedTrack.type)} />
                    <div>
                      <input
                        aria-label="轨道名称"
                        type="text"
                        value={getStemDisplayName(selectedTrack).zh}
                        maxLength={40}
                        onFocus={beginContinuousControlEdit}
                        onBlur={finishContinuousControlEdit}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.currentTarget.blur();
                          }
                        }}
                        onChange={(event) => renameTrack(selectedTrack.type, event.target.value, 'deferred')}
                        style={selectedTrackNameInputStyle}
                      />
                      <div style={selectedTrackSubStyle}>{getStemDisplayName(selectedTrack).en}</div>
                    </div>
                    {selectedTrackAudioStatus && (
                      <span style={stemAudioStatusBadgeStyle(selectedTrackAudioStatus)}>
                        {stemAudioStatusLabel(selectedTrackAudioStatus)}
                      </span>
                    )}
                  </div>
                  <div style={selectedTrackActionsStyle}>
                    <button type="button" style={presetButtonStyle} onClick={() => toggleTrackFlag(selectedTrack.type, 'muted')}>
                      {selectedTrackState.muted ? '取消静音' : '静音'}
                    </button>
                    <button type="button" style={presetButtonStyle} onClick={() => toggleTrackFlag(selectedTrack.type, 'solo')}>
                      {selectedTrackState.solo ? '取消独奏' : '独奏'}
                    </button>
                    <button type="button" style={presetButtonStyle} onClick={() => soloOnlyTrack(selectedTrack.type)}>
                      只听当前
                    </button>
                    <button
                      type="button"
                      disabled={!selectedTrackBuffer}
                      style={presetButtonStyle}
                      onClick={previewSelectedTrackRange}
                    >
                      预听选区
                    </button>
                    <button
                      type="button"
                      disabled={duration <= 0}
                      style={presetButtonStyle}
                      onClick={splitSelectedTrackClipAtPlayhead}
                    >
                      切分片段
                    </button>
                    <button
                      type="button"
                      disabled={duration <= 0 || selectedTrackClipCount === 0}
                      style={presetButtonStyle}
                      onClick={deleteSelectedClipOrActiveTrackClip}
                    >
                      删除片段
                    </button>
                    <button
                      type="button"
                      style={exportModeButtonStyle(loopSelectionPreview)}
                      onClick={toggleLoopSelectionPreview}
                    >
                      循环预听 {loopSelectionPreview ? '开' : '关'}
                    </button>
                    <button
                      type="button"
                      disabled={!selectedTrackBuffer || exportingStemType === selectedTrack.type}
                      style={presetButtonStyle}
                      onClick={() => void exportSingleStem(selectedTrack)}
                    >
                      {exportingStemType === selectedTrack.type ? '导出中' : '导出单轨'}
                    </button>
                    {selectedTrack && (
                      <button
                        type="button"
                        style={deleteTrackButtonStyle}
                        onClick={() => deleteSelectedTrack()}
                      >
                        删除轨道
                      </button>
                    )}
                  </div>
                </div>
                <div style={selectedTrackStatsStyle}>
                  <span>范围 {formatTime(selectedTrackState.trimStart)} - {formatTime(selectedTrackTrimEnd)}</span>
                  <span>片段 {formatTime(selectedTrackClipDuration)}</span>
                  <span>剪辑 {selectedTrackClipCount}</span>
                  <span>音量 {Math.round(selectedTrackState.volume * 100)}%</span>
                  <span>声像 {formatPan(selectedTrackState.pan)}</span>
                  <span>淡入 {selectedTrackState.fadeIn.toFixed(2)}s</span>
                  <span>淡出 {selectedTrackState.fadeOut.toFixed(2)}s</span>
                  <span>静音片段 {selectedTrackMutedRanges.length}</span>
                </div>
                <div style={selectedTrackControlsGridStyle}>
                  <label style={selectedTrackControlStyle}>
                    <span>入点 {formatTime(selectedTrackTrimControls?.trimStart ?? 0)}</span>
                    <div style={selectedTrackInlineControlStyle}>
                      <input
                        aria-label={`${getStemDisplayName(selectedTrack).zh} 精确入点`}
                        type="range"
                        min={0}
                        max={selectedTrackTrimControls?.durationMax ?? Math.max(duration, 0.1)}
                        step={0.05}
                        value={selectedTrackTrimControls?.trimStart ?? 0}
                        onFocus={beginContinuousControlEdit}
                        onPointerDown={beginContinuousControlEdit}
                        onPointerUp={finishContinuousControlEdit}
                        onBlur={finishContinuousControlEdit}
                        onKeyUp={finishContinuousControlEdit}
                        onChange={(event) => setTrackTrim(selectedTrack.type, 'start', Number(event.target.value), snapToGrid, 'deferred')}
                      />
                      <input
                        aria-label={`${getStemDisplayName(selectedTrack).zh} 入点时间码`}
                        type="text"
                        inputMode="decimal"
                        value={selectedTrimInputDraft?.type === selectedTrack.type && selectedTrimInputDraft.edge === 'start'
                          ? selectedTrimInputDraft.value
                          : formatStemTimecode(selectedTrackTrimControls?.trimStart ?? 0)}
                        onFocus={() => setSelectedTrimInputDraft({
                          edge: 'start',
                          type: selectedTrack.type,
                          value: formatStemTimecode(selectedTrackTrimControls?.trimStart ?? 0),
                        })}
                        onChange={(event) => setSelectedTrimInputDraft({
                          edge: 'start',
                          type: selectedTrack.type,
                          value: event.target.value,
                        })}
                        onBlur={(event) => {
                          if (skipNextTrimInputCommitRef.current) {
                            skipNextTrimInputCommitRef.current = false;
                            setSelectedTrimInputDraft(null);
                            return;
                          }
                          commitSelectedTrimInput('start', event.target.value);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.currentTarget.blur();
                          }
                          if (event.key === 'Escape') {
                            skipNextTrimInputCommitRef.current = true;
                            setSelectedTrimInputDraft(null);
                            event.currentTarget.blur();
                          }
                        }}
                        style={selectedTrackNumberInputStyle}
                      />
                    </div>
                  </label>
                  <label style={selectedTrackControlStyle}>
                    <span>出点 {formatTime(selectedTrackTrimControls?.trimEnd ?? duration)}</span>
                    <div style={selectedTrackInlineControlStyle}>
                      <input
                        aria-label={`${getStemDisplayName(selectedTrack).zh} 精确出点`}
                        type="range"
                        min={0}
                        max={selectedTrackTrimControls?.durationMax ?? Math.max(duration, 0.1)}
                        step={0.05}
                        value={selectedTrackTrimControls?.trimEnd ?? duration}
                        onFocus={beginContinuousControlEdit}
                        onPointerDown={beginContinuousControlEdit}
                        onPointerUp={finishContinuousControlEdit}
                        onBlur={finishContinuousControlEdit}
                        onKeyUp={finishContinuousControlEdit}
                        onChange={(event) => setTrackTrim(selectedTrack.type, 'end', Number(event.target.value), snapToGrid, 'deferred')}
                      />
                      <input
                        aria-label={`${getStemDisplayName(selectedTrack).zh} 出点时间码`}
                        type="text"
                        inputMode="decimal"
                        value={selectedTrimInputDraft?.type === selectedTrack.type && selectedTrimInputDraft.edge === 'end'
                          ? selectedTrimInputDraft.value
                          : formatStemTimecode(selectedTrackTrimControls?.trimEnd ?? duration)}
                        onFocus={() => setSelectedTrimInputDraft({
                          edge: 'end',
                          type: selectedTrack.type,
                          value: formatStemTimecode(selectedTrackTrimControls?.trimEnd ?? duration),
                        })}
                        onChange={(event) => setSelectedTrimInputDraft({
                          edge: 'end',
                          type: selectedTrack.type,
                          value: event.target.value,
                        })}
                        onBlur={(event) => {
                          if (skipNextTrimInputCommitRef.current) {
                            skipNextTrimInputCommitRef.current = false;
                            setSelectedTrimInputDraft(null);
                            return;
                          }
                          commitSelectedTrimInput('end', event.target.value);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.currentTarget.blur();
                          }
                          if (event.key === 'Escape') {
                            skipNextTrimInputCommitRef.current = true;
                            setSelectedTrimInputDraft(null);
                            event.currentTarget.blur();
                          }
                        }}
                        style={selectedTrackNumberInputStyle}
                      />
                    </div>
                  </label>
                  <label style={selectedTrackControlStyle}>
                    <span>音量 {Math.round(selectedTrackState.volume * 100)}%</span>
                    <input
                      aria-label={`${getStemDisplayName(selectedTrack).zh} 音量`}
                      type="range"
                      min={0}
                      max={1}
                      step={0.01}
                      value={selectedTrackState.volume}
                      onFocus={beginContinuousControlEdit}
                      onPointerDown={beginContinuousControlEdit}
                      onPointerUp={finishContinuousControlEdit}
                      onBlur={finishContinuousControlEdit}
                      onKeyUp={finishContinuousControlEdit}
                      onChange={(event) => setTrackVolume(selectedTrack.type, Number(event.target.value), 'deferred')}
                    />
                  </label>
                  <label style={selectedTrackControlStyle}>
                    <span>声像 {formatPan(selectedTrackState.pan)}</span>
                    <input
                      aria-label={`${getStemDisplayName(selectedTrack).zh} 声像`}
                      type="range"
                      min={-1}
                      max={1}
                      step={0.01}
                      value={selectedTrackState.pan}
                      onFocus={beginContinuousControlEdit}
                      onPointerDown={beginContinuousControlEdit}
                      onPointerUp={finishContinuousControlEdit}
                      onBlur={finishContinuousControlEdit}
                      onKeyUp={finishContinuousControlEdit}
                      onChange={(event) => setTrackPan(selectedTrack.type, Number(event.target.value), 'deferred')}
                    />
                  </label>
                  <label style={selectedTrackControlStyle}>
                    <span>淡入 {(selectedTrackTrimControls?.fadeIn ?? 0).toFixed(2)}s</span>
                    <input
                      aria-label={`${getStemDisplayName(selectedTrack).zh} 淡入`}
                      type="range"
                      min={0}
                      max={Math.max(selectedTrackClipDuration, 0.1)}
                      step={0.05}
                      value={selectedTrackTrimControls?.fadeIn ?? 0}
                      onFocus={beginContinuousControlEdit}
                      onPointerDown={beginContinuousControlEdit}
                      onPointerUp={finishContinuousControlEdit}
                      onBlur={finishContinuousControlEdit}
                      onKeyUp={finishContinuousControlEdit}
                      onChange={(event) => setTrackFade(selectedTrack.type, 'in', Number(event.target.value), 'deferred')}
                    />
                  </label>
                  <label style={selectedTrackControlStyle}>
                    <span>淡出 {(selectedTrackTrimControls?.fadeOut ?? 0).toFixed(2)}s</span>
                    <input
                      aria-label={`${getStemDisplayName(selectedTrack).zh} 淡出`}
                      type="range"
                      min={0}
                      max={Math.max(selectedTrackClipDuration, 0.1)}
                      step={0.05}
                      value={selectedTrackTrimControls?.fadeOut ?? 0}
                      onFocus={beginContinuousControlEdit}
                      onPointerDown={beginContinuousControlEdit}
                      onPointerUp={finishContinuousControlEdit}
                      onBlur={finishContinuousControlEdit}
                      onKeyUp={finishContinuousControlEdit}
                      onChange={(event) => setTrackFade(selectedTrack.type, 'out', Number(event.target.value), 'deferred')}
                    />
                  </label>
                </div>
                <div style={selectedTrackNudgeGridStyle}>
                  <button
                    type="button"
                    style={presetButtonStyle}
                    onClick={() => nudgeSelectedTrackTrim('start', -SELECTED_TRIM_NUDGE_SECONDS)}
                  >
                    入点 -0.1s
                  </button>
                  <button
                    type="button"
                    style={presetButtonStyle}
                    onClick={() => nudgeSelectedTrackTrim('start', SELECTED_TRIM_NUDGE_SECONDS)}
                  >
                    入点 +0.1s
                  </button>
                  <button
                    type="button"
                    style={presetButtonStyle}
                    onClick={() => nudgeSelectedTrackTrim('end', -SELECTED_TRIM_NUDGE_SECONDS)}
                  >
                    出点 -0.1s
                  </button>
                  <button
                    type="button"
                    style={presetButtonStyle}
                    onClick={() => nudgeSelectedTrackTrim('end', SELECTED_TRIM_NUDGE_SECONDS)}
                  >
                    出点 +0.1s
                  </button>
                </div>
                <div style={selectedTrackActionsStyle}>
                  <button type="button" style={presetButtonStyle} onClick={muteSelectedTrackRange}>
                    静音选区
                  </button>
                  <button type="button" style={presetButtonStyle} onClick={restoreSelectedTrackRange}>
                    恢复选区
                  </button>
                  <button type="button" style={presetButtonStyle} onClick={() => setSelectedTrackTrimToCurrentTime('start')}>
                    入点到播放头
                  </button>
                  <button type="button" style={presetButtonStyle} onClick={() => setSelectedTrackTrimToCurrentTime('end')}>
                    出点到播放头
                  </button>
                  <button type="button" style={presetButtonStyle} onClick={() => resetTrackEdit(selectedTrack.type)}>
                    重置当前轨裁剪
                  </button>
                  <span style={selectedTrackShortcutStyle}>快捷键：↑/↓ 选轨，M 静音，S 独奏，C 切分，Ctrl+C/X/V 复制剪切粘贴，Shift+C 改色，Del 删除</span>
                </div>
                {selectedTrackMutedRanges.length > 0 && (
                  <div style={mutedRangeListStyle} aria-label={`${getStemDisplayName(selectedTrack).zh} 静音片段`}>
                    {selectedTrackMutedRanges.map((range, index) => (
                      <div key={`${range.start}-${range.end}-${index}`} style={mutedRangeItemStyle}>
                        <span style={mutedRangeTimeStyle}>
                          静音 {index + 1}: {formatTime(range.start)} - {formatTime(range.end)}
                        </span>
                        <button
                          type="button"
                          style={mutedRangeRestoreButtonStyle}
                          onClick={() => restoreSelectedTrackMutedRange(index)}
                        >
                          恢复
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div style={emptyTrackNoticeStyle}>当前筛选下没有选中的轨道。</div>
            )}
          </div>
          </>
          )}

          {!inspectorCollapsed && inspectorTab === 'mix' && (
          <>
          <div style={controlPanelStyle}>
            <div style={panelHeadingStyle}>
              <span style={presetLabelStyle}>混音预设</span>
              <span style={panelHeadingMetaStyle}>Mix</span>
            </div>
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
            <div style={panelHeadingStyle}>
              <span style={presetLabelStyle}>快速操作</span>
              <span style={panelHeadingMetaStyle}>Actions</span>
            </div>
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
            <div style={panelHeadingStyle}>
              <span style={presetLabelStyle}>轨道视图</span>
              <span style={panelHeadingMetaStyle}>View</span>
            </div>
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
            <div style={panelHeadingStyle}>
              <span style={presetLabelStyle}>母带输出</span>
              <span style={panelHeadingMetaStyle}>Master</span>
            </div>
            <label style={masterOutputControlStyle}>
              <span>{Math.round(masterState.volume * 100)}%</span>
              <input
                aria-label="母带输出音量"
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={masterState.volume}
                onFocus={beginContinuousControlEdit}
                onPointerDown={beginContinuousControlEdit}
                onPointerUp={finishContinuousControlEdit}
                onBlur={finishContinuousControlEdit}
                onKeyUp={finishContinuousControlEdit}
                onChange={(event) => setMasterVolume(Number(event.target.value), 'deferred')}
              />
            </label>
            <div style={buttonWrapStyle}>
              <button type="button" style={viewModeButtonStyle(masterState.limiter)} onClick={toggleMasterLimiter}>
                防爆音压缩 {masterState.limiter ? '开' : '关'}
              </button>
            </div>
          </div>
          </>
          )}

          {!inspectorCollapsed && inspectorTab === 'export' && (
          <div style={exportPanelStyle}>
            <div style={exportPanelHeaderStyle}>
              <div style={panelHeadingStyle}>
                <span style={presetLabelStyle}>导出设置</span>
                <span style={panelHeadingMetaStyle}>Export</span>
              </div>
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
            <div style={exportActionGridStyle}>
              <button
                type="button"
                disabled={!exportSummary.canExport}
                style={exportPrimaryActionStyle(!exportSummary.canExport)}
                title={mixExportDisabledReason || '导出混音 WAV'}
                onClick={() => void exportMix()}
              >
                <span>导出混音 WAV</span>
                {!exportSummary.canExport && mixExportDisabledReason && (
                  <small style={exportActionReasonStyle}>{mixExportDisabledReason}</small>
                )}
              </button>
              <button
                type="button"
                disabled={Boolean(batchExportDisabledReason)}
                style={exportPrimaryActionStyle(Boolean(batchExportDisabledReason))}
                title={batchExportDisabledReason || '批量导出所有已缓存单轨 WAV'}
                onClick={() => void exportAllReadyStems()}
              >
                <span>批量导出单轨</span>
                {batchExportDisabledReason && (
                  <small style={exportActionReasonStyle}>{batchExportDisabledReason}</small>
                )}
              </button>
            </div>
            <div style={exportHintStyle}>
              {exportMode === 'current-mix' && '按当前静音、独奏、音量、声像、裁剪和淡入淡出导出。'}
              {exportMode === 'all-tracks' && '忽略静音和独奏，只按音量、声像、裁剪和淡入淡出导出全部已加载分轨。'}
              {exportMode === 'solo-only' && '只导出已选择独奏的轨道，适合单独导出人声或乐器组。'}
              {exportSummary.missingCount > 0 && exportReadiness === 'wait-all' && ` 还有 ${exportSummary.missingCount} 条未加载，点击导出后会等待缓存完成。`}
              {exportSummary.missingCount > 0 && exportReadiness === 'ready-only' && ` 还有 ${exportSummary.missingCount} 条未加载，本次只导出已就绪轨道。`}
              {exportSummary.mutedOrSkippedCount > 0 && exportMode !== 'all-tracks' && ` 当前模式会跳过 ${exportSummary.mutedOrSkippedCount} 条轨道。`}
              {exportSummary.disabledReason && ` 暂不能导出：${exportSummary.disabledReason}`}
            </div>
            <div style={exportPreflightStyle}>
              <div style={exportPreflightRowStyle}>
                <span style={exportPreflightLabelStyle}>导出预检</span>
                <span style={exportPreflightValueStyle}>{exportSummary.summary}</span>
              </div>
              <div style={exportPreflightRowStyle}>
                <span style={exportPreflightLabelStyle}>将导出</span>
                <span style={exportPreflightValueStyle}>{formatExportPreflightLabels(exportSummary.exportableLabels)}</span>
              </div>
              {exportSummary.missingCount > 0 && (
                <div style={exportPreflightRowStyle}>
                  <span style={exportPreflightLabelStyle}>等待缓存</span>
                  <span style={exportPreflightWarningStyle}>{formatExportPreflightLabels(exportSummary.missingLabels)}</span>
                </div>
              )}
              {exportSummary.mutedOrSkippedCount > 0 && (
                <div style={exportPreflightRowStyle}>
                  <span style={exportPreflightLabelStyle}>当前跳过</span>
                  <span style={exportPreflightValueStyle}>{formatExportPreflightLabels(exportSummary.skippedLabels)}</span>
                </div>
              )}
              {exportSummary.emptyCount > 0 && (
                <div style={exportPreflightRowStyle}>
                  <span style={exportPreflightLabelStyle}>空轨跳过</span>
                  <span style={exportPreflightValueStyle}>{formatExportPreflightLabels(exportSummary.emptyLabels)}</span>
                </div>
              )}
            </div>
            <div style={exportStatusStyle(exportStatus.tone)}>
              <div style={exportStatusHeaderStyle}>
                <span>{exportStatus.label}</span>
                <span>{exportStatus.progress}%</span>
              </div>
              <div style={exportStatusTrackStyle}>
                <div style={exportStatusProgressStyle(exportStatus.progress, exportStatus.tone)} />
              </div>
              <div style={exportStatusDetailStyle}>{exportStatus.detail}</div>
            </div>
            {latestExportDownload && (
              <a
                href={latestExportDownload.url}
                download={latestExportDownload.fileName}
                style={exportDownloadLinkStyle}
              >
                下载 {latestExportDownload.label}
              </a>
            )}
            {recentExportRecords.length > 0 && (
              <div style={exportHistoryStyle}>
                <div style={exportHistoryHeaderStyle}>
                  <span>最近导出</span>
                  <span style={exportHistoryHeaderActionsStyle}>
                    <span>保留 {recentExportRecords.length}/3</span>
                    <button type="button" style={exportHistoryClearButtonStyle} onClick={clearExportHistory}>
                      清空
                    </button>
                  </span>
                </div>
                <div style={exportHistoryListStyle}>
                  {recentExportRecords.map((record) => (
                    <div key={record.id} style={exportHistoryItemStyle}>
                      <span style={exportHistoryTitleStyle}>{record.view.title}</span>
                      <span style={exportHistoryDetailStyle}>{record.view.detail}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          )}
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
          <button type="button" onClick={() => void reloadAudioCache()} disabled={loadingCount > 0 || isAudioRetrying} style={inlineRetryButtonStyle}>
            {loadingCount > 0 || isAudioRetrying ? '检查中' : '重试音频'}
          </button>
        </div>
      )}
      {(saveStatus || autoSaveStatus) && (
        <div style={editorStatusToastDockStyle(dawLayoutMetrics)} aria-live="polite">
          {saveStatus && (
            <div style={editorStatusToastStyle('save', saveStatusDismissing)}>
              <span style={editorStatusToastIconStyle('save')}>✓</span>
              <span style={editorStatusToastTextStyle}>{saveStatus}</span>
            </div>
          )}
          {autoSaveStatus && (
            <div style={editorStatusToastStyle('auto', autoSaveStatusDismissing)}>
              <span style={editorStatusToastIconStyle('auto')}>↻</span>
              <span style={editorStatusToastTextStyle}>{autoSaveStatus}</span>
            </div>
          )}
        </div>
      )}
      {playbackError && (
        <div style={playbackErrorToastStyle(dawLayoutMetrics)} aria-live="assertive">
          {playbackError}
        </div>
      )}
      {editorDialog && (
        <div
          role="presentation"
          style={editorDialogOverlayStyle}
          onPointerDown={closeEditorDialog}
        >
          <form
            role="dialog"
            aria-modal="true"
            aria-label={editorDialog.kind === 'rename-track' ? '重命名轨道' : '确认删除'}
            style={editorDialogPanelStyle(editorDialog.kind !== 'rename-track')}
            onPointerDown={(event) => event.stopPropagation()}
            onSubmit={(event) => {
              event.preventDefault();
              confirmEditorDialog();
            }}
          >
            <div style={editorDialogEyebrowStyle}>HookCraft Studio</div>
            <div style={editorDialogTitleStyle}>
              {editorDialog.kind === 'rename-track' ? '重命名轨道' : editorDialog.kind === 'delete-track' ? '删除整条轨道' : '删除片段'}
            </div>
            <div style={editorDialogBodyStyle}>
              {editorDialog.kind === 'rename-track'
                ? `为“${editorDialog.label}”设置一个更清晰的轨道名称。`
                : editorDialog.kind === 'delete-track'
                  ? `确定删除整条轨道“${editorDialog.label}”吗？删除后可以通过“上一步”恢复。`
                  : `确定删除“${editorDialog.label}”在 ${formatStemTimecode(editorDialog.time)} 的片段吗？删除后可以通过“上一步”恢复。`}
            </div>
            {editorDialog.kind === 'rename-track' && (
              <input
                autoFocus
                aria-label="轨道新名称"
                value={editorDialog.value}
                maxLength={40}
                onChange={(event) => setEditorDialog((current) => (
                  current?.kind === 'rename-track'
                    ? { ...current, value: event.target.value }
                    : current
                ))}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') {
                    event.preventDefault();
                    closeEditorDialog();
                  }
                }}
                style={editorDialogInputStyle}
              />
            )}
            <div style={editorDialogActionsStyle}>
              <button type="button" style={editorDialogSecondaryButtonStyle} onClick={closeEditorDialog}>
                取消
              </button>
              <button type="submit" style={editorDialogPrimaryButtonStyle(editorDialog.kind !== 'rename-track')}>
                {editorDialog.kind === 'rename-track' ? '保存名称' : '确认删除'}
              </button>
            </div>
          </form>
        </div>
      )}
      {trackContextMenu && (
        <div
          id="stem-editor-track-menu"
          role="menu"
          aria-label="轨道快捷菜单"
          style={trackContextMenuStyle(trackContextMenu.x, trackContextMenu.y)}
          onPointerDown={(event) => event.stopPropagation()}
          onContextMenu={(event) => event.preventDefault()}
        >
          <button type="button" role="menuitem" disabled={!clipClipboard} style={trackContextMenuItemStyle(!clipClipboard)} onClick={() => performTrackContextMenuAction('paste')}>
            <span>粘贴</span>
            <kbd>Ctrl V</kbd>
          </button>
          <button type="button" role="menuitem" disabled={!trackContextMenu.clipId} style={trackContextMenuItemStyle(!trackContextMenu.clipId)} onClick={() => performTrackContextMenuAction('copy')}>
            <span>复制</span>
            <kbd>Ctrl C</kbd>
          </button>
          <button type="button" role="menuitem" disabled={!trackContextMenu.clipId} style={trackContextMenuItemStyle(!trackContextMenu.clipId)} onClick={() => performTrackContextMenuAction('cut')}>
            <span>剪切</span>
            <kbd>Ctrl X</kbd>
          </button>
          <div style={trackContextMenuDividerStyle} />
          <button type="button" role="menuitem" style={trackContextMenuItemStyle(false)} onClick={() => performTrackContextMenuAction('rename')}>
            <span>重命名轨道</span>
          </button>
          <button type="button" role="menuitem" style={trackContextMenuItemStyle(false)} onClick={() => performTrackContextMenuAction('delete')}>
            <span>{trackContextMenu.clipId ? '删除片段' : '删除轨道'}</span>
            <kbd>Del</kbd>
          </button>
          <button type="button" role="menuitem" style={trackContextMenuItemStyle(false)} onClick={() => performTrackContextMenuAction('color')}>
            <span>编辑轨道颜色</span>
            <kbd>Shift C</kbd>
          </button>
          {trackContextMenu.colorOpen && (
            <div style={trackColorEditorStyle}>
              <div style={trackColorPaletteStyle}>
                {TRACK_COLOR_PALETTE.map((color) => (
                  <button
                    key={color}
                    type="button"
                    aria-label={`选择颜色 ${color}`}
                    style={trackColorSwatchStyle(color, trackContextMenu.colorDraft === color)}
                    onClick={() => {
                      setTrackContextMenu((current) => current ? { ...current, colorDraft: color } : current);
                      setTrackColor(trackContextMenu.trackType, color);
                    }}
                  />
                ))}
              </div>
              <label style={trackColorInputRowStyle}>
                <input
                  type="color"
                  value={trackContextMenu.colorDraft}
                  onChange={(event) => {
                    const color = event.target.value;
                    setTrackContextMenu((current) => current ? { ...current, colorDraft: color } : current);
                    setTrackColor(trackContextMenu.trackType, color);
                  }}
                  style={trackColorInputStyle}
                />
                <input
                  type="text"
                  value={trackContextMenu.colorDraft}
                  onChange={(event) => {
                    const color = event.target.value;
                    setTrackContextMenu((current) => current ? { ...current, colorDraft: color } : current);
                    if (sanitizeTrackColor(color)) setTrackColor(trackContextMenu.trackType, color);
                  }}
                  style={trackColorHexInputStyle}
                />
              </label>
            </div>
          )}
        </div>
      )}

      <div
        id="stem-editor-timeline"
        ref={timelineViewportRef}
        tabIndex={-1}
        aria-label="多轨时间线"
        title="Ctrl+鼠标滚轮缩放波形，Shift+滚轮横向移动"
        style={trackListStyle(trackDensity, dawLayoutMetrics, isTimelinePanning, shouldAllowTimelineHorizontalScroll)}
        onContextMenu={(event) => {
          event.preventDefault();
          closeTrackContextMenu();
        }}
        onDragStart={(event) => event.preventDefault()}
        onPointerDown={handleTimelinePanPointerDown}
        onPointerMove={handleTimelinePanPointerMove}
        onPointerUp={finishTimelinePan}
        onPointerCancel={finishTimelinePan}
      >
        <div
          className="stem-timeline-playhead"
          aria-hidden="true"
          style={timelineGlobalPlayheadStyle(currentTime, duration, timelineLaneWidth, timelineLabelWidth)}
        />
        <div
          className="stem-timeline-playhead-badge"
          aria-hidden="true"
          style={timelineGlobalPlayheadBadgeStyle(currentTime, duration, timelineLaneWidth, timelineLabelWidth)}
        >
          {formatStemTimecode(currentTime)}
        </div>
        <div className="stem-timeline-toolbar" style={timelineToolbarStyle(dawLayoutMetrics, timelineViewportWidth)} data-timeline-pan-zone="true" title="拖动空白处移动时间线视野">
          <div>
            <div style={timelineToolbarEyebrowStyle}>时间线</div>
            <div style={timelineToolbarTitleStyle}>多轨时间线</div>
          </div>
          <div style={timelineZoomControlsStyle}>
            <button
              type="button"
              disabled={timelineZoom <= MIN_TIMELINE_ZOOM}
              style={timelineZoomButtonStyle(timelineZoom <= MIN_TIMELINE_ZOOM)}
              onClick={() => applyTimelineZoom(timelineZoom - 0.25)}
            >
              -
            </button>
            <span style={timelineZoomValueStyle}>{Math.round(timelineZoom * 100)}%</span>
            <button
              type="button"
              disabled={timelineZoom >= MAX_TIMELINE_ZOOM}
              style={timelineZoomButtonStyle(timelineZoom >= MAX_TIMELINE_ZOOM)}
              onClick={() => applyTimelineZoom(timelineZoom + 0.25)}
            >
              +
            </button>
            <button type="button" style={timelineZoomFitButtonStyle} onClick={() => applyTimelineZoom(MIN_TIMELINE_ZOOM)}>
              适合
            </button>
          </div>
          <div className="stem-timeline-toolbar-strip" style={timelineToolbarStatsStyle}>
            <button
              type="button"
              style={timelineAddTrackButtonStyle}
              onClick={createEmptyCustomTrack}
            >
              添加轨道
            </button>
            <span style={timelineToolbarPillStyle}>显示 {visibleStems.length}/{stems.length}</span>
            <span style={timelineToolbarPillStyle}>时长 {formatStemTimecode(duration)}</span>
            <span style={timelineToolbarPillStyle}>{selectedTrack ? `选中 ${getStemDisplayName(selectedTrack).zh}` : '未选轨道'}</span>
            {selectedTrack && (
              <span style={timelineToolbarPillStyle}>选区 {formatStemTimecode(selectedTrackClipDuration)}</span>
            )}
            {selectedTrack && (
              <span style={timelineToolbarPillStyle}>片段 {selectedTrackClipCount}</span>
            )}
            {selectedTrack && selectedTrackTrimControls && (
              <span style={timelineSelectionActionsStyle}>
                <button
                  type="button"
                  title="跳到当前轨道入点"
                  style={timelineSelectionActionButtonStyle(false)}
                  onClick={() => seekSelectedTrackTrimEdge('start')}
                >
                  入点
                </button>
                <button
                  type="button"
                  title="[ 把入点设到当前播放头"
                  style={timelineSelectionActionButtonStyle(false)}
                  onClick={() => setSelectedTrackTrimToCurrentTime('start')}
                >
                  设入
                </button>
                <button
                  type="button"
                  title="跳到当前轨道出点"
                  style={timelineSelectionActionButtonStyle(false)}
                  onClick={() => seekSelectedTrackTrimEdge('end')}
                >
                  出点
                </button>
                <button
                  type="button"
                  title="] 把出点设到当前播放头"
                  style={timelineSelectionActionButtonStyle(false)}
                  onClick={() => setSelectedTrackTrimToCurrentTime('end')}
                >
                  设出
                </button>
                <button
                  type="button"
                  title="Shift+R 恢复当前轨道选区为整首全长"
                  style={timelineSelectionActionButtonStyle(false)}
                  onClick={resetSelectedTrackTrimRange}
                >
                  全长
                </button>
                <button
                  type="button"
                  title="Shift+F 聚焦当前选区"
                  style={timelineSelectionActionButtonStyle(false)}
                  onClick={focusSelectedTrackRange}
                >
                  聚焦
                </button>
                <button
                  type="button"
                  disabled={!selectedTrackBuffer}
                  title="P 预听当前选区"
                  style={timelineSelectionActionButtonStyle(!selectedTrackBuffer)}
                  onClick={previewSelectedTrackRange}
                >
                  预听
                </button>
                <button
                  type="button"
                  disabled={duration <= 0}
                  title="在播放头位置切分当前片段"
                  style={timelineSelectionActionButtonStyle(duration <= 0)}
                  onClick={splitSelectedTrackClipAtPlayhead}
                >
                  切分
                </button>
                <button
                  type="button"
                  disabled={duration <= 0 || selectedTrackClipCount === 0}
                  title="删除当前选中片段"
                  style={timelineSelectionActionButtonStyle(duration <= 0 || selectedTrackClipCount === 0)}
                  onClick={deleteSelectedClipOrActiveTrackClip}
                >
                  删除
                </button>
                <button
                  type="button"
                  aria-pressed={loopSelectionPreview}
                  title="L 开关循环预听"
                  style={timelineSelectionLoopButtonStyle(loopSelectionPreview)}
                  onClick={toggleLoopSelectionPreview}
                >
                  循环 {loopSelectionPreview ? '开' : '关'}
                </button>
              </span>
            )}
            <button
              type="button"
              aria-pressed={showShortcutHelp}
              title="? 显示或隐藏快捷键"
              onClick={() => setShowShortcutHelp((value) => !value)}
              style={timelineHelpButtonStyle(showShortcutHelp)}
            >
              快捷键
            </button>
            <button
              type="button"
              onClick={() => centerTimelineOnPlaybackPosition()}
              style={timelineLocateButtonStyle}
            >
              定位播放头
            </button>
            <button
              type="button"
              aria-pressed={followPlayhead}
              onClick={() => setFollowPlayhead((value) => !value)}
              style={timelineFollowButtonStyle(followPlayhead)}
            >
              跟随播放头
            </button>
            <button
              type="button"
              aria-pressed={snapToGrid}
              title="G 开关网格吸附"
              onClick={() => setSnapToGrid((value) => {
                const next = !value;
                setSaveStatus(next ? `网格吸附已开启，步长 ${snapStepSeconds}s。` : '网格吸附已关闭。');
                return next;
              })}
              style={timelineFollowButtonStyle(snapToGrid)}
            >
              网格 {snapToGrid ? '开' : '关'}
            </button>
            <button
              type="button"
              aria-pressed={magnetSnap}
              title="片段边缘靠近时自动贴合"
              onClick={() => setMagnetSnap((value) => {
                const next = !value;
                setSaveStatus(next ? '片段磁吸已开启。' : '片段磁吸已关闭。');
                return next;
              })}
              style={timelineFollowButtonStyle(magnetSnap)}
            >
              磁吸 {magnetSnap ? '开' : '关'}
            </button>
          </div>
        </div>
        {showShortcutHelp && (
          <div style={timelineShortcutHelpStyle(dawLayoutMetrics, timelineViewportWidth)}>
            <span><strong>播放</strong> 空格 / Esc / P / L</span>
            <span><strong>选轨</strong> ↑ ↓ / M / S / R / Del</span>
            <span><strong>裁剪</strong> [ ] / Shift+[ ] / Shift+R</span>
            <span><strong>时间线</strong> ← → / Shift+← → / G / Shift+G / D / 磁吸按钮 / Alt</span>
            <span><strong>视野</strong> Ctrl+± / Ctrl+0 / Ctrl+滚轮 / Shift+F</span>
            <span><strong>编辑</strong> C / Ctrl+S / Ctrl+Z / Ctrl+Y / Ctrl+C/X/V / Shift+C / X / Shift+X</span>
          </div>
        )}
        <div className="stem-timeline-ruler" style={timelineRulerStyle(timelineGridColumns, timelineMinWidth, dawLayoutMetrics)} data-timeline-pan-zone="true">
          <div style={timelineRulerLabelStyle} data-timeline-pan-zone="true">
            <button
              type="button"
              style={timelineRulerAddTrackButtonStyle}
              onClick={createEmptyCustomTrack}
            >
              + 添加轨道
            </button>
          </div>
          <div
            style={timelineRulerMarksStyle}
            data-timeline-seek-zone="true"
            onPointerDown={handleTimelineRulerPointerDown}
            onPointerMove={handleTimelineRulerPointerMove}
            onPointerUp={handleTimelineRulerPointerUp}
            onPointerCancel={handleTimelineRulerPointerUp}
            onPointerLeave={() => setTimelineRulerGuide(null)}
            title="拖动时间尺定位播放头"
          >
            {selectedTrackTrimControls && duration > 0 && (
              <>
                <span
                  aria-hidden="true"
                  style={timelineSelectedRangeStyle(
                    selectedTrackTrimControls.trimStart,
                    selectedTrackTrimControls.trimEnd,
                    duration,
                  )}
                />
                <span
                  aria-hidden="true"
                  style={timelineSelectedRangeEdgeStyle(selectedTrackTrimControls.trimStart, duration, 'start')}
                />
                <span
                  aria-hidden="true"
                  style={timelineSelectedRangeEdgeStyle(selectedTrackTrimControls.trimEnd, duration, 'end')}
                />
              </>
            )}
            {timelineRulerGuide && (
              <>
                <span aria-hidden="true" style={timelineRulerGuideLineStyle(timelineRulerGuide.ratio, timelineRulerGuide.active)} />
                <span style={timelineRulerGuideBadgeStyle(timelineRulerGuide.ratio, timelineRulerGuide.active)}>
                  {formatStemTimecode(timelineRulerGuide.time)}
                  {timelineRulerGuide.snapBypassed && <em>Alt</em>}
                </span>
              </>
            )}
            {timelineRulerMarks.map((ratio) => {
              const time = Math.max(0, duration * ratio);
              return (
                <span key={ratio} style={timelineRulerMarkStyle(ratio)}>
                  {formatStemTimecode(time)}
                </span>
              );
            })}
          </div>
        </div>
        <div className="stem-timeline-track-body" style={timelineTrackBodyStyle(trackDensity)}>
          {visibleStems.map((stem, index) => {
          const state = tracks[stem.type] || defaultTrackState();
          const trackClipState = resolveTrackClipState(state, duration);
          const displayedClips = clipDragPreview
            ? (() => {
              const withoutSourceClip = stem.type === clipDragPreview.sourceTrackType
                ? trackClipState.clips.filter((clip) => clip.id !== clipDragPreview.clipId)
                : trackClipState.clips;
              return stem.type === clipDragPreview.targetTrackType
                ? [
                  ...withoutSourceClip.filter((clip) => clip.id !== clipDragPreview.previewClipId),
                  clipDragPreview.clip,
                ]
                : withoutSourceClip;
            })()
            : trackClipState.clips;
          const displayedSelectedClipId = clipDragPreview?.targetTrackType === stem.type
            ? clipDragPreview.previewClipId
            : selectedClipSelection?.trackType === stem.type
              ? selectedClipSelection.clipId
              : null;
          const trimEnd = state.trimEnd ?? duration;
          const isAudible = !state.muted && (!hasSoloTrack || state.solo);
          const displayName = getStemDisplayName(stem);
          const isSelectedTrack = selectedTrack?.type === stem.type;
          const trackColor = getTrackColor(stem.type);
          const isTrackCollapsed = state.collapsed === true;
          const firstCopiedSourceType = trackClipState.clips.find((clip) => clip.sourceTrackType)?.sourceTrackType;
          const sourceStemForWaveform = firstCopiedSourceType
            ? stems.find((sourceStem) => sourceStem.type === firstCopiedSourceType)
            : null;
          const audioBuffer = audioBuffersRef.current[stem.type]
            || (firstCopiedSourceType ? audioBuffersRef.current[firstCopiedSourceType] : null)
            || null;
          const isRecordingTarget = isRecording && recordingTrackType === stem.type;
          const waveformForTrack = isRecordingTarget
            ? { duration: Math.max(duration, 1), peaks: recordingTrackWaveform }
            : stem.waveform || sourceStemForWaveform?.waveform || null;
          const audioStatus = resolveStemTrackAudioStatus({
            knownEmpty: stemHasKnownEmptyWaveform(stem),
            loaded: Boolean(audioBuffer),
            loading: loadingStemTypes.has(stem.type),
            failed: failedStemTypes.has(stem.type),
          });
          return (
            <div
              key={`${stem.type}-${stem.url}`}
              ref={(node) => {
                trackRowRefs.current[stem.type] = node;
              }}
              data-track-reorder-type={stem.type}
              data-stem-track-type={stem.type}
              data-timeline-pan-zone="true"
              onClick={() => {
                if (ignoreNextTrackClickRef.current) return;
                setSelectedTrackType(stem.type);
                setSelectedClipSelection(null);
              }}
              onContextMenu={(event) => openTrackContextMenu(event, stem.type, currentTime)}
              style={{
                ...stemTrackStyle(state.solo, showAdvancedControls, isSelectedTrack, trackColor, timelineGridColumns, timelineMinWidth, trackDensity, isTrackCollapsed),
              }}
            >
              <div
                className="stem-track-header"
                style={stemNameStyle(isSelectedTrack, trackColor, isTrackCollapsed)}
                title="点击选择轨道"
                onPointerDown={(event) => handleTrackHeaderPointerDown(event, stem.type)}
                onPointerMove={handleTrackHeaderPointerMove}
                onPointerUp={handleTrackHeaderPointerUp}
                onPointerCancel={handleTrackHeaderPointerUp}
              >
                <span
                  aria-hidden="true"
                  title={stemAudioStatusLabel(audioStatus)}
                  style={stemAudioCornerBadgeStyle(audioStatus)}
                />
                <span style={stemIndexStyle(isSelectedTrack)}>{String(index + 1).padStart(2, '0')}</span>
                <span style={stemColorStyle(trackColor)} />
                <div style={stemIdentityStyle}>
                  <div style={stemTitleRowStyle}>
                    <span style={stemLabelStyle}>{displayName.zh}</span>
                  </div>
                  <div style={stemStatusRowStyle}>
                    <span style={stemTypeStyle}>{displayName.en}</span>
                    {state.solo && <span style={stemStateBadgeStyle('solo')}>独奏</span>}
                    {state.muted && <span style={stemStateBadgeStyle('muted')}>静音</span>}
                    {state.mutedRanges.length > 0 && <span style={stemStateBadgeStyle('range')}>{state.mutedRanges.length} 段</span>}
                  </div>
                </div>
                <div style={trackHeaderSwitchesStyle}>
                  <button
                    type="button"
                    aria-pressed={state.muted}
                    title={state.muted ? '取消静音' : '静音'}
                    onClick={() => toggleTrackFlag(stem.type, 'muted')}
                    style={trackToggleStyle(state.muted, 'mute')}
                  >
                    M
                  </button>
                  <button
                    type="button"
                    aria-pressed={state.solo}
                    title={state.solo ? '取消独奏' : '独奏'}
                    onClick={() => toggleTrackFlag(stem.type, 'solo')}
                    style={trackToggleStyle(state.solo, 'solo')}
                  >
                    S
                  </button>
                  <button
                    type="button"
                    aria-expanded={!isTrackCollapsed}
                    title={isTrackCollapsed ? '展开轨道' : '折叠轨道'}
                    onClick={(event) => {
                      event.stopPropagation();
                      toggleTrackCollapsed(stem.type);
                    }}
                    style={trackCollapseButtonStyle(isTrackCollapsed)}
                  >
                    <TransportIcon name={isTrackCollapsed ? 'chevronDown' : 'chevronRight'} />
                  </button>
                </div>
                {!isTrackCollapsed && (
                  <>
                    <button
                      type="button"
                      title="轨道效果"
                      style={trackFxButtonStyle}
                      onClick={() => {
                        setInspectorTab('mix');
                        setInspectorCollapsed(false);
                        setSaveStatus(`已打开“${displayName.zh}”的混音控制。`);
                      }}
                    >
                      +Fx
                    </button>
                    <div style={trackMiniActionsStyle}>
                      <button
                        type="button"
                        title="导出单轨 WAV"
                        disabled={!audioBuffer || exportingStemType === stem.type}
                        onClick={() => void exportSingleStem(stem)}
                        style={trackMiniActionStyle(Boolean(!audioBuffer || exportingStemType === stem.type))}
                      >
                        {exportingStemType === stem.type ? '...' : 'WAV'}
                      </button>
                      {(audioStatus === 'failed' || audioStatus === 'pending') && (
                        <button
                          type="button"
                          disabled={isAudioRetrying || loadingCount > 0}
                          onClick={() => void retrySingleStemAudio(stem)}
                          style={trackMiniActionStyle(isAudioRetrying || loadingCount > 0)}
                        >
                          重试
                        </button>
                      )}
                    </div>
                    <label style={trackHeaderVolumeStyle}>
                      <span>Vol</span>
                      <input
                        className="stem-track-volume-range"
                        aria-label={`${stem.label} 音量`}
                        type="range"
                        min={0}
                        max={1}
                        step={0.01}
                        value={state.volume}
                        style={{
                          '--stem-track-color': trackColor,
                          '--stem-track-fill': `${state.volume * 100}%`,
                        } as CSSProperties}
                        onFocus={beginContinuousControlEdit}
                        onPointerDown={beginContinuousControlEdit}
                        onPointerUp={finishContinuousControlEdit}
                        onBlur={finishContinuousControlEdit}
                        onKeyUp={finishContinuousControlEdit}
                        onChange={(event) => setTrackVolume(stem.type, Number(event.target.value), 'deferred')}
                      />
                    </label>
                    <label style={trackHeaderPanStyle}>
                      <span>L</span>
                      <input
                        className="stem-track-pan-range"
                        aria-label={`${stem.label} 声像`}
                        type="range"
                        min={-1}
                        max={1}
                        step={0.01}
                        value={state.pan}
                        style={{
                          '--stem-track-color': trackColor,
                          '--stem-track-fill': `${((state.pan + 1) / 2) * 100}%`,
                        } as CSSProperties}
                        onFocus={beginContinuousControlEdit}
                        onPointerDown={beginContinuousControlEdit}
                        onPointerUp={finishContinuousControlEdit}
                        onBlur={finishContinuousControlEdit}
                        onKeyUp={finishContinuousControlEdit}
                        onChange={(event) => setTrackPan(stem.type, Number(event.target.value), 'deferred')}
                      />
                      <span>R</span>
                    </label>
                  </>
                )}
              </div>

              <WaveformTrackCanvas
                buffer={audioBuffer}
                waveform={waveformForTrack}
                color={trackColor}
                currentTime={currentTime}
                duration={duration}
                trimStart={state.trimStart}
                trimEnd={trimEnd}
                clips={displayedClips}
                mutedRanges={state.mutedRanges}
                muted={!isAudible}
                selected={isSelectedTrack}
                editable
                snapEnabled={snapToGrid}
                snapStepSeconds={snapStepSeconds}
                bufferVersion={bufferVersion}
                liveSeekOnDrag={!isPlaying}
                seekOnClipClick={!isPlaying}
                trackType={stem.type}
                clipWaveformSources={clipWaveformSources}
                compact={trackDensity === 'compact'}
                collapsed={isTrackCollapsed}
                recording={isRecordingTarget}
                trackLabel={displayName.zh}
                selectedClipId={displayedSelectedClipId}
                onSelect={() => {
                  setSelectedTrackType(stem.type);
                  setSelectedClipSelection(null);
                }}
                onClipSelect={(clipId) => {
                  setSelectedTrackType(stem.type);
                  setSelectedClipSelection({ trackType: stem.type, clipId });
                }}
                onTrackContextMenu={(event, time) => openTrackContextMenu(event, stem.type, time)}
                onSeek={(time, shouldSnap) => handleSeek(snapStemEditorTime(time, duration, shouldSnap, snapStepSeconds))}
                onTrimChange={(edge, time, shouldSnap, phase, clipId) => {
                  if (clipId) {
                    setTrackClipTrim(stem.type, clipId, edge, time, shouldSnap, 'deferred');
                  } else {
                    setTrackTrim(stem.type, edge, time, shouldSnap, 'deferred');
                  }
                  if (phase === 'commit') commitDeferredHistory();
                }}
                onTrimRangeMove={(nextStart, shouldSnap, phase) => {
                  setTrackTrimRange(stem.type, nextStart, shouldSnap, 'deferred');
                  if (phase === 'commit') commitDeferredHistory();
                }}
                onClipMove={(clipId, nextStart, shouldSnap, phase, clientX, clientY) => {
                  if (phase === 'preview') {
                    previewTrackClipMove(stem.type, clipId, nextStart, shouldSnap, clientX, clientY);
                    return;
                  }
                  moveTrackClip(stem.type, clipId, nextStart, shouldSnap, 'deferred', clientX, clientY);
                  commitDeferredHistory();
                }}
              />

            </div>
          );
          })}
          <div style={timelineAddTrackRowStyle}>
            <button
              type="button"
              className="stem-add-track-dropzone"
              aria-label="添加轨道"
              title="点击添加一条空轨道"
              style={trackAddDropzoneButtonStyle}
              onClick={createEmptyCustomTrack}
            >
              <span style={trackAddDropzoneIconStyle}>+♫</span>
              <span style={trackAddDropzoneTextStyle}>点击添加空轨道</span>
            </button>
          </div>
          {visibleStems.length === 0 && (
            <div style={emptyTrackNoticeStyle}>
              当前筛选下没有可显示的轨道，可以切回“全部”查看完整分轨列表。
            </div>
          )}
        </div>
        {timelineScrollState.canScroll && (
          <div
            style={timelineScrollProgressStyle(dawLayoutMetrics)}
            onPointerDown={handleTimelineNavigatorPointerDown}
            onPointerMove={handleTimelineNavigatorPointerMove}
            title="拖动快速移动时间线视野"
          >
            <div style={timelineScrollThumbStyle(timelineScrollState.progress, timelineScrollState.viewRatio)} />
          </div>
        )}
      </div>
    </section>
  );
}

function editorStyle(metrics: DawEditorLayoutMetrics): CSSProperties {
  return {
    position: 'relative',
    width: '100%',
    maxWidth: '100%',
    minHeight: '100vh',
    boxSizing: 'border-box',
    marginTop: 0,
    borderRadius: 0,
    border: 'none',
    background: `
      linear-gradient(180deg, rgba(13, 18, 27, 0.99), rgba(4, 8, 14, 0.99)),
      linear-gradient(90deg, rgba(18, 24, 35, 0.72), transparent 38%)
    `,
    padding: `${metrics.headerHeight + 8}px 12px ${metrics.bottomTransportHeight + 42}px ${metrics.sideRailWidth + 8}px`,
    display: 'grid',
    gridTemplateColumns: `minmax(0, 1fr) ${metrics.inspectorWidth}px`,
    gridAutoFlow: 'row dense',
    gap: 10,
    alignItems: 'start',
    overflowX: 'hidden',
    userSelect: 'none',
    WebkitUserSelect: 'none',
    WebkitTouchCallout: 'none',
  };
}

const timelineScrollbarCss = `
  #stem-editor-timeline {
    scrollbar-width: none;
  }

  #stem-editor-timeline::-webkit-scrollbar {
    width: 0;
    height: 0;
    display: none;
  }

  #stem-editor-timeline::-webkit-scrollbar-button {
    display: none;
    width: 0;
    height: 0;
  }

  #stem-editor-timeline::-webkit-scrollbar-corner {
    background: rgba(7, 10, 18, 0.98);
  }

  html:has(.stem-mixer-editor),
  body:has(.stem-mixer-editor),
  .stem-timeline-track-body,
  .stem-editor-vertical-scroll {
    scrollbar-width: thin;
    scrollbar-color: rgba(87, 219, 199, 0.88) rgba(5, 9, 16, 0.92);
  }

  html:has(.stem-mixer-editor)::-webkit-scrollbar,
  body:has(.stem-mixer-editor)::-webkit-scrollbar,
  .stem-timeline-track-body::-webkit-scrollbar,
  .stem-editor-vertical-scroll::-webkit-scrollbar {
    width: 12px;
    height: 12px;
  }

  html:has(.stem-mixer-editor)::-webkit-scrollbar-track,
  body:has(.stem-mixer-editor)::-webkit-scrollbar-track,
  .stem-timeline-track-body::-webkit-scrollbar-track,
  .stem-editor-vertical-scroll::-webkit-scrollbar-track {
    border-radius: 999px;
    background:
      linear-gradient(180deg, rgba(15, 20, 32, 0.98), rgba(4, 8, 14, 0.98)),
      radial-gradient(circle at 50% 0%, rgba(206, 255, 53, 0.12), transparent 38%);
    box-shadow:
      inset 0 0 0 1px rgba(48, 52, 76, 0.72),
      inset 0 0 18px rgba(0, 0, 0, 0.35);
  }

  html:has(.stem-mixer-editor)::-webkit-scrollbar-thumb,
  body:has(.stem-mixer-editor)::-webkit-scrollbar-thumb,
  .stem-timeline-track-body::-webkit-scrollbar-thumb,
  .stem-editor-vertical-scroll::-webkit-scrollbar-thumb {
    min-height: 52px;
    border: 3px solid rgba(5, 9, 16, 0.96);
    border-radius: 999px;
    background:
      linear-gradient(180deg, #cfff35 0%, #72e486 45%, #57dbc7 100%);
    box-shadow:
      0 0 16px rgba(87, 219, 199, 0.28),
      inset 0 0 0 1px rgba(255, 255, 255, 0.24);
  }

  html:has(.stem-mixer-editor)::-webkit-scrollbar-thumb:hover,
  body:has(.stem-mixer-editor)::-webkit-scrollbar-thumb:hover,
  .stem-timeline-track-body::-webkit-scrollbar-thumb:hover,
  .stem-editor-vertical-scroll::-webkit-scrollbar-thumb:hover {
    background:
      linear-gradient(180deg, #ddff57 0%, #8ef59c 46%, #62efe0 100%);
  }

  html:has(.stem-mixer-editor)::-webkit-scrollbar-button,
  body:has(.stem-mixer-editor)::-webkit-scrollbar-button,
  .stem-timeline-track-body::-webkit-scrollbar-button,
  .stem-editor-vertical-scroll::-webkit-scrollbar-button {
    display: none;
    width: 0;
    height: 0;
  }

  html:has(.stem-mixer-editor)::-webkit-scrollbar-corner,
  body:has(.stem-mixer-editor)::-webkit-scrollbar-corner,
  .stem-timeline-track-body::-webkit-scrollbar-corner,
  .stem-editor-vertical-scroll::-webkit-scrollbar-corner {
    background: rgba(5, 9, 16, 0.98);
  }

  @media (max-width: 920px) {
    .stem-mixer-editor {
      grid-template-columns: 1fr !important;
      padding: 118px 10px 112px !important;
    }

    .stem-mixer-editor-header {
      grid-template-columns: 1fr !important;
      align-items: start !important;
      gap: 8px !important;
      min-height: 110px !important;
      padding: 10px 12px 9px !important;
    }

    .stem-mixer-editor-header-primary {
      width: 100% !important;
      gap: 10px !important;
      flex-wrap: wrap !important;
    }

    .stem-mixer-editor-header-primary > a {
      min-width: 148px !important;
      padding-right: 10px !important;
    }

    .stem-mixer-editor-actions {
      width: 100% !important;
      justify-content: flex-start !important;
      flex-wrap: nowrap !important;
      overflow-x: auto !important;
      padding-bottom: 2px !important;
      scrollbar-width: none;
    }

    .stem-mixer-editor-actions::-webkit-scrollbar {
      display: none;
    }

    .stem-timeline-toolbar {
      top: 0 !important;
      grid-template-columns: minmax(0, 1fr) !important;
      gap: 6px !important;
      min-height: 82px !important;
      align-content: center !important;
    }

    .stem-timeline-toolbar-strip {
      grid-column: 1 / -1 !important;
      justify-content: flex-start !important;
      overflow-x: auto !important;
      flex-wrap: nowrap !important;
      scrollbar-width: none;
    }

    .stem-timeline-toolbar-strip::-webkit-scrollbar {
      display: none;
    }

    #stem-editor-timeline {
      position: relative !important;
      top: auto !important;
      left: auto !important;
      right: auto !important;
      bottom: auto !important;
      height: auto !important;
      max-height: none !important;
    }

    .stem-timeline-track-body {
      max-height: none !important;
      overflow-y: visible !important;
    }

    .stem-timeline-ruler {
      top: 0 !important;
    }

    .stem-timeline-playhead {
      top: 150px !important;
    }

    .stem-timeline-playhead-badge {
      top: 130px !important;
    }

    .stem-editor-inspector-dock {
      position: static !important;
      top: auto !important;
      right: auto !important;
      bottom: auto !important;
      width: auto !important;
      max-width: 100% !important;
      max-height: none !important;
      grid-column: 1 / -1 !important;
      z-index: auto !important;
    }
  }

  .stem-timeline-toolbar-strip::-webkit-scrollbar {
    display: none;
  }

  #stem-editor-timeline .stem-add-track-dropzone:hover,
  #stem-editor-timeline .stem-add-track-dropzone:focus-visible {
    border-color: rgba(190, 232, 95, 0.5) !important;
    background: rgba(18, 24, 34, 0.74) !important;
    color: #f4f7ff !important;
    outline: none;
  }

  #stem-editor-timeline .stem-add-track-dropzone:active {
    transform: none;
  }

  #stem-editor-timeline .stem-track-volume-range,
  #stem-editor-timeline .stem-track-pan-range {
    height: 12px;
    cursor: pointer;
    accent-color: var(--stem-track-color, #1493ff);
    -webkit-appearance: none;
    appearance: none;
    background: transparent;
  }

  #stem-editor-timeline .stem-track-volume-range::-webkit-slider-runnable-track,
  #stem-editor-timeline .stem-track-pan-range::-webkit-slider-runnable-track {
    height: 3px;
    border-radius: 999px;
    background: linear-gradient(90deg, var(--stem-track-color, #148bff) 0%, var(--stem-track-color, #148bff) var(--stem-track-fill, 50%), rgba(255, 255, 255, 0.84) var(--stem-track-fill, 50%), rgba(255, 255, 255, 0.84) 100%);
    box-shadow: inset 0 0 0 1px rgba(6, 12, 24, 0.22);
  }

  #stem-editor-timeline .stem-track-volume-range::-webkit-slider-thumb,
  #stem-editor-timeline .stem-track-pan-range::-webkit-slider-thumb {
    width: 11px;
    height: 11px;
    margin-top: -4px;
    border: 0;
    border-radius: 999px;
    background: var(--stem-track-color, #0f8cff);
    box-shadow: 0 0 0 1px rgba(2, 8, 20, 0.55), 0 3px 8px color-mix(in srgb, var(--stem-track-color, #0f8cff) 36%, transparent);
    -webkit-appearance: none;
    appearance: none;
  }

  #stem-editor-timeline .stem-track-volume-range::-moz-range-track,
  #stem-editor-timeline .stem-track-pan-range::-moz-range-track {
    height: 3px;
    border: 0;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.84);
  }

  #stem-editor-timeline .stem-track-volume-range::-moz-range-progress,
  #stem-editor-timeline .stem-track-pan-range::-moz-range-progress {
    height: 3px;
    border-radius: 999px;
    background: var(--stem-track-color, #148bff);
  }

  #stem-editor-timeline .stem-track-volume-range::-moz-range-thumb,
  #stem-editor-timeline .stem-track-pan-range::-moz-range-thumb {
    width: 11px;
    height: 11px;
    border: 0;
    border-radius: 999px;
    background: var(--stem-track-color, #0f8cff);
    box-shadow: 0 0 0 1px rgba(2, 8, 20, 0.55), 0 3px 8px rgba(15, 140, 255, 0.2);
  }

  #stem-editor-timeline .stem-track-header::before {
    content: "";
    position: absolute;
    top: 0;
    bottom: 0;
    left: -24px;
    width: 24px;
    background: linear-gradient(90deg, rgba(5, 8, 14, 0.99), rgba(13, 17, 22, 0.98));
    box-shadow: -1px 0 0 rgba(48, 52, 76, 0.48), 8px 0 18px rgba(3, 6, 12, 0.42);
    pointer-events: none;
  }

  #stem-editor-track-menu kbd {
    color: #d7dbea;
    font: inherit;
    font-size: 12px;
    font-weight: 850;
  }
`;

type EditorButtonTone = 'neutral' | 'primary' | 'info' | 'success' | 'warning' | 'danger' | 'purple';

function editorButtonChromeStyle({
  tone = 'neutral',
  active = false,
  disabled = false,
  compact = false,
  round = false,
}: {
  tone?: EditorButtonTone;
  active?: boolean;
  disabled?: boolean;
  compact?: boolean;
  round?: boolean;
} = {}): CSSProperties {
  const palette: Record<EditorButtonTone, {
    border: string;
    background: string;
    activeBackground: string;
    color: string;
    activeColor: string;
    glow: string;
  }> = {
    neutral: {
      border: 'rgba(94, 102, 132, 0.36)',
      background: 'rgba(21, 26, 38, 0.92)',
      activeBackground: 'rgba(44, 52, 72, 0.92)',
      color: '#c9cedd',
      activeColor: '#f4f6fb',
      glow: 'rgba(148, 163, 184, 0.08)',
    },
    primary: {
      border: 'rgba(190, 232, 95, 0.56)',
      background: 'rgba(190, 232, 95, 0.9)',
      activeBackground: 'rgba(205, 244, 116, 0.96)',
      color: '#0b1113',
      activeColor: '#07100b',
      glow: 'rgba(190, 232, 95, 0.12)',
    },
    purple: {
      border: 'rgba(151, 165, 196, 0.32)',
      background: 'rgba(27, 33, 48, 0.9)',
      activeBackground: 'rgba(74, 86, 116, 0.88)',
      color: '#cfd7ec',
      activeColor: '#f7f9ff',
      glow: 'rgba(151, 165, 196, 0.1)',
    },
    info: {
      border: 'rgba(122, 167, 255, 0.42)',
      background: 'rgba(31, 49, 78, 0.78)',
      activeBackground: 'rgba(64, 101, 158, 0.86)',
      color: '#d8e5ff',
      activeColor: '#f8fbff',
      glow: 'rgba(122, 167, 255, 0.1)',
    },
    success: {
      border: 'rgba(79, 214, 177, 0.42)',
      background: 'rgba(26, 69, 62, 0.76)',
      activeBackground: 'rgba(52, 121, 104, 0.86)',
      color: '#c8f7e8',
      activeColor: '#f2fffa',
      glow: 'rgba(79, 214, 177, 0.1)',
    },
    warning: {
      border: 'rgba(222, 178, 86, 0.44)',
      background: 'rgba(74, 56, 30, 0.78)',
      activeBackground: 'rgba(128, 91, 40, 0.86)',
      color: '#f2dfb2',
      activeColor: '#fff8e7',
      glow: 'rgba(222, 178, 86, 0.1)',
    },
    danger: {
      border: 'rgba(255, 107, 122, 0.44)',
      background: 'rgba(82, 36, 46, 0.78)',
      activeBackground: 'rgba(143, 62, 74, 0.86)',
      color: '#ffd0d6',
      activeColor: '#fff5f6',
      glow: 'rgba(255, 107, 122, 0.1)',
    },
  };
  const colors = palette[tone];

  return {
    minHeight: compact ? 24 : 32,
    borderRadius: round ? 999 : 8,
    border: `1px solid ${disabled ? 'rgba(48, 52, 76, 0.72)' : colors.border}`,
    background: disabled ? 'rgba(20, 24, 34, 0.64)' : active ? colors.activeBackground : colors.background,
    color: disabled ? '#62687c' : active ? colors.activeColor : colors.color,
    boxShadow: disabled
      ? 'none'
      : active
        ? `0 0 0 1px ${colors.glow}`
        : 'none',
    textShadow: 'none',
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'border-color 140ms ease, background 140ms ease, color 140ms ease',
    whiteSpace: 'nowrap',
  };
}

const editorHeaderStyle: CSSProperties = {
  gridColumn: '1 / -1',
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  zIndex: 20,
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) auto',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  minWidth: 0,
  minHeight: 72,
  padding: '9px 18px 9px 22px',
  borderRadius: 0,
  borderBottom: '1px solid rgba(48, 52, 76, 0.72)',
  background: 'linear-gradient(180deg, rgba(13, 19, 29, 0.98), rgba(7, 11, 19, 0.96))',
  boxShadow: '0 10px 26px rgba(0, 0, 0, 0.26)',
};

const editorHeaderPrimaryStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 18,
  minWidth: 0,
};

const editorHeaderSecondaryStyle: CSSProperties = {
  display: 'none',
};

const editorBrandStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minWidth: 172,
  paddingRight: 20,
  borderRight: '1px solid rgba(48, 52, 76, 0.72)',
  textDecoration: 'none',
  flex: '0 0 auto',
};

const editorProjectTitleStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 7,
  minWidth: 0,
  color: '#f4f4fb',
  fontSize: 17,
  fontWeight: 900,
  whiteSpace: 'nowrap',
};

const editorHeaderFactsStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 7,
  minWidth: 0,
  overflow: 'hidden',
};

function editorHeaderFactStyle(tone: 'project' | 'neutral' | 'ready' | 'loading' | 'snap'): CSSProperties {
  const palette: Record<typeof tone, { border: string; background: string; color: string }> = {
    project: {
      border: 'rgba(206, 255, 53, 0.34)',
      background: 'rgba(206, 255, 53, 0.1)',
      color: '#eaff9e',
    },
    neutral: {
      border: 'rgba(48, 52, 76, 0.78)',
      background: 'rgba(15, 18, 32, 0.68)',
      color: '#aeb2c9',
    },
    ready: {
      border: 'rgba(52, 211, 153, 0.36)',
      background: 'rgba(16, 185, 129, 0.12)',
      color: '#a7f3d0',
    },
    loading: {
      border: 'rgba(96, 165, 250, 0.38)',
      background: 'rgba(37, 99, 235, 0.12)',
      color: '#bfdbfe',
    },
    snap: {
      border: 'rgba(251, 191, 36, 0.38)',
      background: 'rgba(251, 191, 36, 0.12)',
      color: '#fde68a',
    },
  };

  return {
    minHeight: 24,
    maxWidth: tone === 'project' ? 190 : 132,
    display: 'inline-flex',
    alignItems: 'center',
    borderRadius: 999,
    border: `1px solid ${palette[tone].border}`,
    background: palette[tone].background,
    color: palette[tone].color,
    padding: '0 9px',
    fontSize: 11,
    fontWeight: 850,
    lineHeight: 1,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    flex: tone === 'project' ? '1 1 128px' : '0 1 auto',
  };
}

const editorStatusClusterStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 12,
  color: '#9ca3af',
  fontSize: 12,
  fontVariantNumeric: 'tabular-nums',
  whiteSpace: 'nowrap',
};

const editorActionStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: 8,
  flexWrap: 'wrap',
  minWidth: 0,
};

const primarySmallButtonStyle: CSSProperties = {
  ...editorButtonChromeStyle({ tone: 'primary' }),
  minHeight: 32,
  padding: '6px 11px',
  fontSize: 12,
  fontWeight: 900,
};

const hiddenFileInputStyle: CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  opacity: 0,
  pointerEvents: 'none',
};

const editorEyebrowRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: 8,
};

const editorEyebrowStyle: CSSProperties = {
  color: '#8f92aa',
  fontSize: 11,
  fontWeight: 700,
};

const editorModeBadgeStyle: CSSProperties = {
  borderRadius: 999,
  border: '1px solid rgba(45, 212, 191, 0.36)',
  background: 'rgba(20, 184, 166, 0.12)',
  color: '#99f6e4',
  padding: '2px 8px',
  fontSize: 10,
  fontWeight: 900,
  letterSpacing: 0,
  textTransform: 'uppercase',
};

function saveBadgeStyle(tone: StemEditSaveBadgeTone): CSSProperties {
  const palette: Record<StemEditSaveBadgeTone, { border: string; background: string; color: string }> = {
    idle: {
      border: 'rgba(148, 163, 184, 0.32)',
      background: 'rgba(148, 163, 184, 0.1)',
      color: '#cbd5e1',
    },
    pending: {
      border: 'rgba(250, 204, 21, 0.45)',
      background: 'rgba(113, 63, 18, 0.28)',
      color: '#fde68a',
    },
    saving: {
      border: 'rgba(96, 165, 250, 0.5)',
      background: 'rgba(30, 64, 175, 0.24)',
      color: '#bfdbfe',
    },
    saved: {
      border: 'rgba(74, 222, 128, 0.38)',
      background: 'rgba(20, 83, 45, 0.24)',
      color: '#bbf7d0',
    },
    error: {
      border: 'rgba(248, 113, 113, 0.5)',
      background: 'rgba(127, 29, 29, 0.28)',
      color: '#fecaca',
    },
  };

  return {
    border: `1px solid ${palette[tone].border}`,
    background: palette[tone].background,
    color: palette[tone].color,
    borderRadius: 999,
    padding: '2px 8px',
    fontSize: 11,
    fontWeight: 900,
    lineHeight: 1.45,
    whiteSpace: 'nowrap',
  };
}

const editorTitleStyle: CSSProperties = {
  margin: 0,
  color: '#f4f4fb',
  fontSize: 17,
  fontWeight: 900,
};

const editorProjectMetaStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: 7,
  marginTop: 7,
  color: '#9ca3af',
  fontSize: 11,
  fontWeight: 800,
};

const ghostButtonStyle: CSSProperties = {
  ...editorButtonChromeStyle({ tone: 'neutral' }),
  minHeight: 32,
  padding: '6px 11px',
  fontSize: 12,
  fontWeight: 850,
};

function historyButtonStyle(enabled: boolean): CSSProperties {
  return {
    ...ghostButtonStyle,
    opacity: enabled ? 1 : 0.45,
    cursor: enabled ? 'pointer' : 'not-allowed',
  };
}

const workbenchTopStyle: CSSProperties = {
  display: 'contents',
};

function transportPanelStyle(compactTransport: boolean): CSSProperties {
  return {
    gridColumn: '1 / -1',
    order: 5,
    position: 'fixed',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 40,
    borderRadius: 0,
    border: 'none',
    borderTop: '1px solid rgba(48, 52, 76, 0.86)',
    background: 'linear-gradient(180deg, rgba(15, 20, 30, 0.98), rgba(7, 11, 18, 0.99))',
    boxShadow: '0 -18px 44px rgba(0, 0, 0, 0.45)',
    padding: compactTransport ? '12px 22px' : '12px 22px 14px',
    minWidth: 0,
    maxWidth: '100vw',
    boxSizing: 'border-box',
    overflowX: 'hidden',
    backdropFilter: 'blur(18px)',
  };
}

const transportStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(240px, 340px) 116px minmax(220px, 1fr) 84px',
  gap: 14,
  alignItems: 'center',
};

const transportButtonGroupStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  flexWrap: 'nowrap',
  gap: 5,
  minWidth: 0,
  padding: 4,
  borderRadius: 12,
  border: '1px solid rgba(48, 52, 76, 0.78)',
  background: 'linear-gradient(180deg, rgba(18, 23, 38, 0.9), rgba(7, 9, 18, 0.82))',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
};

const playButtonStyle: CSSProperties = {
  ...editorButtonChromeStyle({ tone: 'primary', round: true, active: true }),
  minHeight: 38,
  minWidth: 46,
  border: '1px solid rgba(190, 232, 95, 0.66)',
  background: '#bee85f',
  color: '#08100c',
  padding: 0,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 13,
  fontWeight: 900,
  boxShadow: 'none',
  textShadow: 'none',
};

function transportIconButtonStyle(disabled: boolean): CSSProperties {
  return {
    ...editorButtonChromeStyle({ tone: 'neutral', compact: false, disabled }),
    position: 'relative',
    minWidth: 34,
    minHeight: 34,
    padding: 0,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 11,
    fontWeight: 900,
    fontVariantNumeric: 'tabular-nums',
    whiteSpace: 'nowrap',
  };
}

const transportNudgeBadgeStyle: CSSProperties = {
  position: 'absolute',
  right: 3,
  bottom: 2,
  color: '#aeb4c8',
  fontSize: 8,
  fontWeight: 900,
  lineHeight: 1,
  pointerEvents: 'none',
};

const transportEditBarStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: 6,
  marginTop: 7,
  paddingTop: 7,
  borderTop: '1px solid rgba(48, 52, 76, 0.56)',
};

const transportEditLabelStyle: CSSProperties = {
  maxWidth: 180,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  color: '#e8e6ff',
  fontSize: 11,
  fontWeight: 900,
};

function transportEditButtonStyle(disabled: boolean): CSSProperties {
  return {
    ...editorButtonChromeStyle({ tone: 'purple', compact: true, round: true, disabled }),
    minHeight: 24,
    padding: '0 9px',
    fontSize: 11,
    fontWeight: 900,
  };
}

function transportLoopButtonStyle(active: boolean): CSSProperties {
  return {
    ...editorButtonChromeStyle({ tone: active ? 'success' : 'purple', compact: true, round: true, active }),
    minHeight: 24,
    padding: '0 9px',
    fontSize: 11,
    fontWeight: 900,
  };
}

const transportOptionBarStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: 6,
  marginTop: 6,
};

function transportOptionButtonStyle(active: boolean, disabled: boolean): CSSProperties {
  return {
    ...editorButtonChromeStyle({ tone: active ? 'success' : 'info', compact: true, round: true, active, disabled }),
    minHeight: 24,
    padding: '0 9px',
    fontSize: 11,
    fontWeight: 900,
  };
}

const timeStyle: CSSProperties = {
  color: '#cfd0dc',
  fontSize: 12,
  fontVariantNumeric: 'tabular-nums',
  textAlign: 'center',
};

const timeInputStyle: CSSProperties = {
  width: '100%',
  minHeight: 30,
  borderRadius: 7,
  border: '1px solid rgba(48, 52, 76, 0.9)',
  background: '#0f1220',
  color: '#f4f4fb',
  padding: '4px 6px',
  fontSize: 12,
  fontWeight: 800,
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
  marginTop: 7,
  color: '#9ca3af',
  fontSize: 11,
};

const readinessDockStyle: CSSProperties = {
  gridColumn: '1 / -1',
  order: 2,
  minWidth: 0,
  display: 'none',
};

function readinessPanelStyle(level: StemEditorReadinessLevel): CSSProperties {
  const palette: Record<StemEditorReadinessLevel, { border: string; background: string }> = {
    ready: {
      border: '1px solid rgba(34, 197, 94, 0.28)',
      background: 'rgba(22, 163, 74, 0.1)',
    },
    loading: {
      border: '1px solid rgba(96, 165, 250, 0.28)',
      background: 'rgba(37, 99, 235, 0.1)',
    },
    attention: {
      border: '1px solid rgba(251, 191, 36, 0.3)',
      background: 'rgba(217, 119, 6, 0.1)',
    },
    blocked: {
      border: '1px solid rgba(248, 113, 113, 0.3)',
      background: 'rgba(185, 28, 28, 0.11)',
    },
  };

  return {
    marginTop: 8,
    borderRadius: 10,
    ...palette[level],
    padding: '8px 10px',
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) auto',
    gap: 12,
    alignItems: 'center',
  };
}

const readinessTitleStyle: CSSProperties = {
  color: '#f0f1fb',
  fontSize: 13,
  fontWeight: 900,
};

const readinessDetailStyle: CSSProperties = {
  color: '#aeb2c9',
  fontSize: 11,
  marginTop: 3,
  lineHeight: 1.45,
};

const readinessMetricsStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  justifyContent: 'flex-end',
  gap: 6,
};

const readinessMetricStyle: CSSProperties = {
  borderRadius: 999,
  border: '1px solid rgba(148, 163, 184, 0.24)',
  background: 'rgba(15, 18, 32, 0.72)',
  color: '#d7d9e8',
  padding: '3px 8px',
  fontSize: 11,
  fontWeight: 800,
  whiteSpace: 'nowrap',
};

function controlGridStyle(collapsed: boolean, metrics: DawEditorLayoutMetrics): CSSProperties {
  return {
    order: 4,
    gridColumn: '2',
    position: 'fixed',
    top: metrics.headerHeight + 10,
    right: 12,
    bottom: metrics.bottomTransportHeight + 16,
    width: metrics.inspectorWidth,
    zIndex: 42,
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr)',
    alignContent: 'start',
    gap: 10,
    minWidth: 0,
    maxWidth: `calc(100vw - ${metrics.sideRailWidth + 28}px)`,
    boxSizing: 'border-box',
    overflowY: 'auto',
    overflowX: 'hidden',
    paddingRight: collapsed ? 0 : 3,
    paddingBottom: 8,
  };
}

function inspectorHeaderStyle(collapsed: boolean): CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    justifyContent: collapsed ? 'center' : 'space-between',
    flexDirection: collapsed ? 'column' : 'row',
    gap: collapsed ? 6 : 10,
    minHeight: collapsed ? 104 : 46,
    padding: collapsed ? '9px 6px' : '8px 10px',
    borderRadius: 8,
    border: '1px solid rgba(48, 52, 76, 0.74)',
    background: 'linear-gradient(180deg, rgba(15, 18, 32, 0.9), rgba(9, 11, 21, 0.88))',
    textAlign: collapsed ? 'center' : 'left',
  };
}

const inspectorEyebrowStyle: CSSProperties = {
  color: '#717791',
  fontSize: 10,
  fontWeight: 900,
  textTransform: 'uppercase',
  letterSpacing: 0,
};

const inspectorTitleStyle: CSSProperties = {
  marginTop: 2,
  color: '#f4f4fb',
  fontSize: 14,
  fontWeight: 900,
};

const inspectorBadgeStyle: CSSProperties = {
  maxWidth: 130,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  borderRadius: 999,
  border: '1px solid rgba(125, 211, 252, 0.34)',
  background: 'rgba(14, 165, 233, 0.12)',
  color: '#bae6fd',
  padding: '3px 8px',
  fontSize: 11,
  fontWeight: 900,
};

const inspectorTabsStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: 6,
  minWidth: 0,
  padding: 5,
  borderRadius: 8,
  border: '1px solid rgba(125, 211, 252, 0.28)',
  background: 'linear-gradient(180deg, rgba(9, 14, 25, 0.98), rgba(4, 7, 13, 0.98))',
  boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.05), 0 10px 26px rgba(0, 0, 0, 0.28)',
};

function inspectorTabButtonStyle(active: boolean): CSSProperties {
  return {
    border: active ? '1px solid rgba(206, 255, 53, 0.74)' : '1px solid rgba(71, 85, 105, 0.64)',
    background: active
      ? 'linear-gradient(180deg, rgba(206, 255, 53, 0.24), rgba(71, 97, 13, 0.34))'
      : 'linear-gradient(180deg, rgba(30, 41, 59, 0.72), rgba(15, 23, 42, 0.72))',
    minHeight: 34,
    borderRadius: 7,
    color: active ? '#f7ffcf' : '#cbd5e1',
    fontSize: 12,
    fontWeight: 950,
    letterSpacing: 0,
    boxShadow: active
      ? '0 0 0 1px rgba(206, 255, 53, 0.12), 0 10px 24px rgba(206, 255, 53, 0.12)'
      : 'none',
    cursor: 'pointer',
  };
}

function inspectorCollapseButtonStyle(collapsed: boolean): CSSProperties {
  return {
    ...editorButtonChromeStyle({ tone: 'purple', compact: true, round: collapsed, active: collapsed }),
    borderRadius: collapsed ? 999 : 7,
    minHeight: collapsed ? 28 : 26,
    padding: collapsed ? '0 8px' : '0 9px',
    fontSize: 11,
    fontWeight: 900,
  };
}

const selectedTrackPanelStyle: CSSProperties = {
  gridColumn: 'auto',
  gridRow: 'auto',
  borderRadius: 8,
  border: '1px solid rgba(48, 52, 76, 0.82)',
  background: 'linear-gradient(180deg, rgba(13, 18, 29, 0.94), rgba(7, 11, 20, 0.92))',
  padding: 14,
  minWidth: 0,
};

const selectedTrackHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 10,
  flexWrap: 'wrap',
};

const selectedTrackTitleGroupStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 9,
  minWidth: 0,
};

const selectedTrackNameInputStyle: CSSProperties = {
  width: '100%',
  minWidth: 120,
  maxWidth: 220,
  minHeight: 28,
  borderRadius: 7,
  border: '1px solid rgba(206, 255, 53, 0.26)',
  background: 'rgba(7, 10, 18, 0.82)',
  color: '#f5f3ff',
  padding: '4px 8px',
  fontSize: 14,
  fontWeight: 900,
  outline: 'none',
  userSelect: 'text',
  WebkitUserSelect: 'text',
};

const selectedTrackSubStyle: CSSProperties = {
  color: '#858aa3',
  fontSize: 11,
  marginTop: 2,
};

const selectedTrackActionsStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 7,
  alignItems: 'center',
  minWidth: 0,
};

const mutedRangeListStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
  gap: 7,
  marginTop: 10,
};

const mutedRangeItemStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  minHeight: 30,
  border: '1px solid rgba(248, 113, 113, 0.35)',
  borderRadius: 7,
  background: 'rgba(127, 29, 29, 0.2)',
  padding: '5px 7px',
};

const mutedRangeTimeStyle: CSSProperties = {
  minWidth: 0,
  color: '#fecaca',
  fontSize: 11,
  fontVariantNumeric: 'tabular-nums',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const mutedRangeRestoreButtonStyle: CSSProperties = {
  ...editorButtonChromeStyle({ tone: 'danger', compact: true }),
  minHeight: 22,
  borderRadius: 7,
  padding: '3px 8px',
  fontSize: 11,
  fontWeight: 900,
};

const selectedTrackStatsStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 7,
  marginTop: 10,
  color: '#d8d9e6',
  fontSize: 11,
  fontVariantNumeric: 'tabular-nums',
};

const selectedTrackControlsGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: 10,
  marginTop: 10,
};

const selectedTrackControlStyle: CSSProperties = {
  display: 'grid',
  gap: 4,
  color: '#cfd0dc',
  fontSize: 11,
  fontVariantNumeric: 'tabular-nums',
};

const selectedTrackInlineControlStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) 78px',
  gap: 8,
  alignItems: 'center',
};

const selectedTrackNumberInputStyle: CSSProperties = {
  width: '100%',
  minHeight: 26,
  borderRadius: 6,
  border: '1px solid #30344c',
  background: '#0f1220',
  color: '#cfd0dc',
  padding: '2px 5px',
  fontSize: 11,
  fontVariantNumeric: 'tabular-nums',
  textAlign: 'center',
};

const selectedTrackNudgeGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(86px, 1fr))',
  gap: 7,
  marginTop: 10,
};

const selectedTrackShortcutStyle: CSSProperties = {
  color: '#858aa3',
  fontSize: 11,
  lineHeight: 1.35,
};

const controlPanelStyle: CSSProperties = {
  minWidth: 0,
  borderRadius: 8,
  border: '1px solid rgba(48, 52, 76, 0.82)',
  background: 'rgba(10, 14, 24, 0.92)',
  padding: '10px 12px',
};

function addTrackPanelStyle(open: boolean): CSSProperties {
  return {
    ...controlPanelStyle,
    borderColor: open ? 'rgba(206, 255, 53, 0.42)' : 'rgba(48, 52, 76, 0.82)',
    background: open
      ? 'linear-gradient(180deg, rgba(35, 45, 25, 0.58), rgba(10, 14, 24, 0.94))'
      : controlPanelStyle.background,
  };
}

const addTrackModeGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 8,
  marginTop: 8,
};

const addTrackHintStyle: CSSProperties = {
  marginTop: 8,
  color: '#aeb2c9',
  fontSize: 11,
  lineHeight: 1.45,
};

const recordingInputPanelStyle: CSSProperties = {
  display: 'grid',
  gap: 10,
  marginTop: 10,
  padding: 12,
  borderRadius: 8,
  border: '1px solid rgba(94, 102, 132, 0.34)',
  background: `
    linear-gradient(135deg, rgba(122, 167, 255, 0.05), transparent 34%),
    linear-gradient(180deg, rgba(9, 14, 22, 0.98), rgba(5, 8, 14, 0.96))
  `,
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.045), 0 12px 26px rgba(0,0,0,0.18)',
};

const recordingInputLabelStyle: CSSProperties = {
  color: '#f8fbff',
  fontSize: 12,
  fontWeight: 950,
};

const recordingSelectGroupStyle: CSSProperties = {
  position: 'relative',
  width: '100%',
  minWidth: 0,
};

function recordingSelectButtonStyle(disabled: boolean): CSSProperties {
  return {
    width: '100%',
    minWidth: 0,
    minHeight: 36,
    borderRadius: 7,
    border: '1px solid rgba(75, 86, 118, 0.62)',
    background: disabled
      ? 'rgba(14, 18, 28, 0.72)'
      : 'linear-gradient(180deg, rgba(23, 29, 42, 0.98), rgba(13, 18, 28, 0.98))',
    color: disabled ? '#6d7486' : '#f6f8ff',
    padding: '0 10px',
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) 18px',
    alignItems: 'center',
    gap: 8,
    fontSize: 12,
    fontWeight: 850,
    textAlign: 'left',
    outline: 'none',
    cursor: disabled ? 'not-allowed' : 'pointer',
    boxShadow: disabled ? 'none' : 'inset 0 1px 0 rgba(255,255,255,0.04)',
  };
}

const recordingSelectTextStyle: CSSProperties = {
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const recordingSelectChevronStyle: CSSProperties = {
  width: 18,
  height: 18,
  display: 'grid',
  placeItems: 'center',
  borderRadius: 999,
  color: '#9de6da',
  background: 'rgba(87, 219, 199, 0.08)',
  fontSize: 13,
  lineHeight: 1,
};

const recordingSelectMenuStyle: CSSProperties = {
  position: 'absolute',
  zIndex: 80,
  top: 'calc(100% + 5px)',
  left: 0,
  right: 0,
  display: 'grid',
  gap: 2,
  maxHeight: 174,
  overflowY: 'auto',
  padding: 4,
  borderRadius: 8,
  border: '1px solid rgba(80, 92, 126, 0.72)',
  background: 'linear-gradient(180deg, rgba(16, 22, 34, 0.99), rgba(8, 12, 20, 0.99))',
  boxShadow: '0 18px 40px rgba(0,0,0,0.42), inset 0 1px 0 rgba(255,255,255,0.045)',
};

function recordingSelectOptionButtonStyle(active: boolean): CSSProperties {
  return {
    minHeight: 30,
    width: '100%',
    border: '1px solid transparent',
    borderRadius: 6,
    background: active ? 'rgba(87, 219, 199, 0.16)' : 'transparent',
    color: active ? '#d9fff8' : '#d7deee',
    padding: '0 9px',
    fontSize: 12,
    fontWeight: active ? 950 : 820,
    textAlign: 'left',
    cursor: 'pointer',
  };
}

const recordingInputFooterStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) 88px',
  alignItems: 'end',
  gap: 8,
  paddingTop: 2,
};

const recordingInputLevelStyle: CSSProperties = {
  display: 'grid',
  gap: 6,
  minWidth: 0,
  color: '#f8fbff',
  fontSize: 12,
  fontWeight: 900,
};

const recordingInputRangeStyle: CSSProperties = {
  width: '100%',
  minWidth: 0,
  height: 14,
  accentColor: '#57dbc7',
  display: 'block',
};

function monitoringButtonStyle(active: boolean): CSSProperties {
  return {
    ...editorButtonChromeStyle({ tone: active ? 'success' : 'neutral', compact: true, round: true, active }),
    width: '100%',
    minHeight: 30,
    padding: '0 10px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 0,
    fontSize: 11,
    fontWeight: 950,
    boxShadow: 'none',
  };
}

const recordPanelStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) 42px',
  gap: 12,
  alignItems: 'stretch',
  marginTop: 10,
  padding: 12,
  borderRadius: 8,
  border: '1px solid rgba(73, 79, 107, 0.62)',
  background: `
    linear-gradient(180deg, rgba(14, 18, 29, 0.92), rgba(4, 7, 13, 0.68)),
    radial-gradient(circle at 100% 0%, rgba(206, 255, 53, 0.08), transparent 32%)
  `,
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
};

const recordingStatusBlockStyle: CSSProperties = {
  minWidth: 0,
  display: 'grid',
  alignContent: 'center',
  gap: 5,
};

const recordingStatusTitleStyle: CSSProperties = {
  color: '#f8fbff',
  fontSize: 12,
  fontWeight: 950,
};

const recordingStatusHintStyle: CSSProperties = {
  color: '#9298ad',
  fontSize: 11,
  lineHeight: 1.35,
};

function recordingMeterStyle(active: boolean): CSSProperties {
  return {
    display: 'grid',
    gridTemplateColumns: '17px 13px',
    alignItems: 'stretch',
    gap: 4,
    height: 70,
    padding: '5px 3px',
    borderRadius: 8,
    border: active ? '1px solid rgba(52, 211, 153, 0.42)' : '1px solid rgba(48, 52, 76, 0.82)',
    background: active
      ? 'linear-gradient(180deg, rgba(5, 46, 22, 0.55), rgba(7, 10, 18, 0.92))'
      : 'rgba(8, 11, 19, 0.72)',
    boxShadow: active ? '0 0 18px rgba(52, 211, 153, 0.12)' : 'none',
  };
}

const recordingMeterScaleStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
  alignItems: 'flex-end',
  color: '#77ff9d',
  fontSize: 8,
  fontWeight: 900,
  fontVariantNumeric: 'tabular-nums',
  lineHeight: 1,
};

const recordingMeterTrackStyle: CSSProperties = {
  position: 'relative',
  overflow: 'hidden',
  borderRadius: 999,
  border: '1px solid rgba(74, 222, 128, 0.32)',
  background: 'linear-gradient(180deg, rgba(127, 29, 29, 0.82) 0%, rgba(113, 63, 18, 0.82) 22%, rgba(20, 83, 45, 0.9) 54%, rgba(5, 46, 22, 0.92) 100%)',
  boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.32)',
};

function recordingMeterFillStyle(level: number, active: boolean): CSSProperties {
  const height = Math.max(2, Math.min(100, level * 100));
  return {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: `${active ? height : 2}%`,
    background: 'linear-gradient(180deg, rgba(248, 113, 113, 0.95), rgba(250, 204, 21, 0.92) 32%, rgba(74, 222, 128, 0.95) 72%)',
    boxShadow: active ? '0 0 12px rgba(74, 222, 128, 0.45)' : 'none',
    transition: 'height 70ms linear',
  };
}

function recordingMeterPeakStyle(level: number): CSSProperties {
  const bottom = Math.max(2, Math.min(96, level * 100));
  return {
    position: 'absolute',
    left: -2,
    right: -2,
    bottom: `${bottom}%`,
    height: 2,
    background: '#ecfeff',
    boxShadow: '0 0 8px rgba(236, 254, 255, 0.78)',
  };
}

const addTrackPrimaryButtonStyle: CSSProperties = {
  ...editorButtonChromeStyle({ tone: 'primary', compact: true }),
  minHeight: 30,
  borderRadius: 7,
  padding: '5px 10px',
  fontSize: 12,
  fontWeight: 900,
};

const addTrackDangerButtonStyle: CSSProperties = {
  ...editorButtonChromeStyle({ tone: 'danger', compact: true, active: true }),
  minHeight: 30,
  borderRadius: 7,
  padding: '5px 10px',
  fontSize: 12,
  fontWeight: 900,
};

function recordingActionButtonStyle(active: boolean): CSSProperties {
  return {
    ...(active ? addTrackDangerButtonStyle : addTrackPrimaryButtonStyle),
    gridColumn: '1 / -1',
    width: '100%',
    minHeight: 34,
  };
}

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
  color: '#e5e7f3',
  fontSize: 12,
  fontWeight: 900,
  marginRight: 2,
};

const panelHeadingStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  minWidth: 0,
};

const panelHeadingMetaStyle: CSSProperties = {
  color: '#717791',
  fontSize: 10,
  fontWeight: 900,
  textTransform: 'uppercase',
  letterSpacing: 0,
};

const presetButtonStyle: CSSProperties = {
  ...editorButtonChromeStyle({ tone: 'purple', compact: true }),
  minHeight: 30,
  borderRadius: 7,
  padding: '5px 10px',
  fontSize: 12,
  fontWeight: 900,
  minWidth: 0,
};

const deleteTrackButtonStyle: CSSProperties = {
  ...editorButtonChromeStyle({ tone: 'danger', compact: true }),
  minHeight: 30,
  borderRadius: 7,
  padding: '5px 10px',
  fontSize: 12,
  fontWeight: 900,
  minWidth: 0,
};

function viewModeButtonStyle(active: boolean): CSSProperties {
  return {
    ...editorButtonChromeStyle({ tone: 'purple', compact: true, active }),
    minHeight: 30,
    borderRadius: 7,
    padding: '5px 10px',
    fontSize: 12,
    fontWeight: 900,
    minWidth: 0,
  };
}

const exportPanelStyle: CSSProperties = {
  gridColumn: 'auto',
  minWidth: 0,
  padding: '10px 12px',
  borderRadius: 8,
  border: '1px solid rgba(48, 52, 76, 0.82)',
  background: 'rgba(10, 14, 24, 0.94)',
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
  gridTemplateColumns: 'repeat(auto-fit, minmax(86px, 1fr))',
  gap: 8,
  marginTop: 8,
};

const exportReadinessGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 8,
  marginTop: 8,
};

const exportActionGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 8,
  marginTop: 10,
};

function exportPrimaryActionStyle(disabled: boolean): CSSProperties {
  return {
    ...editorButtonChromeStyle({ tone: 'primary', disabled }),
    minHeight: disabled ? 44 : 34,
    display: 'inline-flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    padding: '6px 10px',
    fontSize: 12,
    fontWeight: 900,
    lineHeight: 1.15,
  };
}

function sanitizeTrackLabel(value: string) {
  return value.replace(/\s+/g, ' ').trim().slice(0, 40);
}

function normalizeTrackLabels(value: unknown) {
  const labels = value && typeof value === 'object'
    ? value as Record<string, unknown>
    : null;
  if (!labels) return {};

  return Object.fromEntries(
    Object.entries(labels)
      .map(([type, label]) => [type.trim().slice(0, 80), sanitizeTrackLabel(String(label || ''))])
      .filter(([type, label]) => type.length > 0 && label.length > 0),
  ) as Record<string, string>;
}

function sanitizeTrackColor(value: string) {
  const color = String(value || '').trim();
  return /^#[0-9a-f]{6}$/i.test(color) ? color.toLowerCase() : '';
}

function normalizeTrackColors(value: unknown) {
  const colors = value && typeof value === 'object'
    ? value as Record<string, unknown>
    : null;
  if (!colors) return {};

  return Object.fromEntries(
    Object.entries(colors)
      .map(([type, color]) => [type.trim().slice(0, 80), sanitizeTrackColor(String(color || ''))])
      .filter(([type, color]) => type.length > 0 && color.length > 0),
  ) as Record<string, string>;
}

function normalizeTrackOrderForStems(value: unknown, stems: EditableStem[]) {
  const stemTypes = stems.map((stem) => stem.type);
  const stemTypeSet = new Set(stemTypes);
  const orderedTypes = Array.isArray(value)
    ? value
        .map((type) => String(type || '').trim())
        .filter((type, index, values) => stemTypeSet.has(type) && values.indexOf(type) === index)
    : [];

  return [
    ...orderedTypes,
    ...stemTypes.filter((type) => !orderedTypes.includes(type)),
  ];
}

function applyTrackOrder(stems: EditableStem[], order: string[]) {
  const orderIndex = new Map(order.map((type, index) => [type, index]));
  return [...stems].sort((left, right) => {
    const leftIndex = orderIndex.get(left.type) ?? Number.MAX_SAFE_INTEGER;
    const rightIndex = orderIndex.get(right.type) ?? Number.MAX_SAFE_INTEGER;
    return leftIndex - rightIndex;
  });
}

const exportActionReasonStyle: CSSProperties = {
  display: 'block',
  maxWidth: '100%',
  color: '#8d93a8',
  fontSize: 10,
  fontWeight: 800,
  lineHeight: 1.1,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

function exportModeButtonStyle(active: boolean): CSSProperties {
  return {
    ...editorButtonChromeStyle({ tone: 'purple', active }),
    minHeight: 32,
    borderRadius: 8,
    padding: '6px 8px',
    fontSize: 12,
    fontWeight: 900,
  };
}

const exportHintStyle: CSSProperties = {
  marginTop: 8,
  color: '#8f92aa',
  fontSize: 11,
  lineHeight: 1.6,
};

const exportPreflightStyle: CSSProperties = {
  display: 'grid',
  gap: 6,
  marginTop: 10,
  padding: '8px 10px',
  borderRadius: 8,
  border: '1px solid rgba(48, 52, 76, 0.72)',
  background: 'rgba(17, 20, 35, 0.82)',
};

const exportPreflightRowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '64px minmax(0, 1fr)',
  gap: 8,
  alignItems: 'start',
  minWidth: 0,
  fontSize: 11,
  lineHeight: 1.45,
};

const exportPreflightLabelStyle: CSSProperties = {
  color: '#8f92aa',
  fontWeight: 800,
  whiteSpace: 'nowrap',
};

const exportPreflightValueStyle: CSSProperties = {
  color: '#cfd3e6',
  fontWeight: 700,
  overflowWrap: 'anywhere',
};

const exportPreflightWarningStyle: CSSProperties = {
  ...exportPreflightValueStyle,
  color: '#f7c873',
};

function exportStatusStyle(tone: StemExportStatusTone): CSSProperties {
  const color = tone === 'success'
    ? 'rgba(52, 211, 153, 0.58)'
    : tone === 'error'
      ? 'rgba(248, 113, 113, 0.52)'
      : tone === 'warning'
        ? 'rgba(251, 191, 36, 0.48)'
        : tone === 'info'
          ? 'rgba(96, 165, 250, 0.48)'
          : 'rgba(75, 85, 99, 0.64)';

  return {
    marginTop: 10,
    padding: '8px 10px',
    borderRadius: 8,
    border: `1px solid ${color}`,
    background: 'rgba(10, 13, 24, 0.82)',
  };
}

const exportStatusHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 10,
  color: '#edf0ff',
  fontSize: 12,
  fontWeight: 900,
};

const exportStatusTrackStyle: CSSProperties = {
  height: 5,
  marginTop: 7,
  overflow: 'hidden',
  borderRadius: 999,
  background: 'rgba(48, 52, 76, 0.78)',
};

function exportStatusProgressStyle(progress: number, tone: StemExportStatusTone): CSSProperties {
  const color = tone === 'success'
    ? '#34d399'
    : tone === 'error'
      ? '#f87171'
      : tone === 'warning'
        ? '#fbbf24'
        : '#ceff35';

  return {
    width: `${Math.max(0, Math.min(100, progress))}%`,
    height: '100%',
    borderRadius: 999,
    background: color,
    transition: 'width 180ms ease',
  };
}

const exportStatusDetailStyle: CSSProperties = {
  marginTop: 6,
  color: '#9ca3af',
  fontSize: 11,
  lineHeight: 1.45,
};

const exportDownloadLinkStyle: CSSProperties = {
  ...editorButtonChromeStyle({ tone: 'info', compact: true, active: true }),
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  marginTop: 8,
  minHeight: 30,
  padding: '0 12px',
  borderRadius: 7,
  color: '#cffafe',
  fontSize: 12,
  fontWeight: 900,
  textDecoration: 'none',
};

const exportHistoryStyle: CSSProperties = {
  marginTop: 10,
  padding: '8px 10px',
  borderRadius: 8,
  border: '1px solid rgba(48, 52, 76, 0.72)',
  background: 'rgba(17, 20, 35, 0.78)',
};

const exportHistoryHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 10,
  color: '#cfd3e6',
  fontSize: 12,
  fontWeight: 900,
};

const exportHistoryHeaderActionsStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  flexShrink: 0,
  color: '#8f92aa',
};

const exportHistoryClearButtonStyle: CSSProperties = {
  ...editorButtonChromeStyle({ tone: 'neutral', compact: true }),
  minHeight: 24,
  borderRadius: 7,
  padding: '3px 7px',
  fontSize: 11,
  fontWeight: 900,
};

const exportHistoryListStyle: CSSProperties = {
  display: 'grid',
  gap: 6,
  marginTop: 8,
};

const exportHistoryItemStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 10,
  minWidth: 0,
  paddingTop: 6,
  borderTop: '1px solid rgba(48, 52, 76, 0.58)',
};

const exportHistoryTitleStyle: CSSProperties = {
  minWidth: 0,
  color: '#edf0ff',
  fontSize: 11,
  fontWeight: 800,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const exportHistoryDetailStyle: CSSProperties = {
  flexShrink: 0,
  color: '#8f92aa',
  fontSize: 11,
  fontWeight: 700,
};

const playbackErrorStyle: CSSProperties = {
  gridColumn: '1 / -1',
  order: 2,
  marginTop: 10,
  borderRadius: 8,
  border: '1px solid rgba(248, 113, 113, 0.28)',
  background: 'rgba(239, 68, 68, 0.1)',
  color: '#fca5a5',
  padding: '8px 10px',
  fontSize: 12,
};

function playbackErrorToastStyle(metrics: DawEditorLayoutMetrics): CSSProperties {
  return {
    position: 'fixed',
    left: metrics.sideRailWidth + 16,
    right: metrics.inspectorWidth + 24,
    bottom: metrics.bottomTransportHeight + 32,
    zIndex: 58,
    minHeight: 38,
    display: 'flex',
    alignItems: 'center',
    borderRadius: 9,
    border: '1px solid rgba(248, 113, 113, 0.38)',
    background: 'linear-gradient(180deg, rgba(49, 14, 26, 0.96), rgba(30, 12, 20, 0.94))',
    boxShadow: '0 18px 42px rgba(0, 0, 0, 0.34), 0 0 0 1px rgba(255, 255, 255, 0.04)',
    backdropFilter: 'blur(14px)',
    color: '#fecaca',
    padding: '8px 14px',
    fontSize: 12,
    fontWeight: 850,
    lineHeight: 1.45,
    pointerEvents: 'none',
  };
}

const inlineRetryButtonStyle: CSSProperties = {
  ...editorButtonChromeStyle({ tone: 'danger', compact: true }),
  marginLeft: 10,
  minHeight: 26,
  borderRadius: 7,
  padding: '4px 9px',
  fontSize: 12,
  fontWeight: 900,
};

const loadingNoticeStyle: CSSProperties = {
  gridColumn: '1 / -1',
  order: 2,
  marginTop: 10,
  borderRadius: 8,
  border: '1px solid rgba(206, 255, 53, 0.22)',
  background: 'rgba(206, 255, 53, 0.08)',
  color: '#eaff9e',
  padding: '8px 10px',
  fontSize: 12,
};

function editorStatusToastDockStyle(metrics: DawEditorLayoutMetrics): CSSProperties {
  return {
    position: 'fixed',
    top: metrics.headerHeight + 12,
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 78,
    display: 'grid',
    gap: 8,
    width: 'min(520px, calc(100vw - 40px))',
    pointerEvents: 'none',
  };
}

function editorStatusToastStyle(tone: 'save' | 'auto', dismissing = false): CSSProperties {
  const saveTone = tone === 'save';
  return {
    display: 'grid',
    gridTemplateColumns: '22px minmax(0, 1fr)',
    alignItems: 'center',
    gap: 10,
    minHeight: 38,
    borderRadius: 8,
    border: saveTone ? '1px solid rgba(134, 239, 172, 0.72)' : '1px solid rgba(125, 211, 252, 0.68)',
    background: saveTone ? '#052e16' : '#082f49',
    boxShadow: saveTone
      ? '0 16px 38px rgba(0, 0, 0, 0.48), 0 0 0 1px rgba(187, 247, 208, 0.08), 0 0 28px rgba(34, 197, 94, 0.22)'
      : '0 16px 38px rgba(0, 0, 0, 0.48), 0 0 0 1px rgba(186, 230, 253, 0.08), 0 0 28px rgba(14, 165, 233, 0.22)',
    color: saveTone ? '#dcfce7' : '#e0f2fe',
    padding: '8px 12px',
    fontSize: 12,
    fontWeight: 900,
    letterSpacing: 0,
    pointerEvents: 'auto',
    opacity: dismissing ? 0 : 1,
    transform: dismissing ? 'translateY(-6px) scale(0.98)' : 'translateY(0) scale(1)',
    transition: `opacity ${STATUS_TOAST_FADE_MS}ms ease, transform ${STATUS_TOAST_FADE_MS}ms ease`,
  };
}

function editorStatusToastIconStyle(tone: 'save' | 'auto'): CSSProperties {
  const saveTone = tone === 'save';
  return {
    width: 22,
    height: 22,
    borderRadius: 11,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: saveTone ? '1px solid rgba(187, 247, 208, 0.7)' : '1px solid rgba(186, 230, 253, 0.68)',
    background: saveTone ? '#16a34a' : '#0284c7',
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 900,
    boxShadow: saveTone ? '0 0 16px rgba(34, 197, 94, 0.34)' : '0 0 16px rgba(14, 165, 233, 0.34)',
  };
}

const editorStatusToastTextStyle: CSSProperties = {
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const editorDialogOverlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 120,
  display: 'grid',
  placeItems: 'center',
  padding: 20,
  background: 'radial-gradient(circle at 50% 36%, rgba(82, 214, 198, 0.1), transparent 32%), rgba(1, 4, 10, 0.68)',
  backdropFilter: 'blur(7px)',
};

function editorDialogPanelStyle(danger: boolean): CSSProperties {
  return {
    width: 'min(460px, calc(100vw - 40px))',
    display: 'grid',
    gap: 12,
    borderRadius: 12,
    border: danger ? '1px solid rgba(248, 113, 113, 0.36)' : '1px solid rgba(82, 214, 198, 0.32)',
    background: 'linear-gradient(180deg, rgba(20, 25, 36, 0.98), rgba(6, 9, 16, 0.98))',
    boxShadow: danger
      ? '0 30px 80px rgba(0, 0, 0, 0.58), 0 0 0 1px rgba(255,255,255,0.04), 0 0 48px rgba(248, 113, 113, 0.11)'
      : '0 30px 80px rgba(0, 0, 0, 0.58), 0 0 0 1px rgba(255,255,255,0.04), 0 0 48px rgba(82, 214, 198, 0.12)',
    padding: 22,
    color: '#f8fbff',
  };
}

const editorDialogEyebrowStyle: CSSProperties = {
  color: '#ceff35',
  fontSize: 11,
  fontWeight: 950,
  letterSpacing: 0,
  textTransform: 'uppercase',
};

const editorDialogTitleStyle: CSSProperties = {
  color: '#ffffff',
  fontSize: 22,
  fontWeight: 950,
  lineHeight: 1.1,
};

const editorDialogBodyStyle: CSSProperties = {
  color: '#b7bdd0',
  fontSize: 13,
  lineHeight: 1.55,
};

const editorDialogInputStyle: CSSProperties = {
  width: '100%',
  height: 42,
  boxSizing: 'border-box',
  borderRadius: 8,
  border: '1px solid rgba(82, 214, 198, 0.46)',
  background: 'rgba(4, 7, 13, 0.82)',
  color: '#f8fbff',
  outline: 'none',
  padding: '0 12px',
  fontSize: 14,
  fontWeight: 850,
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 0 0 3px rgba(82, 214, 198, 0.08)',
};

const editorDialogActionsStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 10,
  marginTop: 4,
};

const editorDialogSecondaryButtonStyle: CSSProperties = {
  ...editorButtonChromeStyle({ tone: 'neutral', compact: true }),
  minHeight: 36,
  minWidth: 82,
  borderRadius: 8,
};

function editorDialogPrimaryButtonStyle(danger: boolean): CSSProperties {
  return {
    ...editorButtonChromeStyle({ tone: danger ? 'danger' : 'primary', compact: true, active: true }),
    minHeight: 36,
    minWidth: 104,
    borderRadius: 8,
  };
}

function trackContextMenuStyle(x: number, y: number): CSSProperties {
  return {
    position: 'fixed',
    left: x,
    top: y,
    zIndex: 80,
    width: 256,
    boxSizing: 'border-box',
    padding: 8,
    borderRadius: 10,
    border: '1px solid rgba(73, 79, 107, 0.86)',
    background: 'linear-gradient(180deg, rgba(18, 21, 29, 0.98), rgba(10, 13, 18, 0.98))',
    boxShadow: '0 26px 60px rgba(0, 0, 0, 0.52), inset 0 1px 0 rgba(255,255,255,0.055)',
    backdropFilter: 'blur(18px)',
    color: '#f8fafc',
  };
}

function trackContextMenuItemStyle(disabled: boolean): CSSProperties {
  return {
    width: '100%',
    minHeight: 36,
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) auto',
    alignItems: 'center',
    gap: 12,
    border: 0,
    borderRadius: 7,
    background: 'transparent',
    color: disabled ? '#61687a' : '#f4f7ff',
    padding: '0 10px',
    fontSize: 13,
    fontWeight: 900,
    textAlign: 'left',
    cursor: disabled ? 'not-allowed' : 'pointer',
  };
}

const trackContextMenuDividerStyle: CSSProperties = {
  height: 1,
  margin: '6px -8px',
  background: 'rgba(73, 79, 107, 0.62)',
};

const trackColorEditorStyle: CSSProperties = {
  marginTop: 7,
  padding: 9,
  borderRadius: 8,
  border: '1px solid rgba(73, 79, 107, 0.58)',
  background: 'rgba(4, 7, 13, 0.58)',
};

const trackColorPaletteStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(6, 1fr)',
  gap: 6,
};

function trackColorSwatchStyle(color: string, active: boolean): CSSProperties {
  return {
    width: '100%',
    aspectRatio: '1',
    borderRadius: 7,
    border: active ? '2px solid #ffffff' : '1px solid rgba(255,255,255,0.18)',
    background: color,
    boxShadow: active ? `0 0 0 2px ${colorWithAlpha(color, 0.34)}` : 'none',
    cursor: 'pointer',
  };
}

const trackColorInputRowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '38px minmax(0, 1fr)',
  alignItems: 'center',
  gap: 8,
  marginTop: 9,
};

const trackColorInputStyle: CSSProperties = {
  width: 38,
  height: 30,
  padding: 0,
  border: '1px solid rgba(255,255,255,0.18)',
  borderRadius: 7,
  background: 'transparent',
};

const trackColorHexInputStyle: CSSProperties = {
  minWidth: 0,
  height: 30,
  borderRadius: 7,
  border: '1px solid rgba(73, 79, 107, 0.78)',
  background: 'rgba(6, 9, 15, 0.88)',
  color: '#edf2ff',
  padding: '0 9px',
  fontSize: 12,
  fontWeight: 850,
};

function trackListStyle(
  trackDensity: TrackDensity,
  metrics: DawEditorLayoutMetrics,
  isPanning = false,
  canScrollHorizontally = true,
): CSSProperties {
  return {
    position: 'fixed',
    top: metrics.headerHeight + 8,
    left: metrics.sideRailWidth + 8,
    right: metrics.inspectorWidth + 24,
    bottom: metrics.bottomTransportHeight + 10,
    zIndex: 18,
    gridColumn: '1',
    order: 3,
    display: 'flex',
    flexDirection: 'column',
    gap: 0,
    marginTop: 0,
    padding: '0 6px 8px',
    border: '1px solid rgba(48, 52, 76, 0.84)',
    borderRadius: 8,
    background: `
      linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px),
      linear-gradient(180deg, rgba(255,255,255,0.035) 1px, transparent 1px),
      linear-gradient(180deg, rgba(9, 13, 22, 0.96), rgba(4, 8, 15, 0.96))
    `,
    backgroundSize: trackDensity === 'compact' ? '76px 100%, 100% 58px, auto' : '76px 100%, 100% 76px, auto',
    minWidth: 0,
    maxWidth: '100%',
    height: `calc(100vh - ${metrics.headerHeight + metrics.bottomTransportHeight + 18}px)`,
    maxHeight: `calc(100vh - ${metrics.headerHeight + metrics.bottomTransportHeight + 18}px)`,
    boxSizing: 'border-box',
    overflowX: canScrollHorizontally ? 'auto' : 'hidden',
    overflowY: 'hidden',
    outline: 'none',
    overscrollBehaviorX: 'contain',
    cursor: isPanning ? 'grabbing' : 'default',
    userSelect: 'none',
    WebkitUserSelect: 'none',
    WebkitTouchCallout: 'none',
    touchAction: 'pan-y',
  };
}

const emptyTrackNoticeStyle: CSSProperties = {
  borderRadius: 10,
  border: '1px dashed rgba(206, 255, 53, 0.3)',
  background: 'rgba(206, 255, 53, 0.06)',
  color: '#eaff9e',
  padding: '18px 14px',
  fontSize: 12,
  textAlign: 'center',
};

const timelineAddTrackRowStyle: CSSProperties = {
  position: 'sticky',
  left: 0,
  zIndex: 3,
  width: '100%',
  minWidth: 0,
  boxSizing: 'border-box',
  padding: '9px 8px 10px',
  background: 'linear-gradient(180deg, rgba(5, 8, 14, 0.28), rgba(5, 8, 14, 0.82))',
};

const trackAddDropzoneButtonStyle: CSSProperties = {
  width: '100%',
  minHeight: 74,
  display: 'grid',
  placeItems: 'center',
  gap: 2,
  borderRadius: 8,
  border: '2px dashed rgba(148, 163, 184, 0.26)',
  background: 'rgba(5, 8, 14, 0.62)',
  color: '#dfe6f3',
  boxShadow: 'none',
  cursor: 'pointer',
  transition: 'border-color 140ms ease, background 140ms ease, color 140ms ease',
};

const trackAddDropzoneIconStyle: CSSProperties = {
  color: '#f8fbff',
  fontSize: 23,
  lineHeight: 1,
  fontWeight: 950,
};

const trackAddDropzoneTextStyle: CSSProperties = {
  color: '#f8fbff',
  fontSize: 14,
  fontWeight: 900,
  lineHeight: 1.2,
};

function timelineToolbarStyle(metrics: DawEditorLayoutMetrics, viewportWidth: number): CSSProperties {
  const visibleWidth = viewportWidth > 0 ? Math.max(320, viewportWidth - 14) : undefined;

  return {
    position: 'relative',
    top: 0,
    left: 0,
    zIndex: 58,
    alignSelf: 'flex-start',
    display: 'grid',
    gridTemplateColumns: 'minmax(130px, auto) auto minmax(0, 1fr)',
    alignItems: 'center',
    justifyContent: 'start',
    columnGap: 12,
    rowGap: 0,
    boxSizing: 'border-box',
    minHeight: 40,
    padding: '5px 10px',
    width: visibleWidth ?? '100%',
    minWidth: 0,
    maxWidth: visibleWidth ?? '100%',
    borderRadius: 0,
    border: 'none',
    borderBottom: '1px solid rgba(48, 52, 76, 0.82)',
    background: 'linear-gradient(180deg, rgba(10, 14, 24, 0.98), rgba(7, 10, 18, 0.98))',
    boxShadow: '0 10px 22px rgba(0,0,0,0.18)',
    backdropFilter: 'blur(14px)',
  };
}

function timelineTrackBodyStyle(trackDensity: TrackDensity): CSSProperties {
  return {
    display: 'flex',
    flexDirection: 'column',
    gap: trackDensity === 'compact' ? 2 : 3,
    minWidth: 'max-content',
    minHeight: 0,
    flex: '1 1 auto',
    overflowY: 'auto',
    overflowX: 'visible',
    paddingTop: 3,
    paddingBottom: 8,
    scrollbarWidth: 'thin',
    scrollbarColor: 'rgba(87, 219, 199, 0.88) rgba(5, 9, 16, 0.92)',
    overscrollBehaviorY: 'contain',
  };
}

const timelineToolbarEyebrowStyle: CSSProperties = {
  color: '#717791',
  fontSize: 10,
  fontWeight: 900,
  textTransform: 'uppercase',
  letterSpacing: 0,
};

const timelineToolbarTitleStyle: CSSProperties = {
  marginTop: 2,
  color: '#f4f4fb',
  fontSize: 14,
  fontWeight: 900,
};

const timelineToolbarStatsStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-start',
  gap: 6,
  flexWrap: 'nowrap',
  minWidth: 0,
  maxWidth: '100%',
  overflowX: 'auto',
  overflowY: 'hidden',
  scrollbarWidth: 'none',
  paddingBottom: 1,
};

const timelineZoomControlsStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 4,
  padding: 3,
  borderRadius: 7,
  border: '1px solid rgba(48, 52, 76, 0.74)',
  background: 'rgba(7, 9, 18, 0.72)',
};

function timelineZoomButtonStyle(disabled: boolean): CSSProperties {
  return {
    ...editorButtonChromeStyle({ tone: 'purple', compact: true, disabled }),
    width: 24,
    height: 22,
    borderRadius: 5,
    fontSize: 13,
    fontWeight: 900,
    lineHeight: 1,
  };
}

const timelineZoomValueStyle: CSSProperties = {
  minWidth: 42,
  color: '#cfd3e6',
  fontSize: 11,
  fontWeight: 900,
  fontVariantNumeric: 'tabular-nums',
  textAlign: 'center',
};

const timelineZoomFitButtonStyle: CSSProperties = {
  ...editorButtonChromeStyle({ tone: 'neutral', compact: true }),
  minHeight: 22,
  borderRadius: 5,
  padding: '0 7px',
  fontSize: 10,
  fontWeight: 900,
};

const timelineToolbarPillStyle: CSSProperties = {
  flex: '0 0 auto',
  borderRadius: 999,
  border: '1px solid rgba(151, 165, 196, 0.22)',
  background: 'rgba(20, 25, 36, 0.66)',
  color: '#cfd7e8',
  padding: '3px 8px',
  fontSize: 11,
  fontWeight: 800,
  whiteSpace: 'nowrap',
};

const timelineAddTrackButtonStyle: CSSProperties = {
  ...editorButtonChromeStyle({ tone: 'primary', compact: true }),
  flex: '0 0 auto',
  minHeight: 24,
  borderRadius: 999,
  padding: '3px 9px',
  fontSize: 11,
  fontWeight: 900,
  whiteSpace: 'nowrap',
};

const timelineSelectionActionsStyle: CSSProperties = {
  flex: '0 0 auto',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  minHeight: 24,
  padding: 2,
  borderRadius: 999,
  border: '1px solid rgba(83, 88, 123, 0.52)',
  background: 'rgba(10, 13, 24, 0.64)',
  whiteSpace: 'nowrap',
};

function timelineSelectionActionButtonStyle(disabled: boolean): CSSProperties {
  return {
    ...editorButtonChromeStyle({ tone: 'info', compact: true, round: true, disabled }),
    minHeight: 20,
    padding: '0 7px',
    fontSize: 10,
    fontWeight: 900,
  };
}

function timelineSelectionLoopButtonStyle(active: boolean): CSSProperties {
  return {
    ...editorButtonChromeStyle({ tone: active ? 'success' : 'info', compact: true, round: true, active }),
    minHeight: 20,
    padding: '0 7px',
    fontSize: 10,
    fontWeight: 900,
  };
}

function timelineFollowButtonStyle(active: boolean): CSSProperties {
  return {
    ...editorButtonChromeStyle({ tone: 'success', compact: true, round: true, active }),
    minHeight: 24,
    padding: '0 9px',
    fontSize: 11,
    fontWeight: 900,
  };
}

function timelineHelpButtonStyle(active: boolean): CSSProperties {
  return {
    ...editorButtonChromeStyle({ tone: 'purple', compact: true, round: true, active }),
    minHeight: 24,
    padding: '0 9px',
    fontSize: 11,
    fontWeight: 900,
  };
}

function timelineShortcutHelpStyle(metrics: DawEditorLayoutMetrics, viewportWidth: number): CSSProperties {
  const visibleWidth = viewportWidth > 0 ? Math.max(320, viewportWidth - 14) : undefined;

  return {
    position: 'relative',
    top: 0,
    left: 0,
    zIndex: 57,
    alignSelf: 'flex-start',
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: 6,
    width: visibleWidth ?? '100%',
    minWidth: 0,
    maxWidth: visibleWidth ?? '100%',
    boxSizing: 'border-box',
    padding: '7px 10px',
    borderRadius: 7,
    border: '1px solid rgba(206, 255, 53, 0.24)',
    background: 'linear-gradient(180deg, rgba(20, 23, 39, 0.96), rgba(10, 13, 24, 0.94))',
    color: '#aeb2c9',
    fontSize: 11,
    lineHeight: 1.35,
    boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
  };
}

const timelineLocateButtonStyle: CSSProperties = {
  ...editorButtonChromeStyle({ tone: 'info', compact: true, round: true }),
  minHeight: 24,
  padding: '0 9px',
  fontSize: 11,
  fontWeight: 900,
};

function timelineScrollProgressStyle(metrics: DawEditorLayoutMetrics): CSSProperties {
  return {
    position: 'fixed',
    left: metrics.sideRailWidth + 16,
    right: metrics.inspectorWidth + 24,
    bottom: metrics.bottomTransportHeight + 2,
    zIndex: 39,
    minWidth: 0,
    boxSizing: 'border-box',
    height: 20,
    padding: '6px 10px',
    borderRadius: 10,
    border: '1px solid rgba(48, 52, 76, 0.72)',
    background: 'linear-gradient(180deg, rgba(8, 13, 22, 0.9), rgba(3, 6, 12, 0.98))',
    boxShadow: '0 -10px 30px rgba(0, 0, 0, 0.34), inset 0 1px 0 rgba(255,255,255,0.045)',
    overflow: 'hidden',
    cursor: 'ew-resize',
    userSelect: 'none',
    backdropFilter: 'blur(14px)',
  };
}

function timelineScrollThumbStyle(progress: number, viewRatio: number): CSSProperties {
  const widthPercent = Math.max(10, Math.min(100, viewRatio * 100));
  const leftPercent = Math.max(0, Math.min(100 - widthPercent, progress * (100 - widthPercent)));

  return {
    position: 'absolute',
    left: `calc(10px + ${leftPercent}%)`,
    top: 6,
    width: `calc(${widthPercent}% - 20px)`,
    minWidth: 42,
    height: 7,
    borderRadius: 999,
    background: 'linear-gradient(90deg, rgba(206, 255, 53, 0.86), rgba(82, 214, 198, 0.9))',
    boxShadow: '0 0 12px rgba(206, 255, 53, 0.34)',
    pointerEvents: 'none',
    userSelect: 'none',
    WebkitUserSelect: 'none',
    WebkitTouchCallout: 'none',
  };
}

function timelineRulerStyle(gridColumns: string, minWidth: number, metrics: DawEditorLayoutMetrics): CSSProperties {
  return {
    position: 'relative',
    top: 0,
    zIndex: 56,
    display: 'grid',
    gridTemplateColumns: gridColumns,
    gap: TIMELINE_GRID_GAP,
    alignItems: 'center',
    minWidth,
    boxSizing: 'border-box',
    minHeight: 32,
    padding: '0 10px',
    borderRadius: 0,
    borderBottom: '1px solid rgba(48, 52, 76, 0.72)',
    background: 'rgba(7, 10, 18, 0.96)',
    color: '#8f92aa',
    fontSize: 10,
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: 0,
  };
}

function timelineGlobalPlayheadStyle(currentTime: number, duration: number, laneWidth: number, labelWidth: number): CSSProperties {
  const ratio = duration > 0 ? Math.max(0, Math.min(1, currentTime / duration)) : 0;
  const playheadLeft = 8 + labelWidth + TIMELINE_GRID_GAP + laneWidth * ratio;

  return {
    position: 'absolute',
    top: 72,
    bottom: 10,
    left: playheadLeft,
    width: 2,
    minHeight: 120,
    borderRadius: 999,
    background: 'linear-gradient(180deg, rgba(255,255,255,0), rgba(255,255,255,0.92) 8%, rgba(156,108,255,0.96) 50%, rgba(255,255,255,0.74) 92%, rgba(255,255,255,0))',
    boxShadow: '0 0 0 1px rgba(156,108,255,0.18), 0 0 18px rgba(156,108,255,0.42)',
    pointerEvents: 'none',
    zIndex: 55,
  };
}

function timelineGlobalPlayheadBadgeStyle(currentTime: number, duration: number, laneWidth: number, labelWidth: number): CSSProperties {
  const ratio = duration > 0 ? Math.max(0, Math.min(1, currentTime / duration)) : 0;
  const playheadLeft = 8 + labelWidth + TIMELINE_GRID_GAP + laneWidth * ratio;

  return {
    position: 'absolute',
    top: 51,
    left: playheadLeft,
    transform: 'translateX(-50%)',
    zIndex: 57,
    borderRadius: 999,
    border: '1px solid rgba(216, 201, 255, 0.7)',
    background: 'linear-gradient(180deg, rgba(206, 255, 53, 0.92), rgba(82, 214, 198, 0.86))',
    color: '#08090c',
    padding: '2px 7px',
    fontSize: 10,
    fontWeight: 900,
    fontVariantNumeric: 'tabular-nums',
    boxShadow: '0 8px 18px rgba(0, 0, 0, 0.28), 0 0 16px rgba(206, 255, 53, 0.28)',
    pointerEvents: 'none',
    whiteSpace: 'nowrap',
  };
}

const timelineRulerLabelStyle: CSSProperties = {
  position: 'sticky',
  left: 0,
  zIndex: 59,
  alignSelf: 'stretch',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-start',
  gap: 8,
  minWidth: 0,
  boxSizing: 'border-box',
  padding: '0 8px 0 2px',
  borderRadius: 0,
  background: 'linear-gradient(180deg, rgba(10, 14, 18, 0.98), rgba(5, 8, 12, 0.98))',
  borderRight: '1px solid rgba(255,255,255,0.06)',
  boxShadow: '10px 0 18px rgba(3, 6, 12, 0.42)',
  overflow: 'hidden',
};

const timelineRulerAddTrackButtonStyle: CSSProperties = {
  ...editorButtonChromeStyle({ tone: 'neutral', compact: true, round: true }),
  minHeight: 28,
  maxWidth: 150,
  padding: '0 12px',
  borderColor: 'rgba(151, 165, 196, 0.28)',
  background: 'rgba(15, 20, 30, 0.96)',
  color: '#e2e7f3',
  fontSize: 12,
  fontWeight: 950,
  boxShadow: 'none',
  whiteSpace: 'nowrap',
};

const timelineRulerMarksStyle: CSSProperties = {
  position: 'relative',
  height: 26,
  borderRadius: 5,
  border: '1px solid rgba(48, 52, 76, 0.72)',
  background: 'linear-gradient(180deg, rgba(13, 17, 29, 0.86), rgba(7, 10, 18, 0.88))',
  overflow: 'visible',
  cursor: 'pointer',
  userSelect: 'none',
  WebkitUserSelect: 'none',
  WebkitTouchCallout: 'none',
  touchAction: 'none',
};

function timelineSelectedRangeStyle(start: number, end: number, duration: number): CSSProperties {
  const safeDuration = Math.max(duration, 0.001);
  const startRatio = Math.max(0, Math.min(1, start / safeDuration));
  const endRatio = Math.max(startRatio, Math.min(1, end / safeDuration));

  return {
    position: 'absolute',
    left: `${startRatio * 100}%`,
    top: 5,
    width: `${Math.max(0.25, (endRatio - startRatio) * 100)}%`,
    height: 16,
    zIndex: 1,
    borderRadius: 3,
    border: '1px solid rgba(206, 255, 53, 0.36)',
    background: 'linear-gradient(90deg, rgba(206, 255, 53, 0.1), rgba(82, 214, 198, 0.09))',
    boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.035)',
    pointerEvents: 'none',
    userSelect: 'none',
    WebkitUserSelect: 'none',
    WebkitTouchCallout: 'none',
  };
}

function timelineSelectedRangeEdgeStyle(time: number, duration: number, edge: 'start' | 'end'): CSSProperties {
  const safeRatio = duration > 0 ? Math.max(0, Math.min(1, time / duration)) : 0;

  return {
    position: 'absolute',
    left: `${safeRatio * 100}%`,
    top: 2,
    bottom: 2,
    zIndex: 8,
    width: 3,
    transform: 'translateX(-50%)',
    borderRadius: 999,
    border: '1px solid rgba(255,255,255,0.52)',
    background: edge === 'start'
      ? 'linear-gradient(180deg, #f7ffd0, #b9ff2f)'
      : 'linear-gradient(180deg, #ecfeff, #20c7dc)',
    boxShadow: edge === 'start'
      ? '0 0 0 1px rgba(6, 10, 18, 0.78), 0 0 8px rgba(206, 255, 53, 0.2)'
      : '0 0 0 1px rgba(6, 10, 18, 0.78), 0 0 8px rgba(103, 232, 249, 0.24)',
    pointerEvents: 'none',
  };
}

function timelineRulerGuideLineStyle(ratio: number, active: boolean): CSSProperties {
  return {
    position: 'absolute',
    left: `${Math.max(0, Math.min(1, ratio)) * 100}%`,
    top: -3,
    bottom: -3,
    zIndex: 4,
    width: active ? 2 : 1,
    borderRadius: 999,
    background: active ? '#fef3c7' : 'rgba(191, 219, 254, 0.9)',
    boxShadow: active ? '0 0 14px rgba(251, 191, 36, 0.58)' : '0 0 9px rgba(96, 165, 250, 0.42)',
    pointerEvents: 'none',
  };
}

function timelineRulerGuideBadgeStyle(ratio: number, active: boolean): CSSProperties {
  const safeRatio = Math.max(0, Math.min(1, ratio));
  const nearRightEdge = safeRatio > 0.86;
  const nearLeftEdge = safeRatio < 0.14;

  return {
    position: 'absolute',
    left: `${safeRatio * 100}%`,
    top: -25,
    zIndex: 5,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    height: 20,
    borderRadius: 999,
    border: active ? '1px solid rgba(251, 191, 36, 0.58)' : '1px solid rgba(96, 165, 250, 0.46)',
    background: active ? 'rgba(113, 63, 18, 0.96)' : 'rgba(12, 15, 28, 0.94)',
    color: active ? '#fef3c7' : '#dbeafe',
    padding: '0 7px',
    fontSize: 10,
    fontWeight: 900,
    fontVariantNumeric: 'tabular-nums',
    whiteSpace: 'nowrap',
    transform: nearRightEdge ? 'translateX(-100%)' : nearLeftEdge ? 'none' : 'translateX(-50%)',
    boxShadow: '0 8px 18px rgba(0, 0, 0, 0.3)',
    pointerEvents: 'none',
  };
}

function timelineRulerMarkStyle(ratio: number): CSSProperties {
  return {
    position: 'absolute',
    left: `${Math.max(0, Math.min(1, ratio)) * 100}%`,
    top: 0,
    height: '100%',
    borderLeft: '1px solid rgba(255,255,255,0.12)',
    paddingLeft: ratio >= 0.96 ? 0 : 5,
    transform: ratio >= 0.96 ? 'translateX(-100%)' : 'none',
    color: '#cfd3e6',
    fontSize: 10,
    lineHeight: '24px',
    fontVariantNumeric: 'tabular-nums',
    whiteSpace: 'nowrap',
  };
}

const timelineRulerMetaStyle: CSSProperties = {
  color: '#717791',
  textAlign: 'center',
};

function stemTrackStyle(
  solo: boolean,
  advanced: boolean,
  selectedTrack: boolean,
  trackColor: string,
  gridColumns: string,
  minWidth: number,
  trackDensity: TrackDensity,
  collapsed: boolean,
): CSSProperties {
  const selectionWash = colorWithAlpha(trackColor, 0.16);
  const selectionEdge = colorWithAlpha(trackColor, 0.72);
  const compact = trackDensity === 'compact';
  const rowHeight = resolveDawTrackHeight({ advanced, density: trackDensity, selected: selectedTrack });
  const collapsedHeight = compact ? 48 : 56;
  const openHeight = compact ? 92 : 104;

  return {
    position: 'relative',
    zIndex: selectedTrack ? 30 : 1,
    display: 'grid',
    gridTemplateColumns: gridColumns,
    alignItems: 'center',
    gap: compact ? 4 : 5,
    minWidth,
    boxSizing: 'border-box',
    minHeight: collapsed ? collapsedHeight : Math.max(rowHeight, openHeight),
    borderRadius: 8,
    border: selectedTrack
      ? `1px solid ${colorWithAlpha(trackColor, 0.58)}`
      : solo
        ? '1px solid rgba(206, 255, 53, 0.42)'
        : '1px solid rgba(25, 30, 46, 0.92)',
    background: `
      linear-gradient(90deg, ${selectedTrack ? selectionWash : 'rgba(4, 7, 12, 0.98)'}, rgba(7, 10, 17, 0.96) 26%, rgba(3, 6, 11, 0.98)),
      linear-gradient(180deg, rgba(255,255,255,0.026), rgba(255,255,255,0))
    `,
    boxShadow: selectedTrack
      ? `inset 0 0 0 1px ${colorWithAlpha(trackColor, 0.24)}, inset 3px 0 0 ${selectionEdge}`
      : solo
        ? 'inset 3px 0 0 rgba(206, 255, 53, 0.58)'
        : 'none',
    opacity: 1,
    padding: selectedTrack
      ? collapsed ? '4px 8px' : compact ? '4px 8px' : '5px 8px'
      : collapsed ? '4px 8px' : compact ? '4px 8px' : '5px 8px',
    cursor: 'pointer',
    transition: 'min-height 180ms ease, opacity 140ms ease, border-color 140ms ease, background 140ms ease, box-shadow 140ms ease, padding 180ms ease',
  };
}

function stemNameStyle(selectedTrack: boolean, trackColor: string, collapsed = false): CSSProperties {
  return {
    position: 'sticky',
    left: 0,
    zIndex: 28,
    display: 'grid',
    gridTemplateColumns: '18px 10px minmax(0, 1fr) 22px auto',
    gridTemplateRows: collapsed ? 'auto' : 'auto auto auto',
    alignItems: 'center',
    gap: 6,
    width: '100%',
    minHeight: collapsed ? 44 : 94,
    minWidth: 0,
    maxWidth: '100%',
    alignSelf: 'stretch',
    padding: collapsed ? '5px 9px' : '7px 9px',
    borderRadius: 0,
    border: 'none',
    borderRight: selectedTrack ? `1px solid ${colorWithAlpha(trackColor, 0.42)}` : '1px solid rgba(255, 255, 255, 0.055)',
    background: selectedTrack
      ? `linear-gradient(90deg, ${colorWithAlpha(trackColor, 0.18)}, rgba(12, 15, 21, 0.98))`
      : 'linear-gradient(90deg, rgba(10, 14, 19, 0.99), rgba(8, 11, 16, 0.98))',
    boxShadow: selectedTrack ? `inset 3px 0 0 ${trackColor}` : 'none',
    overflow: 'hidden',
    isolation: 'isolate',
    opacity: 1,
    cursor: 'pointer',
    touchAction: 'none',
  };
}

function stemIndexStyle(selectedTrack: boolean): CSSProperties {
  return {
    width: 18,
    flexShrink: 0,
    color: selectedTrack ? '#f8fafc' : '#cbd5e1',
    fontSize: 10,
    fontWeight: 900,
    fontVariantNumeric: 'tabular-nums',
    textAlign: 'right',
  };
}

const stemIdentityStyle: CSSProperties = {
  display: 'grid',
  gap: 1,
  minWidth: 0,
  overflow: 'hidden',
};

const stemTitleRowStyle: CSSProperties = {
  minWidth: 0,
  overflow: 'hidden',
};

const stemLabelStyle: CSSProperties = {
  display: 'block',
  color: '#f8fafc',
  fontSize: 12,
  fontWeight: 900,
  lineHeight: 1.15,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const stemStatusRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  minWidth: 0,
  maxWidth: '100%',
  minHeight: 13,
  overflow: 'hidden',
};

function stemAudioStatusLabel(status: StemTrackAudioStatus) {
  if (status === 'ready') return '已缓存';
  if (status === 'loading') return '缓存中';
  if (status === 'failed') return '失败';
  if (status === 'skipped') return '空轨';
  return '待加载';
}

function stemAudioCornerBadgeStyle(status: StemTrackAudioStatus): CSSProperties {
  const palette: Record<StemTrackAudioStatus, string> = {
    ready: '#34d399',
    loading: '#60a5fa',
    failed: '#f87171',
    skipped: '#94a3b8',
    pending: '#fbbf24',
  };

  return {
    position: 'absolute',
    top: 8,
    left: 2,
    width: 10,
    height: 10,
    borderRadius: 999,
    background: palette[status],
    boxShadow: `0 0 0 2px rgba(8, 12, 21, 0.96), 0 0 10px ${palette[status]}66`,
    pointerEvents: 'none',
  };
}

function stemAudioStatusBadgeStyle(status: StemTrackAudioStatus): CSSProperties {
  const palette: Record<StemTrackAudioStatus, { border: string; background: string; color: string }> = {
    ready: {
      border: '1px solid rgba(52, 211, 153, 0.42)',
      background: 'rgba(16, 185, 129, 0.14)',
      color: '#86efac',
    },
    loading: {
      border: '1px solid rgba(96, 165, 250, 0.42)',
      background: 'rgba(37, 99, 235, 0.16)',
      color: '#bfdbfe',
    },
    failed: {
      border: '1px solid rgba(248, 113, 113, 0.48)',
      background: 'rgba(185, 28, 28, 0.18)',
      color: '#fecaca',
    },
    skipped: {
      border: '1px solid rgba(148, 163, 184, 0.34)',
      background: 'rgba(71, 85, 105, 0.16)',
      color: '#cbd5e1',
    },
    pending: {
      border: '1px solid rgba(251, 191, 36, 0.42)',
      background: 'rgba(217, 119, 6, 0.14)',
      color: '#fde68a',
    },
  };

  return {
    borderRadius: 999,
    ...palette[status],
    padding: '1px 5px',
    fontSize: 9,
    fontWeight: 900,
    lineHeight: 1.25,
    whiteSpace: 'nowrap',
    flexShrink: 0,
  };
}

function stemStateBadgeStyle(tone: 'solo' | 'muted' | 'range' | 'volume'): CSSProperties {
  const palette: Record<typeof tone, { border: string; background: string; color: string }> = {
    solo: {
      border: '1px solid rgba(251, 191, 36, 0.46)',
      background: 'rgba(251, 191, 36, 0.14)',
      color: '#fde68a',
    },
    muted: {
      border: '1px solid rgba(248, 113, 113, 0.46)',
      background: 'rgba(248, 113, 113, 0.14)',
      color: '#fecaca',
    },
    range: {
      border: '1px solid rgba(216, 180, 254, 0.42)',
      background: 'rgba(126, 34, 206, 0.16)',
      color: '#e9d5ff',
    },
    volume: {
      border: '1px solid rgba(96, 165, 250, 0.42)',
      background: 'rgba(37, 99, 235, 0.14)',
      color: '#bfdbfe',
    },
  };

  return {
    borderRadius: 999,
    ...palette[tone],
    padding: '1px 5px',
    fontSize: 9,
    fontWeight: 900,
    lineHeight: 1.25,
    whiteSpace: 'nowrap',
    flexShrink: 0,
  };
}

const stemTypeStyle: CSSProperties = {
  color: '#b7bdc9',
  fontSize: 10,
  fontWeight: 700,
  lineHeight: 1.25,
  textTransform: 'capitalize',
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  flex: '1 1 32px',
};

const trackHeaderSwitchesStyle: CSSProperties = {
  gridColumn: '5',
  gridRow: '1',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 3,
  justifyContent: 'flex-end',
};

function trackCollapseButtonStyle(active: boolean): CSSProperties {
  return {
    ...editorButtonChromeStyle({ tone: active ? 'info' : 'neutral', compact: true, round: true, active }),
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 24,
    height: 24,
    minWidth: 24,
    minHeight: 24,
    padding: 0,
    color: active ? '#081018' : '#f8fafc',
    lineHeight: 0,
    verticalAlign: 'middle',
  };
}

const trackFxButtonStyle: CSSProperties = {
  gridColumn: '1 / 3',
  gridRow: '2',
  justifySelf: 'start',
  ...editorButtonChromeStyle({ tone: 'neutral', compact: true, round: true }),
  minHeight: 20,
  padding: '0 7px',
  color: '#f8fafc',
  fontSize: 10,
  fontWeight: 950,
};

const trackMiniActionsStyle: CSSProperties = {
  gridColumn: '4 / 6',
  gridRow: '2',
  justifySelf: 'end',
  display: 'inline-flex',
  gap: 4,
  alignItems: 'center',
};

function trackMiniActionStyle(disabled: boolean): CSSProperties {
  return {
    ...editorButtonChromeStyle({ tone: 'purple', compact: true, round: true, disabled }),
    minHeight: 20,
    padding: '0 7px',
    fontSize: 10,
    fontWeight: 950,
  };
}

const trackHeaderVolumeStyle: CSSProperties = {
  gridColumn: '1 / 4',
  gridRow: '3',
  display: 'grid',
  gridTemplateColumns: '28px minmax(0, 1fr)',
  alignItems: 'center',
  gap: 7,
  minWidth: 0,
  color: '#f8fafc',
  fontSize: 10,
  fontWeight: 900,
};

const trackHeaderPanStyle: CSSProperties = {
  gridColumn: '4 / 6',
  gridRow: '3',
  display: 'grid',
  gridTemplateColumns: '10px 44px 10px',
  alignItems: 'center',
  gap: 3,
  minWidth: 0,
  color: '#cbd5e1',
  fontSize: 9,
  fontWeight: 900,
};

const stemButtonsStyle: CSSProperties = {
  display: 'flex',
  gap: 3,
  justifyContent: 'center',
};

function trackToggleStyle(active: boolean, tone: 'mute' | 'solo' | 'export' | 'retry' = 'export'): CSSProperties {
  const palette: Record<typeof tone, EditorButtonTone> = {
    mute: 'danger',
    solo: 'warning',
    export: 'purple',
    retry: 'info',
  };

  return {
    ...editorButtonChromeStyle({ tone: palette[tone], compact: true, active }),
    minWidth: tone === 'export' ? 38 : 25,
    minHeight: 24,
    padding: tone === 'export' ? '0 6px' : '0 3px',
    borderRadius: 5,
    fontSize: 10,
    fontWeight: 900,
    fontVariantNumeric: 'tabular-nums',
  };
}

const volumeStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '32px minmax(0, 1fr)',
  alignItems: 'center',
  gap: 6,
  color: '#9ca3af',
  fontSize: 11,
  fontWeight: 700,
};

const panStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '36px minmax(0, 1fr)',
  alignItems: 'center',
  gap: 7,
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
  ...editorButtonChromeStyle({ tone: 'neutral', compact: true }),
  minHeight: 22,
  borderRadius: 6,
  padding: '2px 7px',
  fontSize: 10,
  fontWeight: 900,
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
  clips,
  mutedRanges,
  muted,
  selected,
  editable,
  snapEnabled,
  snapStepSeconds,
  bufferVersion,
  liveSeekOnDrag,
  seekOnClipClick,
  trackType,
  clipWaveformSources,
  compact,
  collapsed,
  recording,
  trackLabel,
  selectedClipId,
  onSelect,
  onClipSelect,
  onTrackContextMenu,
  onSeek,
  onTrimChange,
  onTrimRangeMove,
  onClipMove,
}: {
  buffer: AudioBuffer | null;
  waveform: StemWaveform | null;
  color: string;
  currentTime: number;
  duration: number;
  trimStart: number;
  trimEnd: number;
  clips: StemClip[];
  mutedRanges: StemMutedRange[];
  muted: boolean;
  selected: boolean;
  editable: boolean;
  snapEnabled: boolean;
  snapStepSeconds: number;
  bufferVersion: number;
  liveSeekOnDrag: boolean;
  seekOnClipClick: boolean;
  trackType: string;
  clipWaveformSources: Record<string, StemClipWaveformSource>;
  compact: boolean;
  collapsed: boolean;
  recording: boolean;
  trackLabel: string;
  selectedClipId: string | null;
  onSelect: () => void;
  onClipSelect: (clipId: string) => void;
  onTrackContextMenu: (event: MouseEvent<HTMLCanvasElement>, time: number) => void;
  onSeek: (time: number, shouldSnap: boolean) => void;
  onTrimChange: (edge: 'start' | 'end', time: number, shouldSnap: boolean, phase: StemInteractionPhase, clipId?: string | null) => void;
  onTrimRangeMove: (nextStart: number, shouldSnap: boolean, phase: StemInteractionPhase) => void;
  onClipMove: (clipId: string, nextStart: number, shouldSnap: boolean, phase: StemInteractionPhase, clientX?: number, clientY?: number) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pendingSeekRef = useRef<{ x: number; time: number; moved: boolean; mode: 'click' | 'playhead' } | null>(null);
  const trimDragRef = useRef<{ edge: 'start' | 'end'; moved: boolean; clipId: string | null } | null>(null);
  const trimRangeDragRef = useRef<{ anchorTime: number; trimStart: number; trimEnd: number; moved: boolean } | null>(null);
  const clipDragRef = useRef<{ clipId: string; anchorTime: number; clipStart: number; pointerX: number; moved: boolean } | null>(null);
  const pendingTrimRef = useRef<{ time: number; shouldSnap: boolean } | null>(null);
  const pendingSeekTimeRef = useRef<{ time: number; shouldSnap: boolean } | null>(null);
  const trimFrameRef = useRef<number | null>(null);
  const seekFrameRef = useRef<number | null>(null);
  const [pointerGuide, setPointerGuide] = useState<{
    x: number;
    time: number;
    label: string;
    active: boolean;
    snapBypassed: boolean;
    placement: 'above' | 'inside';
  } | null>(null);
  const displayPeaks = useMemo(() => {
    if (waveform?.peaks?.length) return waveform.peaks;
    if (!buffer) return [];
    return buildWaveformPeaksFromSamples(buffer.getChannelData(0), 720);
  }, [buffer, bufferVersion, waveform?.peaks]);

  const timeFromPointer = useCallback((event: PointerEvent<HTMLCanvasElement> | MouseEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = rect.width > 0
      ? Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width))
      : 0;
    return ratio * duration;
  }, [duration]);

  const interactionTimeFromPointer = useCallback((event: PointerEvent<HTMLCanvasElement>) => {
    const shouldSnap = snapEnabled && !event.altKey;
    const time = snapStemEditorTime(timeFromPointer(event), duration, shouldSnap, snapStepSeconds);
    return { time, shouldSnap };
  }, [duration, snapEnabled, snapStepSeconds, timeFromPointer]);

  const updatePointerGuide = useCallback((
    event: PointerEvent<HTMLCanvasElement>,
    label = event.altKey && snapEnabled ? '精修' : '定位',
    active = false,
  ) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const scrollContainer = event.currentTarget.closest('.stem-timeline-track-body');
    const containerRect = scrollContainer?.getBoundingClientRect();
    const placement = containerRect && rect.top - containerRect.top < 26 ? 'inside' : 'above';
    const { time, shouldSnap } = interactionTimeFromPointer(event);
    setPointerGuide({
      x: Math.max(0, Math.min(rect.width, event.clientX - rect.left)),
      time,
      label,
      active,
      snapBypassed: snapEnabled && !shouldSnap,
      placement,
    });
  }, [interactionTimeFromPointer, snapEnabled]);

  const scheduleTrimChange = useCallback((time: number, shouldSnap: boolean) => {
    pendingTrimRef.current = { time, shouldSnap };
    if (trimFrameRef.current !== null) return;

    trimFrameRef.current = window.requestAnimationFrame(() => {
      trimFrameRef.current = null;
      const dragState = trimDragRef.current;
      const pendingTrim = pendingTrimRef.current;
      pendingTrimRef.current = null;
      if (!dragState || !pendingTrim) return;
      onTrimChange(dragState.edge, pendingTrim.time, pendingTrim.shouldSnap, 'preview', dragState.clipId);
    });
  }, [onTrimChange]);

  const cancelScheduledTrimChange = useCallback(() => {
    if (trimFrameRef.current !== null) {
      window.cancelAnimationFrame(trimFrameRef.current);
      trimFrameRef.current = null;
    }
    pendingTrimRef.current = null;
  }, []);

  const scheduleSeekChange = useCallback((time: number, shouldSnap: boolean) => {
    pendingSeekTimeRef.current = { time, shouldSnap };
    if (seekFrameRef.current !== null) return;

    seekFrameRef.current = window.requestAnimationFrame(() => {
      seekFrameRef.current = null;
      const pendingSeek = pendingSeekRef.current;
      const pendingSeekTime = pendingSeekTimeRef.current;
      pendingSeekTimeRef.current = null;
      if (!pendingSeek || pendingSeek.mode !== 'playhead' || !pendingSeekTime) return;
      onSeek(pendingSeekTime.time, pendingSeekTime.shouldSnap);
    });
  }, [onSeek]);

  const cancelScheduledSeekChange = useCallback(() => {
    if (seekFrameRef.current !== null) {
      window.cancelAnimationFrame(seekFrameRef.current);
      seekFrameRef.current = null;
    }
    pendingSeekTimeRef.current = null;
  }, []);

  useEffect(() => () => {
    cancelScheduledTrimChange();
    cancelScheduledSeekChange();
  }, [cancelScheduledSeekChange, cancelScheduledTrimChange]);

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

      const baseColor = recording ? '#f97316' : color;
      const backgroundColor = recording
        ? 'rgba(31, 17, 22, 0.96)'
        : selected
          ? colorWithAlpha(baseColor, 0.12)
          : 'rgba(5, 8, 14, 0.98)';
      const waveformColor = recording
        ? '#f97316'
        : muted
          ? colorWithAlpha(baseColor, 0.42)
          : baseColor;
      context.clearRect(0, 0, width, height);
      context.fillStyle = backgroundColor;
      context.fillRect(0, 0, width, height);

      const gridStep = snapEnabled && duration > 0
        ? Math.max((normalizeTimelineSnapStep(snapStepSeconds) / duration) * width, 18 * ratio)
        : Math.max(24 * ratio, width / 10);
      const gridOpacity = selected ? 0.09 : snapEnabled ? 0.064 : 0.04;
      context.strokeStyle = `rgba(255,255,255,${gridOpacity})`;
      context.lineWidth = Math.max(1, ratio);
      context.beginPath();
      for (let x = gridStep; x < width; x += gridStep) {
        context.moveTo(x, 0);
        context.lineTo(x, height);
      }
      context.stroke();
      if (snapEnabled && duration > 0) {
        const majorGridStep = gridStep * 4;
        context.strokeStyle = 'rgba(251,191,36,0.12)';
        context.beginPath();
        for (let x = majorGridStep; x < width; x += majorGridStep) {
          context.moveTo(x, 0);
          context.lineTo(x, height);
        }
        context.stroke();
      }

      const centerY = height / 2;
      context.strokeStyle = 'rgba(255,255,255,0.08)';
      context.beginPath();
      context.moveTo(0, centerY);
      context.lineTo(width, centerY);
      context.stroke();

      const hasClipSourcePeaks = clips.some((clip) => {
        const sourceType = clip.sourceTrackType || trackType;
        return Boolean(clipWaveformSources[sourceType]?.peaks.length);
      });

      if (!displayPeaks.length && !hasClipSourcePeaks) {
        context.fillStyle = 'rgba(206, 255, 53, 0.12)';
        context.fillRect(0, 0, width, height);
        context.fillStyle = '#8f92aa';
        context.font = `${Math.max(10, 11 * ratio)}px sans-serif`;
        context.textAlign = 'center';
        context.fillText('正在准备波形', width / 2, centerY + 4 * ratio);
        return;
      }

      const startX = (Math.max(0, trimStart) / duration) * width;
      const endX = (Math.min(duration, trimEnd) / duration) * width;
      context.fillStyle = 'rgba(5, 7, 14, 0.22)';
      context.fillRect(0, 0, startX, height);
      context.fillRect(endX, 0, Math.max(0, width - endX), height);

      if (clips.length <= 1) {
        context.fillStyle = selected ? colorWithAlpha(baseColor, 0.08) : 'rgba(255,255,255,0.012)';
        context.fillRect(startX, 0, Math.max(0, endX - startX), height);
      }

      const takeBarHeight = selected ? 15 * ratio : 13 * ratio;
      const renderClipWaveform = (clip: StemClip) => {
        const isSelectedClip = selected && clip.id === selectedClipId;
        const clipStartX = (Math.max(0, Math.min(duration, clip.start)) / duration) * width;
        const clipEndX = (Math.max(0, Math.min(duration, clip.start + getStemClipDuration(clip))) / duration) * width;
        const clipWidth = Math.max(0, clipEndX - clipStartX);
        if (clipWidth <= 1) return;

        const sourceType = clip.sourceTrackType || trackType;
        const clipSource = clipWaveformSources[sourceType];
        const sourcePeaks = clipSource?.peaks?.length ? clipSource.peaks : displayPeaks;
        const sourceDuration = Math.max(clipSource?.duration || 0, waveform?.duration || 0, buffer?.duration || 0, duration);
        const clipTrackLabel = clipSource?.label || trackLabel;
        const clipBaseColor = baseColor;
        const clipWaveformColor = recording
          ? '#f97316'
          : muted
            ? colorWithAlpha(clipBaseColor, 0.42)
            : clipBaseColor;
        const clipPeaks = sliceStemClipPeaks(clip, sourceDuration, sourcePeaks);
        const clipGradient = context.createLinearGradient(clipStartX, 0, clipEndX, 0);
        clipGradient.addColorStop(0, colorWithAlpha(clipBaseColor, recording ? 0.42 : isSelectedClip ? 0.48 : selected ? 0.36 : 0.24));
        clipGradient.addColorStop(0.55, colorWithAlpha(clipBaseColor, recording ? 0.34 : isSelectedClip ? 0.36 : selected ? 0.28 : 0.18));
        clipGradient.addColorStop(1, colorWithAlpha(clipBaseColor, recording ? 0.24 : isSelectedClip ? 0.28 : selected ? 0.22 : 0.13));
        context.fillStyle = clipGradient;
        context.fillRect(clipStartX, 0, clipWidth, height);

        const takeGradient = context.createLinearGradient(clipStartX, 0, clipEndX, 0);
        takeGradient.addColorStop(0, colorWithAlpha(clipBaseColor, recording ? 0.94 : 0.9));
        takeGradient.addColorStop(1, colorWithAlpha(clipBaseColor, recording ? 0.68 : 0.58));
        context.fillStyle = takeGradient;
        context.fillRect(clipStartX, 0, clipWidth, takeBarHeight);

        context.save();
        context.beginPath();
        context.rect(clipStartX, 0, clipWidth, height);
        context.clip();

        const clipGridStep = Math.max(12 * ratio, gridStep);
        context.strokeStyle = 'rgba(255,255,255,0.08)';
        context.lineWidth = Math.max(1, ratio);
        context.beginPath();
        for (let x = clipStartX + clipGridStep; x < clipEndX; x += clipGridStep) {
          context.moveTo(x, takeBarHeight);
          context.lineTo(x, height);
        }
        context.stroke();

        context.fillStyle = '#fff7ff';
        context.font = `${Math.max(8, 9 * ratio)}px sans-serif`;
        context.textAlign = 'left';
        context.fillText(`♛ Takes   ${clipTrackLabel}`, clipStartX + 7 * ratio, Math.max(10 * ratio, takeBarHeight - 4 * ratio));

        if (clipPeaks.length) {
          const step = clipPeaks.length > 1 ? clipWidth / (clipPeaks.length - 1) : clipWidth;
          const usableHeight = Math.max(1, height - takeBarHeight - 3 * ratio);
          const waveformCenterY = takeBarHeight + usableHeight / 2;
          const waveformScale = usableHeight * (recording ? 0.5 : 0.46);
          const visualPeakMax = Math.max(0.08, ...clipPeaks);
          const smoothedPeaks = clipPeaks.map((peak, index) => {
            const previous = clipPeaks[Math.max(0, index - 1)] ?? peak;
            const next = clipPeaks[Math.min(clipPeaks.length - 1, index + 1)] ?? peak;
            const normalizedPeak = Math.min(1, (previous * 0.16 + peak * 0.68 + next * 0.16) / visualPeakMax);
            const boostedPeak = Math.pow(normalizedPeak, 0.66) * 1.08;
            return Math.max(0.035, Math.min(1, boostedPeak));
          });

          const waveformFill = context.createLinearGradient(0, takeBarHeight, 0, height);
          waveformFill.addColorStop(0, muted ? colorWithAlpha(clipBaseColor, 0.44) : colorWithAlpha(clipWaveformColor, recording ? 0.94 : 0.96));
          waveformFill.addColorStop(0.5, muted ? colorWithAlpha(clipBaseColor, 0.34) : colorWithAlpha(clipWaveformColor, recording ? 0.9 : 0.88));
          waveformFill.addColorStop(1, muted ? colorWithAlpha(clipBaseColor, 0.26) : colorWithAlpha(clipWaveformColor, recording ? 0.72 : 0.68));

          context.save();
          context.shadowColor = recording ? 'rgba(249, 115, 22, 0.62)' : muted ? 'transparent' : colorWithAlpha(clipBaseColor, selected ? 0.38 : 0.22);
          context.shadowBlur = recording ? 7 * ratio : selected ? 4 * ratio : 1.5 * ratio;
          context.fillStyle = waveformFill;
          context.beginPath();
          smoothedPeaks.forEach((peak, index) => {
            const x = clipStartX + index * step;
            const y = Math.min(waveformScale, peak * waveformScale);
            const topY = waveformCenterY - y;
            if (index === 0) context.moveTo(x, topY);
            else context.lineTo(x, topY);
          });
          for (let index = smoothedPeaks.length - 1; index >= 0; index -= 1) {
            const x = clipStartX + index * step;
            const y = Math.min(waveformScale, smoothedPeaks[index] * waveformScale);
            context.lineTo(x, waveformCenterY + y);
          }
          context.closePath();
          context.fill();
          context.restore();
        }

        context.restore();

        context.strokeStyle = isSelectedClip ? '#f8fafc' : selected ? colorWithAlpha(clipBaseColor, 0.82) : colorWithAlpha(clipBaseColor, 0.46);
        context.lineWidth = Math.max(1, isSelectedClip ? 1.6 * ratio : selected ? 1.1 * ratio : ratio);
        context.strokeRect(clipStartX + 0.5 * ratio, 0.5 * ratio, Math.max(0, clipWidth - ratio), Math.max(0, height - ratio));
      };

      clips.forEach((clip) => {
        renderClipWaveform(clip);
      });

      const mutedRects = mapStemMutedRangesToPixels({ mutedRanges, duration, width });
      mutedRects.forEach((rect) => {
        context.fillStyle = selected ? 'rgba(244, 63, 94, 0.34)' : 'rgba(244, 63, 94, 0.22)';
        context.fillRect(rect.x, 0, rect.width, height);
        context.fillStyle = 'rgba(255,255,255,0.17)';
        context.fillRect(rect.x, 0, Math.max(1, ratio), height);
        context.fillRect(rect.x + rect.width - Math.max(1, ratio), 0, Math.max(1, ratio), height);
      });

      if (selected) {
        if (mutedRects.length > 0) {
          context.fillStyle = 'rgba(255,255,255,0.88)';
          context.textAlign = 'left';
          context.fillText(`静音 ${mutedRects.length}`, 8 * ratio, height - 8 * ratio);
        }
      }
      if (recording) {
        context.fillStyle = 'rgba(255,255,255,0.92)';
        context.font = `${Math.max(9, 10 * ratio)}px sans-serif`;
        context.textAlign = 'left';
        context.fillText('REC', 8 * ratio, 13 * ratio);
        context.fillStyle = '#fb7185';
        context.beginPath();
        context.arc(32 * ratio, 9 * ratio, 3.5 * ratio, 0, Math.PI * 2);
        context.fill();
      }

    };

    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [buffer, clipWaveformSources, clips, color, displayPeaks, duration, muted, mutedRanges, recording, selected, selectedClipId, snapEnabled, snapStepSeconds, trackLabel, trackType, trimEnd, trimStart, waveform?.duration]);

  const handlePointerDown = useCallback((event: PointerEvent<HTMLCanvasElement>) => {
    if (duration <= 0) return;
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const pointerX = event.clientX - rect.left;
    const selectedClipForIntent = selectedClipId
      ? clips.find((clip) => clip.id === selectedClipId) || null
      : selected && clips.length === 1
        ? clips[0]
        : null;
    const intentTrimStart = selectedClipForIntent?.start ?? trimStart;
    const intentTrimEnd = selectedClipForIntent
      ? selectedClipForIntent.start + getStemClipDuration(selectedClipForIntent)
      : trimEnd;
    const intent = resolveWaveformPointerIntent({
      editable,
      pointerX,
      width: rect.width,
      duration,
      trimStart: intentTrimStart,
      trimEnd: intentTrimEnd,
      currentTime,
      hitSize: selected ? 48 : 40,
    });

    onSelect();

    if (intent.kind === 'trim') {
      trimDragRef.current = {
        edge: intent.edge,
        moved: false,
        clipId: selectedClipForIntent?.id ?? null,
      };
      trimRangeDragRef.current = null;
      clipDragRef.current = null;
      pendingSeekRef.current = null;
      updatePointerGuide(event, intent.edge === 'start' ? '入点' : '出点', true);
    } else {
      const { time } = interactionTimeFromPointer(event);
      const targetClip = resolveStemClipDragTarget(clips, time);
      if (targetClip) {
        onClipSelect(targetClip.id);
        if (event.detail > 1) {
          trimDragRef.current = null;
          trimRangeDragRef.current = null;
          clipDragRef.current = null;
          pendingSeekRef.current = null;
          updatePointerGuide(event, '选择片段', false);
          return;
        }
        clipDragRef.current = {
          clipId: targetClip.id,
          anchorTime: time,
          clipStart: targetClip.start,
          pointerX: event.clientX,
          moved: false,
        };
        trimDragRef.current = null;
        trimRangeDragRef.current = null;
        pendingSeekRef.current = null;
        updatePointerGuide(event, '移动片段', true);
        safelySetPointerCapture(event.currentTarget, event.pointerId);
        return;
      }
      if (intent.kind === 'move-trim' && clips.length <= 1) {
        trimRangeDragRef.current = {
          anchorTime: intent.time,
          trimStart,
          trimEnd,
          moved: false,
        };
        trimDragRef.current = null;
        clipDragRef.current = null;
        pendingSeekRef.current = null;
        updatePointerGuide(event, '移动选区', true);
      } else {
        trimDragRef.current = null;
        trimRangeDragRef.current = null;
        clipDragRef.current = null;
        if (intent.kind === 'playhead') {
          pendingSeekRef.current = {
            x: event.clientX,
            time,
            moved: false,
            mode: 'playhead',
          };
          updatePointerGuide(event, '播放头', true);
        } else {
          pendingSeekRef.current = null;
          updatePointerGuide(event, '选择', false);
        }
      }
    }
    safelySetPointerCapture(event.currentTarget, event.pointerId);
  }, [clips, currentTime, duration, editable, interactionTimeFromPointer, onClipSelect, onSelect, selected, selectedClipId, trimEnd, trimStart, updatePointerGuide]);

  const handlePointerMove = useCallback((event: PointerEvent<HTMLCanvasElement>) => {
    if (trimDragRef.current) {
      trimDragRef.current.moved = true;
      const { time, shouldSnap } = interactionTimeFromPointer(event);
      scheduleTrimChange(time, shouldSnap);
      updatePointerGuide(event, trimDragRef.current.edge === 'start' ? '入点' : '出点', true);
      event.preventDefault();
      return;
    }

    if (trimRangeDragRef.current) {
      trimRangeDragRef.current.moved = true;
      const { time, shouldSnap } = interactionTimeFromPointer(event);
      onTrimRangeMove(trimRangeDragRef.current.trimStart + time - trimRangeDragRef.current.anchorTime, shouldSnap, 'preview');
      updatePointerGuide(event, '移动选区', true);
      event.preventDefault();
      return;
    }

    if (clipDragRef.current) {
      if (!clipDragRef.current.moved && Math.abs(event.clientX - clipDragRef.current.pointerX) < 4) {
        updatePointerGuide(event, '移动片段', true);
        return;
      }
      clipDragRef.current.moved = true;
      const { time, shouldSnap } = interactionTimeFromPointer(event);
      onClipMove(clipDragRef.current.clipId, clipDragRef.current.clipStart + time - clipDragRef.current.anchorTime, shouldSnap, 'preview', event.clientX, event.clientY);
      updatePointerGuide(event, '移动片段', true);
      event.preventDefault();
      return;
    }

    const pendingSeek = pendingSeekRef.current;
    if (pendingSeek) {
      if (Math.abs(event.clientX - pendingSeek.x) > 4) {
        pendingSeek.moved = true;
      }
      if (pendingSeek.mode === 'playhead') {
        if (liveSeekOnDrag) {
          const { time, shouldSnap } = interactionTimeFromPointer(event);
          scheduleSeekChange(time, shouldSnap);
        }
        updatePointerGuide(event, '播放头', true);
        event.preventDefault();
      }
      return;
    }

    updatePointerGuide(event);
  }, [interactionTimeFromPointer, liveSeekOnDrag, onClipMove, onTrimRangeMove, scheduleSeekChange, scheduleTrimChange, updatePointerGuide]);

  const handlePointerUp = useCallback((event: PointerEvent<HTMLCanvasElement>) => {
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // Pointer capture may already be released if the browser cancelled it.
    }

    if (trimDragRef.current) {
      cancelScheduledTrimChange();
      const { time, shouldSnap } = interactionTimeFromPointer(event);
      if (!trimDragRef.current.moved) {
        onTrimChange(trimDragRef.current.edge, time, shouldSnap, 'commit', trimDragRef.current.clipId);
      } else {
        onTrimChange(trimDragRef.current.edge, time, shouldSnap, 'commit', trimDragRef.current.clipId);
      }
      trimDragRef.current = null;
      pendingSeekRef.current = null;
      updatePointerGuide(event, '裁剪', false);
      return;
    }

    if (trimRangeDragRef.current) {
      const { time, shouldSnap } = interactionTimeFromPointer(event);
      const nextStart = trimRangeDragRef.current.trimStart + time - trimRangeDragRef.current.anchorTime;
      onTrimRangeMove(nextStart, shouldSnap, 'commit');
      trimRangeDragRef.current = null;
      pendingSeekRef.current = null;
      updatePointerGuide(event, '移动选区', false);
      return;
    }

    if (clipDragRef.current) {
      const { time, shouldSnap } = interactionTimeFromPointer(event);
      if (clipDragRef.current.moved) {
        onClipMove(clipDragRef.current.clipId, clipDragRef.current.clipStart + time - clipDragRef.current.anchorTime, shouldSnap, 'commit', event.clientX, event.clientY);
      } else {
        onClipSelect(clipDragRef.current.clipId);
      }
      clipDragRef.current = null;
      pendingSeekRef.current = null;
      updatePointerGuide(event, '移动片段', false);
      return;
    }

    const pendingSeek = pendingSeekRef.current;
    cancelScheduledSeekChange();
    pendingSeekRef.current = null;
    if (pendingSeek?.mode === 'playhead') {
      const { time, shouldSnap } = interactionTimeFromPointer(event);
      if (seekOnClipClick) onSeek(time, shouldSnap);
      updatePointerGuide(event, '播放头', false);
      return;
    }
    updatePointerGuide(event, '选择', false);
  }, [cancelScheduledSeekChange, cancelScheduledTrimChange, interactionTimeFromPointer, onClipMove, onClipSelect, onSeek, onTrimChange, onTrimRangeMove, seekOnClipClick, updatePointerGuide]);

  const selectedClipForOverlay = selectedClipId
    ? clips.find((clip) => clip.id === selectedClipId) || null
    : selected && clips.length === 1
      ? clips[0]
      : null;

  return (
    <div
      style={waveformCanvasWrapStyle}
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      <canvas
        ref={canvasRef}
        draggable={false}
        aria-label="分轨波形。可选择轨道、拖动播放头或拖动边界编辑。"
        onContextMenu={(event) => onTrackContextMenu(event, timeFromPointer(event))}
        onDragStart={(event) => event.preventDefault()}
        onDoubleClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={() => {
          if (!trimDragRef.current && !trimRangeDragRef.current && !clipDragRef.current && !pendingSeekRef.current) {
            setPointerGuide(null);
          }
        }}
        style={waveformCanvasStyle(selected, muted, editable, compact, collapsed, recording)}
      />
      {duration > 0 && selectedClipForOverlay && (
        <>
          <span
            aria-hidden="true"
            style={waveformSelectedClipOverlayStyle(selectedClipForOverlay, duration, color)}
          />
          <span
            aria-hidden="true"
            style={waveformClipHandleStyle(selectedClipForOverlay.start, duration, 'start')}
          />
          <span
            aria-hidden="true"
            style={waveformClipHandleStyle(selectedClipForOverlay.start + getStemClipDuration(selectedClipForOverlay), duration, 'end')}
          />
        </>
      )}
      {duration > 0 && !selectedClipForOverlay && (
        <>
          <span
            aria-hidden="true"
            style={waveformTrimHandleStyle(trimStart, duration, selected, 'start')}
          />
          <span
            aria-hidden="true"
            style={waveformTrimHandleStyle(trimEnd, duration, selected, 'end')}
          />
        </>
      )}
      {pointerGuide && (
        <div style={waveformPointerGuideStyle(pointerGuide.x, pointerGuide.active, pointerGuide.placement)}>
          <span>{pointerGuide.label}</span>
          <strong>{formatStemTimecode(pointerGuide.time)}</strong>
          {pointerGuide.snapBypassed && <em>Alt</em>}
        </div>
      )}
    </div>
  );
}

const waveformCanvasWrapStyle: CSSProperties = {
  position: 'relative',
  minWidth: 0,
  userSelect: 'none',
  WebkitUserSelect: 'none',
  WebkitTouchCallout: 'none',
};

function waveformCanvasStyle(selected: boolean, muted: boolean, editable: boolean, compact: boolean, collapsed: boolean, recording = false): CSSProperties {
  const waveformHeight = compact ? 64 : 76;

  return {
    width: '100%',
    height: collapsed
      ? compact ? 34 : 40
      : waveformHeight,
    borderRadius: 4,
    border: recording ? '1px solid rgba(251, 113, 133, 0.92)' : selected ? '1px solid rgba(206, 255, 53, 0.46)' : '1px solid rgba(55, 61, 83, 0.82)',
    background: recording ? 'linear-gradient(180deg, #241317, #090b12)' : 'linear-gradient(180deg, #111827, #080c15)',
    boxShadow: selected
      ? recording
        ? 'inset 0 0 0 1px rgba(251, 113, 133, 0.22), 0 0 22px rgba(248, 113, 113, 0.16)'
        : 'inset 0 0 0 1px rgba(206, 255, 53, 0.18), 0 0 0 1px rgba(82, 214, 198, 0.18)'
      : 'inset 0 1px 0 rgba(255,255,255,0.035)',
    cursor: editable ? 'grab' : 'default',
    opacity: muted ? 0.72 : 1,
    touchAction: 'none',
    userSelect: 'none',
    WebkitUserSelect: 'none',
    WebkitTouchCallout: 'none',
    transition: 'border-color 140ms ease, box-shadow 140ms ease, opacity 140ms ease',
  };
}

function waveformSelectedClipOverlayStyle(clip: StemClip, duration: number, color: string): CSSProperties {
  const startRatio = duration > 0 ? Math.max(0, Math.min(1, clip.start / duration)) : 0;
  const endRatio = duration > 0 ? Math.max(startRatio, Math.min(1, (clip.start + getStemClipDuration(clip)) / duration)) : startRatio;
  const left = startRatio * 100;
  const width = Math.max(0, (endRatio - startRatio) * 100);

  return {
    position: 'absolute',
    top: 2,
    bottom: 2,
    left: `${left}%`,
    width: `${width}%`,
    zIndex: 13,
    borderRadius: 5,
    border: '2px solid rgba(255, 255, 255, 0.94)',
    boxShadow: `inset 0 0 0 1px ${colorWithAlpha(color, 0.72)}, 0 0 0 1px rgba(4, 7, 13, 0.92), 0 0 18px ${colorWithAlpha(color, 0.3)}`,
    background: colorWithAlpha(color, 0.08),
    pointerEvents: 'none',
  };
}

function waveformClipHandleStyle(time: number, duration: number, edge: 'start' | 'end'): CSSProperties {
  const safeRatio = duration > 0 ? Math.max(0, Math.min(1, time / duration)) : 0;
  const stickToStart = edge === 'start' && safeRatio <= 0.002;
  const stickToEnd = edge === 'end' && safeRatio >= 0.998;

  return {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: stickToEnd ? undefined : `${safeRatio * 100}%`,
    right: stickToEnd ? 0 : undefined,
    transform: stickToStart || stickToEnd ? 'none' : edge === 'start' ? 'translateX(-50%)' : 'translateX(-50%)',
    zIndex: 14,
    width: 5,
    borderRadius: 999,
    border: '1px solid rgba(6, 10, 18, 0.92)',
    background: 'linear-gradient(180deg, #ffffff, #ceff35)',
    boxShadow: '0 0 0 1px rgba(255,255,255,0.72), 0 0 12px rgba(206, 255, 53, 0.44)',
    pointerEvents: 'none',
  };
}

function waveformTrimHandleStyle(time: number, duration: number, selected: boolean, edge: 'start' | 'end'): CSSProperties {
  const safeRatio = duration > 0 ? Math.max(0, Math.min(1, time / duration)) : 0;
  const stickToStart = edge === 'start' && safeRatio <= 0.002;
  const stickToEnd = edge === 'end' && safeRatio >= 0.998;

  return {
    position: 'absolute',
    top: selected ? 1 : 6,
    bottom: selected ? 1 : 6,
    left: stickToEnd ? undefined : `${safeRatio * 100}%`,
    right: stickToEnd ? 0 : undefined,
    transform: stickToStart || stickToEnd ? 'none' : edge === 'start' ? 'translateX(0)' : 'translateX(-100%)',
    zIndex: selected ? 8 : 3,
    width: selected ? 2 : 2,
    borderRadius: 999,
    border: selected ? '1px solid rgba(206, 255, 53, 0.34)' : '1px solid rgba(206, 255, 53, 0.28)',
    background: selected ? 'rgba(206, 255, 53, 0.42)' : 'rgba(206, 255, 53, 0.34)',
    boxShadow: selected
      ? '0 0 0 1px rgba(6, 10, 18, 0.72), 0 0 6px rgba(206, 255, 53, 0.14)'
      : '0 0 6px rgba(206, 255, 53, 0.1)',
    pointerEvents: 'none',
  };
}

function waveformPointerGuideStyle(x: number, active: boolean, placement: 'above' | 'inside'): CSSProperties {
  return {
    position: 'absolute',
    left: x,
    top: placement === 'inside' ? 5 : active ? -23 : -19,
    transform: 'translateX(-50%)',
    zIndex: 90,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    height: active ? 22 : 20,
    padding: '0 7px',
    borderRadius: 999,
    border: active ? '1px solid rgba(216, 201, 255, 0.86)' : '1px solid rgba(83, 88, 123, 0.72)',
    background: active ? 'rgba(75, 38, 144, 0.96)' : 'rgba(12, 15, 28, 0.92)',
    boxShadow: active ? '0 8px 22px rgba(0, 0, 0, 0.28)' : '0 4px 12px rgba(0, 0, 0, 0.18)',
    color: '#e8e6ff',
    fontSize: 10,
    fontWeight: 700,
    lineHeight: 1,
    whiteSpace: 'nowrap',
    pointerEvents: 'none',
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

function stemColorStyle(color: string): CSSProperties {
  return {
    width: 8,
    height: 32,
    flexShrink: 0,
    borderRadius: 999,
    background: color,
  };
}

