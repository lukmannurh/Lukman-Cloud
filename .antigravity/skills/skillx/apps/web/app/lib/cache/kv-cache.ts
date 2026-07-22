/**
 * KV caching utility for Workers KV
 * Provides simple get-or-fetch pattern with TTL support
 */

export async function getCached<T>(
  kv: KVNamespace,
  key: string,
  ttlSeconds: number,
  fetchFn: () => Promise<T>
): Promise<T> {
  // Try to get from cache
  const cached = await kv.get(key, 'json');
  if (cached) {
    return cached as T;
  }

  // Cache miss - fetch fresh data
  const fresh = await fetchFn();

  // Store in cache with TTL
  await kv.put(key, JSON.stringify(fresh), { expirationTtl: ttlSeconds });

  return fresh;
}
