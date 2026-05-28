import { describe, expect, it } from 'vitest';
import { clampStemTimecodeInput, formatStemTimecode, parseStemTimecode } from './stemTimecode';

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

  it('clamps parsed timecode to the available duration', () => {
    expect(clampStemTimecodeInput('2:00', 90)).toEqual({ ok: true, time: 90 });
    expect(clampStemTimecodeInput('12.5', 90)).toEqual({ ok: true, time: 12.5 });
  });

  it('keeps invalid clamped timecode explicit', () => {
    expect(clampStemTimecodeInput('nope', 90)).toEqual({ ok: false });
  });
});
