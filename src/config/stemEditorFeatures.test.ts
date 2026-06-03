import { describe, expect, it } from 'vitest';
import {
  DEFAULT_STEM_EDITOR_FEATURE_SETTINGS,
  normalizeStemEditorFeatureSettings,
  resolveEditorAccessTier,
  resolveStemSeparationMode,
} from './stemEditorFeatures';

describe('stem editor feature settings', () => {
  it('keeps Plus as a two-track editor with MP3-only export by default', () => {
    const settings = normalizeStemEditorFeatureSettings(null);

    expect(settings.plus.stems.separateVocal).toBe(true);
    expect(settings.plus.stems.splitStem).toBe(false);
    expect(settings.plus.stems.resultType).toBe('two_track_vocal_instrumental');
    expect(settings.plus.editing.splitClip).toBe(true);
    expect(settings.plus.editing.copyCutPaste).toBe(true);
    expect(settings.plus.export.mp3Mix).toBe(true);
    expect(settings.plus.export.wavMix).toBe(false);
    expect(settings.plus.advanced.recording).toBe(false);
  });

  it('keeps Pro as a twelve-stem-result editor with advanced tools by default', () => {
    const settings = normalizeStemEditorFeatureSettings(undefined);

    expect(settings.pro.stems.separateVocal).toBe(true);
    expect(settings.pro.stems.splitStem).toBe(true);
    expect(settings.pro.stems.resultType).toBe('twelve_stem_groups');
    expect(settings.pro.advanced.addTrack).toBe(true);
    expect(settings.pro.advanced.recording).toBe(true);
    expect(settings.pro.export.wavMix).toBe(true);
    expect(settings.pro.export.wavStems).toBe(true);
  });

  it('normalizes partial admin input without allowing invalid defaults', () => {
    const settings = normalizeStemEditorFeatureSettings({
      plus: {
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

    expect(settings.plus.modes.basicEditor).toBe(false);
    expect(settings.plus.modes.proEditor).toBe(true);
    expect(settings.plus.modes.defaultMode).toBe('pro');
    expect(settings.plus.export.mp3Mix).toBe(false);
    expect(settings.plus.export.wavMix).toBe(true);
    expect(settings.plus.editing.clipDrag).toBe(DEFAULT_STEM_EDITOR_FEATURE_SETTINGS.plus.editing.clipDrag);
  });

  it('maps current membership tiers to editor access tiers', () => {
    expect(resolveEditorAccessTier('free')).toBe('free');
    expect(resolveEditorAccessTier('pro')).toBe('plus');
    expect(resolveEditorAccessTier('business')).toBe('pro');
  });

  it('resolves supported separation modes from requested mode and access tier', () => {
    const settings = normalizeStemEditorFeatureSettings(null);

    expect(resolveStemSeparationMode(settings, 'plus', 'split_stem')).toBe('separate_vocal');
    expect(resolveStemSeparationMode(settings, 'pro', 'split_stem')).toBe('split_stem');
    expect(resolveStemSeparationMode(settings, 'pro', 'separate_vocal')).toBe('separate_vocal');
    expect(resolveStemSeparationMode(settings, 'free', 'split_stem')).toBe(null);
  });
});
