import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const source = [
  'src/components/studio/StemMixerEditor.tsx',
  'src/app/studio/stem-editor/StemEditorPageClient.tsx',
  'src/app/api/stems/create/route.ts',
  'src/config/stemEditorFeatures.ts',
].map((file) => readFileSync(join(root, file), 'utf8')).join('\n');

const enforcedSwitches: Array<[string, RegExp]> = [
  ['basicEditor', /modes\.basicEditor|activeSettings\.modes\.basicEditor|resolveStemSeparationMode/],
  ['proEditor', /modes\.proEditor|activeSettings\.modes\.proEditor|resolveStemSeparationMode/],
  ['showCreditConfirm', /showCreditConfirm/],
  ['allowUpgradeFromBasic', /allowUpgradeFromBasic/],
  ['allowForceRefresh', /canForceRefresh|allowForceRefresh/],
  ['separateVocal', /separateVocal|separate_vocal/],
  ['splitStem', /splitStem|split_stem/],
  ['playback', /canUsePlayback|editing\.playback/],
  ['trackVolume', /canUseTrackVolume|editing\.trackVolume/],
  ['muteSolo', /canUseMuteSolo|editing\.muteSolo/],
  ['pan', /canUsePan|editing\.pan/],
  ['trim', /canUseTrim|editing\.trim/],
  ['fade', /canUseFade|editing\.fade/],
  ['previewSelection', /previewSelection/],
  ['muteRanges', /canUseMuteRanges|editing\.muteRanges/],
  ['splitClip', /canUseSplitClip|editing\.splitClip/],
  ['deleteClip', /canUseDeleteClip|editing\.deleteClip/],
  ['copyCutPaste', /canUseCopyCutPaste|editing\.copyCutPaste/],
  ['clipDrag', /canUseClipDrag|editing\.clipDrag/],
  ['crossTrackDrag', /canUseCrossTrackDrag|editing\.crossTrackDrag/],
  ['snap', /canUseSnap|editing\.snap/],
  ['zoom', /canUseTimelineZoom|editing\.zoom/],
  ['followPlayhead', /followPlayhead/],
  ['loopPreview', /canUseLoopPreview|editing\.loopPreview/],
  ['undoRedo', /canUseUndoRedo|editing\.undoRedo/],
  ['autoSave', /canUseAutoSave|editing\.autoSave/],
  ['localDraftRecovery', /canUseLocalDraftRecovery|editing\.localDraftRecovery/],
  ['addTrack', /advanced\.addTrack/],
  ['importAudio', /advanced\.importAudio/],
  ['recording', /advanced\.recording/],
  ['recordingDeviceSelect', /canUseRecordingDeviceSelect|recordingDeviceSelect/],
  ['recordingChannelSelect', /canUseRecordingChannelSelect|recordingChannelSelect/],
  ['recordingInputLevel', /canUseRecordingInputLevel|recordingInputLevel/],
  ['recordingMonitoring', /canUseRecordingMonitoring|recordingMonitoring/],
  ['trackRename', /advanced\.trackRename/],
  ['trackColor', /advanced\.trackColor/],
  ['trackReorder', /canUseTrackReorder|trackReorder/],
  ['trackViewFilter', /canUseTrackFilter|trackViewFilter/],
  ['trackDensity', /canUseTrackDensity|trackDensity/],
  ['shortcutHelp', /shortcutHelp/],
  ['mp3Mix', /export\.mp3Mix/],
  ['mp3Stems', /export\.mp3Stems/],
  ['wavMix', /export\.wavMix/],
  ['wavStems', /export\.wavStems/],
  ['soloOnly', /canUseSoloOnlyExport|soloOnly/],
  ['advancedExportModes', /canUseAdvancedExportModes|advancedExportModes/],
  ['exportHistory', /canUseExportHistory|exportHistory/],
];

describe('stem editor feature switch enforcement', () => {
  it.each(enforcedSwitches)('wires %s to editor behavior or service access', (_name, pattern) => {
    expect(source).toMatch(pattern);
  });

  it('hides playback-adjacent timeline controls when playback is disabled', () => {
    expect(source).toMatch(/\{canUsePlayback && <TimelineIconButton\s+icon="locate"/);
  });
});
