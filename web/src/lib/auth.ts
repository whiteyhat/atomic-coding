import "server-only";
import { auth } from "@clerk/nextjs/server";
import {
  getDevAuthUser,
  isDevAuthBypassEnabled,
} from "./dev-auth";

export interface AuthUser {
  userId: string;
  email?: string;
}

/**
 * Verify the auth token from a request.
 * Returns the authenticated user or null if invalid.
 */
export async function verifyAuthToken(
  req: Request
): Promise<AuthUser | null> {
  const hostname = new URL(req.url).hostname;
  if (isDevAuthBypassEnabled(hostname)) {
    return getDevAuthUser();
  }

  try {
    const { userId } = await auth();
    if (!userId) return null;
    return { userId };
  } catch {
    return null;
  }
}
