import { getSupabaseClient } from "../supabase-client.ts";
import { log } from "../logger.ts";

// =============================================================================
// Types
// =============================================================================

export interface CurveConfigParams {
  curve_mode?: number;
  initial_mcap?: number;
  migration_mcap?: number;
  total_token_supply?: number;
  token_decimals?: number;
  supply_on_migration_pct?: number;
  migration_option?: number;
  migration_fee_option?: number;
  creator_fee_pct?: number;
  creator_lp_pct?: number;
  base_fee_mode?: number;
  starting_fee_bps?: number;
  ending_fee_bps?: number;
  dynamic_fee?: boolean;
  token_image_url?: string;
  token_description?: string;
  token_website?: string;
  token_twitter?: string;
  token_telegram?: string;
}

export interface DeployAddresses {
  dbc_config_key: string;
  pool_address: string;
  base_mint: string;
  creator_wallet: string;
}

// =============================================================================
// Curve Configuration
// =============================================================================

/** Save bonding curve config to token_launches */
export async function configureCurve(
  launchId: string,
  params: CurveConfigParams,
) {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("token_launches")
    .update({
      ...params,
      status: "configuring",
    })
    .eq("id", launchId)
    .select("*")
    .single();

  if (error) throw new Error(`Failed to configure curve: ${error.message}`);
  log("info", "curve configured", { launchId });
  return data;
}

/** Get full curve config + state for a game */
export async function getCurveConfig(gameId: string) {
  const supabase = getSupabaseClient();

  const { data: launch, error: launchErr } = await supabase
    .from("token_launches")
    .select("*")
    .eq("game_id", gameId)
    .single();

  if (launchErr) {
    if (launchErr.code === "PGRST116") return null;
    throw new Error(`Failed to get curve config: ${launchErr.message}`);
  }

  // Also fetch bonding curve state if it exists
  const { data: state } = await supabase
    .from("bonding_curve_state")
    .select("*")
    .eq("launch_id", launch.id)
    .single();

  return { launch, state: state || null };
}

// =============================================================================
// Lifecycle State Management
// =============================================================================

/** Record on-chain addresses after deployment */
export async function markDeploying(
  launchId: string,
  addresses: DeployAddresses,
) {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("token_launches")
    .update({
      status: "deploying",
      dbc_config_key: addresses.dbc_config_key,
      pool_address: addresses.pool_address,
      base_mint: addresses.base_mint,
      creator_wallet: addresses.creator_wallet,
      deployed_at: new Date().toISOString(),
    })
    .eq("id", launchId)
    .select("*")
    .single();

  if (error) throw new Error(`Failed to mark deploying: ${error.message}`);
  log("info", "token marked deploying", { launchId, poolAddress: addresses.pool_address });
  return data;
}

/** Mark token as live and create bonding_curve_state row */
export async function markLive(launchId: string) {
  const supabase = getSupabaseClient();

  // Update status
  const { data: launch, error: updateErr } = await supabase
    .from("token_launches")
    .update({ status: "live" })
    .eq("id", launchId)
    .select("*")
    .single();

  if (updateErr) throw new Error(`Failed to mark live: ${updateErr.message}`);

  // Create initial bonding_curve_state row
  const { error: stateErr } = await supabase
    .from("bonding_curve_state")
    .upsert(
      {
        launch_id: launchId,
        game_id: launch.game_id,
      },
      { onConflict: "launch_id" },
    );

  if (stateErr) throw new Error(`Failed to create curve state: ${stateErr.message}`);
  log("info", "token marked live", { launchId });
  return launch;
}

/** Mark graduated + set graduated_at */
export async function markGraduated(launchId: string, graduatedPool: string) {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("token_launches")
    .update({
      status: "graduated",
      graduated_at: new Date().toISOString(),
      graduated_pool: graduatedPool,
    })
    .eq("id", launchId)
    .select("*")
    .single();

  if (error) throw new Error(`Failed to mark graduated: ${error.message}`);

  // Update bonding_curve_state
  await supabase
    .from("bonding_curve_state")
    .update({ is_graduated: true, bonding_pct: 100 })
    .eq("launch_id", launchId);

  log("info", "token graduated", { launchId, graduatedPool });
  return data;
}

/** Mark failed + store error in metadata */
export async function markFailed(launchId: string, errorMsg: string) {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("token_launches")
    .update({
      status: "failed",
      metadata: { error: errorMsg, failed_at: new Date().toISOString() },
    })
    .eq("id", launchId)
    .select("*")
    .single();

  if (error) throw new Error(`Failed to mark failed: ${error.message}`);
  log("error", "token launch failed", { launchId, errorMsg });
  return data;
}

// =============================================================================
// Query Functions
// =============================================================================

/** List all live (trading) tokens with state */
export async function getLiveTokens(limit = 20, offset = 0) {
  const supabase = getSupabaseClient();

  const { data, error, count } = await supabase
    .from("token_launches")
    .select("*, bonding_curve_state(*)", { count: "exact" })
    .eq("status", "live")
    .order("deployed_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw new Error(`Failed to get live tokens: ${error.message}`);
  return { tokens: data || [], total: count || 0 };
}

/** List all graduated tokens */
export async function getGraduatedTokens(limit = 20, offset = 0) {
  const supabase = getSupabaseClient();

  const { data, error, count } = await supabase
    .from("token_launches")
    .select("*, bonding_curve_state(*)", { count: "exact" })
    .eq("status", "graduated")
    .order("graduated_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw new Error(`Failed to get graduated tokens: ${error.message}`);
  return { tokens: data || [], total: count || 0 };
}

/** Explore tokens with filtering and sorting */
export async function getExploreTokens(filters: {
  status?: string;
  sort?: string;
  limit?: number;
  offset?: number;
}) {
  const supabase = getSupabaseClient();
  const limit = filters.limit || 20;
  const offset = filters.offset || 0;

  let query = supabase
    .from("token_launches")
    .select("*, bonding_curve_state(*)", { count: "exact" })
    .in("status", ["live", "graduating", "graduated"]);

  if (filters.status === "live") {
    query = query.eq("status", "live");
  } else if (filters.status === "graduated") {
    query = query.eq("status", "graduated");
  }

  // Sorting
  switch (filters.sort) {
    case "bonding_pct":
      query = query.order("deployed_at", { ascending: false });
      break;
    case "mcap":
      query = query.order("deployed_at", { ascending: false });
      break;
    case "volume":
      query = query.order("deployed_at", { ascending: false });
      break;
    case "newest":
    default:
      query = query.order("deployed_at", { ascending: false });
      break;
  }

  const { data, error, count } = await query.range(offset, offset + limit - 1);

  if (error) throw new Error(`Failed to explore tokens: ${error.message}`);
  return { tokens: data || [], total: count || 0 };
}
