import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { Hono } from "npm:hono@^4.9.7";
import { log } from "../_shared/logger.ts";
import * as games from "../_shared/services/games.ts";
import * as atoms from "../_shared/services/atoms.ts";
import * as builds from "../_shared/services/builds.ts";
import * as externals from "../_shared/services/externals.ts";
import * as chat from "../_shared/services/chat.ts";
import * as users from "../_shared/services/users.ts";
import * as boilerplates from "../_shared/services/boilerplates.ts";
import * as scores from "../_shared/services/scores.ts";
import * as tokens from "../_shared/services/tokens.ts";
import * as warrooms from "../_shared/services/warrooms.ts";
import { verifyAuthToken, requireAuth } from "../_shared/auth.ts";
import { checkRateLimit } from "../_shared/rate-limit.ts";
import { publishWithRetry } from "../_shared/qstash.ts";
import { streamPlatformAidChatResponse } from "../_shared/platform-aid.ts";
import * as schemas from "../_shared/schemas.ts";
import { openClawRouter } from "../_shared/openclaw-router.ts";
import { getSupabaseClient } from "../_shared/supabase-client.ts";
import { ZodError } from "npm:zod@^3.23.0";

// =============================================================================
// App
// =============================================================================

const app = new Hono();

function buildPixelRuntimeIndex(
  generatedAssets: Awaited<ReturnType<typeof warrooms.listGeneratedAssets>>,
) {
  const runtimeRows = generatedAssets.filter(
    (row) => row.asset_kind !== "pixel_manifest" && row.runtime_ready && !row.editor_only,
  );

  const animations = runtimeRows
    .filter((row) => row.asset_kind === "animation_pack")
    .map((row) => {
      const metadata = row.metadata as Record<string, unknown>;
      return {
        stable_asset_id: row.stable_asset_id,
        character_seed_url:
          typeof metadata.character_seed_url === "string" ? metadata.character_seed_url : row.public_url,
        animations: Array.isArray(metadata.animations)
          ? (metadata.animations as Array<Record<string, unknown>>).map((entry) => ({
              animation: entry.animation,
              processed_sheet_url: entry.processed_sheet_url,
              raw_sheet_url: entry.raw_sheet_url,
              frame_manifest_url: entry.frame_manifest_url,
              phaser_descriptor_url: entry.phaser_descriptor_url,
              cols: entry.cols,
              rows: entry.rows,
              width: entry.width,
              height: entry.height,
            }))
          : [],
      };
    })
    .sort((a, b) => String(a.stable_asset_id).localeCompare(String(b.stable_asset_id)));

  const backgrounds = Array.from(
    runtimeRows
      .filter((row) => row.asset_kind === "background_layer")
      .reduce((map, row) => {
        const existing = map.get(row.stable_asset_id) ?? [];
        existing.push({
          variant: row.variant,
          url: row.public_url,
          width: row.width,
          height: row.height,
        });
        map.set(row.stable_asset_id, existing);
        return map;
      }, new Map<string, Array<Record<string, unknown>>>()),
  )
    .map(([stableAssetId, layers]) => ({
      stable_asset_id: stableAssetId,
      layers: layers.sort((a, b) => String(a.variant).localeCompare(String(b.variant))),
    }))
    .sort((a, b) => String(a.stable_asset_id).localeCompare(String(b.stable_asset_id)));

  const ui = runtimeRows
    .filter((row) => row.asset_kind === "ui_asset")
    .map((row) => ({
      stable_asset_id: row.stable_asset_id,
      variant: row.variant,
      url: row.public_url,
      width: row.width,
      height: row.height,
    }))
    .sort((a, b) => String(a.stable_asset_id).localeCompare(String(b.stable_asset_id)));

  return { animations, backgrounds, ui };
}

function buildPixelManifestPayload(
  room: Awaited<ReturnType<typeof warrooms.getWarRoom>>,
  generatedAssets: Awaited<ReturnType<typeof warrooms.listGeneratedAssets>>,
) {
  const task7Output = room?.tasks.find((task) => task.task_number === 7)?.output ?? null;
  const task8Output = room?.tasks.find((task) => task.task_number === 8)?.output ?? null;
  const rows = generatedAssets.filter((row) => row.asset_kind !== "pixel_manifest");
  const uiAssets = rows
    .filter((row) => row.task_number === 7 && row.asset_kind === "ui_asset")
    .map((row) => ({
      stable_asset_id: row.stable_asset_id,
      variant: row.variant,
      url: row.public_url,
      width: row.width,
      height: row.height,
      metadata: row.metadata,
    }));
  const animationSets = rows
    .filter((row) => row.asset_kind === "animation_pack")
    .map((row) => ({
      stable_asset_id: row.stable_asset_id,
      ...(row.metadata as Record<string, unknown>),
    }));
  const backgroundSets = Array.from(
    rows
      .filter((row) => row.asset_kind === "background_layer")
      .reduce((map, row) => {
        const existing = map.get(row.stable_asset_id) ?? [];
        existing.push({
          variant: row.variant,
          url: row.public_url,
          width: row.width,
          height: row.height,
          metadata: row.metadata,
        });
        map.set(row.stable_asset_id, existing);
        return map;
      }, new Map<string, Array<Record<string, unknown>>>()),
  ).map(([stableAssetId, layers]) => ({
    stable_asset_id: stableAssetId,
    layers: layers.sort((a, b) => String(a.variant).localeCompare(String(b.variant))),
  }));
  const auxiliaryAssets = rows
    .filter((row) =>
      row.task_number === 8 &&
      ["texture_asset", "effect_asset", "ui_asset", "background_plate"].includes(row.asset_kind),
    )
    .map((row) => ({
      stable_asset_id: row.stable_asset_id,
      asset_kind: row.asset_kind,
      variant: row.variant,
      url: row.public_url,
      width: row.width,
      height: row.height,
      metadata: row.metadata,
    }));

  const runtimeIndex = buildPixelRuntimeIndex(generatedAssets);

  return {
    version: 2,
    asset_contract_version: 2,
    war_room_id: room?.id ?? null,
    game_id: room?.game_id ?? null,
    game_format: room?.game_format ?? null,
    runtime: room?.game_format === "2d" ? "phaser" : "three",
    generated_at: new Date().toISOString(),
    task_7: task7Output
      ? {
          design_system: task7Output.design_system ?? null,
          art_direction: task7Output.art_direction ?? null,
          generation_model: task7Output.generation_model ?? null,
          ui_assets: uiAssets,
        }
      : null,
    task_8: {
      art_direction: task8Output?.art_direction ?? null,
      generation_model: task8Output?.generation_model ?? null,
      sprite_manifest: task8Output?.sprite_manifest ?? [],
      animation_sets: animationSets,
      background_sets: backgroundSets,
      auxiliary_assets: auxiliaryAssets,
      runtime_index: runtimeIndex,
      notes: task8Output?.notes ?? [],
    },
  };
}

