type CacheEntry<T> = {
  value: T;
  createdAt: number;
  expiresAt: number;
};

type TTLCacheDiagnostics = {
  name: string;
  ttlMs: number;
  maxEntries: number;
  size: number;
  inFlight: number;
  hits: number;
  misses: number;
  staleServed: number;
  loadSuccesses: number;
  loadFailures: number;
  evictions: number;
  oldestEntryAgeMs: number | null;
  newestEntryAgeMs: number | null;
};

const cacheRegistry = new Set<TTLCache<unknown>>();
let anonymousCacheCounter = 0;

export class TTLCache<T> {
  private readonly store = new Map<string, CacheEntry<T>>();
  private readonly inFlight = new Map<string, Promise<T>>();
  private readonly name: string;
  private hits = 0;
  private misses = 0;
  private staleServed = 0;
  private loadSuccesses = 0;
  private loadFailures = 0;
  private evictions = 0;

  constructor(private readonly ttlMs: number, private readonly maxEntries = 500, name?: string) {
    this.name = name || `ttl-cache-${++anonymousCacheCounter}`;
    cacheRegistry.add(this as TTLCache<unknown>);
  }

  get(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) {
      this.misses += 1;
      return null;
    }
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      this.misses += 1;
      return null;
    }
    this.hits += 1;
    return entry.value;
  }

  set(key: string, value: T): void {
    if (this.store.size >= this.maxEntries) {
      const firstKey = this.store.keys().next().value;
      if (firstKey) {
        this.store.delete(firstKey);
        this.evictions += 1;
      }
    }
    const now = Date.now();
    this.store.set(key, { value, createdAt: now, expiresAt: now + this.ttlMs });
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
      this.hits += 1;
      if (backgroundRefreshBeforeMs > 0 && Date.now() > entry.expiresAt - backgroundRefreshBeforeMs && !this.inFlight.has(key)) {
        const refresh = loader().then(v => { this.set(key, v); return v; }).catch(err => { console.error('[TTLCache] background refresh failed:', err); return entry.value; }).finally(() => this.inFlight.delete(key));
        this.inFlight.set(key, refresh);
      }
      return entry.value;
    }

    const staleEntry = entry ?? null;
    this.misses += 1;
    if (entry) this.store.delete(key);

    const existingLoad = this.inFlight.get(key);
    if (existingLoad) return existingLoad;

    const loadPromise = (async () => {
      try {
        const value = await loader();
        this.set(key, value);
        this.loadSuccesses += 1;
        return value;
      } catch (err) {
        this.loadFailures += 1;
        if (staleEntry) {
          // Serve stale data on load failure; short TTL so we retry soon
          this.staleServed += 1;
          const now = Date.now();
          this.store.set(key, {
            value: staleEntry.value,
            createdAt: staleEntry.createdAt,
            expiresAt: now + Math.min(30_000, this.ttlMs / 4),
          });
          return staleEntry.value;
        }
        throw err;
      }
    })();

    this.inFlight.set(key, loadPromise);
    try {
      return await loadPromise;
    } finally {
      this.inFlight.delete(key);
    }
  }

  getDiagnostics(): TTLCacheDiagnostics {
    const now = Date.now();
    let oldestEntryAgeMs: number | null = null;
    let newestEntryAgeMs: number | null = null;

    for (const entry of this.store.values()) {
      const age = now - entry.createdAt;
      if (oldestEntryAgeMs === null || age > oldestEntryAgeMs) oldestEntryAgeMs = age;
      if (newestEntryAgeMs === null || age < newestEntryAgeMs) newestEntryAgeMs = age;
    }

    return {
      name: this.name,
      ttlMs: this.ttlMs,
      maxEntries: this.maxEntries,
      size: this.store.size,
      inFlight: this.inFlight.size,
      hits: this.hits,
      misses: this.misses,
      staleServed: this.staleServed,
      loadSuccesses: this.loadSuccesses,
      loadFailures: this.loadFailures,
      evictions: this.evictions,
      oldestEntryAgeMs,
      newestEntryAgeMs,
    };
  }
}

export function getTTLCacheDiagnostics(): TTLCacheDiagnostics[] {
  return Array.from(cacheRegistry.values()).map((cache) => cache.getDiagnostics());
}
