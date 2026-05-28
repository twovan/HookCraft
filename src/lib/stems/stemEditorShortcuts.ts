export type StemEditorShortcutAction =
  | 'toggle-playback'
  | 'save'
  | 'undo'
  | 'redo'
  | 'toggle-selected-mute'
  | 'toggle-selected-solo'
  | 'reset-selected-track'
  | 'select-previous-track'
  | 'select-next-track'
  | 'set-selected-trim-start'
  | 'set-selected-trim-end'
  | 'nudge-selected-trim-start-back'
  | 'nudge-selected-trim-end-forward'
  | 'mute-selected-range'
  | 'restore-selected-range'
  | 'seek-start'
  | 'seek-end';

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

  if (!hasCommandModifier && !event.shiftKey) {
    if (key === 'm') return 'toggle-selected-mute';
    if (key === 's') return 'toggle-selected-solo';
    if (key === 'r') return 'reset-selected-track';
    if (event.key === 'ArrowUp') return 'select-previous-track';
    if (event.key === 'ArrowDown') return 'select-next-track';
    if (event.key === '[') return 'set-selected-trim-start';
    if (event.key === ']') return 'set-selected-trim-end';
    if (key === 'x') return 'mute-selected-range';
    if (event.key === 'Home') return 'seek-start';
    if (event.key === 'End') return 'seek-end';
  }

  if (!hasCommandModifier && event.shiftKey) {
    if (event.key === '[') return 'nudge-selected-trim-start-back';
    if (event.key === ']') return 'nudge-selected-trim-end-forward';
    if (key === 'x') return 'restore-selected-range';
  }

  if (!hasCommandModifier) return null;

  if (key === 's' && !event.shiftKey) return 'save';
  if (key === 'z' && event.shiftKey) return 'redo';
  if (key === 'z') return 'undo';
  if (key === 'y' && !event.shiftKey) return 'redo';

  return null;
}
