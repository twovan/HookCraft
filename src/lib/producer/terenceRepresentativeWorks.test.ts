import { describe, expect, it } from 'vitest';
import { formatRepresentativeWorkLabel } from './terenceRepresentativeWorks';

describe('formatRepresentativeWorkLabel', () => {
  it('wraps the song title when input is song then artist', () => {
    expect(formatRepresentativeWorkLabel('水仙 - 林俊杰')).toBe('《水仙》 - 林俊杰');
  });

  it('normalizes artist then song input using known representative works', () => {
    expect(formatRepresentativeWorkLabel('林俊杰 - 水仙')).toBe('《水仙》 - 林俊杰');
  });

  it('does not wrap an already wrapped song title twice', () => {
    expect(formatRepresentativeWorkLabel('《水仙》 - 林俊杰')).toBe('《水仙》 - 林俊杰');
  });

  it('wraps standalone song titles without adding an artist', () => {
    expect(formatRepresentativeWorkLabel('水仙')).toBe('《水仙》');
  });
});
