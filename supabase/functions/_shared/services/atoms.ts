import { getSupabaseClient } from "../supabase-client.ts";
import { generateEmbedding } from "../openai.ts";
import { log } from "../logger.ts";
import { emitOpenClawEvent } from "./openclaw.ts";

// =============================================================================
// Types
// =============================================================================

export interface Port {
  name: string;
  type: string;
  description?: string;
  optional?: boolean;
}

export interface AtomSummary {
  name: string;
  type: string;
  inputs: Port[];
  outputs: Port[];
  depends_on: string[];
}

export interface AtomFull {
  name: string;
  type: string;
  code: string;
  description: string | null;
  inputs: Port[];
  outputs: Port[];
  version: number;
  depends_on: string[];
}

export interface UpsertAtomInput {
  name: string;
  code: string;
  type: "core" | "feature" | "util";
  inputs?: Port[];
  outputs?: Port[];
  dependencies?: string[];
  description?: string;
}

export interface SearchResult extends AtomFull {
  similarity: number;
}

// =============================================================================
// Helpers
// =============================================================================

function groupBy<T extends Record<string, unknown>>(
  arr: T[],
  key: string,
): Record<string, T[]> {
  const map: Record<string, T[]> = {};
  for (const item of arr) {
    const k = String(item[key]);
    if (!map[k]) map[k] = [];
    map[k].push(item);
  }
  return map;
}

export function formatPort(p: Port): string {
  return `${p.name}: ${p.type}${p.optional ? "?" : ""}`;
}

export function formatSignature(inputs: Port[], outputs: Port[]): string {
  const inSig = inputs.map(formatPort).join(", ");
  const outSig =
    outputs.length === 0
      ? "void"
      : outputs.length === 1
        ? outputs[0].type
        : `{ ${outputs.map(formatPort).join(", ")} }`;
  return `(${inSig}) => ${outSig}`;
}

