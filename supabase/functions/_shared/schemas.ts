import { z } from "npm:zod@^3.23.0";

// =============================================================================
// Games
// =============================================================================

export const createGameSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
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
