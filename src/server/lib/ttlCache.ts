type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

export class TTLCache<T> {
  private readonly store = new Map<string, CacheEntry<T>>();
  private readonly inFlight = new Map<string, Promise<T>>();

  constructor(private readonly ttlMs: number, private readonly maxEntries = 500) {}

  get(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  set(key: string, value: T): void {
    if (this.store.size >= this.maxEntries) {
      const firstKey = this.store.keys().next().value;
      if (firstKey) this.store.delete(firstKey);
    }
    this.store.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }

  clearPrefix(prefix: string): void {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) this.store.delete(key);
    }
    for (const key of this.inFlight.keys()) {
      if (key.startsWith(prefix)) this.inFlight.delete(key);
    }
  }

  async getOrLoad(key: string, loader: () => Promise<T>, backgroundRefreshBeforeMs = 0): Promise<T> {
    const entry = this.store.get(key);
    if (entry && Date.now() <= entry.expiresAt) {
      if (backgroundRefreshBeforeMs > 0 && Date.now() > entry.expiresAt - backgroundRefreshBeforeMs && !this.inFlight.has(key)) {
        const refresh = loader().then(v => { this.set(key, v); return v; }).catch(err => { console.error('[TTLCache] background refresh failed:', err); }).finally(() => this.inFlight.delete(key));
        this.inFlight.set(key, refresh);
      }
      return entry.value;
    }
    if (entry) this.store.delete(key);

    const existingLoad = this.inFlight.get(key);
    if (existingLoad) return existingLoad;

    const loadPromise = (async () => {
      const value = await loader();
      this.set(key, value);
      return value;
    })();

    this.inFlight.set(key, loadPromise);
    try {
      return await loadPromise;
    } finally {
      this.inFlight.delete(key);
    }
  }
}
