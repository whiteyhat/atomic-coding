import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * If `gameIdOrSlug` is already a UUID, return it as-is (no DB call).
 * Otherwise, look up the `games` table by name and return the UUID.
 */
export async function resolveGameId(gameIdOrSlug: string): Promise<string> {
  if (UUID_RE.test(gameIdOrSlug)) return gameIdOrSlug;

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("games")
    .select("id")
    .eq("name", gameIdOrSlug)
    .single();

  if (error || !data) {
    throw new Error(`Game not found: "${gameIdOrSlug}"`);
  }
  return data.id;
}

export function getSupabaseClient(): SupabaseClient {
  if (_client) return _client;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  _client = createClient(url, key, {
    auth: { persistSession: false },
  });
  return _client;
}
