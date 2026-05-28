import { describe, expect, it } from 'vitest';
import { resolveVisibleStemSelection } from './stemSelection';

describe('resolveVisibleStemSelection', () => {
  it('keeps the current stem when it is visible', () => {
    expect(resolveVisibleStemSelection(['vocals', 'drums'], 'drums')).toBe('drums');
  });

  it('falls back to the first visible stem when the current stem is hidden', () => {
    expect(resolveVisibleStemSelection(['vocals', 'drums'], 'bass')).toBe('vocals');
  });

  it('returns null when no stems are visible', () => {
    expect(resolveVisibleStemSelection([], 'vocals')).toBeNull();
  });
});
