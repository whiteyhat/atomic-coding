import { getSupabaseClient } from "../supabase-client.ts";
import { generateEmbedding } from "../openai.ts";
import { log } from "../logger.ts";
import { emitOpenClawEvent } from "./openclaw.ts";
import {
  validateScoreSystemRules,
  type ValidationReport,
} from "../../../../mastra/src/shared/atom-validation.ts";

// =============================================================================
// Types
// =============================================================================

export interface Build {
  id: string;
  game_id: string;
  status: string;
  bundle_url: string | null;
  atom_count: number | null;
  error_message: string | null;
  build_log: unknown;
  atom_snapshot: AtomSnapshot | null;
  score_system_ready: boolean;
  score_system_report: ValidationReport | null;
  score_system_checked_at: string | null;
  created_at: string;
}

export interface BuildSummary {
  id: string;
  status: string;
  bundle_url: string | null;
  atom_count: number | null;
  error_message: string | null;
  score_system_ready: boolean;
  score_system_checked_at: string | null;
  created_at: string;
}

export interface AtomSnapshot {
  atoms: SnapshotAtom[];
  dependencies: SnapshotDep[];
}

interface SnapshotAtom {
  name: string;
  type: string;
  code: string;
  description: string | null;
  inputs: SnapshotPort[];
  outputs: SnapshotPort[];
}

interface SnapshotDep {
  atom_name: string;
  depends_on: string;
}

interface SnapshotPort {
  name: string;
  type: string;
}

// =============================================================================
// Service functions
// =============================================================================

