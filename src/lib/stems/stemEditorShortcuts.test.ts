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
    expect(resolveStemEditorShortcut(keyEvent({ key: 's', ctrlKey: true }))).toBe('save');
    expect(resolveStemEditorShortcut(keyEvent({ key: 'z', metaKey: true }))).toBe('undo');
    expect(resolveStemEditorShortcut(keyEvent({ key: 'y', ctrlKey: true }))).toBe('redo');
    expect(resolveStemEditorShortcut(keyEvent({ key: 'z', ctrlKey: true, shiftKey: true }))).toBe('redo');
  });

  it('maps selected-track editing shortcuts', () => {
    expect(resolveStemEditorShortcut(keyEvent({ key: 'm' }))).toBe('toggle-selected-mute');
    expect(resolveStemEditorShortcut(keyEvent({ key: 's' }))).toBe('toggle-selected-solo');
    expect(resolveStemEditorShortcut(keyEvent({ key: 'r' }))).toBe('reset-selected-track');
    expect(resolveStemEditorShortcut(keyEvent({ key: 'ArrowUp' }))).toBe('select-previous-track');
    expect(resolveStemEditorShortcut(keyEvent({ key: 'ArrowDown' }))).toBe('select-next-track');
  });

  it('ignores text-entry fields and unrelated modified shortcuts', () => {
    const input = { tagName: 'INPUT', isContentEditable: false };
    expect(resolveStemEditorShortcut(keyEvent({ key: ' ', target: input as unknown as EventTarget }))).toBeNull();
    expect(resolveStemEditorShortcut(keyEvent({ key: 'm', target: input as unknown as EventTarget }))).toBeNull();
    expect(resolveStemEditorShortcut(keyEvent({ key: 's', altKey: true }))).toBeNull();
    expect(resolveStemEditorShortcut(keyEvent({ key: 'x', ctrlKey: true }))).toBeNull();
  });
});
