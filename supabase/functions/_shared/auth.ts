import { PrivyClient } from "npm:@privy-io/server-auth@^1.32.5";

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
