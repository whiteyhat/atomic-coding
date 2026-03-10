import { getSupabaseClient } from "../lib/supabase.js";

// =============================================================================
// Types
// =============================================================================

export interface BoilerplateAtom {
  name: string;
  type: "core" | "feature" | "util";
  description: string;
  code: string;
  inputs: { name: string; type: string }[];
  outputs: { name: string; type: string }[];
  dependencies: string[];
}

export interface SeedReport {
  seeded: string[];
  already_existed: string[];
  externals_installed: number;
  boilerplate_atoms: BoilerplateAtom[];
}

function normalizeBoilerplateAtoms(atoms: BoilerplateAtom[]): BoilerplateAtom[] {
  return atoms.map((atom) =>
    atom.name === "score_tracker"
      ? { ...atom, type: "feature" }
      : atom
  );
}

const EMPTY_REPORT: SeedReport = {
  seeded: [],
  already_existed: [],
  externals_installed: 0,
  boilerplate_atoms: [],
};

// =============================================================================
// Main
// =============================================================================

/**
 * Ensure boilerplate atoms exist for a game. Idempotent — skips atoms that
 * already exist so retry scenarios don't overwrite modified atoms.
 */
export async function ensureBoilerplateSeeded(
  gameId: string,
  genre: string,
  gameFormat?: "2d" | "3d" | null,
): Promise<SeedReport> {
  if (!genre || genre === "custom") {
    return EMPTY_REPORT;
  }

  const supabase = getSupabaseClient();

  // 1. Fetch boilerplate definition
  let query = supabase
    .from("genre_boilerplates")
    .select("atoms_json, externals, game_format")
    .eq("slug", genre);

  if (gameFormat) {
    query = query.eq("game_format", gameFormat);
  } else {
    query = query.order("game_format", { ascending: false }).limit(1);
  }

  const { data: boilerplateRows, error: bpError } = await query;
  const boilerplate = Array.isArray(boilerplateRows)
    ? boilerplateRows[0]
    : boilerplateRows;

  if (bpError || !boilerplate) {
    console.warn("[boilerplate-seeder] no boilerplate found for genre", { genre, error: bpError?.message });
    return EMPTY_REPORT;
  }

  const boilerplateAtoms = normalizeBoilerplateAtoms(
    (boilerplate.atoms_json || []) as BoilerplateAtom[],
  );
  if (boilerplateAtoms.length === 0) {
    return { ...EMPTY_REPORT, boilerplate_atoms: boilerplateAtoms };
  }

  // 2. Check which atoms already exist for this game
  const { data: existingAtoms } = await supabase
    .from("atoms")
    .select("name")
    .eq("game_id", gameId)
    .in("name", boilerplateAtoms.map((a) => a.name));

  const existingNames = new Set((existingAtoms || []).map((a: { name: string }) => a.name));

  const seeded: string[] = [];
  const alreadyExisted: string[] = [];

  // 3. Insert only missing atoms (preserves modifications from prior runs)
  for (const atom of boilerplateAtoms) {
    if (existingNames.has(atom.name)) {
      alreadyExisted.push(atom.name);
      continue;
    }

    const { error: insertError } = await supabase.from("atoms").insert({
      game_id: gameId,
      name: atom.name,
      type: atom.type,
      code: atom.code,
      description: atom.description || null,
      inputs: atom.inputs || [],
      outputs: atom.outputs || [],
    });

    if (insertError) {
      console.warn("[boilerplate-seeder] atom insert failed", { atom: atom.name, error: insertError.message });
      continue;
    }

    // Insert dependencies for newly seeded atom
    const deps = atom.dependencies || [];
    if (deps.length > 0) {
      await supabase.from("atom_dependencies").insert(
        deps.map((dep) => ({
          game_id: gameId,
          atom_name: atom.name,
          depends_on: dep,
        })),
      );
    }

    seeded.push(atom.name);
  }

  // 4. Install externals (idempotent — ignore conflicts)
  let externalsInstalled = 0;
  const externals: string[] = boilerplate.externals || [];
  for (const extName of externals) {
    const { data: entry } = await supabase
      .from("external_registry")
      .select("id")
      .eq("name", extName)
      .single();

    if (entry) {
      const { error } = await supabase
        .from("game_externals")
        .insert({ game_id: gameId, registry_id: entry.id });
      if (!error) externalsInstalled++;
      // Conflict (already installed) is fine — ignore
    }
  }

  console.log("[boilerplate-seeder] complete", {
    gameId,
    genre,
    seeded,
    alreadyExisted,
    externalsInstalled,
  });

  return {
    seeded,
    already_existed: alreadyExisted,
    externals_installed: externalsInstalled,
    boilerplate_atoms: boilerplateAtoms,
  };
}
