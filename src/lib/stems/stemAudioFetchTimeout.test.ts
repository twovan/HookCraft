import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  STEM_AUDIO_FETCH_TIMEOUT_MS,
  createStemAudioFetchTimeout,
} from './stemAudioFetchTimeout';

describe('createStemAudioFetchTimeout', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('aborts after the stem audio fetch timeout', () => {
    vi.useFakeTimers();
    const timeout = createStemAudioFetchTimeout();

    expect(timeout.signal.aborted).toBe(false);
    vi.advanceTimersByTime(STEM_AUDIO_FETCH_TIMEOUT_MS - 1);
    expect(timeout.signal.aborted).toBe(false);
    vi.advanceTimersByTime(1);
    expect(timeout.signal.aborted).toBe(true);
  });

  it('can be cancelled when the fetch settles', () => {
    vi.useFakeTimers();
    const timeout = createStemAudioFetchTimeout(1000);

    timeout.cancel();
    vi.advanceTimersByTime(1000);

    expect(timeout.signal.aborted).toBe(false);
  });
});
