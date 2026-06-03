import { describe, expect, it } from 'vitest';
import {
  DEFAULT_STEM_EDITOR_FEATURE_SETTINGS,
  editorPanelForSeparationMode,
  normalizeStemEditorFeatureSettings,
  resolveEditorPanelAccess,
  resolveStemSeparationMode,
} from './stemEditorFeatures';

describe('stem editor feature settings', () => {
  it('keeps the basic editor as a two-track editor with MP3-only export by default', () => {
    const settings = normalizeStemEditorFeatureSettings(null);

    expect(settings.basicEditor.stems.separateVocal).toBe(true);
    expect(settings.basicEditor.stems.splitStem).toBe(false);
    expect(settings.basicEditor.stems.resultType).toBe('two_track_vocal_instrumental');
    expect(settings.basicEditor.editing.splitClip).toBe(true);
    expect(settings.basicEditor.editing.copyCutPaste).toBe(true);
    expect(settings.basicEditor.export.mp3Mix).toBe(true);
    expect(settings.basicEditor.export.wavMix).toBe(false);
    expect(settings.basicEditor.advanced.recording).toBe(false);
  });

  it('keeps the professional editor as a multi-stem-result editor with advanced tools by default', () => {
    const settings = normalizeStemEditorFeatureSettings(undefined);

    expect(settings.proEditor.stems.separateVocal).toBe(true);
    expect(settings.proEditor.stems.splitStem).toBe(true);
    expect(settings.proEditor.stems.resultType).toBe('twelve_stem_groups');
    expect(settings.proEditor.advanced.addTrack).toBe(true);
    expect(settings.proEditor.advanced.recording).toBe(true);
    expect(settings.proEditor.export.wavMix).toBe(true);
    expect(settings.proEditor.export.wavStems).toBe(true);
  });

  it('normalizes partial admin input without allowing invalid defaults', () => {
    const settings = normalizeStemEditorFeatureSettings({
      basicEditor: {
        modes: {
          basicEditor: false,
          proEditor: true,
          defaultMode: 'pro',
        },
        export: {
          mp3Mix: false,
          wavMix: true,
        },
      },
    });

    expect(settings.basicEditor.modes.basicEditor).toBe(false);
    expect(settings.basicEditor.modes.proEditor).toBe(true);
    expect(settings.basicEditor.modes.defaultMode).toBe('pro');
    expect(settings.basicEditor.export.mp3Mix).toBe(false);
    expect(settings.basicEditor.export.wavMix).toBe(true);
    expect(settings.basicEditor.editing.clipDrag).toBe(DEFAULT_STEM_EDITOR_FEATURE_SETTINGS.basicEditor.editing.clipDrag);
  });

  it('normalizes legacy plus/pro settings into editor panel settings', () => {
    const settings = normalizeStemEditorFeatureSettings({
      plus: {
        editing: {
          playback: false,
        },
      },
      pro: {
        export: {
          wavMix: false,
        },
      },
    });

    expect(settings.basicEditor.editing.playback).toBe(false);
    expect(settings.proEditor.export.wavMix).toBe(false);
    expect(Object.keys(settings)).toEqual(['basicEditor', 'proEditor']);
  });

  it('maps current membership tiers to editor panels', () => {
    expect(resolveEditorPanelAccess('free')).toBe('free');
    expect(resolveEditorPanelAccess('pro')).toBe('basicEditor');
    expect(resolveEditorPanelAccess('business')).toBe('proEditor');
  });

  it('resolves supported separation modes from requested mode and editor panel', () => {
    const settings = normalizeStemEditorFeatureSettings(null);

    expect(resolveStemSeparationMode(settings, 'basicEditor', 'split_stem')).toBe('separate_vocal');
    expect(resolveStemSeparationMode(settings, 'proEditor', 'split_stem')).toBe('split_stem');
    expect(resolveStemSeparationMode(settings, 'proEditor', 'separate_vocal')).toBe('separate_vocal');
    expect(resolveStemSeparationMode(settings, 'free', 'split_stem')).toBe(null);
  });

  it('maps the resolved separation mode to the actual editor panel', () => {
    expect(editorPanelForSeparationMode('separate_vocal')).toBe('basicEditor');
    expect(editorPanelForSeparationMode('split_stem')).toBe('proEditor');
  });
});
