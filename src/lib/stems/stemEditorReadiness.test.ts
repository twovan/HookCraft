import { describe, expect, it } from 'vitest';
import { buildStemEditorReadiness } from './stemEditorReadiness';

describe('buildStemEditorReadiness', () => {
  it('blocks preview when no usable stems are ready yet', () => {
    expect(buildStemEditorReadiness({
      loadableStemCount: 8,
      readyStemCount: 0,
      loadingStemCount: 8,
      failedStemCount: 0,
      skippedStemCount: 0,
      exportSelectedCount: 0,
      exportMissingCount: 0,
    })).toMatchObject({
      level: 'loading',
      canPreview: false,
      canExport: false,
    });
  });

  it('allows partial testing when some stems failed but others are ready', () => {
    expect(buildStemEditorReadiness({
      loadableStemCount: 8,
      readyStemCount: 6,
      loadingStemCount: 0,
      failedStemCount: 2,
      skippedStemCount: 1,
      exportSelectedCount: 5,
      exportMissingCount: 1,
    })).toMatchObject({
      level: 'attention',
      canPreview: true,
      canExport: true,
    });
  });

  it('marks the editor ready when all selected export stems are available', () => {
    expect(buildStemEditorReadiness({
      loadableStemCount: 7,
      readyStemCount: 7,
      loadingStemCount: 0,
      failedStemCount: 0,
      skippedStemCount: 2,
      exportSelectedCount: 4,
      exportMissingCount: 0,
    })).toMatchObject({
      level: 'ready',
      canPreview: true,
      canExport: true,
    });
  });
});
