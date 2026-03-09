import "server-only";
import { PrivyClient } from "@privy-io/server-auth";

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "";
const PRIVY_APP_SECRET = process.env.PRIVY_APP_SECRET ?? "";

let privyClient: PrivyClient | null = null;

function getPrivyClient(): PrivyClient {
  if (!privyClient) {
    privyClient = new PrivyClient(PRIVY_APP_ID, PRIVY_APP_SECRET);
  }
  return privyClient;
}

export interface AuthUser {
  userId: string; // Privy DID
  email?: string;
}

/**
 * Verify a Privy auth token from a request.
 * Returns the authenticated user or null if invalid.
 */
export async function verifyAuthToken(
  req: Request
): Promise<AuthUser | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.slice(7);
  if (!token) return null;

  try {
    const client = getPrivyClient();
    const verifiedClaims = await client.verifyAuthToken(token);
    return {
      userId: verifiedClaims.userId,
    };
  } catch {
    return null;
  }
}