async function publishRuntimeManifest(args: {
  gameName: string;
  room: NonNullable<Awaited<ReturnType<typeof warrooms.getWarRoom>>>;
  pixelManifestUrl: string | null;
  pixelAssetsRevision: number;
  pixelIndex: ReturnType<typeof buildPixelRuntimeIndex>;
}) {
  const installed = await externals.getInstalledExternals(args.room.game_id);
  const manifest = {
    runtime: args.room.game_format === "2d" ? "phaser" : "three",
    externals: installed.map((ext) => ({
      name: ext.name,
      cdn_url: ext.cdn_url,
      global_name: ext.global_name,
      load_type: ext.load_type || "script",
      ...(ext.module_imports ? { module_imports: ext.module_imports } : {}),
    })),
    bundle_url: "latest.js",
    built_at: new Date().toISOString(),
    asset_contract_version: 2,
    pixel_manifest_url: args.pixelManifestUrl,
    pixel_assets_revision: args.pixelAssetsRevision,
    runtime_asset_mode:
      args.room.game_format === "2d" && !args.pixelManifestUrl ? "progressive" : "final",
    pixel_index: args.pixelIndex,
  };

  const path = `${args.gameName}/manifest.json`;
  const bytes = new TextEncoder().encode(`${JSON.stringify(manifest, null, 2)}\n`);
  const supabase = getSupabaseClient();
  const { error } = await supabase.storage
    .from("bundles")
    .upload(path, new Blob([bytes], { type: "application/json" }), {
      cacheControl: "0",
      upsert: true,
      contentType: "application/json",
    });
  if (error) {
    throw new Error(`Failed to publish runtime manifest: ${error.message}`);
  }
}

async function publishPixelManifest(
  gameName: string,
  room: NonNullable<Awaited<ReturnType<typeof warrooms.getWarRoom>>>,
) {
  const generatedAssets = await warrooms.listGeneratedAssets(room.id);
  const payload = buildPixelManifestPayload(room, generatedAssets);
  const runtimeIndex = buildPixelRuntimeIndex(generatedAssets);
  const path = `${gameName}/pixel/${room.id}/pixel-manifest.json`;
  const bytes = new TextEncoder().encode(`${JSON.stringify(payload, null, 2)}\n`);
  const supabase = getSupabaseClient();
  const { error } = await supabase.storage
    .from("bundles")
    .upload(path, new Blob([bytes], { type: "application/json" }), {
      cacheControl: "3600",
      upsert: true,
      contentType: "application/json",
    });
  if (error) {
    throw new Error(`Failed to publish pixel manifest: ${error.message}`);
  }

  const { data } = supabase.storage.from("bundles").getPublicUrl(path);
  if (!data?.publicUrl) {
    throw new Error("Failed to resolve public URL for pixel manifest");
  }

  await warrooms.upsertGeneratedAsset({
    war_room_id: room.id,
    task_number: 8,
    stable_asset_id: "pixel_manifest",
    asset_kind: "pixel_manifest",
    variant: "",
    storage_path: path,
    public_url: data.publicUrl,
    source_service: "atomic-pixel-manifest",
    metadata: {
      version: 2,
      animation_set_count: payload.task_8.animation_sets.length,
      background_set_count: payload.task_8.background_sets.length,
      sprite_manifest_count: payload.task_8.sprite_manifest.length,
      task7_ui_asset_count: payload.task_7?.ui_assets.length ?? 0,
    },
  });

  const { data: gameData, error: gameError } = await supabase
    .from("games")
    .select("pixel_assets_revision")
    .eq("id", room.game_id)
    .single();
  if (gameError || !gameData) {
    throw new Error(`Failed to load game for pixel manifest update: ${gameError?.message ?? "missing game"}`);
  }

  const nextRevision = Number(gameData.pixel_assets_revision ?? 0) + 1;
  const { error: updateGameError } = await supabase
    .from("games")
    .update({
      pixel_assets_revision: nextRevision,
      pixel_manifest_url: data.publicUrl,
    })
    .eq("id", room.game_id);
  if (updateGameError) {
    throw new Error(`Failed to update game pixel runtime state: ${updateGameError.message}`);
  }

  await publishRuntimeManifest({
    gameName,
    room,
    pixelManifestUrl: data.publicUrl,
    pixelAssetsRevision: nextRevision,
    pixelIndex: runtimeIndex,
  });

  return payload;
}

