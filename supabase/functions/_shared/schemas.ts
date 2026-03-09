import { z } from "npm:zod@^3.23.0";

// =============================================================================
// Games
// =============================================================================

export const createGameSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  user_id: z.string().min(1),
  genre: z.string().max(50).optional(),
});

// =============================================================================
// Atoms
// =============================================================================

const portSchema = z.object({
  name: z.string().min(1),
  type: z.string().min(1),
});

export const upsertAtomSchema = z.object({
  code: z.string().min(1).max(4096),
  type: z.enum(["core", "feature", "util"]),
  inputs: z.array(portSchema).optional(),
  outputs: z.array(portSchema).optional(),
  dependencies: z.array(z.string()).optional(),
  description: z.string().max(500).optional(),
});

export const readAtomsSchema = z.object({
  names: z.array(z.string().min(1)).min(1).max(50),
});

export const searchAtomsSchema = z.object({
  query: z.string().min(1).max(200),
  limit: z.number().int().min(1).max(20).optional(),
});

// =============================================================================
// Externals
// =============================================================================

export const installExternalSchema = z.object({
  name: z.string().min(1).max(100),
});

// =============================================================================
// Scores
// =============================================================================

export const submitScoreSchema = z.object({
  score: z.number().int().min(0),
  metadata: z.record(z.unknown()).optional(),
});

// =============================================================================
// Chat
// =============================================================================

export const createSessionSchema = z.object({
  model: z.string().max(100).optional(),
  title: z.string().max(200).optional(),
});

export const saveMessagesSchema = z.object({
  messages: z.array(z.record(z.unknown())).min(1).max(200),
});

// =============================================================================
// War Rooms
// =============================================================================

export const createWarRoomSchema = z.object({
  prompt: z.string().min(1).max(2000),
  user_id: z.string().optional(),
  genre: z.string().max(50).optional(),
});

// =============================================================================
// Publishing
// =============================================================================

export const publishGameSchema = z.object({
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, "slug must be lowercase alphanumeric with hyphens"),
});

// =============================================================================
// Token
// =============================================================================

export const upsertTokenSchema = z.object({
  token_name: z.string().min(1).max(50),
  token_symbol: z.string().min(1).max(10),
  creator_id: z.string().min(1),
  chain_id: z.number().int().optional(),
  total_supply: z.number().optional(),
  leaderboard_allocation_pct: z.number().min(0).max(100).optional(),
});

// =============================================================================
// Bonding Curve
// =============================================================================

export const configureCurveSchema = z.object({
  curve_mode: z.number().int().min(0).max(3).optional(),
  initial_mcap: z.number().positive().optional(),
  migration_mcap: z.number().positive().optional(),
  total_token_supply: z.number().positive().optional(),
  token_decimals: z.number().int().min(0).max(18).optional(),
  supply_on_migration_pct: z.number().int().min(20).max(100).optional(),
  migration_option: z.number().int().min(0).max(1).optional(),
  migration_fee_option: z.number().int().min(0).max(5).optional(),
  creator_fee_pct: z.number().int().min(0).max(100).optional(),
  creator_lp_pct: z.number().int().min(0).max(100).optional(),
  base_fee_mode: z.number().int().min(0).max(2).optional(),
  starting_fee_bps: z.number().int().min(1).max(9900).optional(),
  ending_fee_bps: z.number().int().min(1).max(9900).optional(),
  dynamic_fee: z.boolean().optional(),
  token_image_url: z.string().url().optional(),
  token_description: z.string().max(500).optional(),
  token_website: z.string().url().optional(),
  token_twitter: z.string().max(100).optional(),
  token_telegram: z.string().max(200).optional(),
});

export const deployRecordSchema = z.object({
  dbc_config_key: z.string().min(1),
  pool_address: z.string().min(1),
  base_mint: z.string().min(1),
  creator_wallet: z.string().min(1),
});

export const recordTransactionSchema = z.object({
  tx_signature: z.string().min(1),
  tx_type: z.enum(["buy", "sell"]),
  wallet_address: z.string().min(1),
  amount_in: z.number().positive(),
  amount_out: z.number().positive(),
  price_per_token: z.number().positive(),
  fee_amount: z.number().min(0).optional(),
  mcap_at_trade: z.number().optional(),
  bonding_pct_at_trade: z.number().optional(),
  block_time: z.string().min(1),
});

export const swapQuoteSchema = z.object({
  direction: z.enum(["buy", "sell"]),
  amount: z.number().positive(),
});

export const exploreQuerySchema = z.object({
  status: z.enum(["live", "graduated", "all"]).optional(),
  sort: z.enum(["bonding_pct", "mcap", "volume", "newest"]).optional(),
  limit: z.number().int().min(1).max(100).optional(),
  offset: z.number().int().min(0).optional(),
});

// =============================================================================
// User Profiles
// =============================================================================

export const upsertProfileSchema = z.object({
  id: z.string().min(1),
  display_name: z.string().max(100).optional(),
  avatar_url: z.string().url().max(500).optional().nullable(),
  privy_did: z.string().optional(),
}).passthrough();

// =============================================================================
// Heartbeat
// =============================================================================

export const heartbeatSchema = z.object({
  agent: z.string().min(1),
  status: z.enum(["idle", "working", "error", "timeout"]).optional(),
  metadata: z.record(z.unknown()).optional(),
});

// =============================================================================
// Task Status
// =============================================================================

export const taskStatusSchema = z.object({
  status: z.enum(["pending", "assigned", "running", "completed", "failed", "blocked"]),
  output: z.record(z.unknown()).optional(),
});
