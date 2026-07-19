export const SERVER_NODE_CACHE_TTL_MS = 30_000;

export interface ServerNodeCacheResult<T> {
  data: T;
  updatedAt: number;
  fresh: boolean;
}

interface ServerNodeCacheEntry {
  data: unknown;
  updatedAt: number;
}

const memoryCache = new Map<string, ServerNodeCacheEntry>();

export function serverNodeCacheKey(
  nodeId: string,
  resource: string,
  variant = "default",
): string {
  return `${nodeId}:${resource}:${variant}`;
}

export function readServerNodeCache<T>(
  key: string,
  now = Date.now(),
): ServerNodeCacheResult<T> | null {
  const entry = memoryCache.get(key);
  if (!entry) return null;
  return {
    data: entry.data as T,
    updatedAt: entry.updatedAt,
    fresh: now - entry.updatedAt < SERVER_NODE_CACHE_TTL_MS,
  };
}

export function writeServerNodeCache<T>(
  key: string,
  data: T,
  updatedAt = Date.now(),
): ServerNodeCacheResult<T> {
  memoryCache.set(key, { data, updatedAt });
  return { data, updatedAt, fresh: true };
}

export function clearServerNodeCacheForNode(nodeId: string): void {
  const prefix = `${nodeId}:`;
  for (const key of memoryCache.keys()) {
    if (key.startsWith(prefix)) memoryCache.delete(key);
  }
}

export function clearServerNodeCache(): void {
  memoryCache.clear();
}
