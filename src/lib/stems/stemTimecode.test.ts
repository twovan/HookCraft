import { describe, expect, it } from 'vitest';
import { formatStemTimecode, parseStemTimecode } from './stemTimecode';

describe('stem timecode', () => {
  it('formats seconds as minute timecode with centiseconds', () => {
    expect(formatStemTimecode(83.456)).toBe('1:23.46');
    expect(formatStemTimecode(0)).toBe('0:00.00');
  });

  it('parses numeric seconds', () => {
    expect(parseStemTimecode('83.5')).toBe(83.5);
  });

  it('parses minute timecode', () => {
    expect(parseStemTimecode('1:23.50')).toBe(83.5);
    expect(parseStemTimecode('02:03')).toBe(123);
  });

  it('returns null for invalid timecode text', () => {
    expect(parseStemTimecode('abc')).toBeNull();
    expect(parseStemTimecode('1:xx')).toBeNull();
  });
});
