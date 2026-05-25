export type StemExportMode = 'current-mix' | 'all-tracks' | 'solo-only';

export interface StemExportPreflightTrack {
  type: string;
  label: string;
  loaded: boolean;
  knownEmpty?: boolean;
  muted: boolean;
  solo: boolean;
  volume: number;
}

export interface StemExportPreflightResult {
  plannedTypes: string[];
  exportableTypes: string[];
  missingTypes: string[];
  skippedTypes: string[];
  emptyTypes: string[];
  plannedLabels: string[];
  exportableLabels: string[];
  missingLabels: string[];
  skippedLabels: string[];
  emptyLabels: string[];
  sourceCount: number;
  loadedCount: number;
  canExport: boolean;
  summary: string;
}

interface StemExportPreflightInput {
  tracks: StemExportPreflightTrack[];
  mode: StemExportMode;
  hasSoloTrack: boolean;
  waitForAll: boolean;
}

function isIncludedInExport(track: StemExportPreflightTrack, mode: StemExportMode, hasSoloTrack: boolean) {
  if (track.volume <= 0) return false;
  if (mode === 'all-tracks') return true;
  if (mode === 'solo-only') return track.solo;
  return !track.muted && (!hasSoloTrack || track.solo);
}

function pickTypes(tracks: StemExportPreflightTrack[]) {
  return tracks.map((track) => track.type);
}

function pickLabels(tracks: StemExportPreflightTrack[]) {
  return tracks.map((track) => track.label);
}

export function buildStemExportPreflight(input: StemExportPreflightInput): StemExportPreflightResult {
  const emptyTracks = input.tracks.filter((track) => track.knownEmpty);
  const sourceTracks = input.tracks.filter((track) => !track.knownEmpty);
  const plannedTracks = sourceTracks.filter((track) => isIncludedInExport(track, input.mode, input.hasSoloTrack));
  const exportableTracks = plannedTracks.filter((track) => track.loaded);
  const missingTracks = plannedTracks.filter((track) => !track.loaded);
  const skippedTracks = sourceTracks.filter((track) => !isIncludedInExport(track, input.mode, input.hasSoloTrack));
  const canExport = input.waitForAll ? plannedTracks.length > 0 : exportableTracks.length > 0;

  return {
    plannedTypes: pickTypes(plannedTracks),
    exportableTypes: pickTypes(exportableTracks),
    missingTypes: pickTypes(missingTracks),
    skippedTypes: pickTypes(skippedTracks),
    emptyTypes: pickTypes(emptyTracks),
    plannedLabels: pickLabels(plannedTracks),
    exportableLabels: pickLabels(exportableTracks),
    missingLabels: pickLabels(missingTracks),
    skippedLabels: pickLabels(skippedTracks),
    emptyLabels: pickLabels(emptyTracks),
    sourceCount: sourceTracks.length,
    loadedCount: sourceTracks.filter((track) => track.loaded).length,
    canExport,
    summary: missingTracks.length > 0
      ? `将导出 ${exportableTracks.length}/${plannedTracks.length} 条，等待 ${missingTracks.length} 条缓存`
      : `将导出 ${exportableTracks.length} 条`,
  };
}
