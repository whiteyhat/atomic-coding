import type { Context, Next } from "npm:hono@^4.9.7";
import { authenticateApiKey } from "./services/openclaw.ts";

export function requireOpenClawApiKey() {
  return async (c: Context, next: Next) => {
    const authHeader = c.req.header("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const token = authHeader.slice(7).trim();
    if (!token) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const context = await authenticateApiKey(token);
    if (!context) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    c.set("openclawApiKey", context);
    await next();
  };
}
