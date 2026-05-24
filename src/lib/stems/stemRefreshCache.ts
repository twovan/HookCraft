type CacheEntry<T> = {
  promise: Promise<T>;
  expiresAt: number;
};

export class TimedPromiseCache<T> {
  private entries = new Map<string, CacheEntry<T>>();

  constructor(private readonly ttlMs: number) {}

  get(key: string, loader: () => Promise<T>, now = Date.now()) {
    const existing = this.entries.get(key);
    if (existing && existing.expiresAt > now) {
      return existing.promise;
    }

    const promise = loader().catch((error) => {
      if (this.entries.get(key)?.promise === promise) {
        this.entries.delete(key);
      }
      throw error;
    });

    this.entries.set(key, {
      promise,
      expiresAt: now + this.ttlMs,
    });

    return promise;
  }
}
