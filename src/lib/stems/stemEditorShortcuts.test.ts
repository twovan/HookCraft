import { describe, expect, it } from 'vitest';
import { resolveStemEditorShortcut } from './stemEditorShortcuts';

function keyEvent(overrides: Partial<KeyboardEvent> & { key: string }) {
  return {
    key: overrides.key,
    ctrlKey: overrides.ctrlKey === true,
    metaKey: overrides.metaKey === true,
    shiftKey: overrides.shiftKey === true,
    altKey: overrides.altKey === true,
    target: overrides.target ?? null,
  } as KeyboardEvent;
}

describe('resolveStemEditorShortcut', () => {
  it('maps playback, save, undo, and redo shortcuts', () => {
    expect(resolveStemEditorShortcut(keyEvent({ key: ' ' }))).toBe('toggle-playback');
    expect(resolveStemEditorShortcut(keyEvent({ key: 'Escape' }))).toBe('stop-playback');
    expect(resolveStemEditorShortcut(keyEvent({ key: '?' }))).toBe('toggle-shortcut-help');
    expect(resolveStemEditorShortcut(keyEvent({ key: 's', ctrlKey: true }))).toBe('save');
    expect(resolveStemEditorShortcut(keyEvent({ key: 'c', ctrlKey: true }))).toBe('copy-selected-clip');
    expect(resolveStemEditorShortcut(keyEvent({ key: 'x', ctrlKey: true }))).toBe('cut-selected-clip');
    expect(resolveStemEditorShortcut(keyEvent({ key: 'v', ctrlKey: true }))).toBe('paste-clip');
    expect(resolveStemEditorShortcut(keyEvent({ key: 'z', ctrlKey: true }))).toBe('undo');
    expect(resolveStemEditorShortcut(keyEvent({ key: 'z', metaKey: true }))).toBe('undo');
    expect(resolveStemEditorShortcut(keyEvent({ key: 'y', ctrlKey: true }))).toBe('redo');
    expect(resolveStemEditorShortcut(keyEvent({ key: 'z', ctrlKey: true, shiftKey: true }))).toBe('redo');
    expect(resolveStemEditorShortcut(keyEvent({ key: '=', ctrlKey: true }))).toBe('zoom-in');
    expect(resolveStemEditorShortcut(keyEvent({ key: '+', ctrlKey: true, shiftKey: true }))).toBe('zoom-in');
    expect(resolveStemEditorShortcut(keyEvent({ key: '-', metaKey: true }))).toBe('zoom-out');
    expect(resolveStemEditorShortcut(keyEvent({ key: '0', ctrlKey: true }))).toBe('zoom-reset');
  });

  it('maps selected-track editing shortcuts', () => {
    expect(resolveStemEditorShortcut(keyEvent({ key: 'm' }))).toBe('toggle-selected-mute');
    expect(resolveStemEditorShortcut(keyEvent({ key: 's' }))).toBe('toggle-selected-solo');
    expect(resolveStemEditorShortcut(keyEvent({ key: 'f' }))).toBe('toggle-follow-playhead');
    expect(resolveStemEditorShortcut(keyEvent({ key: 'g' }))).toBe('toggle-snap-grid');
    expect(resolveStemEditorShortcut(keyEvent({ key: 'g', shiftKey: true }))).toBe('cycle-snap-step');
    expect(resolveStemEditorShortcut(keyEvent({ key: 'b' }))).toBe('toggle-transport-compact');
    expect(resolveStemEditorShortcut(keyEvent({ key: 'd' }))).toBe('toggle-track-density');
    expect(resolveStemEditorShortcut(keyEvent({ key: 'l' }))).toBe('toggle-loop-preview');
    expect(resolveStemEditorShortcut(keyEvent({ key: 'p' }))).toBe('preview-selected-range');
    expect(resolveStemEditorShortcut(keyEvent({ key: 'f', shiftKey: true }))).toBe('focus-selected-range');
    expect(resolveStemEditorShortcut(keyEvent({ key: 'r' }))).toBe('reset-selected-track');
    expect(resolveStemEditorShortcut(keyEvent({ key: 'Delete' }))).toBe('delete-selected-track');
    expect(resolveStemEditorShortcut(keyEvent({ key: 'F2' }))).toBeNull();
    expect(resolveStemEditorShortcut(keyEvent({ key: 'c', shiftKey: true }))).toBe('edit-selected-track-color');
    expect(resolveStemEditorShortcut(keyEvent({ key: 'r', shiftKey: true }))).toBe('reset-selected-trim-range');
    expect(resolveStemEditorShortcut(keyEvent({ key: 'ArrowLeft' }))).toBe('seek-backward');
    expect(resolveStemEditorShortcut(keyEvent({ key: 'ArrowRight' }))).toBe('seek-forward');
    expect(resolveStemEditorShortcut(keyEvent({ key: 'ArrowLeft', shiftKey: true }))).toBe('seek-backward-large');
    expect(resolveStemEditorShortcut(keyEvent({ key: 'ArrowRight', shiftKey: true }))).toBe('seek-forward-large');
    expect(resolveStemEditorShortcut(keyEvent({ key: 'ArrowUp' }))).toBe('select-previous-track');
    expect(resolveStemEditorShortcut(keyEvent({ key: 'ArrowDown' }))).toBe('select-next-track');
    expect(resolveStemEditorShortcut(keyEvent({ key: '[' }))).toBe('set-selected-trim-start');
    expect(resolveStemEditorShortcut(keyEvent({ key: ']' }))).toBe('set-selected-trim-end');
    expect(resolveStemEditorShortcut(keyEvent({ key: '[', shiftKey: true }))).toBe('nudge-selected-trim-start-back');
    expect(resolveStemEditorShortcut(keyEvent({ key: ']', shiftKey: true }))).toBe('nudge-selected-trim-end-forward');
    expect(resolveStemEditorShortcut(keyEvent({ key: 'x' }))).toBe('mute-selected-range');
    expect(resolveStemEditorShortcut(keyEvent({ key: 'x', shiftKey: true }))).toBe('restore-selected-range');
    expect(resolveStemEditorShortcut(keyEvent({ key: 'Home' }))).toBe('seek-start');
    expect(resolveStemEditorShortcut(keyEvent({ key: 'End' }))).toBe('seek-end');
  });

  it('ignores text-entry fields and unrelated modified shortcuts', () => {
    const input = { tagName: 'INPUT', isContentEditable: false };
    expect(resolveStemEditorShortcut(keyEvent({ key: ' ', target: input as unknown as EventTarget }))).toBeNull();
    expect(resolveStemEditorShortcut(keyEvent({ key: 'c', ctrlKey: true, target: input as unknown as EventTarget }))).toBeNull();
    expect(resolveStemEditorShortcut(keyEvent({ key: 'v', ctrlKey: true, target: input as unknown as EventTarget }))).toBeNull();
    expect(resolveStemEditorShortcut(keyEvent({ key: 'm', target: input as unknown as EventTarget }))).toBeNull();
    expect(resolveStemEditorShortcut(keyEvent({ key: 'Delete', target: input as unknown as EventTarget }))).toBeNull();
    expect(resolveStemEditorShortcut(keyEvent({ key: 's', altKey: true }))).toBeNull();
    expect(resolveStemEditorShortcut(keyEvent({ key: 'q', ctrlKey: true }))).toBeNull();
  });

  it('keeps undo available when focus is on non-text controls', () => {
    const rangeInput = { tagName: 'INPUT', type: 'range', isContentEditable: false };
    const checkboxInput = { tagName: 'INPUT', type: 'checkbox', isContentEditable: false };

    expect(resolveStemEditorShortcut(keyEvent({ key: 'z', ctrlKey: true, target: rangeInput as unknown as EventTarget }))).toBe('undo');
    expect(resolveStemEditorShortcut(keyEvent({ key: 'z', ctrlKey: true, target: checkboxInput as unknown as EventTarget }))).toBe('undo');
  });
});
