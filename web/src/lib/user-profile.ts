/**
 * Ensure a user profile exists in the database.
 * Creates one if it doesn't exist, updates if it does.
 */
export async function ensureUserProfile(
  userId: string,
  _email?: string,
  _displayName?: string,
  _avatarUrl?: string,
  _walletAddress?: string
): Promise<void> {
  const { API_BASE } = await import("./constants");

  const response = await fetch(`${API_BASE}/users/profile`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: userId,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to sync user profile: ${response.status}`);
  }
}
