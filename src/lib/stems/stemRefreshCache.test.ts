import { describe, expect, it } from 'vitest';
import { TimedPromiseCache } from './stemRefreshCache';

describe('TimedPromiseCache', () => {
  it('reuses the same in-flight promise within the ttl window', async () => {
    const cache = new TimedPromiseCache<string>(1000);
    let calls = 0;

    const first = cache.get('job-1', () => {
      calls += 1;
      return Promise.resolve('fresh-stems');
    }, 100);
    const second = cache.get('job-1', () => {
      calls += 1;
      return Promise.resolve('duplicate');
    }, 200);

    await expect(Promise.all([first, second])).resolves.toEqual(['fresh-stems', 'fresh-stems']);
    expect(calls).toBe(1);
  });

  it('evicts rejected promises so the next call can retry', async () => {
    const cache = new TimedPromiseCache<string>(1000);
    let calls = 0;

    await expect(cache.get('job-2', () => {
      calls += 1;
      return Promise.reject(new Error('temporary failure'));
    }, 100)).rejects.toThrow('temporary failure');

    await expect(cache.get('job-2', () => {
      calls += 1;
      return Promise.resolve('recovered');
    }, 200)).resolves.toBe('recovered');
    expect(calls).toBe(2);
  });
});
