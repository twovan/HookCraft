import type { MembershipTier } from '@/types/membership';

export type EditorPanelAccess = 'free' | 'basicEditor' | 'proEditor';
export type StemSeparationMode = 'separate_vocal' | 'split_stem';
export type StemEditorMode = 'basic' | 'pro';
export type StemResultType = 'two_track_vocal_instrumental' | 'twelve_stem_groups';

export interface StemEditorModeSettings {
  basicEditor: boolean;
  proEditor: boolean;
  defaultMode: StemEditorMode;
  showCreditConfirm: boolean;
  allowUpgradeFromBasic: boolean;
  allowForceRefresh: boolean;
}

export interface StemEditorStemSettings {
  separateVocal: boolean;
  splitStem: boolean;
  resultType: StemResultType;
}

export interface StemEditorEditingSettings {
  playback: boolean;
  trackVolume: boolean;
  muteSolo: boolean;
  pan: boolean;
  trim: boolean;
  fade: boolean;
  previewSelection: boolean;
  muteRanges: boolean;
  splitClip: boolean;
  deleteClip: boolean;
  copyCutPaste: boolean;
  clipDrag: boolean;
  crossTrackDrag: boolean;
  snap: boolean;
  zoom: boolean;
  followPlayhead: boolean;
  loopPreview: boolean;
  undoRedo: boolean;
  autoSave: boolean;
  localDraftRecovery: boolean;
}

export interface StemEditorAdvancedSettings {
  addTrack: boolean;
  importAudio: boolean;
  recording: boolean;
  recordingDeviceSelect: boolean;
  recordingChannelSelect: boolean;
  recordingInputLevel: boolean;
  recordingMonitoring: boolean;
  trackRename: boolean;
  trackColor: boolean;
  trackReorder: boolean;
  trackViewFilter: boolean;
  trackDensity: boolean;
  shortcutHelp: boolean;
}

export interface StemEditorExportSettings {
  mp3Mix: boolean;
  mp3Stems: boolean;
  wavMix: boolean;
  wavStems: boolean;
  soloOnly: boolean;
  advancedExportModes: boolean;
  exportHistory: boolean;
}

export interface StemEditorTierFeatureSettings {
  modes: StemEditorModeSettings;
  stems: StemEditorStemSettings;
  editing: StemEditorEditingSettings;
  advanced: StemEditorAdvancedSettings;
  export: StemEditorExportSettings;
}

export interface StemEditorFeatureSettings {
  basicEditor: StemEditorTierFeatureSettings;
  proEditor: StemEditorTierFeatureSettings;
}

