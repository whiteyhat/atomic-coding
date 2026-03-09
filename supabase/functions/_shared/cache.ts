import { Redis } from "npm:@upstash/redis@^1.34.0";

let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (redis) return redis;

  const url = Deno.env.get("UPSTASH_REDIS_REST_URL");
  const token = Deno.env.get("UPSTASH_REDIS_REST_TOKEN");

  if (!url || !token) return null;

  redis = new Redis({ url, token });
  return redis;
}

/**
 * Get a value from cache.
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  const r = getRedis();
  if (!r) return null;
  try {
    return await r.get<T>(key);
  } catch {
    return null;
  }
}

/**
 * Set a value in cache with a TTL in seconds.
 */
export async function cacheSet<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
  const r = getRedis();
  if (!r) return;
  try {
    await r.set(key, value, { ex: ttlSeconds });
  } catch {
    // Best-effort caching — don't block on failures
  }
}

/**
 * Delete a cache key.
 */
export async function cacheDel(...keys: string[]): Promise<void> {
  const r = getRedis();
  if (!r) return;
  try {
    await r.del(...keys);
  } catch {
    // Best-effort
  }
}

/**
 * Cache-aside helper: return cached value or fetch and cache it.
 */
export async function cached<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>,
): Promise<T> {
  const hit = await cacheGet<T>(key);
  if (hit !== null) return hit;

  const value = await fetcher();
  // Don't await — fire-and-forget set
  cacheSet(key, value, ttlSeconds);
  return value;
}
