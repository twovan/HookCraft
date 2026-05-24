export type WaveformPointerIntent =
  | { kind: 'seek'; time: number }
  | { kind: 'trim'; edge: 'start' | 'end'; time: number };

export interface WaveformPointerIntentInput {
  editable: boolean;
  pointerX: number;
  width: number;
  duration: number;
  trimStart: number;
  trimEnd: number;
  hitSize?: number;
}

export function resolveWaveformPointerIntent(input: WaveformPointerIntentInput): WaveformPointerIntent {
  const width = Math.max(1, input.width);
  const duration = Math.max(0, input.duration);
  const ratio = Math.max(0, Math.min(1, input.pointerX / width));
  const time = ratio * duration;

  if (!input.editable || duration <= 0) {
    return { kind: 'seek', time };
  }

  const trimStart = Math.max(0, Math.min(duration, input.trimStart));
  const trimEnd = Math.max(0, Math.min(duration, input.trimEnd));
  const startX = (trimStart / duration) * width;
  const endX = (trimEnd / duration) * width;
  const hitSize = input.hitSize ?? 14;
  const startDistance = Math.abs(input.pointerX - startX);
  const endDistance = Math.abs(input.pointerX - endX);

  if (startDistance <= hitSize || endDistance <= hitSize) {
    return {
      kind: 'trim',
      edge: startDistance <= endDistance ? 'start' : 'end',
      time,
    };
  }

  return { kind: 'seek', time };
}
