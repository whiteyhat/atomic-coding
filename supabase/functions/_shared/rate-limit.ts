import { Ratelimit } from "npm:@upstash/ratelimit@^2.0.5";
import { Redis } from "npm:@upstash/redis@^1.34.0";
import type { Context } from "npm:hono@^4.9.7";

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
 * Create a rate limiter with a sliding window.
 * Returns null if Upstash is not configured (graceful degradation).
 */
function createLimiter(
  prefix: string,
  maxRequests: number,
  windowSeconds: number,
): Ratelimit | null {
  const r = getRedis();
  if (!r) return null;
  return new Ratelimit({
    redis: r,
    prefix: `rl:${prefix}`,
    limiter: Ratelimit.slidingWindow(maxRequests, `${windowSeconds} s`),
  });
}

// Pre-configured limiters for different endpoints
const limiters = {
  score: () => createLimiter("score", 1, 1),                   // 1/sec per user
  warroom: () => createLimiter("warroom", 5, 60),               // 5/min per user
  build: () => createLimiter("build", 2, 60),                   // 2/min per game
  chatSave: () => createLimiter("chat-save", 10, 60),           // 10/min per session
  gameCreate: () => createLimiter("game-create", 5, 60),        // 5/min per user
  assistantChat: () => createLimiter("assistant-chat", 10, 60), // 10/min per user
  publish: () => createLimiter("publish", 3, 60),               // 3/min per user
  atomWrite: () => createLimiter("atom-write", 30, 60),         // 30/min per user
  deleteOp: () => createLimiter("delete", 10, 60),              // 10/min per user
  customExternal: () => createLimiter("custom-ext", 5, 60),     // 5/min per user
  sessionCreate: () => createLimiter("session-create", 10, 60), // 10/min per user
};

export type RateLimitType = keyof typeof limiters;

/**
 * Check rate limit. Returns a 429 Response if exceeded, null if allowed.
 * Identifier should be a userId, gameId, or sessionId depending on the limiter.
 */
export async function checkRateLimit(
  c: Context,
  type: RateLimitType,
  identifier: string,
): Promise<Response | null> {
  const limiter = limiters[type]();
  if (!limiter) return null; // Upstash not configured — allow all

  try {
    const { success, limit, remaining, reset } = await limiter.limit(identifier);
    if (!success) {
      c.header("X-RateLimit-Limit", String(limit));
      c.header("X-RateLimit-Remaining", "0");
      c.header("X-RateLimit-Reset", String(reset));
      return c.json({ error: "Too many requests" }, 429);
    }
    c.header("X-RateLimit-Limit", String(limit));
    c.header("X-RateLimit-Remaining", String(remaining));
    return null;
  } catch {
    // On limiter error, allow the request through
    return null;
  }
}
