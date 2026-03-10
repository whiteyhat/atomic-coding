import { z } from "npm:zod@^3.23.0";

// =============================================================================
// Games
// =============================================================================

export const createGameSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  genre: z.string().max(50).optional(),
  game_format: z.enum(["2d", "3d"]).optional(),
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

export const registerCustomExternalSchema = z.object({
  display_name: z.string().min(1).max(100),
  cdn_url: z.string().url().max(500),
  global_name: z.string().min(1).max(100),
  version: z.string().min(1).max(30).optional(),
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
  game_format: z.enum(["2d", "3d"]).optional(),
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
// User Profiles
// =============================================================================

export const upsertProfileSchema = z.object({
  id: z.string().min(1),
  email: z.string().email().max(320).optional(),
  display_name: z.string().max(100).optional(),
  avatar_url: z.string().url().max(500).optional().nullable(),
  wallet_address: z.string().max(255).optional(),
  privy_did: z.string().optional(),
}).passthrough();

export const updateMyProfileSchema = z.object({
  display_name: z.string().max(100).optional(),
  avatar_url: z.string().url().max(500).optional().nullable(),
});

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

// =============================================================================
// OpenClaw
// =============================================================================

export const openClawClaimSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional().nullable(),
  agent_url: z.string().url().max(500),
  endpoint_url: z.string().url().max(500).optional().nullable(),
  webhook_events: z.array(z.string().min(1).max(100)).max(32).optional(),
});

export const openClawWebhookConfigSchema = z.object({
  delivery_channel: z.enum(["custom", "telegram"]).optional(),
  endpoint_url: z.string().url().max(500).optional().nullable(),
  telegram_bot_token: z.string().max(255).optional().nullable(),
  telegram_chat_id: z.string().max(100).optional().nullable(),
  webhook_events: z.array(z.string().min(1).max(100)).max(32).optional(),
});

export const openClawApiKeyCreateSchema = z.object({
  scopes: z.array(z.string().min(1).max(50)).max(32).optional(),
});

export const openClawHeartbeatSchema = z.object({
  metadata: z.record(z.unknown()).optional(),
});
