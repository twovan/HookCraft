import { describe, expect, it } from 'vitest';
import { buildStemEditorUrlWithMode } from './stemEditorUrl';

describe('stem editor url helpers', () => {
  it('persists the selected editor mode without dropping existing route state', () => {
    expect(
      buildStemEditorUrlWithMode(
        '/studio/stem-editor?generationTaskId=task-1',
        'separate_vocal',
      ),
    ).toBe('/studio/stem-editor?generationTaskId=task-1&separationMode=separate_vocal');
  });

  it('replaces an existing editor mode when switching panels', () => {
    expect(
      buildStemEditorUrlWithMode(
        '/studio/stem-editor?generationTaskId=task-1&separationMode=separate_vocal#timeline',
        'split_stem',
      ),
    ).toBe('/studio/stem-editor?generationTaskId=task-1&separationMode=split_stem#timeline');
  });
});
