import { describe, expect, it } from 'vitest';
import {
  buildAdvancedArrangementStoragePath,
  validateAdvancedArrangementStoredAudio,
  validateAdvancedArrangementUploadMetadata,
} from './advancedArrangementUpload';

describe('advanced arrangement upload helpers', () => {
  it('accepts supported audio metadata under 100MB', () => {
    expect(validateAdvancedArrangementUploadMetadata({
      fileName: 'reference.wav',
      contentType: 'audio/wav',
      size: 23 * 1024 * 1024,
    })).toMatchObject({ valid: true, extension: 'wav' });
  });

  it('rejects unsupported audio extensions', () => {
    expect(validateAdvancedArrangementUploadMetadata({
      fileName: 'reference.aac',
      contentType: 'audio/aac',
      size: 1024,
    })).toMatchObject({ valid: false });
  });

  it('rejects audio files over 100MB', () => {
    expect(validateAdvancedArrangementUploadMetadata({
      fileName: 'reference.wav',
      contentType: 'audio/wav',
      size: 101 * 1024 * 1024,
    })).toMatchObject({ valid: false });
  });

  it('builds storage paths under the authenticated user prefix', () => {
    expect(buildAdvancedArrangementStoragePath({
      userId: 'user-1',
      fileName: 'demo track.wav',
      now: 1781000000000,
      randomId: 'abc123',
    })).toBe('user-1/kie/uploads/1781000000000-abc123.wav');
  });

  it('allows stored audio only from the authenticated user upload folder', () => {
    expect(validateAdvancedArrangementStoredAudio({
      userId: 'user-1',
      path: 'user-1/kie/uploads/1781000000000-abc123.wav',
      fileName: 'demo.wav',
      contentType: 'audio/wav',
      size: 23 * 1024 * 1024,
    })).toMatchObject({ valid: true });

    expect(validateAdvancedArrangementStoredAudio({
      userId: 'user-1',
      path: 'user-2/kie/uploads/1781000000000-abc123.wav',
      fileName: 'demo.wav',
      contentType: 'audio/wav',
      size: 23 * 1024 * 1024,
    })).toMatchObject({ valid: false });
  });
});