/** List builds for a game, newest first */
export async function listBuilds(
  gameId: string,
  limit: number = 20,
): Promise<BuildSummary[]> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("builds")
    .select("id, status, bundle_url, atom_count, error_message, score_system_ready, score_system_checked_at, created_at")
    .eq("game_id", gameId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Failed to list builds: ${error.message}`);
  return (data || []) as BuildSummary[];
}

/**
 * Create a snapshot of the current atoms for a game.
 * Returns the snapshot object (does NOT create a build record).
 */
export async function snapshotCurrentAtoms(
  gameId: string,
): Promise<AtomSnapshot> {
  const supabase = getSupabaseClient();

  const { data: atoms, error: atomsError } = await supabase
    .from("atoms")
    .select("name, type, code, description, inputs, outputs")
    .eq("game_id", gameId);

  if (atomsError) throw new Error(`Snapshot failed: ${atomsError.message}`);

  const { data: deps, error: depsError } = await supabase
    .from("atom_dependencies")
    .select("atom_name, depends_on")
    .eq("game_id", gameId);

  if (depsError) throw new Error(`Snapshot deps failed: ${depsError.message}`);

  return {
    atoms: (atoms || []).map((a: any) => ({
      name: a.name,
      type: a.type,
      code: a.code,
      description: a.description,
      inputs: a.inputs || [],
      outputs: a.outputs || [],
    })),
    dependencies: (deps || []).map((d: any) => ({
      atom_name: d.atom_name,
      depends_on: d.depends_on,
    })),
  };
}

/**
 * Rollback a game to a previous build.
 *
 * Flow:
 * 1. Fetch target build's atom_snapshot
 * 2. Snapshot current atoms into a NEW build (auto-checkpoint)
 * 3. DELETE all atoms + deps for the game
 * 4. INSERT atoms from target snapshot
 * 5. INSERT deps from target snapshot
 * 6. Regenerate embeddings for restored atoms
 * 7. Update game.active_build_id
 * 8. Trigger rebuild
 */
export async function rollbackBuild(
  gameId: string,
  buildId: string,
): Promise<{ checkpointBuildId: string; restoredAtomCount: number }> {
  const supabase = getSupabaseClient();
  const { data: gameMeta } = await supabase
    .from("games")
    .select("name, user_id")
    .eq("id", gameId)
    .limit(1)
    .maybeSingle();

  // 1. Fetch target build
  const { data: targetBuild, error: buildError } = await supabase
    .from("builds")
    .select("id, atom_snapshot, game_id")
    .eq("id", buildId)
    .eq("game_id", gameId)
    .single();

  if (buildError || !targetBuild) {
    throw new Error(`Build "${buildId}" not found for this game.`);
  }

  const snapshot = targetBuild.atom_snapshot as AtomSnapshot | null;
  if (!snapshot || !snapshot.atoms) {
    throw new Error(
      `Build "${buildId}" has no atom snapshot. Only builds created after the snapshot feature can be rolled back to.`,
    );
  }

  // 2. Save current state as a checkpoint build
  log("info", "rollback: saving checkpoint", { gameId, targetBuildId: buildId });
  const currentSnapshot = await snapshotCurrentAtoms(gameId);

  const { data: checkpointBuild, error: checkpointError } = await supabase
    .from("builds")
    .insert({
      game_id: gameId,
      status: "success",
      atom_count: currentSnapshot.atoms.length,
      atom_snapshot: currentSnapshot,
      build_log: ["auto-checkpoint before rollback"],
    })
    .select("id")
    .single();

  if (checkpointError) {
    throw new Error(`Failed to save checkpoint: ${checkpointError.message}`);
  }

  // 3. Delete all current atoms + deps for the game
  log("info", "rollback: clearing current atoms", { gameId });
  await supabase.from("atom_dependencies").delete().eq("game_id", gameId);
  await supabase.from("atoms").delete().eq("game_id", gameId);

  // 4. Insert atoms from target snapshot
  log("info", "rollback: restoring atoms", {
    gameId,
    atomCount: snapshot.atoms.length,
  });

  for (const atom of snapshot.atoms) {
    // Generate embedding for restored atom
    const sigText = (atom.inputs as any[])
      .map((p: any) => `${p.name}:${p.type}`)
      .join(", ");
    const outText = (atom.outputs as any[])
      .map((p: any) => `${p.name}:${p.type}`)
      .join(", ");
    const embeddingText = `${atom.name}(${sigText}) => ${outText}: ${atom.description || ""}\n${atom.code}`;
    const embedding = await generateEmbedding(embeddingText);

    const { error: insertError } = await supabase.from("atoms").insert({
      game_id: gameId,
      name: atom.name,
      type: atom.type,
      code: atom.code,
      description: atom.description,
      inputs: atom.inputs,
      outputs: atom.outputs,
      embedding,
    });

    if (insertError) {
      throw new Error(
        `Failed to restore atom "${atom.name}": ${insertError.message}`,
      );
    }
  }

  // 5. Insert deps from target snapshot
  if (snapshot.dependencies.length > 0) {
    const { error: depError } = await supabase
      .from("atom_dependencies")
      .insert(
        snapshot.dependencies.map((d) => ({
          game_id: gameId,
          atom_name: d.atom_name,
          depends_on: d.depends_on,
        })),
      );

    if (depError) {
      throw new Error(`Failed to restore dependencies: ${depError.message}`);
    }
  }

  // 6. Update game.active_build_id to the target build
  await supabase
    .from("games")
    .update({ active_build_id: buildId })
    .eq("id", gameId);

  // 7. Trigger rebuild
  log("info", "rollback: triggering rebuild", { gameId });
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (supabaseUrl && serviceKey) {
    try {
      await fetch(`${supabaseUrl}/functions/v1/rebuild-bundle`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ game_id: gameId }),
      });
    } catch (err) {
      log("error", "rollback: rebuild trigger failed", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  log("info", "rollback: complete", {
    gameId,
    targetBuildId: buildId,
    checkpointBuildId: checkpointBuild.id,
    restoredAtoms: snapshot.atoms.length,
  });

  if (gameMeta?.user_id) {
    await emitOpenClawEvent(gameMeta.user_id, "build:rollback", {
      game_id: gameId,
      game_name: gameMeta.name,
      build_id: buildId,
      checkpoint_build_id: checkpointBuild.id,
    });
  }

  return {
    checkpointBuildId: checkpointBuild.id,
    restoredAtomCount: snapshot.atoms.length,
  };
}

export async function ensureBuildScoreSystemReport(
  buildId: string,
): Promise<ValidationReport> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("builds")
    .select("id, atom_snapshot, score_system_report")
    .eq("id", buildId)
    .single();

  if (error || !data) {
    throw new Error(`Build "${buildId}" not found.`);
  }

  if (data.score_system_report) {
    return data.score_system_report as ValidationReport;
  }

  const snapshot = data.atom_snapshot as AtomSnapshot | null;
  if (!snapshot) {
    throw new Error(`Build "${buildId}" cannot be validated because it has no atom snapshot.`);
  }

  const report = validateScoreSystemRules(snapshot.atoms, snapshot.dependencies);

  const { error: updateError } = await supabase
    .from("builds")
    .update({
      score_system_ready: report.passed,
      score_system_report: report,
      score_system_checked_at: report.checked_at,
    })
    .eq("id", buildId);

  if (updateError) {
    throw new Error(`Failed to persist build score-system report: ${updateError.message}`);
  }

  return report;
}