// =============================================================================
// Middleware: request logging
// =============================================================================

app.use("*", async (c, next) => {
  const start = performance.now();
  const method = c.req.method;
  const path = new URL(c.req.url).pathname;
  const requestId = crypto.randomUUID().slice(0, 8);

  log("info", "api:request:start", { requestId, method, path });

  await next();

  const durationMs = Math.round(performance.now() - start);
  const status = c.res.status;
  log("info", "api:request:end", { requestId, method, path, status, durationMs });
});

// =============================================================================
// Middleware: CORS
// =============================================================================

const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") || Deno.env.get("ALLOWED_ORIGIN") || "*")
  .split(",")
  .map((o) => o.trim());

function resolveOrigin(requestOrigin: string | undefined): string {
  if (ALLOWED_ORIGINS.includes("*")) return "*";
  if (requestOrigin && ALLOWED_ORIGINS.includes(requestOrigin)) return requestOrigin;
  return ALLOWED_ORIGINS[0];
}

app.use("*", async (c, next) => {
  const origin = resolveOrigin(c.req.header("Origin"));
  c.header("Access-Control-Allow-Origin", origin);
  c.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  c.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (origin !== "*") c.header("Vary", "Origin");
  if (c.req.method === "OPTIONS") {
    return c.body(null, 204);
  }
  await next();
});

// =============================================================================
// Middleware: Zod error handling
// =============================================================================

app.onError((err, c) => {
  if (err instanceof ZodError) {
    const issues = err.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
    return c.json({ error: "Validation error", details: issues }, 400);
  }
  throw err;
});

app.route("/", openClawRouter);

// =============================================================================
// Health check
// =============================================================================

app.get("/", (c) =>
  c.json({ status: "ok", server: "atomic-game-maker-api", version: "3.0.0" }),
);

// =============================================================================
// User Profiles
// =============================================================================

/** POST /users/profile -- upsert user profile (called on login) */
app.post("/users/profile", async (c) => {
  try {
    const body = schemas.upsertProfileSchema.parse(await c.req.json());
    const profile = await users.upsertUserProfile(body);
    return c.json(profile);
  } catch (err) {
    return c.json({ error: (err as Error).message }, 400);
  }
});

/** GET /users/profile/:id -- get user profile */
app.get("/users/profile/:id", async (c) => {
  try {
    const profile = await users.getUserProfile(c.req.param("id"));
    if (!profile) return c.json({ error: "User not found" }, 404);
    return c.json(profile);
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
  }
});

/** GET /users/me -- get the authenticated user's profile */
app.get("/users/me", requireAuth(), async (c) => {
  try {
    const authUser = c.get("authUser") as { userId: string };
    let profile = await users.getUserProfile(authUser.userId);

    if (!profile) {
      profile = await users.upsertUserProfile({ id: authUser.userId });
    }

    return c.json(profile);
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
  }
});

/** PUT /users/me -- update editable profile fields for the authenticated user */
app.put("/users/me", requireAuth(), async (c) => {
  try {
    const authUser = c.get("authUser") as { userId: string };
    const body = schemas.updateMyProfileSchema.parse(await c.req.json());
    const profile = await users.updateUserProfile(authUser.userId, body);
    return c.json(profile);
  } catch (err) {
    return c.json({ error: (err as Error).message }, 400);
  }
});

// =============================================================================
// Platform Aid
// =============================================================================

/** POST /assistant/chat -- authenticated platform-help SSE chat */
app.post("/assistant/chat", requireAuth(), async (c) => {
  try {
    const authUser = c.get("authUser") as { userId: string };
    const rateLimited = await checkRateLimit(c, "assistantChat", authUser.userId);
    if (rateLimited) return rateLimited;
    const body = schemas.platformAidChatSchema.parse(await c.req.json());
    const sseResponse = await streamPlatformAidChatResponse(authUser.userId, body);

    // Return the stream through Hono's context so middleware headers (CORS) are applied
    c.header("Content-Type", "text/event-stream; charset=utf-8");
    c.header("Cache-Control", "no-cache, no-transform");
    c.header("Connection", "keep-alive");
    return c.body(sseResponse.body);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err ?? "Platform aid request failed");
    return c.json({ error: message }, 400);
  }
});

// =============================================================================
// Boilerplates
// =============================================================================

/** GET /boilerplates -- list all genre boilerplates */
app.get("/boilerplates", async (c) => {
  try {
    const list = await boilerplates.listBoilerplates();
    return c.json(list);
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
  }
});

/** GET /boilerplates/:slug -- get a single boilerplate */
app.get("/boilerplates/:slug", async (c) => {
  try {
    const queryFormat = c.req.query("game_format");
    const gameFormat =
      queryFormat === "2d" || queryFormat === "3d" ? queryFormat : null;
    const bp = await boilerplates.getBoilerplate(c.req.param("slug"), gameFormat);
    if (!bp) return c.json({ error: "Boilerplate not found" }, 404);
    return c.json(bp);
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
  }
});

// =============================================================================
// Games
// =============================================================================

