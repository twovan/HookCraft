import { describe, expect, it } from 'vitest';
import { buildCreationsFetchKey } from './creationsRefresh';

describe('buildCreationsFetchKey', () => {
  it('keeps the fetch key stable when the same user receives a refreshed auth object', () => {
    expect(buildCreationsFetchKey('user-1', '30d', 1)).toBe(buildCreationsFetchKey('user-1', '30d', 1));
  });

  it('changes the fetch key only when the visible query changes', () => {
    expect(buildCreationsFetchKey('user-1', '30d', 1)).not.toBe(buildCreationsFetchKey('user-1', '7d', 1));
    expect(buildCreationsFetchKey('user-1', '30d', 1)).not.toBe(buildCreationsFetchKey('user-1', '30d', 2));
    expect(buildCreationsFetchKey('user-1', '30d', 1)).not.toBe(buildCreationsFetchKey('user-2', '30d', 1));
  });

  it('does not produce a fetch key before auth has a user id', () => {
    expect(buildCreationsFetchKey(undefined, '30d', 1)).toBeNull();
  });
});
