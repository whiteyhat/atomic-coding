import { getSupabaseClient } from "../supabase-client.ts";
import { log } from "../logger.ts";
import { cached } from "../cache.ts";

// =============================================================================
// Types
// =============================================================================

export interface BoilerplateAtom {
  name: string;
  type: "core" | "feature" | "util";
  description: string;
  code: string;
  inputs: { name: string; type: string; description?: string; optional?: boolean }[];
  outputs: { name: string; type: string; description?: string; optional?: boolean }[];
  dependencies: string[];
}

export interface Boilerplate {
  id: string;
  slug: string;
  game_format: "2d" | "3d";
  display_name: string;
  description: string | null;
  thumbnail_url: string | null;
  atoms_json: BoilerplateAtom[];
  externals: string[];
  template_prompts: string[];
  created_at: string;
}

export interface BoilerplateSummary {
  slug: string;
  game_format: "2d" | "3d";
  display_name: string;
  description: string | null;
  thumbnail_url: string | null;
  externals: string[];
  template_prompts: string[];
}

function normalizeBoilerplateAtoms(atoms: BoilerplateAtom[]): BoilerplateAtom[] {
  return atoms.map((atom) =>
    atom.name === "score_tracker"
      ? { ...atom, type: "feature" }
      : atom
  );
}

// =============================================================================
// Service functions
// =============================================================================

/** List all boilerplates (without atoms_json for lightweight listing) */
export async function listBoilerplates(): Promise<BoilerplateSummary[]> {
  return cached("boilerplates:list", 300, async () => {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from("genre_boilerplates")
      .select("slug, game_format, display_name, description, thumbnail_url, externals, template_prompts")
      .order("display_name", { ascending: true })
      .order("game_format", { ascending: true });

    if (error) throw new Error(`Failed to list boilerplates: ${error.message}`);
    return (data || []) as BoilerplateSummary[];
  });
}

/** Get a single boilerplate by slug (includes atoms_json) */
export async function getBoilerplate(
  slug: string,
  gameFormat?: "2d" | "3d" | null,
): Promise<Boilerplate | null> {
  const cacheKey = `boilerplate:${slug}:${gameFormat || "any"}`;

  return cached(cacheKey, 300, async () => {
    const supabase = getSupabaseClient();

    let query = supabase
      .from("genre_boilerplates")
      .select("*")
      .eq("slug", slug);

    if (gameFormat) {
      query = query.eq("game_format", gameFormat);
      const { data, error } = await query.single();

      if (error) {
        if (error.code === "PGRST116") return null;
        throw new Error(`Failed to get boilerplate: ${error.message}`);
      }

      return {
        ...(data as Boilerplate),
        atoms_json: normalizeBoilerplateAtoms((data as Boilerplate).atoms_json || []),
      };
    }

    const { data, error } = await query.order("game_format", { ascending: false });

    if (error) {
      throw new Error(`Failed to get boilerplate: ${error.message}`);
    }

    const selected = (data || [])[0] as Boilerplate | undefined;
    if (!selected) return null;

    return {
      ...selected,
      atoms_json: normalizeBoilerplateAtoms(selected.atoms_json || []),
    };
  });
}

/** Seed a game with atoms and externals from a boilerplate */
export async function seedGameFromBoilerplate(
  gameId: string,
  slug: string,
  gameFormat?: "2d" | "3d" | null,
): Promise<{ atomCount: number; externalCount: number }> {
  const boilerplate = await getBoilerplate(slug, gameFormat);
  if (!boilerplate) throw new Error(`Boilerplate "${slug}" not found`);

  const supabase = getSupabaseClient();
  const atoms = boilerplate.atoms_json;

  // 1. Insert all atoms in parallel
  await Promise.all(
    atoms.map(async (atom) => {
      const { error } = await supabase.from("atoms").upsert(
        {
          game_id: gameId,
          name: atom.name,
          code: atom.code,
          type: atom.type,
          description: atom.description || null,
          inputs: atom.inputs || [],
          outputs: atom.outputs || [],
        },
        { onConflict: "game_id,name" },
      );
      if (error) {
        log("error", "seedGameFromBoilerplate: atom insert failed", {
          atom: atom.name,
          error: error.message,
        });
      }
    }),
  );

  // Insert all dependencies in a single bulk insert
  const allDeps = atoms.flatMap((atom) =>
    (atom.dependencies || []).map((dep) => ({
      game_id: gameId,
      atom_name: atom.name,
      depends_on: dep,
    }))
  );
  if (allDeps.length > 0) {
    await supabase.from("atom_dependencies").insert(allDeps);
  }

  // 2. Install externals — look up all registry IDs in one query, then bulk insert
  let externalCount = 0;
  if (boilerplate.externals.length > 0) {
    const { data: entries } = await supabase
      .from("external_registry")
      .select("id, name")
      .in("name", boilerplate.externals);

    if (entries && entries.length > 0) {
      const { error } = await supabase.from("game_externals").insert(
        entries.map((entry) => ({ game_id: gameId, registry_id: entry.id })),
      );
      if (!error) externalCount = entries.length;
    }
  }

  log("info", "seedGameFromBoilerplate: complete", {
    gameId,
    slug,
    atomCount: atoms.length,
    externalCount,
  });

  return { atomCount: atoms.length, externalCount };
}
