import { getSupabaseClient } from "../_shared/supabase-client.ts";
import { topologicalSort } from "../_shared/topological-sort.ts";
import { log } from "../_shared/logger.ts";
import { emitOpenClawEvent } from "../_shared/services/openclaw.ts";
import { snapshotCurrentAtoms } from "../_shared/services/builds.ts";
import { getInstalledExternals } from "../_shared/services/externals.ts";
import { validateScoreSystemRules } from "../../../mastra/src/shared/atom-validation.ts";

const PHASER_AUTO_RE = /\bPhaser\s*\.\s*AUTO\b/g;
const SCRIPT_INJECTION_RE = /document\s*\.\s*createElement\s*\(\s*["']script["']\s*\)/;
const LOCKDOWN_RE = /lockdown-install\.js|lockdown\s*\(|\bCompartment\b|\bharden\s*\(/;

async function loadPixelRuntimeIndex(
  pixelManifestUrl: string | null | undefined,
): Promise<Record<string, unknown>> {
  if (!pixelManifestUrl) {
    return { animations: [], backgrounds: [], ui: [] };
  }

  try {
    const response = await fetch(pixelManifestUrl, { headers: { Accept: "application/json" } });
    if (!response.ok) {
      return { animations: [], backgrounds: [], ui: [] };
    }
    const payload = await response.json().catch(() => null) as Record<string, unknown> | null;
    const task8 = payload?.task_8 as Record<string, unknown> | undefined;
    const runtimeIndex = task8?.runtime_index;
    if (runtimeIndex && typeof runtimeIndex === "object") {
      return runtimeIndex as Record<string, unknown>;
    }
  } catch {
    // Best-effort only; runtime falls back to placeholders if missing.
  }

  return { animations: [], backgrounds: [], ui: [] };
}

/**
 * Rebuild Bundle Edge Function
 *
 * Accepts a game_id, fetches that game's atoms, sorts them topologically,
 * concatenates into a single IIFE bundle, stores an atom snapshot in the
 * build record, and uploads to Supabase Storage under game-scoped paths.
 */

Deno.serve(async (req: Request) => {
  const allowedOrigins = (Deno.env.get("ALLOWED_ORIGINS") || "*")
    .split(",").map((o: string) => o.trim());
  const reqOrigin = req.headers.get("Origin") || "";
  const origin = allowedOrigins.includes("*") ? "*"
    : allowedOrigins.includes(reqOrigin) ? reqOrigin
    : allowedOrigins[0];
  const corsHeaders: Record<string, string> = {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    ...(origin !== "*" ? { Vary: "Origin" } : {}),
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const supabase = getSupabaseClient();
  let buildId: string | null = null;
  let requestedGameId: string | null = null;

  try {
    // 0. Parse game_id from request body
    const body = await req.json().catch(() => ({}));
    const gameId: string | undefined = body.game_id;
    requestedGameId = typeof gameId === "string" ? gameId : null;
    if (!gameId) {
      return new Response(
        JSON.stringify({ status: "error", error: "game_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Resolve game name for storage paths
    const { data: game, error: gameError } = await supabase
      .from("games")
      .select("id, name, game_format, user_id, pixel_assets_revision, pixel_manifest_url")
      .eq("id", gameId)
      .single();

    if (gameError || !game) {
      return new Response(
        JSON.stringify({ status: "error", error: `Game not found: ${gameId}` }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    log("info", "rebuild: starting", { gameId, gameName: game.name });

    // 1. Create build record (status: building)
    const { data: build, error: buildError } = await supabase
      .from("builds")
      .insert({ status: "building", game_id: gameId })
      .select("id")
      .single();

    if (buildError) throw new Error(`Failed to create build: ${buildError.message}`);
    buildId = build.id;

    // 2. Create atom snapshot BEFORE bundling (for rollback support)
    const atomSnapshot = await snapshotCurrentAtoms(gameId);
    const scoreSystemReport = validateScoreSystemRules(
      atomSnapshot.atoms,
      atomSnapshot.dependencies,
    );

    // 3. Fetch all atoms for this game
    const { data: atoms, error: atomsError } = await supabase
      .from("atoms")
      .select("name, type, code")
      .eq("game_id", gameId);

    if (atomsError) throw new Error(`Failed to fetch atoms: ${atomsError.message}`);

    if (!atoms || atoms.length === 0) {
      await supabase
        .from("builds")
        .update({
          status: "success",
          atom_count: 0,
          build_log: [],
          bundle_url: null,
          atom_snapshot: atomSnapshot,
          score_system_ready: scoreSystemReport.passed,
          score_system_report: scoreSystemReport,
          score_system_checked_at: scoreSystemReport.checked_at,
        })
        .eq("id", buildId);

      return new Response(
        JSON.stringify({ status: "success", atoms: 0, build_id: buildId }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 4. Fetch dependencies for this game
    const { data: deps, error: depsError } = await supabase
      .from("atom_dependencies")
      .select("atom_name, depends_on")
      .eq("game_id", gameId);

    if (depsError) throw new Error(`Failed to fetch deps: ${depsError.message}`);

    // 5. Topological sort
    const sortedNames = topologicalSort(atoms, deps || []);

    // 6. Build the bundle
    type AtomRow = { name: string; type: string; code: string };
    const runtime = game.game_format === "2d" ? "phaser" : "three";
    const normalizedAtoms = (atoms as AtomRow[]).map((atom) => ({
      ...atom,
      code: normalizeAtomCode(atom.code, runtime),
    }));
    const blockedAtoms = normalizedAtoms.filter((atom) => hasBlockedRuntimePattern(atom.code));
    if (blockedAtoms.length > 0) {
      throw new Error(
        `Blocked unsafe runtime code in atom(s): ${blockedAtoms.map((atom) => atom.name).join(", ")}. ` +
          "Atoms may not inject scripts or load SES/lockdown bootstraps.",
      );
    }

    const atomMap = new Map<string, AtomRow>();
    for (const a of normalizedAtoms) {
      atomMap.set(a.name, a);
    }
    const timestamp = new Date().toISOString();

    const sections = sortedNames.map((name) => {
      const atom = atomMap.get(name)!;
      return `  // --- [${atom.type}] ${atom.name} ---\n${indent(atom.code, 2)}`;
    });

    const coreAtoms = sortedNames.filter(
      (n) => atomMap.get(n)?.type === "core",
    );
    const entryPoint =
      coreAtoms.find((n) => n === "game_loop" || n === "main") ||
      coreAtoms[coreAtoms.length - 1];

    const bootSection = entryPoint
      ? `\n  // Boot\n  if (typeof ${entryPoint} === 'function') ${entryPoint}();`
      : "\n  // No entry point found (no 'core' atom)";

    const bundle = [
      `// === Atomic Coding Bundle ===`,
      `// Game: ${game.name}`,
      `// Generated: ${timestamp}`,
      `// Atoms: ${atoms.length}`,
      `// Order: ${sortedNames.join(" -> ")}`,
      `(function() {`,
      `  "use strict";`,
      ``,
      sections.join("\n\n"),
      bootSection,
      `})();`,
    ].join("\n");

    // 7. Fetch installed externals and generate manifest
    const installed = await getInstalledExternals(gameId);
    const pixelIndex = await loadPixelRuntimeIndex(game.pixel_manifest_url);
    const manifest = {
      runtime,
      externals: installed.map((ext) => ({
        name: ext.name,
        cdn_url: ext.cdn_url,
        global_name: ext.global_name,
        load_type: ext.load_type || "script",
        ...(ext.module_imports ? { module_imports: ext.module_imports } : {}),
      })),
      bundle_url: "latest.js",
      built_at: timestamp,
      asset_contract_version: 2,
      pixel_manifest_url: game.pixel_manifest_url || null,
      pixel_assets_revision: Number(game.pixel_assets_revision ?? 0),
      runtime_asset_mode:
        runtime === "phaser" && !game.pixel_manifest_url ? "progressive" : "final",
      pixel_index: pixelIndex,
    };

    // 8. Upload bundle + manifest to Supabase Storage (game-scoped paths)
    const bundleBlob = new Blob([bundle], { type: "application/javascript" });
    const manifestBlob = new Blob([JSON.stringify(manifest, null, 2)], { type: "application/json" });
    const latestPath = `${game.name}/latest.js`;
    const versionedPath = `${game.name}/build_${buildId}.js`;
    const manifestPath = `${game.name}/manifest.json`;

    const { error: uploadError } = await supabase.storage
      .from("bundles")
      .upload(latestPath, bundleBlob, {
        cacheControl: "0",
        upsert: true,
        contentType: "application/javascript",
      });

    if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

    // Save a versioned copy of the bundle
    await supabase.storage
      .from("bundles")
      .upload(versionedPath, new Blob([bundle], { type: "application/javascript" }), {
        cacheControl: "3600",
        upsert: true,
        contentType: "application/javascript",
      });

    // Upload manifest
    await supabase.storage
      .from("bundles")
      .upload(manifestPath, manifestBlob, {
        cacheControl: "0",
        upsert: true,
        contentType: "application/json",
      });

    // 9. Get the public URL
    const { data: urlData } = supabase.storage
      .from("bundles")
      .getPublicUrl(latestPath);

    const bundleUrl = urlData?.publicUrl || null;

    // 10. Update build record (status: success + snapshot)
    await supabase
      .from("builds")
      .update({
        status: "success",
        atom_count: atoms.length,
        build_log: sortedNames,
        bundle_url: bundleUrl,
        atom_snapshot: atomSnapshot,
        score_system_ready: scoreSystemReport.passed,
        score_system_report: scoreSystemReport,
        score_system_checked_at: scoreSystemReport.checked_at,
      })
      .eq("id", buildId);

    // 11. Update game's active_build_id
    await supabase
      .from("games")
      .update({ active_build_id: buildId })
      .eq("id", gameId);

    log("info", "rebuild: succeeded", {
      buildId,
      gameId,
      atomCount: atoms.length,
      order: sortedNames,
    });

    if (game.user_id) {
      await emitOpenClawEvent(game.user_id, "build:success", {
        build_id: buildId,
        game_id: gameId,
        game_name: game.name,
        atom_count: atoms.length,
        bundle_url: bundleUrl,
      });
    }

    return new Response(
      JSON.stringify({
        status: "success",
        build_id: buildId,
        game_id: gameId,
        atom_count: atoms.length,
        order: sortedNames,
        bundle_url: bundleUrl,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log("error", "rebuild: failed", { buildId, error: message });

    if (buildId) {
      await supabase
        .from("builds")
        .update({
          status: "error",
          error_message: message,
        })
        .eq("id", buildId);
    }

    try {
      if (requestedGameId) {
        const { data: game } = await supabase
          .from("games")
          .select("name, user_id")
          .eq("id", requestedGameId)
          .limit(1)
          .maybeSingle();
        if (game?.user_id) {
          await emitOpenClawEvent(game.user_id, "build:error", {
            build_id: buildId,
            game_id: requestedGameId,
            game_name: game.name,
            error: message,
          });
        }
      }
    } catch {
      // Ignore OpenClaw webhook failures in the rebuild error path.
    }

    return new Response(
      JSON.stringify({ status: "error", error: message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});

/** Helper: indent every line of code by N spaces */
function indent(code: string, spaces: number): string {
  const pad = " ".repeat(spaces);
  return code
    .split("\n")
    .map((line) => (line.trim() ? pad + line : line))
    .join("\n");
}

function normalizeAtomCode(code: string, runtime: "phaser" | "three"): string {
  if (runtime !== "phaser" || !code) return code;
  return code.replace(PHASER_AUTO_RE, "Phaser.CANVAS");
}

function hasBlockedRuntimePattern(code: string): boolean {
  return SCRIPT_INJECTION_RE.test(code) || LOCKDOWN_RE.test(code);
}
