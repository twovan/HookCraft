export type StemEditorShortcutAction =
  | 'toggle-playback'
  | 'stop-playback'
  | 'toggle-shortcut-help'
  | 'save'
  | 'undo'
  | 'redo'
  | 'toggle-selected-mute'
  | 'toggle-selected-solo'
  | 'reset-selected-track'
  | 'delete-selected-track'
  | 'reset-selected-trim-range'
  | 'select-previous-track'
  | 'select-next-track'
  | 'set-selected-trim-start'
  | 'set-selected-trim-end'
  | 'nudge-selected-trim-start-back'
  | 'nudge-selected-trim-end-forward'
  | 'mute-selected-range'
  | 'restore-selected-range'
  | 'seek-backward'
  | 'seek-forward'
  | 'seek-backward-large'
  | 'seek-forward-large'
  | 'seek-start'
  | 'seek-end'
  | 'zoom-in'
  | 'zoom-out'
  | 'zoom-reset'
  | 'toggle-follow-playhead'
  | 'toggle-snap-grid'
  | 'cycle-snap-step'
  | 'toggle-transport-compact'
  | 'toggle-track-density'
  | 'preview-selected-range'
  | 'toggle-loop-preview'
  | 'focus-selected-range';

type KeyboardShortcutEvent = Pick<
  KeyboardEvent,
  'altKey' | 'ctrlKey' | 'key' | 'metaKey' | 'shiftKey' | 'target'
>;

function isTextEntryTarget(target: EventTarget | null) {
  if (!target || typeof target !== 'object') return false;

  const element = target as HTMLElement;
  if (element.isContentEditable) return true;

  const tagName = element.tagName?.toLowerCase();
  return tagName === 'input' || tagName === 'textarea' || tagName === 'select';
}

export function resolveStemEditorShortcut(event: KeyboardShortcutEvent): StemEditorShortcutAction | null {
  if (isTextEntryTarget(event.target) || event.altKey) return null;

  const key = event.key.toLowerCase();
  const hasCommandModifier = event.ctrlKey || event.metaKey;

  if (!hasCommandModifier && !event.shiftKey && event.key === ' ') {
    return 'toggle-playback';
  }

  if (!hasCommandModifier && event.key === '?') {
    return 'toggle-shortcut-help';
  }

  if (!hasCommandModifier && !event.shiftKey) {
    if (event.key === 'Escape') return 'stop-playback';
    if (key === 'm') return 'toggle-selected-mute';
    if (key === 's') return 'toggle-selected-solo';
    if (key === 'f') return 'toggle-follow-playhead';
    if (key === 'g') return 'toggle-snap-grid';
    if (key === 'b') return 'toggle-transport-compact';
    if (key === 'd') return 'toggle-track-density';
    if (key === 'l') return 'toggle-loop-preview';
    if (key === 'p') return 'preview-selected-range';
    if (key === 'r') return 'reset-selected-track';
    if (event.key === 'Delete') return 'delete-selected-track';
    if (event.key === 'ArrowLeft') return 'seek-backward';
    if (event.key === 'ArrowRight') return 'seek-forward';
    if (event.key === 'ArrowUp') return 'select-previous-track';
    if (event.key === 'ArrowDown') return 'select-next-track';
    if (event.key === '[') return 'set-selected-trim-start';
    if (event.key === ']') return 'set-selected-trim-end';
    if (key === 'x') return 'mute-selected-range';
    if (event.key === 'Home') return 'seek-start';
    if (event.key === 'End') return 'seek-end';
  }

  if (!hasCommandModifier && event.shiftKey) {
    if (key === 'f') return 'focus-selected-range';
    if (key === 'g') return 'cycle-snap-step';
    if (key === 'r') return 'reset-selected-trim-range';
    if (event.key === 'ArrowLeft') return 'seek-backward-large';
    if (event.key === 'ArrowRight') return 'seek-forward-large';
    if (event.key === '[') return 'nudge-selected-trim-start-back';
    if (event.key === ']') return 'nudge-selected-trim-end-forward';
    if (key === 'x') return 'restore-selected-range';
  }

  if (!hasCommandModifier) return null;

  if (key === 's' && !event.shiftKey) return 'save';
  if ((key === '+' || key === '=') && !event.shiftKey) return 'zoom-in';
  if ((key === '+' || key === '=') && event.shiftKey) return 'zoom-in';
  if ((key === '-' || key === '_') && !event.shiftKey) return 'zoom-out';
  if (key === '0' && !event.shiftKey) return 'zoom-reset';
  if (key === 'z' && event.shiftKey) return 'redo';
  if (key === 'z') return 'undo';
  if (key === 'y' && !event.shiftKey) return 'redo';

  return null;
}