/** POST /games -- create a game (optionally seed from a genre boilerplate) */
app.post("/games", requireAuth(), async (c) => {
  try {
    const authUser = c.get("authUser") as { userId: string };
    const rateLimited = await checkRateLimit(c, "gameCreate", authUser.userId);
    if (rateLimited) return rateLimited;
    const body = schemas.createGameSchema.parse(await c.req.json());

    const existingProfile = await users.getUserProfile(authUser.userId);
    if (!existingProfile) {
      await users.upsertUserProfile({ id: authUser.userId });
    }

    const game = await games.createGame(
      body.name,
      body.description,
      authUser.userId,
      body.genre,
      body.game_format,
    );

    // Seed atoms and externals from boilerplate if genre is specified (non-blocking)
    if (body.genre) {
      boilerplates
        .seedGameFromBoilerplate(game.id, body.genre, body.game_format ?? null)
        .then(() => atoms.triggerRebuild(game.id))
        .catch((seedErr: Error) =>
          log("error", "Failed to seed boilerplate", {
            gameId: game.id,
            genre: body.genre,
            error: seedErr.message,
          })
        );
    }

    return c.json(game, 201);
  } catch (err) {
    return c.json({ error: (err as Error).message }, 400);
  }
});

/** GET /games -- list all games */
app.get("/games", async (c) => {
  try {
    const list = await games.listGames();
    return c.json(list);
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
  }
});

/** GET /games/mine -- list games for the authenticated user */
app.get("/games/mine", requireAuth(), async (c) => {
  try {
    const authUser = c.get("authUser") as { userId: string };
    const list = await games.listGamesByUser(authUser.userId);
    return c.json(list);
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
  }
});

/** GET /games/:name -- get single game */
app.get("/games/:name", async (c) => {
  try {
    const game = await games.getGame(c.req.param("name"));
    if (!game) return c.json({ error: "Game not found" }, 404);
    return c.json(game);
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
  }
});

// =============================================================================
// Public Games (no auth needed)
// =============================================================================

/** GET /public/games -- list published games */
app.get("/public/games", async (c) => {
  try {
    const limit = parseInt(c.req.query("limit") || "50", 10);
    const list = await games.listPublishedGames(limit);
    return c.json(list);
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
  }
});

/** GET /public/games/:slug -- get a published game by slug */
app.get("/public/games/:slug", async (c) => {
  try {
    const game = await games.getPublishedGame(c.req.param("slug"));
    if (!game) return c.json({ error: "Game not found" }, 404);
    return c.json(game);
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
  }
});

// =============================================================================
// External Registry (global, not game-scoped)
// =============================================================================

/** GET /registry/externals -- list all available external libraries */
app.get("/registry/externals", async (c) => {
  try {
    const list = await externals.listRegistry();
    return c.json(list);
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
  }
});

/** POST /registry/externals/custom -- register a custom external library */
app.post("/registry/externals/custom", requireAuth(), async (c) => {
  try {
    const authUser = c.get("authUser") as { userId: string };
    const rateLimited = await checkRateLimit(c, "customExternal", authUser.userId);
    if (rateLimited) return rateLimited;
    const body = schemas.registerCustomExternalSchema.parse(await c.req.json());
    const entry = await externals.registerCustomExternal(body);
    return c.json(entry, 201);
  } catch (err) {
    return c.json({ error: (err as Error).message }, 400);
  }
});

// =============================================================================
// Middleware: resolve game_id from :name for all /games/:name/* routes
// =============================================================================

app.use("/games/:name/*", async (c, next) => {
  try {
    const gameId = await games.resolveGameId(c.req.param("name"));
    c.set("gameId", gameId);
    await next();
  } catch (_err) {
    return c.json({ error: `Game not found: "${c.req.param("name")}"` }, 404);
  }
});

// =============================================================================
// Atoms (scoped to game)
// =============================================================================

/** GET /games/:name/structure -- atom map */
app.get("/games/:name/structure", async (c) => {
  try {
    const gameId = c.get("gameId") as string;
    const typeFilter = c.req.query("type") || undefined;
    const structure = await atoms.getCodeStructure(gameId, typeFilter);
    return c.json(structure);
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
  }
});

/** POST /games/:name/atoms/read -- read atoms by names */
app.post("/games/:name/atoms/read", async (c) => {
  try {
    const gameId = c.get("gameId") as string;
    const body = schemas.readAtomsSchema.parse(await c.req.json());
    const result = await atoms.readAtoms(gameId, body.names);
    if (result.length === 0) {
      return c.json({ error: `No atoms found: ${body.names.join(", ")}` }, 404);
    }
    return c.json(result);
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
  }
});

/** POST /games/:name/atoms/search -- semantic search */
app.post("/games/:name/atoms/search", async (c) => {
  try {
    const gameId = c.get("gameId") as string;
    const body = schemas.searchAtomsSchema.parse(await c.req.json());
    const result = await atoms.semanticSearch(gameId, body.query, body.limit);
    return c.json(result);
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
  }
});

/** PUT /games/:name/atoms/:atom_name -- upsert atom */
app.put("/games/:name/atoms/:atom_name", requireAuth(), async (c) => {
  try {
    const authUser = c.get("authUser") as { userId: string };
    const rateLimited = await checkRateLimit(c, "atomWrite", authUser.userId);
    if (rateLimited) return rateLimited;
    const gameId = c.get("gameId") as string;
    const atomName = c.req.param("atom_name");
    const body = schemas.upsertAtomSchema.parse(await c.req.json());
    const result = await atoms.upsertAtom(gameId, {
      name: atomName,
      code: body.code,
      type: body.type,
      inputs: body.inputs,
      outputs: body.outputs,
      dependencies: body.dependencies,
      description: body.description,
    });
    return c.json(result);
  } catch (err) {
    return c.json({ error: (err as Error).message }, 400);
  }
});

/** DELETE /games/:name/atoms/:atom_name -- delete atom */
app.delete("/games/:name/atoms/:atom_name", requireAuth(), async (c) => {
  try {
    const authUser = c.get("authUser") as { userId: string };
    const rateLimited = await checkRateLimit(c, "deleteOp", authUser.userId);
    if (rateLimited) return rateLimited;
    const gameId = c.get("gameId") as string;
    await atoms.deleteAtom(gameId, c.req.param("atom_name"));
    return c.json({ deleted: c.req.param("atom_name") });
  } catch (err) {
    return c.json({ error: (err as Error).message }, 400);
  }
});

