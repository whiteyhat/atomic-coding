import { getSupabaseClient } from "../../supabase-client.ts";
import { log } from "../../logger.ts";

// =============================================================================
// Types
// =============================================================================

export interface ValidationFailure {
  atom: string;
  rule: string;
  message: string;
}

export interface ValidationReport {
  passed: boolean;
  failures: ValidationFailure[];
  atom_count: number;
  checked_at: string;
}

interface AtomRow {
  name: string;
  type: string;
  code: string;
  description: string | null;
  inputs: { name: string; type: string }[];
  outputs: { name: string; type: string }[];
}

interface DepRow {
  atom_name: string;
  depends_on: string;
}

// =============================================================================
// Constants
// =============================================================================

const MAX_ATOM_SIZE = 2048; // bytes
const SNAKE_CASE_RE = /^[a-z][a-z0-9]*(_[a-z0-9]+)*$/;
const PRIMITIVE_TYPES = new Set([
  "number",
  "string",
  "boolean",
  "void",
  "object",
  "array",
  "any",
  "null",
  "undefined",
]);

// =============================================================================
// Validator
// =============================================================================

/**
 * Run structural validation on all atoms for a game.
 * Checks size, naming, interfaces, dependencies, and required atoms.
 */
export async function validate(gameId: string): Promise<ValidationReport> {
  const supabase = getSupabaseClient();
  const failures: ValidationFailure[] = [];

  // 1. Fetch all atoms
  const { data: atoms, error: atomErr } = await supabase
    .from("atoms")
    .select("name, type, code, description, inputs, outputs")
    .eq("game_id", gameId);

  if (atomErr) throw new Error(`Failed to fetch atoms: ${atomErr.message}`);
  if (!atoms || atoms.length === 0) {
    return {
      passed: true,
      failures: [],
      atom_count: 0,
      checked_at: new Date().toISOString(),
    };
  }

  // 2. Fetch all dependencies
  const { data: deps, error: depErr } = await supabase
    .from("atom_dependencies")
    .select("atom_name, depends_on")
    .eq("game_id", gameId);

  if (depErr) throw new Error(`Failed to fetch deps: ${depErr.message}`);

  const depList = (deps || []) as DepRow[];
  const atomNames = new Set(atoms.map((a: AtomRow) => a.name));

  // Build adjacency list for cycle detection
  const adjacency = new Map<string, string[]>();
  for (const d of depList) {
    const list = adjacency.get(d.atom_name) || [];
    list.push(d.depends_on);
    adjacency.set(d.atom_name, list);
  }

  // ── Per-atom checks ──────────────────────────────────────────────────────

  for (const atom of atoms as AtomRow[]) {
    // Rule: size limit
    const codeSize = new TextEncoder().encode(atom.code).byteLength;
    if (codeSize > MAX_ATOM_SIZE) {
      failures.push({
        atom: atom.name,
        rule: "size_limit",
        message: `Code is ${codeSize} bytes (max ${MAX_ATOM_SIZE})`,
      });
    }

    // Rule: snake_case naming
    if (!SNAKE_CASE_RE.test(atom.name)) {
      failures.push({
        atom: atom.name,
        rule: "snake_case",
        message: `Name "${atom.name}" is not valid snake_case`,
      });
    }

    // Rule: primitive-only interfaces
    for (const port of atom.inputs || []) {
      if (!PRIMITIVE_TYPES.has(port.type.toLowerCase())) {
        failures.push({
          atom: atom.name,
          rule: "primitive_interface",
          message: `Input "${port.name}" has non-primitive type "${port.type}"`,
        });
      }
    }
    for (const port of atom.outputs || []) {
      if (!PRIMITIVE_TYPES.has(port.type.toLowerCase())) {
        failures.push({
          atom: atom.name,
          rule: "primitive_interface",
          message: `Output "${port.name}" has non-primitive type "${port.type}"`,
        });
      }
    }

    // Rule: valid atom type
    if (!["core", "feature", "util"].includes(atom.type)) {
      failures.push({
        atom: atom.name,
        rule: "valid_type",
        message: `Type "${atom.type}" is not one of: core, feature, util`,
      });
    }

    // Rule: dependency completeness (all declared deps exist)
    const atomDeps = adjacency.get(atom.name) || [];
    for (const dep of atomDeps) {
      if (!atomNames.has(dep)) {
        failures.push({
          atom: atom.name,
          rule: "dependency_exists",
          message: `Depends on "${dep}" which does not exist`,
        });
      }
    }
  }

  // ── Global checks ────────────────────────────────────────────────────────

  // Rule: DAG integrity (no circular dependencies)
  const cycleAtom = detectCycle(adjacency);
  if (cycleAtom) {
    failures.push({
      atom: cycleAtom,
      rule: "no_cycles",
      message: `Circular dependency detected involving "${cycleAtom}"`,
    });
  }

  // Rule: required atoms (game_loop and create_scene must exist)
  if (!atomNames.has("game_loop")) {
    failures.push({
      atom: "game_loop",
      rule: "required_atom",
      message: 'Missing required atom "game_loop"',
    });
  }
  if (!atomNames.has("create_scene")) {
    failures.push({
      atom: "create_scene",
      rule: "required_atom",
      message: 'Missing required atom "create_scene"',
    });
  }

  // Rule: score_tracker should have update_score output
  const scoreTracker = (atoms as AtomRow[]).find(
    (a) => a.name === "score_tracker",
  );
  if (scoreTracker) {
    const hasUpdateScore = (scoreTracker.outputs || []).some(
      (o) => o.name === "update_score",
    );
    if (!hasUpdateScore) {
      failures.push({
        atom: "score_tracker",
        rule: "score_tracker_output",
        message:
          'score_tracker should have an "update_score" output',
      });
    }
  }

  const report: ValidationReport = {
    passed: failures.length === 0,
    failures,
    atom_count: atoms.length,
    checked_at: new Date().toISOString(),
  };

  log("info", "structural validation complete", {
    gameId,
    passed: report.passed,
    failureCount: failures.length,
    atomCount: atoms.length,
  });

  return report;
}

// =============================================================================
// Cycle detection (DFS)
// =============================================================================

function detectCycle(adjacency: Map<string, string[]>): string | null {
  const WHITE = 0; // unvisited
  const GRAY = 1; // in progress
  const BLACK = 2; // finished

  const color = new Map<string, number>();
  for (const node of adjacency.keys()) {
    color.set(node, WHITE);
  }

  for (const node of adjacency.keys()) {
    if (color.get(node) === WHITE) {
      const cycleNode = dfs(node, adjacency, color);
      if (cycleNode) return cycleNode;
    }
  }

  return null;
}

function dfs(
  node: string,
  adjacency: Map<string, string[]>,
  color: Map<string, number>,
): string | null {
  color.set(node, 1); // GRAY
  for (const neighbor of adjacency.get(node) || []) {
    const c = color.get(neighbor) ?? 0;
    if (c === 1) return neighbor; // back edge → cycle
    if (c === 0) {
      const result = dfs(neighbor, adjacency, color);
      if (result) return result;
    }
  }
  color.set(node, 2); // BLACK
  return null;
}
