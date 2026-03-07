import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { getSupabaseClient } from "../lib/supabase.js";

/** Fire-and-forget: trigger the rebuild-bundle Edge Function */
function triggerRebuild(gameId: string): void {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    console.warn("[upsert-atom] triggerRebuild: missing env vars, skipping");
    return;
  }
  fetch(`${supabaseUrl}/functions/v1/rebuild-bundle`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ game_id: gameId }),
  }).catch((err) => {
    console.error("[upsert-atom] triggerRebuild failed:", err);
  });
}

/** Build a dependency lookup map from atom_dependencies rows */
function buildDepsMap(deps: Array<{ atom_name: string; depends_on: string }>): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  for (const d of deps) {
    if (!map[d.atom_name]) map[d.atom_name] = [];
    map[d.atom_name].push(d.depends_on);
  }
  return map;
}

export const getCodeStructureTool = createTool({
  id: "get-code-structure",
  description:
    "Get the full atom map and code structure for a game. Returns all atoms with their types, inputs, outputs, and dependencies.",
  inputSchema: z.object({
    gameId: z.string().describe("The game ID to get code structure for"),
    type: z
      .enum(["core", "feature", "util"])
      .optional()
      .describe("Filter by atom type"),
  }),
  outputSchema: z.object({
    atoms: z.array(
      z.object({
        name: z.string(),
        type: z.string(),
        description: z.string().nullable(),
        inputs: z.any(),
        outputs: z.any(),
        depends_on: z.array(z.string()),
      })
    ),
  }),
  execute: async ({ gameId, type }) => {
    const supabase = getSupabaseClient();

    let query = supabase
      .from("atoms")
      .select("name,type,description,inputs,outputs")
      .eq("game_id", gameId);
    if (type) query = query.eq("type", type);
    const { data: atoms, error: atomsError } = await query;
    if (atomsError) throw new Error(atomsError.message);

    const { data: deps } = await supabase
      .from("atom_dependencies")
      .select("atom_name,depends_on")
      .eq("game_id", gameId);

    const depsMap = buildDepsMap(deps || []);

    return {
      atoms: (atoms || []).map((a: any) => ({
        ...a,
        depends_on: depsMap[a.name] || [],
      })),
    };
  },
});

export const readAtomsTool = createTool({
  id: "read-atoms",
  description:
    "Read the source code and metadata for specific atoms by name.",
  inputSchema: z.object({
    gameId: z.string().describe("The game ID"),
    names: z.array(z.string()).describe("Atom names to read"),
  }),
  outputSchema: z.object({
    atoms: z.array(
      z.object({
        name: z.string(),
        type: z.string(),
        code: z.string(),
        description: z.string().nullable(),
        inputs: z.any(),
        outputs: z.any(),
        depends_on: z.array(z.string()),
      })
    ),
  }),
  execute: async ({ gameId, names }) => {
    const supabase = getSupabaseClient();

    const { data: atoms, error } = await supabase
      .from("atoms")
      .select("name,type,code,description,inputs,outputs")
      .eq("game_id", gameId)
      .in("name", names);
    if (error) throw new Error(error.message);
    if (!atoms || atoms.length === 0) return { atoms: [] };

    const { data: deps } = await supabase
      .from("atom_dependencies")
      .select("atom_name,depends_on")
      .eq("game_id", gameId)
      .in("atom_name", names);

    const depsMap = buildDepsMap(deps || []);

    return {
      atoms: atoms.map((a: any) => ({
        ...a,
        depends_on: depsMap[a.name] || [],
      })),
    };
  },
});

export const upsertAtomTool = createTool({
  id: "upsert-atom",
  description:
    "Create or update an atom in the game. The atom name must be snake_case and the code must be under 2KB.",
  inputSchema: z.object({
    gameId: z.string().describe("The game ID"),
    name: z.string().describe("Atom name (snake_case)"),
    type: z.enum(["core", "feature", "util"]).describe("Atom type"),
    code: z.string().describe("JavaScript function code (max 2KB)"),
    description: z.string().describe("What this atom does"),
    inputs: z
      .array(z.object({ name: z.string(), type: z.string() }))
      .default([])
      .describe("Input parameters"),
    outputs: z
      .array(z.object({ name: z.string(), type: z.string() }))
      .default([])
      .describe("Output values"),
    depends_on: z
      .array(z.string())
      .default([])
      .describe("Names of atoms this depends on"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    atom: z.object({ name: z.string(), type: z.string() }),
  }),
  execute: async ({ gameId, name, type, code, description, inputs, outputs, depends_on }) => {
    const supabase = getSupabaseClient();

    // 1. Validate code size
    const codeBytes = new TextEncoder().encode(code).length;
    if (codeBytes > 2048) {
      throw new Error(
        `Code is ${codeBytes} bytes (limit: 2048). Break this into smaller atoms.`
      );
    }

    // 2. Upsert the atom (depends_on is NOT a column on the atoms table)
    const { data, error } = await supabase
      .from("atoms")
      .upsert(
        {
          game_id: gameId,
          name,
          type,
          code,
          description,
          inputs,
          outputs,
        },
        { onConflict: "game_id,name" }
      )
      .select("name,type")
      .single();
    if (error) throw new Error(error.message);

    // 3. Replace dependencies in the atom_dependencies junction table
    await supabase
      .from("atom_dependencies")
      .delete()
      .eq("game_id", gameId)
      .eq("atom_name", name);

    if (depends_on.length > 0) {
      const { error: depError } = await supabase
        .from("atom_dependencies")
        .insert(
          depends_on.map((dep) => ({
            game_id: gameId,
            atom_name: name,
            depends_on: dep,
          }))
        );
      if (depError) {
        throw new Error(
          `Atom saved but dependency linking failed: ${depError.message}`
        );
      }
    }

    // 4. Trigger rebuild (fire-and-forget)
    triggerRebuild(gameId);

    return { success: true, atom: data };
  },
});

export const supabaseTools = {
  "get-code-structure": getCodeStructureTool,
  "read-atoms": readAtomsTool,
  "upsert-atom": upsertAtomTool,
};
