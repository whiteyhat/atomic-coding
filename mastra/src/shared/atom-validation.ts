export interface ValidationPort {
  name: string;
  type: string;
}

export interface ValidationAtom {
  name: string;
  type: string;
  code: string;
  description: string | null;
  inputs: ValidationPort[];
  outputs: ValidationPort[];
}

export interface ValidationDependency {
  atom_name: string;
  depends_on: string;
}

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

const MAX_ATOM_SIZE = 2048;
const SNAKE_CASE_RE = /^[a-z][a-z0-9]*(_[a-z0-9]+)*$/;
const PRIMITIVE_TYPES = new Set([
  "number",
  "string",
  "boolean",
  "number[]",
  "string[]",
  "boolean[]",
  "void",
  "object",
  "array",
  "any",
  "null",
  "undefined",
]);

export function validateStructuralRules(
  atoms: ValidationAtom[],
  dependencies: ValidationDependency[],
): ValidationReport {
  const failures: ValidationFailure[] = [];
  const atomNames = new Set(atoms.map((atom) => atom.name));
  const adjacency = buildAdjacency(dependencies);

  for (const atom of atoms) {
    const codeSize = new TextEncoder().encode(atom.code).byteLength;
    if (codeSize > MAX_ATOM_SIZE) {
      failures.push({
        atom: atom.name,
        rule: "size_limit",
        message: `Code is ${codeSize} bytes (max ${MAX_ATOM_SIZE})`,
      });
    }

    if (!SNAKE_CASE_RE.test(atom.name)) {
      failures.push({
        atom: atom.name,
        rule: "snake_case",
        message: `Name "${atom.name}" is not valid snake_case`,
      });
    }

    for (const port of atom.inputs || []) {
      if (!isPrimitiveType(port.type)) {
        failures.push({
          atom: atom.name,
          rule: "primitive_interface",
          message: `Input "${port.name}" has non-primitive type "${port.type}"`,
        });
      }
    }

    for (const port of atom.outputs || []) {
      if (!isPrimitiveType(port.type)) {
        failures.push({
          atom: atom.name,
          rule: "primitive_interface",
          message: `Output "${port.name}" has non-primitive type "${port.type}"`,
        });
      }
    }

    if (!["core", "feature", "util"].includes(atom.type)) {
      failures.push({
        atom: atom.name,
        rule: "valid_type",
        message: `Type "${atom.type}" is not one of: core, feature, util`,
      });
    }

    for (const dep of adjacency.get(atom.name) || []) {
      if (!atomNames.has(dep)) {
        failures.push({
          atom: atom.name,
          rule: "dependency_exists",
          message: `Depends on "${dep}" which does not exist`,
        });
      }
    }
  }

  const cycleAtom = detectCycle(adjacency);
  if (cycleAtom) {
    failures.push({
      atom: cycleAtom,
      rule: "no_cycles",
      message: `Circular dependency detected involving "${cycleAtom}"`,
    });
  }

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

  return buildReport(atoms.length, failures);
}

export function validateScoreSystemRules(
  atoms: ValidationAtom[],
  dependencies: ValidationDependency[],
): ValidationReport {
  const failures: ValidationFailure[] = [];
  const atomByName = new Map(atoms.map((atom) => [atom.name, atom]));
  const scoreTracker = atomByName.get("score_tracker");

  if (!scoreTracker) {
    failures.push({
      atom: "score_tracker",
      rule: "required_score_tracker",
      message: 'Missing required score atom "score_tracker"',
    });
    return buildReport(atoms.length, failures);
  }

  const hasScoreOutput = (scoreTracker.outputs || []).some(
    (output) => output.name === "score" && normalizeType(output.type) === "number",
  );

  if (!hasScoreOutput) {
    failures.push({
      atom: "score_tracker",
      rule: "score_output_contract",
      message: 'score_tracker must expose a numeric "score" output',
    });
  }

  const code = scoreTracker.code || "";
  const postsToParent = /window\s*\.\s*parent\s*\.\s*postMessage\s*\(/.test(code);
  const emitsScoreUpdate = /type\s*:\s*["']SCORE_UPDATE["']/.test(code);
  const emitsScoreField = /score\s*:/.test(code);

  if (!postsToParent || !emitsScoreUpdate || !emitsScoreField) {
    failures.push({
      atom: "score_tracker",
      rule: "score_update_postmessage",
      message:
        'score_tracker must emit window.parent.postMessage({ type: "SCORE_UPDATE", score: ... })',
    });
  }

  const wiredConsumers = dependencies
    .filter((dep) => dep.depends_on === "score_tracker")
    .map((dep) => atomByName.get(dep.atom_name))
    .filter((atom): atom is ValidationAtom => Boolean(atom))
    .filter((atom) => atom.type === "core" || atom.type === "feature");

  if (wiredConsumers.length === 0) {
    failures.push({
      atom: "score_tracker",
      rule: "score_tracker_wired",
      message:
        "score_tracker must be referenced by at least one core or feature atom",
    });
  }

  return buildReport(atoms.length, failures);
}

export function mergeValidationReports(
  ...reports: ValidationReport[]
): ValidationReport {
  const failures: ValidationFailure[] = [];
  const seen = new Set<string>();
  let atomCount = 0;

  for (const report of reports) {
    atomCount = Math.max(atomCount, report.atom_count);
    for (const failure of report.failures) {
      const key = `${failure.atom}:${failure.rule}:${failure.message}`;
      if (seen.has(key)) continue;
      seen.add(key);
      failures.push(failure);
    }
  }

  return buildReport(atomCount, failures);
}

function buildAdjacency(
  dependencies: ValidationDependency[],
): Map<string, string[]> {
  const adjacency = new Map<string, string[]>();

  for (const dependency of dependencies) {
    const list = adjacency.get(dependency.atom_name) || [];
    list.push(dependency.depends_on);
    adjacency.set(dependency.atom_name, list);
  }

  return adjacency;
}

function isPrimitiveType(type: string): boolean {
  return PRIMITIVE_TYPES.has(normalizeType(type));
}

function normalizeType(type: string): string {
  return type.trim().toLowerCase();
}

function buildReport(
  atomCount: number,
  failures: ValidationFailure[],
): ValidationReport {
  return {
    passed: failures.length === 0,
    failures,
    atom_count: atomCount,
    checked_at: new Date().toISOString(),
  };
}

function detectCycle(adjacency: Map<string, string[]>): string | null {
  const color = new Map<string, number>();

  for (const node of adjacency.keys()) {
    color.set(node, 0);
  }

  for (const node of adjacency.keys()) {
    if ((color.get(node) ?? 0) === 0) {
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
  color.set(node, 1);

  for (const neighbor of adjacency.get(node) || []) {
    const currentColor = color.get(neighbor) ?? 0;
    if (currentColor === 1) return neighbor;
    if (currentColor === 0) {
      const cycleNode = dfs(neighbor, adjacency, color);
      if (cycleNode) return cycleNode;
    }
  }

  color.set(node, 2);
  return null;
}
