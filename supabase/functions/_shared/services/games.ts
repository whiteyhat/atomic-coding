import { getSupabaseClient } from "../supabase-client.ts";
import { log } from "../logger.ts";
import { cached, cacheDel } from "../cache.ts";
import { ensureBuildScoreSystemReport } from "./builds.ts";
import type { ValidationReport } from "../../../../mastra/src/shared/atom-validation.ts";

// =============================================================================
// Types
// =============================================================================

export interface Game {
  id: string;
  name: string;
  description: string | null;
  active_build_id: string | null;
  user_id: string | null;
  genre: string | null;
  thumbnail_url: string | null;
  is_published: boolean;
  published_at: string | null;
  public_slug: string | null;
  published_bundle_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface GameWithBuild extends Game {
  active_build?: {
    id: string;
    status: string;
    atom_count: number | null;
    created_at: string;
  } | null;
}

// =============================================================================
// Helpers
// =============================================================================

/** Map a raw DB row to Game fields */
function mapGame(g: any): Game {
  return {
    id: g.id,
    name: g.name,
    description: g.description,
    active_build_id: g.active_build_id,
    user_id: g.user_id,
    genre: g.genre || null,
    thumbnail_url: g.thumbnail_url || null,
    is_published: g.is_published ?? false,
    published_at: g.published_at || null,
    public_slug: g.public_slug || null,
    published_bundle_url: g.published_bundle_url || null,
    created_at: g.created_at,
    updated_at: g.updated_at,
  };
}

function mapGameWithBuild(g: any): GameWithBuild {
  return {
    ...mapGame(g),
    active_build: g.builds || null,
  };
}

// =============================================================================
// Service functions
// =============================================================================

/** Create a new game */
export async function createGame(
  name: string,
  description?: string,
  userId?: string,
  genre?: string,
): Promise<Game> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("games")
    .insert({
      name,
      description: description || null,
      user_id: userId || null,
      genre: genre || null,
    })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new Error("Game name already exists");
    }

    throw new Error(`Failed to create game: ${error.message}`);
  }
  log("info", "game created", { name, id: data.id, userId, genre });
  cacheDel(`game:id:${name}`);
  return mapGame(data);
}

/** List all games with optional active build info */
export async function listGames(): Promise<GameWithBuild[]> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("games")
    .select("*, builds!fk_games_active_build(id, status, atom_count, created_at)")
    .order("created_at", { ascending: true });

  if (error) throw new Error(`Failed to list games: ${error.message}`);
  return (data || []).map(mapGameWithBuild);
}

/** Get a single game by name */
export async function getGame(name: string): Promise<GameWithBuild | null> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("games")
    .select("*, builds!fk_games_active_build(id, status, atom_count, created_at)")
    .eq("name", name)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null; // not found
    throw new Error(`Failed to get game: ${error.message}`);
  }

  return mapGameWithBuild(data);
}

/** List games by user */
export async function listGamesByUser(userId: string): Promise<GameWithBuild[]> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("games")
    .select("*, builds!fk_games_active_build(id, status, atom_count, created_at)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to list user games: ${error.message}`);
  return (data || []).map(mapGameWithBuild);
}

/**
 * Resolve a game name to its UUID.
 * Used by transport layers (REST middleware, MCP tools) -- NOT by other services.
 */
export async function resolveGameId(name: string): Promise<string> {
  return cached(`game:id:${name}`, 60, async () => {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from("games")
      .select("id")
      .eq("name", name)
      .single();

    if (error || !data) {
      throw new Error(`Game not found: "${name}"`);
    }

    return data.id;
  });
}

/**
 * Validate that a game_id exists. Returns the game or throws.
 * Used by MCP server to validate the x-game-id header.
 */
export async function validateGameId(gameId: string): Promise<Game> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("games")
    .select("*")
    .eq("id", gameId)
    .single();

  if (error || !data) {
    throw new Error(`Game not found for id: "${gameId}"`);
  }

  return mapGame(data);
}

// =============================================================================
// Publishing
// =============================================================================

/** Publish a game with a public slug */
export async function publishGame(
  gameId: string,
  slug: string,
): Promise<Game> {
  const supabase = getSupabaseClient();

  // Get current bundle URL
  const { data: game, error: fetchErr } = await supabase
    .from("games")
    .select("active_build_id")
    .eq("id", gameId)
    .single();

  if (fetchErr || !game) throw new Error("Game not found");
  if (!game.active_build_id) throw new Error("Game has no active build to publish");

  const { data: build, error: buildError } = await supabase
    .from("builds")
    .select("id, status, bundle_url, score_system_ready, score_system_report")
    .eq("id", game.active_build_id)
    .single();

  if (buildError || !build) throw new Error("Active build not found");
  if (build.status !== "success") {
    throw new Error("Game can only be published from a successful active build");
  }

  let scoreReport = build.score_system_report as ValidationReport | null;
  if (!scoreReport) {
    scoreReport = await ensureBuildScoreSystemReport(build.id);
  }

  if (!scoreReport.passed) {
    const reasons = scoreReport.failures.map((failure) => failure.message).join("; ");
    throw new Error(
      reasons
        ? `Active build is missing required score-system support: ${reasons}`
        : "Active build is missing required score-system support",
    );
  }

  const { data, error } = await supabase
    .from("games")
    .update({
      is_published: true,
      published_at: new Date().toISOString(),
      public_slug: slug,
      published_bundle_url: build?.bundle_url || null,
    })
    .eq("id", gameId)
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new Error(`Slug "${slug}" is already taken`);
    }
    throw new Error(`Failed to publish game: ${error.message}`);
  }

  log("info", "game published", { gameId, slug });
  return mapGame(data);
}

/** Unpublish a game */
export async function unpublishGame(gameId: string): Promise<Game> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("games")
    .update({
      is_published: false,
      public_slug: null,
      published_bundle_url: null,
    })
    .eq("id", gameId)
    .select("*")
    .single();

  if (error) throw new Error(`Failed to unpublish game: ${error.message}`);
  log("info", "game unpublished", { gameId });
  return mapGame(data);
}

/** Get a published game by its public slug */
export async function getPublishedGame(slug: string): Promise<GameWithBuild | null> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("games")
    .select("*, builds!fk_games_active_build(id, status, atom_count, created_at)")
    .eq("public_slug", slug)
    .eq("is_published", true)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(`Failed to get published game: ${error.message}`);
  }

  return mapGameWithBuild(data);
}

/** List all published games */
export async function listPublishedGames(limit = 50): Promise<GameWithBuild[]> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("games")
    .select("*, builds!fk_games_active_build(id, status, atom_count, created_at)")
    .eq("is_published", true)
    .order("published_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Failed to list published games: ${error.message}`);
  return (data || []).map(mapGameWithBuild);
}
