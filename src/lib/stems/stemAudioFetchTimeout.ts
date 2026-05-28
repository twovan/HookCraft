export const STEM_AUDIO_FETCH_TIMEOUT_MS = 15_000;

export function createStemAudioFetchTimeout(timeoutMs = STEM_AUDIO_FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  return {
    signal: controller.signal,
    cancel: () => clearTimeout(timeoutId),
  };
}
