import { getSupabaseClient } from "../supabase-client.ts";
import { log } from "../logger.ts";
import { markGraduated } from "./bonding-curve.ts";

// =============================================================================
// Leaderboard Distribution Weights
// =============================================================================

/** Top 10 distribution weights (must sum to 100) */
const DISTRIBUTION_WEIGHTS = [25, 20, 15, 12, 8, 6, 5, 4, 3, 2] as const;

// =============================================================================
// Graduation
// =============================================================================

/**
 * Handle full graduation flow:
 * 1. Mark token as graduated
 * 2. Snapshot leaderboard
 * 3. Calculate and create distributions
 */
export async function handleGraduation(
  launchId: string,
  gameId: string,
  graduatedPool: string,
) {
  log("info", "graduation: starting", { launchId, gameId });

  // 1. Mark graduated
  await markGraduated(launchId, graduatedPool);
  log("info", "graduation: marked graduated", { launchId });

  // 2. Snapshot leaderboard + create distributions
  await createLeaderboardDistributions(launchId, gameId);
  log("info", "graduation: distributions created", { launchId });
}

// =============================================================================
// Leaderboard Snapshot + Distribution
// =============================================================================

/**
 * Snapshot the current leaderboard and create token distribution records.
 * Takes the top 10 players from the lifetime leaderboard.
 */
export async function createLeaderboardDistributions(
  launchId: string,
  gameId: string,
) {
  const supabase = getSupabaseClient();

  // Get launch to determine allocation amount
  const { data: launch, error: launchErr } = await supabase
    .from("token_launches")
    .select("total_supply, total_token_supply, leaderboard_allocation_pct")
    .eq("id", launchId)
    .single();

  if (launchErr) throw new Error(`Failed to get launch: ${launchErr.message}`);

  const totalSupply = launch.total_token_supply ?? launch.total_supply ?? 1_000_000_000;
  const allocationPct = launch.leaderboard_allocation_pct ?? 2;
  const allocationPool = totalSupply * (allocationPct / 100);

  // Get top 10 from lifetime leaderboard
  const { data: leaderboard, error: lbErr } = await supabase
    .from("game_scores")
    .select("user_id, score")
    .eq("game_id", gameId)
    .order("score", { ascending: false })
    .limit(10);

  if (lbErr) throw new Error(`Failed to get leaderboard: ${lbErr.message}`);
  if (!leaderboard?.length) {
    log("warn", "graduation: no leaderboard entries, skipping distribution", { gameId });
    return;
  }

  // Calculate distributions
  const distributions = leaderboard.map((entry, index) => {
    const weight = DISTRIBUTION_WEIGHTS[index] ?? 0;
    return {
      launch_id: launchId,
      user_id: entry.user_id,
      rank: index + 1,
      allocation_amount: Math.floor(allocationPool * (weight / 100)),
      status: "pending" as const,
    };
  });

  // Insert distributions
  const { error: insertErr } = await supabase
    .from("token_distributions")
    .insert(distributions);

  if (insertErr) throw new Error(`Failed to insert distributions: ${insertErr.message}`);

  log("info", "graduation: distributions inserted", {
    launchId,
    count: distributions.length,
    totalAllocated: distributions.reduce((s, d) => s + (d.allocation_amount ?? 0), 0),
  });
}

/**
 * Check if a token has graduated based on its bonding curve state.
 * Called from syncPoolState when bonding_pct reaches 100.
 */
export async function checkGraduation(
  launchId: string,
  gameId: string,
  bondingPct: number,
  graduatedPool?: string,
) {
  if (bondingPct < 100 && !graduatedPool) return false;

  const supabase = getSupabaseClient();

  // Check if already graduated
  const { data } = await supabase
    .from("token_launches")
    .select("status")
    .eq("id", launchId)
    .single();

  if (data?.status === "graduated" || data?.status === "graduating") {
    return false; // Already handling
  }

  log("info", "graduation: auto-detected", { launchId, bondingPct });

  try {
    await handleGraduation(launchId, gameId, graduatedPool ?? "auto-graduated");
    return true;
  } catch (err) {
    log("error", "graduation: auto-graduation failed", {
      launchId,
      error: (err as Error).message,
    });
    return false;
  }
}
