import { describe, expect, it } from 'vitest';
import { resolveStemTrackAudioStatus } from './stemTrackAudioStatus';

describe('resolveStemTrackAudioStatus', () => {
  it('prioritizes known empty stems as skipped', () => {
    expect(resolveStemTrackAudioStatus({
      knownEmpty: true,
      loaded: true,
      loading: true,
      failed: true,
    })).toBe('skipped');
  });

  it('marks loaded stems as ready', () => {
    expect(resolveStemTrackAudioStatus({ loaded: true })).toBe('ready');
  });

  it('marks in-flight stems as loading before failed', () => {
    expect(resolveStemTrackAudioStatus({ loading: true, failed: true })).toBe('loading');
  });

  it('marks failed stems and otherwise pending stems', () => {
    expect(resolveStemTrackAudioStatus({ failed: true })).toBe('failed');
    expect(resolveStemTrackAudioStatus({})).toBe('pending');
  });
});