/** Trigger the rebuild-bundle Edge Function for a specific game */
export async function triggerRebuild(gameId: string): Promise<void> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    log("warn", "triggerRebuild: missing env vars, skipping");
    return;
  }

  try {
    const supabase = getSupabaseClient();
    const { data: game } = await supabase
      .from("games")
      .select("name, user_id")
      .eq("id", gameId)
      .limit(1)
      .maybeSingle();

    const res = await fetch(`${supabaseUrl}/functions/v1/rebuild-bundle`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ game_id: gameId }),
    });
    log("info", "triggerRebuild: response", { gameId, status: res.status });
    if (game?.user_id) {
      await emitOpenClawEvent(game.user_id, "build:triggered", {
        game_id: gameId,
        game_name: game.name,
        queued: res.ok,
      });
    }
  } catch (err) {
    log("error", "triggerRebuild: failed", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

// =============================================================================
// Service functions
// =============================================================================

/** Get the code structure (atom map) for a game */
export async function getCodeStructure(
  gameId: string,
  typeFilter?: string,
): Promise<AtomSummary[]> {
  const supabase = getSupabaseClient();

  let query = supabase
    .from("atoms")
    .select("name, type, inputs, outputs")
    .eq("game_id", gameId);
  if (typeFilter) query = query.eq("type", typeFilter);
  const { data: atoms, error: atomsError } = await query;

  if (atomsError) throw new Error(`Failed to fetch atoms: ${atomsError.message}`);

  const { data: deps } = await supabase
    .from("atom_dependencies")
    .select("atom_name, depends_on")
    .eq("game_id", gameId);

  const depsMap = groupBy(deps || [], "atom_name");

  return (atoms || []).map((a: any) => ({
    name: a.name,
    type: a.type,
    inputs: a.inputs,
    outputs: a.outputs,
    depends_on: (depsMap[a.name] || []).map((d: any) => d.depends_on),
  }));
}

/** Read full atom data for one or more atoms */
export async function readAtoms(
  gameId: string,
  names: string[],
): Promise<AtomFull[]> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("atoms")
    .select("name, type, code, description, inputs, outputs, version")
    .eq("game_id", gameId)
    .in("name", names);

  if (error) throw new Error(`Failed to read atoms: ${error.message}`);
  if (!data || data.length === 0) return [];

  const { data: deps } = await supabase
    .from("atom_dependencies")
    .select("atom_name, depends_on")
    .eq("game_id", gameId)
    .in("atom_name", names);

  const depsMap = groupBy(deps || [], "atom_name");

  return data.map((a: any) => ({
    name: a.name,
    type: a.type,
    code: a.code,
    description: a.description,
    inputs: a.inputs || [],
    outputs: a.outputs || [],
    version: a.version,
    depends_on: (depsMap[a.name] || []).map((d: any) => d.depends_on),
  }));
}

/** Semantic search for atoms by meaning */
export async function semanticSearch(
  gameId: string,
  query: string,
  limit: number = 5,
): Promise<SearchResult[]> {
  const supabase = getSupabaseClient();

  const embedding = await generateEmbedding(query);

  const { data, error } = await supabase.rpc("match_atoms", {
    p_game_id: gameId,
    query_embedding: embedding,
    match_threshold: 0.3,
    match_count: limit,
  });

  if (error) throw new Error(`Semantic search failed: ${error.message}`);
  if (!data || data.length === 0) return [];

  // Fetch dependencies for matched atoms
  const matchedNames = data.map((a: any) => a.name);
  const { data: deps } = await supabase
    .from("atom_dependencies")
    .select("atom_name, depends_on")
    .eq("game_id", gameId)
    .in("atom_name", matchedNames);

  const depsMap = groupBy(deps || [], "atom_name");

  return data.map((a: any) => ({
    name: a.name,
    type: a.type,
    code: a.code,
    description: a.description,
    inputs: a.inputs || [],
    outputs: a.outputs || [],
    version: 0, // match_atoms RPC doesn't return version
    similarity: a.similarity,
    depends_on: (depsMap[a.name] || []).map((d: any) => d.depends_on),
  }));
}

/** Create or update an atom */
export async function upsertAtom(
  gameId: string,
  input: UpsertAtomInput,
): Promise<{ name: string; signature: string; dependencies: string[] }> {
  const supabase = getSupabaseClient();
  const { name, code, type, description } = input;
  const inputs = input.inputs || [];
  const outputs = input.outputs || [];
  const dependencies = input.dependencies || [];

  // 1. Validate code size
  const codeBytes = new TextEncoder().encode(code).length;
  if (codeBytes > 2048) {
    throw new Error(
      `Code is ${codeBytes} bytes (limit: 2048). Break this into smaller atoms.`,
    );
  }

  // 2. Validate all dependencies exist
  if (dependencies.length > 0) {
    const { data: existing } = await supabase
      .from("atoms")
      .select("name")
      .eq("game_id", gameId)
      .in("name", dependencies);
    const found = new Set((existing || []).map((e: any) => e.name));
    const missing = dependencies.filter((d) => d !== name && !found.has(d));
    if (missing.length > 0) {
      throw new Error(
        `Dependencies not found: ${missing.join(", ")}. Create them first.`,
      );
    }
  }

  // 3. Generate embedding
  log("debug", "upsertAtom: generating embedding", { name });
  const sigText = inputs.map((p) => `${p.name}:${p.type}`).join(", ");
  const outText = outputs.map((p) => `${p.name}:${p.type}`).join(", ");
  const embeddingText = `${name}(${sigText}) => ${outText}: ${description || ""}\n${code}`;
  const embedding = await generateEmbedding(embeddingText);

  // 4. Upsert the atom
  log("debug", "upsertAtom: writing to database", { name, gameId });
  const { error } = await supabase.from("atoms").upsert(
    {
      game_id: gameId,
      name,
      code,
      type,
      inputs,
      outputs,
      description: description || null,
      embedding,
    },
    { onConflict: "game_id,name" },
  );

  if (error) throw new Error(`Failed to upsert atom: ${error.message}`);

  // 5. Replace dependencies
  await supabase
    .from("atom_dependencies")
    .delete()
    .eq("game_id", gameId)
    .eq("atom_name", name);

  if (dependencies.length > 0) {
    const { error: depError } = await supabase
      .from("atom_dependencies")
      .insert(
        dependencies.map((dep) => ({
          game_id: gameId,
          atom_name: name,
          depends_on: dep,
        })),
      );
    if (depError) {
      throw new Error(`Atom saved but dependency linking failed: ${depError.message}`);
    }
  }

  // 6. Trigger rebuild (fire-and-forget)
  triggerRebuild(gameId);

  const signature = formatSignature(inputs, outputs);
  return { name, signature, dependencies };
}

/** Delete an atom */
export async function deleteAtom(
  gameId: string,
  name: string,
): Promise<void> {
  const supabase = getSupabaseClient();

  // Check who depends on this atom
  const { data: dependents } = await supabase
    .from("atom_dependencies")
    .select("atom_name")
    .eq("game_id", gameId)
    .eq("depends_on", name);

  if (dependents && dependents.length > 0) {
    const depNames = dependents.map((d: any) => d.atom_name).join(", ");
    throw new Error(
      `Cannot delete "${name}": used by [${depNames}]. Update or delete those atoms first.`,
    );
  }

  // Check the atom exists
  const { data: existing } = await supabase
    .from("atoms")
    .select("name")
    .eq("game_id", gameId)
    .eq("name", name)
    .single();

  if (!existing) throw new Error(`Atom "${name}" not found.`);

  const { error } = await supabase
    .from("atoms")
    .delete()
    .eq("game_id", gameId)
    .eq("name", name);

  if (error) throw new Error(`Failed to delete atom: ${error.message}`);

  // Trigger rebuild (fire-and-forget)
  triggerRebuild(gameId);
}