export const DEFAULT_STEM_EDITOR_FEATURE_SETTINGS: StemEditorFeatureSettings = {
  basicEditor: {
    modes: {
      basicEditor: true,
      proEditor: false,
      defaultMode: 'basic',
      showCreditConfirm: true,
      allowUpgradeFromBasic: true,
      allowForceRefresh: false,
    },
    stems: {
      separateVocal: true,
      splitStem: false,
      resultType: 'two_track_vocal_instrumental',
    },
    editing: {
      playback: true,
      trackVolume: true,
      muteSolo: true,
      pan: true,
      trim: true,
      fade: true,
      previewSelection: true,
      muteRanges: true,
      splitClip: true,
      deleteClip: true,
      copyCutPaste: true,
      clipDrag: true,
      crossTrackDrag: true,
      snap: true,
      zoom: true,
      followPlayhead: true,
      loopPreview: true,
      undoRedo: true,
      autoSave: true,
      localDraftRecovery: true,
    },
    advanced: {
      addTrack: false,
      importAudio: false,
      recording: false,
      recordingDeviceSelect: false,
      recordingChannelSelect: false,
      recordingInputLevel: false,
      recordingMonitoring: false,
      trackRename: false,
      trackColor: false,
      trackReorder: false,
      trackViewFilter: false,
      trackDensity: false,
      shortcutHelp: false,
    },
    export: {
      mp3Mix: true,
      mp3Stems: true,
      wavMix: false,
      wavStems: false,
      soloOnly: false,
      advancedExportModes: false,
      exportHistory: false,
    },
  },
  proEditor: {
    modes: {
      basicEditor: true,
      proEditor: true,
      defaultMode: 'basic',
      showCreditConfirm: true,
      allowUpgradeFromBasic: true,
      allowForceRefresh: true,
    },
    stems: {
      separateVocal: true,
      splitStem: true,
      resultType: 'twelve_stem_groups',
    },
    editing: {
      playback: true,
      trackVolume: true,
      muteSolo: true,
      pan: true,
      trim: true,
      fade: true,
      previewSelection: true,
      muteRanges: true,
      splitClip: true,
      deleteClip: true,
      copyCutPaste: true,
      clipDrag: true,
      crossTrackDrag: true,
      snap: true,
      zoom: true,
      followPlayhead: true,
      loopPreview: true,
      undoRedo: true,
      autoSave: true,
      localDraftRecovery: true,
    },
    advanced: {
      addTrack: true,
      importAudio: true,
      recording: true,
      recordingDeviceSelect: true,
      recordingChannelSelect: true,
      recordingInputLevel: true,
      recordingMonitoring: true,
      trackRename: true,
      trackColor: true,
      trackReorder: true,
      trackViewFilter: true,
      trackDensity: true,
      shortcutHelp: true,
    },
    export: {
      mp3Mix: true,
      mp3Stems: true,
      wavMix: true,
      wavStems: true,
      soloOnly: true,
      advancedExportModes: true,
      exportHistory: true,
    },
  },
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function boolOr(value: unknown, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback;
}

function normalizeMode(value: unknown, fallback: StemEditorMode): StemEditorMode {
  return value === 'basic' || value === 'pro' ? value : fallback;
}

function normalizeResultType(value: unknown, fallback: StemResultType): StemResultType {
  return value === 'two_track_vocal_instrumental' || value === 'twelve_stem_groups'
    ? value
    : fallback;
}

function normalizeModes(value: unknown, fallback: StemEditorModeSettings): StemEditorModeSettings {
  const input = asRecord(value);
  return {
    basicEditor: boolOr(input.basicEditor, fallback.basicEditor),
    proEditor: boolOr(input.proEditor, fallback.proEditor),
    defaultMode: normalizeMode(input.defaultMode, fallback.defaultMode),
    showCreditConfirm: boolOr(input.showCreditConfirm, fallback.showCreditConfirm),
    allowUpgradeFromBasic: boolOr(input.allowUpgradeFromBasic, fallback.allowUpgradeFromBasic),
    allowForceRefresh: boolOr(input.allowForceRefresh, fallback.allowForceRefresh),
  };
}

function normalizeStems(value: unknown, fallback: StemEditorStemSettings): StemEditorStemSettings {
  const input = asRecord(value);
  return {
    separateVocal: boolOr(input.separateVocal, fallback.separateVocal),
    splitStem: boolOr(input.splitStem, fallback.splitStem),
    resultType: normalizeResultType(input.resultType, fallback.resultType),
  };
}

function normalizeBooleanGroup<T extends object>(value: unknown, fallback: T): T {
  const input = asRecord(value);
  return Object.fromEntries(
    Object.entries(fallback as Record<string, boolean>).map(([key, defaultValue]) => [
      key,
      boolOr(input[key], defaultValue),
    ]),
  ) as T;
}

function normalizeTierSettings(
  value: unknown,
  fallback: StemEditorTierFeatureSettings,
): StemEditorTierFeatureSettings {
  const input = asRecord(value);
  return {
    modes: normalizeModes(input.modes, fallback.modes),
    stems: normalizeStems(input.stems, fallback.stems),
    editing: normalizeBooleanGroup(input.editing, fallback.editing),
    advanced: normalizeBooleanGroup(input.advanced, fallback.advanced),
    export: normalizeBooleanGroup(input.export, fallback.export),
  };
}

export function normalizeStemEditorFeatureSettings(value: unknown): StemEditorFeatureSettings {
  const input = asRecord(value);
  const basicEditorInput = input.basicEditor ?? input.plus;
  const proEditorInput = input.proEditor ?? input.pro;
  return {
    basicEditor: normalizeTierSettings(basicEditorInput, DEFAULT_STEM_EDITOR_FEATURE_SETTINGS.basicEditor),
    proEditor: normalizeTierSettings(proEditorInput, DEFAULT_STEM_EDITOR_FEATURE_SETTINGS.proEditor),
  };
}

export function resolveEditorPanelAccess(tier: MembershipTier | null | undefined): EditorPanelAccess {
  if (tier === 'business') return 'proEditor';
  if (tier === 'pro') return 'basicEditor';
  return 'free';
}

export function editorPanelForSeparationMode(mode: StemSeparationMode): Exclude<EditorPanelAccess, 'free'> {
  return mode === 'split_stem' ? 'proEditor' : 'basicEditor';
}

export function resolveStemSeparationMode(
  settings: StemEditorFeatureSettings,
  editorPanel: EditorPanelAccess,
  requestedMode: unknown,
): StemSeparationMode | null {
  if (editorPanel === 'free') return null;

  const tierSettings = settings[editorPanel];
  const requested = requestedMode === 'split_stem' ? 'split_stem' : 'separate_vocal';

  if (requested === 'split_stem' && tierSettings.modes.proEditor && tierSettings.stems.splitStem) {
    return 'split_stem';
  }

  if (tierSettings.modes.basicEditor && tierSettings.stems.separateVocal) {
    return 'separate_vocal';
  }

  if (tierSettings.modes.proEditor && tierSettings.stems.splitStem) {
    return 'split_stem';
  }

  return null;
}
