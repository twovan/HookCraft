export type StemTrackAudioStatus = 'ready' | 'loading' | 'failed' | 'skipped' | 'pending';

export interface StemTrackAudioStatusInput {
  knownEmpty?: boolean;
  loaded?: boolean;
  loading?: boolean;
  failed?: boolean;
}

export function resolveStemTrackAudioStatus(input: StemTrackAudioStatusInput): StemTrackAudioStatus {
  if (input.knownEmpty) return 'skipped';
  if (input.loaded) return 'ready';
  if (input.loading) return 'loading';
  if (input.failed) return 'failed';
  return 'pending';
}
