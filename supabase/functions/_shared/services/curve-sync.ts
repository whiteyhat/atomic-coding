import { getSupabaseClient } from "../supabase-client.ts";
import { log } from "../logger.ts";

const JUPITER_API = "https://datapi.jup.ag";

// =============================================================================
// Jupiter API Types
// =============================================================================

interface JupiterPool {
  id: string;
  bondingCurve?: number;
  volume24h?: number;
  baseAsset: {
    id: string;
    name: string;
    symbol: string;
    icon?: string;
    decimals: number;
    holderCount?: number;
    fdv?: number;
    mcap?: number;
    usdPrice?: number;
    liquidity?: number;
    graduatedAt?: string;
    stats5m?: { priceChangePercent: number };
    stats1h?: { priceChangePercent: number };
    stats6h?: { priceChangePercent: number };
    stats24h?: { priceChangePercent: number; volume: number; trades: number };
  };
}

// =============================================================================
// Sync Functions
// =============================================================================

/** Fetch pool data from Jupiter API and update bonding_curve_state */
export async function syncPoolState(launchId: string) {
  const supabase = getSupabaseClient();

  // Get the token launch to find the mint address
  const { data: launch, error: launchErr } = await supabase
    .from("token_launches")
    .select("base_mint, game_id")
    .eq("id", launchId)
    .single();

  if (launchErr || !launch?.base_mint) {
    log("warn", "syncPoolState: no base_mint found", { launchId });
    return null;
  }

  // Fetch from Jupiter
  const pool = await fetchPoolFromJupiter(launch.base_mint);
  if (!pool) {
    log("warn", "syncPoolState: pool not found on Jupiter", { launchId, mint: launch.base_mint });
    return null;
  }

  const asset = pool.baseAsset;
  const stats24h = asset.stats24h;

  // Update bonding_curve_state
  const stateUpdate = {
    launch_id: launchId,
    game_id: launch.game_id,
    bonding_pct: pool.bondingCurve ?? 100,
    current_mcap: asset.mcap ?? 0,
    current_mcap_usd: asset.mcap ? (asset.mcap * (asset.usdPrice ?? 0)) : 0,
    current_price: asset.usdPrice ?? 0,
    current_price_usd: asset.usdPrice ?? 0,
    fdv: asset.fdv ?? 0,
    liquidity: asset.liquidity ?? 0,
    holder_count: asset.holderCount ?? 0,
    volume_24h: stats24h?.volume ?? 0,
    trades_24h: stats24h?.trades ?? 0,
    price_change_5m: asset.stats5m?.priceChangePercent ?? 0,
    price_change_1h: asset.stats1h?.priceChangePercent ?? 0,
    price_change_6h: asset.stats6h?.priceChangePercent ?? 0,
    price_change_24h: stats24h?.priceChangePercent ?? 0,
    is_graduated: pool.bondingCurve === undefined || (pool.bondingCurve ?? 0) >= 100,
    last_synced_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("bonding_curve_state")
    .upsert(stateUpdate, { onConflict: "launch_id" })
    .select("*")
    .single();

  if (error) {
    log("error", "syncPoolState: failed to update state", { launchId, error: error.message });
    return null;
  }

  log("info", "pool state synced", { launchId, bondingPct: stateUpdate.bonding_pct });
  return data;
}

/** Sync all live tokens */
export async function syncAllLiveTokens() {
  const supabase = getSupabaseClient();

  const { data: liveTokens, error } = await supabase
    .from("token_launches")
    .select("id")
    .in("status", ["live", "graduating"]);

  if (error) {
    log("error", "syncAllLiveTokens: failed to fetch live tokens", { error: error.message });
    return;
  }

  log("info", "syncing live tokens", { count: liveTokens?.length ?? 0 });

  for (const token of liveTokens || []) {
    try {
      await syncPoolState(token.id);
    } catch (err) {
      log("error", "syncAllLiveTokens: failed to sync token", {
        launchId: token.id,
        error: (err as Error).message,
      });
    }
  }
}

// =============================================================================
// State Queries
// =============================================================================

/** Get cached state for a game */
export async function getState(gameId: string) {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("bonding_curve_state")
    .select("*")
    .eq("game_id", gameId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(`Failed to get curve state: ${error.message}`);
  }

  return data;
}

/** Get top holders sorted by balance */
export async function getHolders(launchId: string, limit = 10) {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("token_holders")
    .select("*")
    .eq("launch_id", launchId)
    .order("balance", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Failed to get holders: ${error.message}`);
  return data || [];
}

/** Get recent transactions */
export async function getTransactions(launchId: string, limit = 50) {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("token_transactions")
    .select("*")
    .eq("launch_id", launchId)
    .order("block_time", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Failed to get transactions: ${error.message}`);
  return data || [];
}

/** Record a new buy/sell transaction */
export async function recordTransaction(
  launchId: string,
  gameId: string,
  txData: {
    tx_signature: string;
    tx_type: "buy" | "sell";
    wallet_address: string;
    amount_in: number;
    amount_out: number;
    price_per_token: number;
    fee_amount?: number;
    mcap_at_trade?: number;
    bonding_pct_at_trade?: number;
    block_time: string;
  },
) {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("token_transactions")
    .insert({
      launch_id: launchId,
      game_id: gameId,
      ...txData,
    })
    .select("*")
    .single();

  if (error) throw new Error(`Failed to record transaction: ${error.message}`);
  log("info", "transaction recorded", { launchId, txType: txData.tx_type, signature: txData.tx_signature });
  return data;
}

// =============================================================================
// Jupiter API Helper
// =============================================================================

async function fetchPoolFromJupiter(mintAddress: string): Promise<JupiterPool | null> {
  try {
    const res = await fetch(
      `${JUPITER_API}/v1/pools?assetId=${mintAddress}&provider=met-dbc`,
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.pools?.[0] ?? null;
  } catch (err) {
    log("error", "fetchPoolFromJupiter failed", { mintAddress, error: (err as Error).message });
    return null;
  }
}
