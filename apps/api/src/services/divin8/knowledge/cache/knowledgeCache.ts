interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const DEFAULT_TTL_MS = 5 * 60 * 1000;
const retrievalCache = new Map<string, CacheEntry<unknown>>();

export function buildKnowledgeCacheKey(parts: unknown[]) {
  return JSON.stringify(parts);
}

export function getKnowledgeCache<T>(key: string): T | null {
  const entry = retrievalCache.get(key);
  if (!entry) {
    return null;
  }
  if (Date.now() > entry.expiresAt) {
    retrievalCache.delete(key);
    return null;
  }
  return entry.value as T;
}

export function setKnowledgeCache<T>(key: string, value: T, ttlMs = DEFAULT_TTL_MS) {
  retrievalCache.set(key, {
    value,
    expiresAt: Date.now() + ttlMs,
  });
}

export function invalidateKnowledgeCache() {
  retrievalCache.clear();
}
