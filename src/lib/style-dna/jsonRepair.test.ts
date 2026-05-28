import { describe, expect, it } from 'vitest';
import { parseStrictJsonObject } from './jsonRepair';

describe('parseStrictJsonObject', () => {
  it('parses strict JSON directly', () => {
    expect(parseStrictJsonObject('{"confidence":0.8,"genre_candidates":["pop"]}')).toEqual({
      confidence: 0.8,
      genre_candidates: ['pop'],
    });
  });

  it('extracts JSON from markdown fences', () => {
    const result = parseStrictJsonObject('```json\n{"estimated_key":"unknown"}\n```');
    expect(result).toEqual({ estimated_key: 'unknown' });
  });

  it('throws a useful error for non JSON output', () => {
    expect(() => parseStrictJsonObject('I hear a warm pop song.')).toThrow('Google response did not contain a JSON object');
  });
});

