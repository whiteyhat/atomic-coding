/**
 * Ensure a user profile exists in the database.
 * Creates one if it doesn't exist, updates if it does.
 */
export async function ensureUserProfile(
  userId: string,
  email?: string,
  displayName?: string,
  avatarUrl?: string,
  walletAddress?: string
): Promise<void> {
  const { API_BASE } = await import("./constants");

  const response = await fetch(`${API_BASE}/users/profile`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: userId,
      email,
      display_name: displayName,
      avatar_url: avatarUrl,
      wallet_address: walletAddress,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to sync user profile: ${response.status}`);
  }
}