// =============================================================================
// Externals (scoped to game)
// =============================================================================

/** GET /games/:name/externals -- list installed externals */
app.get("/games/:name/externals", async (c) => {
  try {
    const gameId = c.get("gameId") as string;
    const list = await externals.getInstalledExternals(gameId);
    return c.json(list);
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
  }
});

/** POST /games/:name/externals -- install an external */
app.post("/games/:name/externals", requireAuth(), async (c) => {
  try {
    const gameId = c.get("gameId") as string;
    const body = schemas.installExternalSchema.parse(await c.req.json());
    const result = await externals.installExternal(gameId, body.name);
    return c.json(result, 201);
  } catch (err) {
    return c.json({ error: (err as Error).message }, 400);
  }
});

/** DELETE /games/:name/externals/:ext_name -- uninstall an external */
app.delete("/games/:name/externals/:ext_name", requireAuth(), async (c) => {
  try {
    const authUser = c.get("authUser") as { userId: string };
    const rateLimited = await checkRateLimit(c, "deleteOp", authUser.userId);
    if (rateLimited) return rateLimited;
    const gameId = c.get("gameId") as string;
    const extName = c.req.param("ext_name");
    await externals.uninstallExternal(gameId, extName);
    return c.json({ uninstalled: extName });
  } catch (err) {
    return c.json({ error: (err as Error).message }, 400);
  }
});

// =============================================================================
// Builds
// =============================================================================

/** GET /games/:name/builds -- list builds */
app.get("/games/:name/builds", async (c) => {
  try {
    const gameId = c.get("gameId") as string;
    const limit = parseInt(c.req.query("limit") || "20", 10);
    const list = await builds.listBuilds(gameId, limit);
    return c.json(list);
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
  }
});

/** POST /games/:name/builds -- trigger rebuild */
app.post("/games/:name/builds", requireAuth(), async (c) => {
  try {
    const gameId = c.get("gameId") as string;
    const rateLimited = await checkRateLimit(c, "build", gameId);
    if (rateLimited) return rateLimited;

    atoms.triggerRebuild(gameId);
    return c.json({ status: "rebuild triggered", game_id: gameId });
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
  }
});

/** POST /games/:name/builds/:id/rollback -- rollback to build */
app.post("/games/:name/builds/:id/rollback", requireAuth(), async (c) => {
  try {
    const gameId = c.get("gameId") as string;
    const buildId = c.req.param("id");
    const result = await builds.rollbackBuild(gameId, buildId);
    return c.json(result);
  } catch (err) {
    return c.json({ error: (err as Error).message }, 400);
  }
});

// =============================================================================
// Publishing (scoped to game)
// =============================================================================

/** POST /games/:name/publish -- publish a game with a slug */
app.post("/games/:name/publish", requireAuth(), async (c) => {
  try {
    const authUser = c.get("authUser") as { userId: string };
    const rateLimited = await checkRateLimit(c, "publish", authUser.userId);
    if (rateLimited) return rateLimited;
    const gameId = c.get("gameId") as string;
    const body = schemas.publishGameSchema.parse(await c.req.json());
    const game = await games.publishGame(gameId, body.slug.trim());
    return c.json(game);
  } catch (err) {
    return c.json({ error: (err as Error).message }, 400);
  }
});

/** POST /games/:name/unpublish -- unpublish a game */
app.post("/games/:name/unpublish", requireAuth(), async (c) => {
  try {
    const authUser = c.get("authUser") as { userId: string };
    const rateLimited = await checkRateLimit(c, "publish", authUser.userId);
    if (rateLimited) return rateLimited;
    const gameId = c.get("gameId") as string;
    const game = await games.unpublishGame(gameId);
    return c.json(game);
  } catch (err) {
    return c.json({ error: (err as Error).message }, 400);
  }
});

// =============================================================================
// Scores & Leaderboard (scoped to game)
// =============================================================================

/** POST /games/:name/scores -- submit a score */
app.post("/games/:name/scores", async (c) => {
  try {
    const authUser = await verifyAuthToken(c.req.raw);
    if (!authUser) return c.json({ error: "Unauthorized" }, 401);

    const rateLimited = await checkRateLimit(c, "score", authUser.userId);
    if (rateLimited) return rateLimited;

    const gameId = c.get("gameId") as string;
    const body = schemas.submitScoreSchema.parse(await c.req.json());
    const result = await scores.submitScore(
      gameId,
      body.score,
      authUser.userId,
      body.metadata,
    );
    return c.json(result, 201);
  } catch (err) {
    return c.json({ error: (err as Error).message }, 400);
  }
});

/** GET /games/:name/leaderboard -- get top scores */
app.get("/games/:name/leaderboard", async (c) => {
  try {
    const gameId = c.get("gameId") as string;
    const limit = parseInt(c.req.query("limit") || "10", 10);
    const period = (c.req.query("period") || "lifetime") as scores.LeaderboardPeriod;
    if (!["day", "week", "lifetime"].includes(period)) {
      return c.json({ error: "period must be one of: day, week, lifetime" }, 400);
    }
    const leaderboard = await scores.getLeaderboard(gameId, period, limit);
    return c.json(leaderboard);
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
  }
});

// =============================================================================
// Token Launches (scoped to game)
// =============================================================================

