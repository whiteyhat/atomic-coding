import { PrivyClient } from "npm:@privy-io/server-auth@^1.32.5";
import type { Context, Next } from "npm:hono@^4.9.7";
import {
  DEV_AUTH_BYPASS_TOKEN,
  getDevAuthUser,
  isDevAuthBypassEnabled,
} from "./dev-auth.ts";

export interface AuthUser {
  userId: string;
}

let privyClient: PrivyClient | null = null;

function getPrivyClient(): PrivyClient {
  if (privyClient) return privyClient;

  const appId =
    Deno.env.get("NEXT_PUBLIC_PRIVY_APP_ID") ??
    Deno.env.get("PRIVY_APP_ID") ??
    "";
  const appSecret = Deno.env.get("PRIVY_APP_SECRET") ?? "";

  if (!appId || !appSecret) {
    throw new Error("Missing Privy app credentials");
  }

  privyClient = new PrivyClient(appId, appSecret);
  return privyClient;
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
    const claims = await getPrivyClient().verifyAuthToken(token);
    return { userId: claims.userId };
  } catch {
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
      return c.json({ error: "Unauthorized" }, 401);
    }
    c.set("authUser", user);
    await next();
  };
}
