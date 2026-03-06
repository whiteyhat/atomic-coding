import { getSupabaseClient } from "../supabase-client.ts";
import { log } from "../logger.ts";

// =============================================================================
// Types
// =============================================================================

export interface TokenLaunch {
  id: string;
  game_id: string;
  creator_id: string;
  token_name: string;
  token_symbol: string;
  status: "draft" | "pending" | "launched" | "failed";
  chain_id: string | null;
  contract_address: string | null;
  total_supply: number | null;
  leaderboard_allocation_pct: number;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface TokenDistribution {
  id: string;
  launch_id: string;
  user_id: string | null;
  rank: number | null;
  allocation_amount: number | null;
  status: "pending" | "distributed" | "claimed";
  wallet_address: string | null;
  created_at: string;
}

// =============================================================================
// Token Launches
// =============================================================================

/** Create or update a token launch for a game (one per game) */
export async function upsertTokenLaunch(
  gameId: string,
  creatorId: string,
  tokenName: string,
  tokenSymbol: string,
  opts?: {
    chainId?: string;
    totalSupply?: number;
    leaderboardAllocationPct?: number;
  },
): Promise<TokenLaunch> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("token_launches")
    .upsert(
      {
        game_id: gameId,
        creator_id: creatorId,
        token_name: tokenName,
        token_symbol: tokenSymbol.toUpperCase(),
        chain_id: opts?.chainId || null,
        total_supply: opts?.totalSupply || null,
        leaderboard_allocation_pct: opts?.leaderboardAllocationPct ?? 2,
      },
      { onConflict: "game_id" },
    )
    .select("*")
    .single();

  if (error) throw new Error(`Failed to upsert token launch: ${error.message}`);
  log("info", "token launch upserted", { gameId, tokenName, tokenSymbol });
  return data as TokenLaunch;
}

/** Get the token launch for a game */
export async function getTokenLaunch(gameId: string): Promise<TokenLaunch | null> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("token_launches")
    .select("*")
    .eq("game_id", gameId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(`Failed to get token launch: ${error.message}`);
  }

  return data as TokenLaunch;
}

/** Update token launch status */
export async function updateTokenLaunchStatus(
  launchId: string,
  status: TokenLaunch["status"],
): Promise<TokenLaunch> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("token_launches")
    .update({ status })
    .eq("id", launchId)
    .select("*")
    .single();

  if (error) throw new Error(`Failed to update token launch: ${error.message}`);
  log("info", "token launch status updated", { launchId, status });
  return data as TokenLaunch;
}

// =============================================================================
// Token Distributions
// =============================================================================

/** Get distributions for a launch */
export async function getDistributions(launchId: string): Promise<TokenDistribution[]> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("token_distributions")
    .select("*")
    .eq("launch_id", launchId)
    .order("rank", { ascending: true });

  if (error) throw new Error(`Failed to get distributions: ${error.message}`);
  return (data || []) as TokenDistribution[];
}