/** PUT /games/:name/token -- create or update token launch */
app.put("/games/:name/token", requireAuth(), async (c) => {
  try {
    const gameId = c.get("gameId") as string;
    const body = schemas.upsertTokenSchema.parse(await c.req.json());
    const launch = await tokens.upsertTokenLaunch(gameId, body.creator_id, body.token_name, body.token_symbol, {
      chainId: body.chain_id,
      totalSupply: body.total_supply,
      leaderboardAllocationPct: body.leaderboard_allocation_pct,
    });
    return c.json(launch);
  } catch (err) {
    return c.json({ error: (err as Error).message }, 400);
  }
});

/** GET /games/:name/token -- get token launch for a game */
app.get("/games/:name/token", async (c) => {
  try {
    const gameId = c.get("gameId") as string;
    const launch = await tokens.getTokenLaunch(gameId);
    return c.json(launch);
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
  }
});

/** GET /games/:name/token/distributions -- get distributions for a game's token */
app.get("/games/:name/token/distributions", async (c) => {
  try {
    const gameId = c.get("gameId") as string;
    const launch = await tokens.getTokenLaunch(gameId);
    if (!launch) return c.json({ error: "No token launch found" }, 404);
    const distributions = await tokens.getDistributions(launch.id);
    return c.json(distributions);
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
  }
});

// =============================================================================
// Chat Sessions (scoped to game)
// =============================================================================

/** GET /games/:name/chat/sessions -- list sessions */
app.get("/games/:name/chat/sessions", async (c) => {
  try {
    const gameId = c.get("gameId") as string;
    const limit = parseInt(c.req.query("limit") || "20", 10);
    const sessions = await chat.listSessions(gameId, limit);
    return c.json(sessions);
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
  }
});

/** POST /games/:name/chat/sessions -- create session */
app.post("/games/:name/chat/sessions", requireAuth(), async (c) => {
  try {
    const authUser = c.get("authUser") as { userId: string };
    const rateLimited = await checkRateLimit(c, "sessionCreate", authUser.userId);
    if (rateLimited) return rateLimited;
    const gameId = c.get("gameId") as string;
    const body = schemas.createSessionSchema.parse(await c.req.json());
    const session = await chat.createSession(gameId, body.model, body.title);
    return c.json(session, 201);
  } catch (err) {
    return c.json({ error: (err as Error).message }, 400);
  }
});

/** DELETE /games/:name/chat/sessions/:sessionId -- delete session */
app.delete("/games/:name/chat/sessions/:sessionId", requireAuth(), async (c) => {
  try {
    const authUser = c.get("authUser") as { userId: string };
    const rateLimited = await checkRateLimit(c, "deleteOp", authUser.userId);
    if (rateLimited) return rateLimited;
    await chat.deleteSession(c.req.param("sessionId"));
    return c.json({ deleted: c.req.param("sessionId") });
  } catch (err) {
    return c.json({ error: (err as Error).message }, 400);
  }
});

/** GET /games/:name/chat/sessions/:sessionId/messages -- get messages */
app.get("/games/:name/chat/sessions/:sessionId/messages", async (c) => {
  try {
    const messages = await chat.getMessages(c.req.param("sessionId"));
    return c.json(messages);
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
  }
});

/** POST /games/:name/chat/sessions/:sessionId/messages -- save messages */
app.post("/games/:name/chat/sessions/:sessionId/messages", requireAuth(), async (c) => {
  try {
    const rateLimited = await checkRateLimit(c, "chatSave", c.req.param("sessionId"));
    if (rateLimited) return rateLimited;

    const body = schemas.saveMessagesSchema.parse(await c.req.json());
    await chat.saveMessages(c.req.param("sessionId"), body.messages);

    // Auto-set title from first user message if not set
    const session = await chat.getSession(c.req.param("sessionId"));
    if (!session.title) {
      const userMsg = body.messages.find((m: { role: string }) => m.role === "user");
      if (userMsg?.parts?.[0]?.text) {
        const title = userMsg.parts[0].text.slice(0, 100);
        await chat.updateSessionTitle(c.req.param("sessionId"), title);
      }
    }

    return c.json({ saved: body.messages.length });
  } catch (err) {
    return c.json({ error: (err as Error).message }, 400);
  }
});

// =============================================================================
// War Rooms (scoped to game)
// =============================================================================

/** Trigger the Mastra pipeline orchestrator with retries via QStash. */
async function triggerOrchestrator(warRoomId: string): Promise<void> {
  const mastraUrl = Deno.env.get("MASTRA_SERVER_URL");
  if (!mastraUrl) {
    log("warn", "triggerOrchestrator: MASTRA_SERVER_URL not set, skipping");
    await warrooms.recordEvent(warRoomId, "trigger_failed", "jarvis", null, {
      error: "MASTRA_SERVER_URL not configured",
    });
    await warrooms.updateWarRoomStatus(warRoomId, "failed");
    return;
  }

  try {
    await publishWithRetry(`${mastraUrl}/pipeline/run`, { war_room_id: warRoomId }, { retries: 3 });
    log("info", "triggerOrchestrator: dispatched", { warRoomId, mastraUrl });
  } catch (err) {
    log("error", "triggerOrchestrator: failed to dispatch", {
      warRoomId,
      error: (err as Error).message,
    });
    await warrooms.recordEvent(warRoomId, "trigger_failed", "jarvis", null, {
      error: (err as Error).message,
    });
    await warrooms.updateWarRoomStatus(warRoomId, "failed");
  }
}

