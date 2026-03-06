import { getSupabaseClient } from "../supabase-client.ts";
import { log } from "../logger.ts";

// =============================================================================
// Types
// =============================================================================

export interface Score {
  id: string;
  game_id: string;
  user_id: string | null;
  player_name: string | null;
  score: number;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface LeaderboardEntry {
  id: string;
  game_id: string;
  user_id: string | null;
  player_name: string;
  avatar_url: string | null;
  score: number;
  created_at: string;
}

// =============================================================================
// Rate limiting (in-memory, per-instance)
// =============================================================================

const rateLimitMap = new Map<string, number>();

function isRateLimited(key: string, intervalMs: number = 1000): boolean {
  const now = Date.now();
  const last = rateLimitMap.get(key) ?? 0;
  if (now - last < intervalMs) return true;
  rateLimitMap.set(key, now);
  return false;
}

// =============================================================================
// Service functions
// =============================================================================

/** Submit a score for a game */
export async function submitScore(
  gameId: string,
  score: number,
  userId?: string,
  playerName?: string,
  metadata?: Record<string, unknown>,
): Promise<Score> {
  // Rate limit: 1 score per second per user/game
  const rateLimitKey = `${gameId}:${userId ?? "anon"}`;
  if (isRateLimited(rateLimitKey)) {
    throw new Error("Rate limited: max 1 score per second");
  }

  // Validate score
  if (!Number.isInteger(score) || score < 0) {
    throw new Error("Score must be a non-negative integer");
  }

  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("scores")
    .insert({
      game_id: gameId,
      user_id: userId || null,
      player_name: playerName || null,
      score,
      metadata: metadata || {},
    })
    .select("*")
    .single();

  if (error) throw new Error(`Failed to submit score: ${error.message}`);

  log("info", "score submitted", { gameId, userId, score });
  return data as Score;
}

/** Get leaderboard for a game (top scores, one per user) */
export async function getLeaderboard(
  gameId: string,
  limit: number = 20,
): Promise<LeaderboardEntry[]> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("leaderboard")
    .select("*")
    .eq("game_id", gameId)
    .order("score", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Failed to get leaderboard: ${error.message}`);
  return (data || []) as LeaderboardEntry[];
}

/** Get recent scores for a game (all entries, not deduplicated) */
export async function getRecentScores(
  gameId: string,
  limit: number = 50,
): Promise<Score[]> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("scores")
    .select("*")
    .eq("game_id", gameId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Failed to get recent scores: ${error.message}`);
  return (data || []) as Score[];
}
