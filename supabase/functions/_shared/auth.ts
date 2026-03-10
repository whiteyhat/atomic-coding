import * as jose from "npm:jose@^5";
import type { Context, Next } from "npm:hono@^4.9.7";
import {
  DEV_AUTH_BYPASS_TOKEN,
  getDevAuthUser,
  isDevAuthBypassEnabled,
} from "./dev-auth.ts";
import { log } from "./logger.ts";

export interface AuthUser {
  userId: string;
}

const CLERK_JWKS_URL = Deno.env.get("CLERK_JWKS_URL") ?? "";

let jwks: ReturnType<typeof jose.createRemoteJWKSet> | null = null;

function getJWKS() {
  if (!jwks) {
    if (!CLERK_JWKS_URL) {
      throw new Error("Missing CLERK_JWKS_URL environment variable");
    }
    jwks = jose.createRemoteJWKSet(new URL(CLERK_JWKS_URL));
  }
  return jwks;
}

export async function verifyAuthToken(req: Request): Promise<AuthUser | null> {
  if (isDevAuthBypassEnabled(req)) {
    const authHeader = req.headers.get("Authorization");
    if (authHeader === `Bearer ${DEV_AUTH_BYPASS_TOKEN}`) {
      return getDevAuthUser();
    }
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.slice(7);
  if (!token) return null;

  try {
    const keySet = getJWKS();
    const { payload } = await jose.jwtVerify(token, keySet);
    if (!payload.sub) return null;
    return { userId: payload.sub };
  } catch (err) {
    log("warn", "auth:verify_failed", {
      error: (err as Error).message,
      hasToken: !!token,
    });
    return null;
  }
}

/**
 * Hono middleware that requires a valid auth token on the request.
 * Sets `c.set("authUser", user)` on success, returns 401 on failure.
 */
export function requireAuth() {
  return async (c: Context, next: Next) => {
    const user = await verifyAuthToken(c.req.raw);
    if (!user) {
      const path = new URL(c.req.url).pathname;
      const hasAuthHeader = !!c.req.header("Authorization");
      log("warn", "auth:unauthorized", { path, hasAuthHeader });
      return c.json({ error: "Unauthorized" }, 401);
    }
    c.set("authUser", user);
    await next();
  };
}