/** POST /games/:name/warrooms -- create a war room (+ 12 pipeline tasks) */
app.post("/games/:name/warrooms", requireAuth(), async (c) => {
  try {
    const authUser = c.get("authUser") as { userId: string };
    const rateLimited = await checkRateLimit(c, "warroom", authUser.userId);
    if (rateLimited) return rateLimited;

    const gameId = c.get("gameId") as string;
    const body = schemas.createWarRoomSchema.parse(await c.req.json());

    // War rooms must be attributed to the authenticated user. The frontend may
    // omit user_id, and profile sync is best-effort, so ensure a row exists.
    const existingProfile = await users.getUserProfile(authUser.userId);
    if (!existingProfile) {
      await users.upsertUserProfile({ id: authUser.userId });
    }

    const game = await games.validateGameId(gameId);

    // Resolve genre and format: prefer explicit payload, fall back to the persisted game
    const genre = body.genre || game.genre || null;
    const gameFormat = body.game_format || game.game_format || null;

    const room = await warrooms.createWarRoom(
      gameId,
      authUser.userId,
      body.prompt,
      genre,
      gameFormat,
      body.visual_references ?? [],
    );

    // Trigger orchestrator pipeline in background (don't block the response)
    triggerOrchestrator(room.id).catch((err) => {
      log("error", "triggerOrchestrator: background error", {
        warRoomId: room.id,
        error: (err as Error).message,
      });
    });

    return c.json(room, 201);
  } catch (err) {
    return c.json({ error: (err as Error).message }, 400);
  }
});

/** GET /games/:name/warrooms -- list war rooms */
app.get("/games/:name/warrooms", async (c) => {
  try {
    const gameId = c.get("gameId") as string;
    const limit = parseInt(c.req.query("limit") || "20", 10);
    const list = await warrooms.listWarRooms(gameId, limit);
    return c.json(list);
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
  }
});

/** GET /games/:name/warrooms/:id -- get war room with tasks */
app.get("/games/:name/warrooms/:id", async (c) => {
  try {
    const room = await warrooms.getWarRoomFeed(c.req.param("id"));
    if (!room) return c.json({ error: "War room not found" }, 404);
    return c.json(room);
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
  }
});

/** GET /games/:name/warrooms/:id/assets -- list Pixel-generated assets */
app.get("/games/:name/warrooms/:id/assets", async (c) => {
  try {
    const gameId = c.get("gameId") as string;
    const room = await warrooms.getWarRoom(c.req.param("id"));
    if (!room || room.game_id !== gameId) {
      return c.json({ error: "War room not found" }, 404);
    }

    const assets = await warrooms.listGeneratedAssets(room.id);
    return c.json({ items: assets });
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
  }
});

/** PATCH /games/:name/warrooms/:id/assets/:assetId/layout -- persist edited animation layout */
app.patch("/games/:name/warrooms/:id/assets/:assetId/layout", requireAuth(), async (c) => {
  try {
    const gameId = c.get("gameId") as string;
    const room = await warrooms.getWarRoom(c.req.param("id"));
    if (!room || room.game_id !== gameId) {
      return c.json({ error: "War room not found" }, 404);
    }

    const body = schemas.patchGeneratedAssetLayoutSchema.parse(await c.req.json());
    const asset = await warrooms.updateGeneratedAssetLayout({
      warRoomId: room.id,
      assetId: c.req.param("assetId"),
      animation: body.animation,
      layout: {
        cols: body.cols,
        rows: body.rows,
        vertical_dividers: body.vertical_dividers,
        horizontal_dividers: body.horizontal_dividers,
        frames: body.frames,
      },
    });
    await publishPixelManifest(c.req.param("name"), room);

    await warrooms.recordEvent(room.id, "pixel_asset_layout_updated", "pixel", 8, {
      asset_id: asset.id,
      stable_asset_id: asset.stable_asset_id,
      animation: body.animation,
      frame_count: body.frames.length,
    });

    return c.json(asset);
  } catch (err) {
    return c.json({ error: (err as Error).message }, 400);
  }
});

/** POST /games/:name/warrooms/:id/cancel -- cancel a running war room */
app.post("/games/:name/warrooms/:id/cancel", requireAuth(), async (c) => {
  try {
    const warRoomId = c.req.param("id");
    const room = await warrooms.getWarRoom(warRoomId);
    if (!room) return c.json({ error: "War room not found" }, 404);
    if (room.status !== "running" && room.status !== "planning") {
      return c.json({ error: `Cannot cancel war room with status '${room.status}'` }, 400);
    }
    const updated = await warrooms.updateWarRoomStatus(warRoomId, "cancelled");
    await warrooms.recordEvent(warRoomId, "war_room_cancelled", null, null, {
      previous_status: room.status,
    });
    return c.json(updated);
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
  }
});

/** POST /warrooms/cleanup -- auto-fail stuck war rooms */
app.post("/warrooms/cleanup", async (c) => {
  try {
    const cleaned = await warrooms.cleanupStuckWarRooms();
    return c.json({ cleaned });
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
  }
});

