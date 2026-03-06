import { getSupabaseClient } from "../supabase-client.ts";
import { log } from "../logger.ts";

// =============================================================================
// Types
// =============================================================================

export interface UserProfile {
  id: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
  wallet_address: string | null;
  created_at: string;
  updated_at: string;
}

// =============================================================================
// Service functions
// =============================================================================

/** Upsert a user profile (create or update) */
export async function upsertUserProfile(profile: {
  id: string;
  email?: string;
  display_name?: string;
  avatar_url?: string;
  wallet_address?: string;
}): Promise<UserProfile> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("user_profiles")
    .upsert(
      {
        id: profile.id,
        email: profile.email || null,
        display_name: profile.display_name || null,
        avatar_url: profile.avatar_url || null,
        wallet_address: profile.wallet_address || null,
      },
      { onConflict: "id" }
    )
    .select("*")
    .single();

  if (error) throw new Error(`Failed to upsert user profile: ${error.message}`);
  log("info", "user profile upserted", { id: profile.id });
  return data as UserProfile;
}

/** Get a user profile by Privy DID */
export async function getUserProfile(
  userId: string
): Promise<UserProfile | null> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(`Failed to get user profile: ${error.message}`);
  }

  return data as UserProfile;
}
