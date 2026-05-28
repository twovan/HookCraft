export interface StemMasterState {
  volume: number;
  limiter: boolean;
}

export function defaultStemMasterState(): StemMasterState {
  return {
    volume: 0.92,
    limiter: true,
  };
}

export function normalizeStemMasterState(value: Partial<StemMasterState> | undefined | null): StemMasterState {
  return {
    volume: typeof value?.volume === 'number'
      ? Math.max(0, Math.min(1, value.volume))
      : defaultStemMasterState().volume,
    limiter: typeof value?.limiter === 'boolean' ? value.limiter : defaultStemMasterState().limiter,
  };
}