/** GET /games/:name/warrooms/:id/events -- SSE event stream */
app.get("/games/:name/warrooms/:id/events", async (c) => {
  const warRoomId = c.req.param("id");
  const lastEventId = c.req.header("Last-Event-ID") || c.req.query("since");

  // Verify war room exists
  const room = await warrooms.getWarRoom(warRoomId);
  if (!room) return c.json({ error: "War room not found" }, 404);

  // Max connection duration to stay well under Supabase Edge Function wall clock limit (~6min)
  const MAX_SSE_DURATION_MS = 4 * 60 * 1000;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const startTime = Date.now();

      // 1. Send existing events (hydration on connect / reconnect)
      try {
        const existing = await warrooms.getEvents(warRoomId, lastEventId);
        for (const evt of existing) {
          const data = JSON.stringify(evt);
          controller.enqueue(
            encoder.encode(`id: ${evt.id}\nevent: ${evt.event_type}\ndata: ${data}\n\n`),
          );
        }
      } catch {
        // Continue even if hydration fails
      }

      // 2. Poll for new events every 2s (Supabase Realtime not available in Edge Functions)
      let lastSeen = lastEventId || "";
      let keepalive: ReturnType<typeof setInterval>;
      const interval = setInterval(async () => {
        try {
          // Gracefully close before hitting Supabase wall clock limit;
          // EventSource auto-reconnects with Last-Event-ID
          if (Date.now() - startTime >= MAX_SSE_DURATION_MS) {
            clearInterval(interval);
            clearInterval(keepalive);
            controller.close();
            return;
          }

          const newEvents = await warrooms.getEvents(warRoomId, lastSeen || undefined);
          for (const evt of newEvents) {
            const data = JSON.stringify(evt);
            controller.enqueue(
              encoder.encode(`id: ${evt.id}\nevent: ${evt.event_type}\ndata: ${data}\n\n`),
            );
            lastSeen = evt.id;
          }

          // Also send heartbeats as SSE
          const heartbeats = await warrooms.getHeartbeats(warRoomId);
          if (heartbeats.length > 0) {
            controller.enqueue(
              encoder.encode(
                `event: heartbeats\ndata: ${JSON.stringify(heartbeats)}\n\n`,
              ),
            );
          }

          // Check if war room is complete — close stream
          const current = await warrooms.getWarRoom(warRoomId);
          if (
            current &&
            (current.status === "completed" ||
              current.status === "failed" ||
              current.status === "cancelled")
          ) {
            controller.enqueue(
              encoder.encode(
                `event: done\ndata: ${JSON.stringify({ status: current.status })}\n\n`,
              ),
            );
            clearInterval(interval);
            clearInterval(keepalive);
            controller.close();
          }
        } catch {
          // Keep stream alive on transient errors
          controller.enqueue(encoder.encode(": keepalive\n\n"));
        }
      }, 2000);

      // Keepalive comment every 15s to prevent proxy timeouts
      keepalive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": keepalive\n\n"));
        } catch {
          clearInterval(keepalive);
        }
      }, 15000);
    },
  });

  const origin = resolveOrigin(c.req.header("Origin"));
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": origin,
      ...(origin !== "*" ? { Vary: "Origin" } : {}),
    },
  });
});

/** POST /games/:name/warrooms/:id/heartbeat -- agent heartbeat */
app.post("/games/:name/warrooms/:id/heartbeat", async (c) => {
  try {
    const warRoomId = c.req.param("id");
    const body = schemas.heartbeatSchema.parse(await c.req.json());
    const hb = await warrooms.upsertHeartbeat(
      warRoomId,
      body.agent,
      body.status || "working",
      body.metadata,
    );
    return c.json(hb);
  } catch (err) {
    return c.json({ error: (err as Error).message }, 400);
  }
});

/** POST /games/:name/warrooms/:id/tasks/:num/retry -- retry a failed task */
app.post("/games/:name/warrooms/:id/tasks/:num/retry", requireAuth(), async (c) => {
  try {
    const warRoomId = c.req.param("id");
    const taskNumber = parseInt(c.req.param("num"), 10);
    if (isNaN(taskNumber) || taskNumber < 1 || taskNumber > 12) {
      return c.json({ error: "task number must be 1-12" }, 400);
    }

    const room = await warrooms.getWarRoom(warRoomId);
    if (!room) return c.json({ error: "War room not found" }, 404);

    const task = room.tasks.find((t) => t.task_number === taskNumber);
    if (!task) return c.json({ error: "Task not found" }, 404);
    if (task.status !== "failed") {
      return c.json({ error: `Cannot retry task with status '${task.status}'` }, 400);
    }

    // Reset task to pending
    const updated = await warrooms.updateTaskStatus(warRoomId, taskNumber, "pending");
    await warrooms.recordEvent(warRoomId, "task_retry_manual", task.assigned_agent, taskNumber, {
      previous_error: task.output?.error ?? null,
    });

    // Resume war room if it was terminal
    if (room.status === "failed" || room.status === "completed") {
      await warrooms.updateWarRoomStatus(warRoomId, "running");
    }

    // Re-trigger orchestrator
    triggerOrchestrator(warRoomId).catch((err) => {
      log("error", "retry triggerOrchestrator: background error", {
        warRoomId,
        taskNumber,
        error: (err as Error).message,
      });
    });

    return c.json(updated);
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
  }
});

/** POST /games/:name/warrooms/:id/tasks/:num/status -- update task status */
app.post("/games/:name/warrooms/:id/tasks/:num/status", async (c) => {
  try {
    const warRoomId = c.req.param("id");
    const taskNumber = parseInt(c.req.param("num"), 10);
    if (isNaN(taskNumber) || taskNumber < 1 || taskNumber > 12) {
      return c.json({ error: "task number must be 1-12" }, 400);
    }
    const body = schemas.taskStatusSchema.parse(await c.req.json());
    const task = await warrooms.updateTaskStatus(
      warRoomId,
      taskNumber,
      body.status,
      body.output,
    );
    return c.json(task);
  } catch (err) {
    return c.json({ error: (err as Error).message }, 400);
  }
});

// =============================================================================
// Start server
// =============================================================================

log("info", "API server starting", { version: "2.0.0" });
Deno.serve((req) => {
  const url = new URL(req.url);
  const stripped = url.pathname.replace(/^\/api/, "") || "/";
  const newUrl = new URL(stripped + url.search, url.origin);
  return app.fetch(new Request(newUrl.toString(), req));
});
