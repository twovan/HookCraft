import { describe, expect, it } from 'vitest';
import { resolveActiveProducerId } from './resolveActiveProducerId';

function createProducerLookup(data: { id: string } | null, error: unknown = null) {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  const query = {
    select: (...args: unknown[]) => {
      calls.push({ method: 'select', args });
      return query;
    },
    eq: (...args: unknown[]) => {
      calls.push({ method: 'eq', args });
      return query;
    },
    maybeSingle: async () => {
      calls.push({ method: 'maybeSingle', args: [] });
      return { data, error };
    },
  };

  return {
    client: {
      from: (...args: unknown[]) => {
        calls.push({ method: 'from', args });
        return query;
      },
    },
    calls,
  };
}

describe('resolveActiveProducerId', () => {
  it('returns the active producer id bound to the user account', async () => {
    const lookup = createProducerLookup({ id: 'producer-123' });

    await expect(resolveActiveProducerId(lookup.client as any, 'user-123')).resolves.toBe('producer-123');

    expect(lookup.calls).toEqual([
      { method: 'from', args: ['producers'] },
      { method: 'select', args: ['id'] },
      { method: 'eq', args: ['user_id', 'user-123'] },
      { method: 'eq', args: ['status', 'active'] },
      { method: 'maybeSingle', args: [] },
    ]);
  });

  it('returns null when the user has no active producer profile', async () => {
    const lookup = createProducerLookup(null);

    await expect(resolveActiveProducerId(lookup.client as any, 'user-123')).resolves.toBeNull();
  });

  it('throws when the producer lookup fails', async () => {
    const lookup = createProducerLookup(null, new Error('database unavailable'));

    await expect(resolveActiveProducerId(lookup.client as any, 'user-123')).rejects.toThrow('database unavailable');
  });
});
