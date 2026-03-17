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

export type ValidationSeverity = "error" | "warning";

export interface ValidationFailure {
  atom: string;
  rule: string;
  message: string;
  severity?: ValidationSeverity;
  fix_hint?: string;
}

export interface ValidationReport {
  passed: boolean;
  failures: ValidationFailure[];
  atom_count: number;
  checked_at: string;
  summary?: { error_count: number; warning_count: number };
}

const MAX_ATOM_SIZE = 2048;
const MAX_TOTAL_CODE_SIZE = 40_000;
const ABSOLUTE_MAX_ATOMS = 30;
const SNAKE_CASE_RE = /^[a-z][a-z0-9]*(_[a-z0-9]+)*$/;
const SCORE_POST_RE = /window\s*\.\s*parent\s*\.\s*postMessage\s*\(\s*\{[^}]*type\s*:\s*["']SCORE_UPDATE["'][^}]*score\s*:/s;
const PHASER_AUTO_RE = /\bPhaser\s*\.\s*AUTO\b/;
const PHASER_DIRECT_LOAD_RE =
  /\b(?:this|scene)\s*\.\s*load\s*\.\s*(?:image|spritesheet|atlas|atlasjsonhash|atlasjsonarray)\s*\(/i;
const DIRECT_ASSET_PATH_RE =
  /(?:assets\/[^\s"'`]+\.(?:png|jpg|jpeg|gif|webp|json)|https?:\/\/[^\s"'`]+\.(?:png|jpg|jpeg|gif|webp|json))/i;
const SCRIPT_INJECTION_RE = /document\s*\.\s*createElement\s*\(\s*["']script["']\s*\)/;
const LOCKDOWN_RE = /lockdown-install\.js|lockdown\s*\(|\bCompartment\b|\bharden\s*\(/;
const PRIMITIVE_TYPES = new Set([
  "number",
  "string",
  "boolean",
  "number[]",
  "string[]",
  "boolean[]",
  "void",
  "array",
  "null",
  "undefined",
]);

export function validateStructuralRules(
  atoms: ValidationAtom[],
  dependencies: ValidationDependency[],
): ValidationReport {
  const failures: ValidationFailure[] = [];

  // Duplicate atom name detection
  const nameCount = new Map<string, number>();
  for (const atom of atoms) {
    nameCount.set(atom.name, (nameCount.get(atom.name) ?? 0) + 1);
  }
  for (const [name, count] of nameCount) {
    if (count > 1) {
      failures.push({
        atom: name,
        rule: "duplicate_atom_name",
        message: `Atom "${name}" appears ${count} times`,
        severity: "error",
        fix_hint: `Remove duplicate definitions of "${name}" — each atom name must be unique.`,
      });
    }
  }

  const atomNames = new Set(atoms.map((atom) => atom.name));
  const adjacency = buildAdjacency(dependencies);

  for (const atom of atoms) {
    const codeSize = new TextEncoder().encode(atom.code).byteLength;
    if (codeSize > MAX_ATOM_SIZE) {
      failures.push({
        atom: atom.name,
        rule: "size_limit",
        message: `Code is ${codeSize} bytes (max ${MAX_ATOM_SIZE})`,
        severity: "warning",
        fix_hint: "Split into smaller atoms. Extract helper logic into a new util atom.",
      });
    }

    if (!SNAKE_CASE_RE.test(atom.name)) {
      failures.push({
        atom: atom.name,
        rule: "snake_case",
        message: `Name "${atom.name}" is not valid snake_case`,
        severity: "warning",
        fix_hint: `Rename to a valid snake_case name (e.g., lowercase with underscores).`,
      });
    }

    for (const port of atom.inputs || []) {
      if (!isPrimitiveType(port.type)) {
        failures.push({
          atom: atom.name,
          rule: "primitive_interface",
          message: `Input "${port.name}" has non-primitive type "${port.type}"`,
          severity: "warning",
          fix_hint: `Change type to a primitive: number, string, boolean, number[], string[], boolean[], void.`,
        });
      }
    }

    for (const port of atom.outputs || []) {
      if (!isPrimitiveType(port.type)) {
        failures.push({
          atom: atom.name,
          rule: "primitive_interface",
          message: `Output "${port.name}" has non-primitive type "${port.type}"`,
          severity: "warning",
          fix_hint: `Change type to a primitive: number, string, boolean, number[], string[], boolean[], void.`,
        });
      }
    }

    if (!["core", "feature", "util"].includes(atom.type)) {
      failures.push({
        atom: atom.name,
        rule: "valid_type",
        message: `Type "${atom.type}" is not one of: core, feature, util`,
        severity: "warning",
        fix_hint: `Set atom type to one of: core, feature, util.`,
      });
    }

    for (const dep of adjacency.get(atom.name) || []) {
      if (!atomNames.has(dep)) {
        failures.push({
          atom: atom.name,
          rule: "dependency_exists",
          message: `Depends on "${dep}" which does not exist`,
          severity: "error",
          fix_hint: `Create atom "${dep}" or remove it from depends_on.`,
        });
      }
    }
  }

  // Total code size check
  const totalCodeSize = atoms.reduce(
    (sum, a) => sum + new TextEncoder().encode(a.code).byteLength, 0,
  );
  if (totalCodeSize > MAX_TOTAL_CODE_SIZE) {
    failures.push({
      atom: "_pipeline",
      rule: "total_code_size",
      message: `Total code size ${totalCodeSize} bytes exceeds ${MAX_TOTAL_CODE_SIZE} byte limit`,
      severity: "warning",
      fix_hint: "Reduce atom code sizes. Extract shared logic into smaller util atoms.",
    });
  }
  if (atoms.length > ABSOLUTE_MAX_ATOMS) {
    failures.push({
      atom: "_pipeline",
      rule: "max_atom_count",
      message: `${atoms.length} atoms exceeds hard cap of ${ABSOLUTE_MAX_ATOMS}`,
      severity: "warning",
      fix_hint: "Consolidate related atoms to reduce total count.",
    });
  }

  const cyclePath = detectCycle(adjacency);
  if (cyclePath) {
    failures.push({
      atom: cyclePath[0],
      rule: "no_cycles",
      message: `Circular dependency: ${cyclePath.join(" → ")}`,
      severity: "error",
      fix_hint: `Break the cycle by removing a dependency edge or introducing a mediator atom.`,
    });
  }

  if (!atomNames.has("game_loop")) {
    failures.push({
      atom: "game_loop",
      rule: "required_atom",
      message: 'Missing required atom "game_loop"',
      severity: "error",
      fix_hint: 'Create a "game_loop" core atom that drives the main game tick.',
    });
  }

  if (!atomNames.has("create_scene")) {
    failures.push({
      atom: "create_scene",
      rule: "required_atom",
      message: 'Missing required atom "create_scene"',
      severity: "error",
      fix_hint: 'Create a "create_scene" core atom that initializes the game scene.',
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
      severity: "error",
      fix_hint: 'Create a "score_tracker" feature atom that tracks and reports the game score.',
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
      severity: "error",
      fix_hint: 'Add output { name: "score", type: "number" } to score_tracker.',
    });
  }

  const code = scoreTracker.code || "";
  if (!SCORE_POST_RE.test(code)) {
    failures.push({
      atom: "score_tracker",
      rule: "score_update_postmessage",
      message:
        'score_tracker must emit window.parent.postMessage({ type: "SCORE_UPDATE", score: ... })',
      severity: "error",
      fix_hint: 'Add: window.parent.postMessage({ type: "SCORE_UPDATE", score: currentScore })',
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
      severity: "warning",
      fix_hint: "Add score_tracker as a dependency of game_loop or a feature atom.",
    });
  }

  return buildReport(atoms.length, failures);
}

export interface ValidationSpecs {
  required_atoms: string[];
  interface_contracts: { atom_name: string; expected_inputs: { name: string; type: string }[]; expected_outputs: { name: string; type: string }[] }[];
  score_event_specs: { event_name: string; trigger_atom: string; description: string }[];
  expected_dependencies: Record<string, string[]>;
  complexity_bounds: {
    min_atoms: number;
    max_atoms: number;
    required_types: { core: number; feature: number; util: number };
  };
  genre_rules: { rule_id: string; description: string; check_type: string; target_atom: string; expected_value?: string }[];
}

export function validateGameSpecificRules(
  atoms: ValidationAtom[],
  dependencies: ValidationDependency[],
  specs: ValidationSpecs,
): ValidationReport {
  const failures: ValidationFailure[] = [];
  const atomNames = new Set(atoms.map((a) => a.name));
  const atomByName = new Map(atoms.map((a) => [a.name, a]));
  const adjacency = buildAdjacency(dependencies);

  // 1. Required atoms — every planned atom must exist
  for (const requiredName of specs.required_atoms) {
    if (!atomNames.has(requiredName)) {
      failures.push({
        atom: requiredName,
        rule: "scope_required_atom",
        message: `Planned atom "${requiredName}" was not built`,
        severity: "error",
        fix_hint: `Create atom "${requiredName}" as specified in the scope.`,
      });
    }
  }

  // 2. Interface contracts — inputs/outputs must match plan
  for (const contract of specs.interface_contracts) {
    const atom = atomByName.get(contract.atom_name);
    if (!atom) continue; // already caught by required_atoms

    for (const expectedInput of contract.expected_inputs) {
      const actual = (atom.inputs || []).find((i) => i.name === expectedInput.name);
      if (!actual) {
        failures.push({
          atom: contract.atom_name,
          rule: "interface_contract_input",
          message: `Missing planned input "${expectedInput.name}" (${expectedInput.type})`,
          severity: "error",
          fix_hint: `Add input { name: "${expectedInput.name}", type: "${expectedInput.type}" }.`,
        });
      } else if (normalizeType(actual.type) !== normalizeType(expectedInput.type)) {
        failures.push({
          atom: contract.atom_name,
          rule: "interface_contract_type",
          message: `Input "${expectedInput.name}" type mismatch: expected "${expectedInput.type}", got "${actual.type}"`,
          severity: "error",
          fix_hint: `Change input "${expectedInput.name}" type from "${actual.type}" to "${expectedInput.type}".`,
        });
      }
    }

    for (const expectedOutput of contract.expected_outputs) {
      const actual = (atom.outputs || []).find((o) => o.name === expectedOutput.name);
      if (!actual) {
        failures.push({
          atom: contract.atom_name,
          rule: "interface_contract_output",
          message: `Missing planned output "${expectedOutput.name}" (${expectedOutput.type})`,
          severity: "error",
          fix_hint: `Add output { name: "${expectedOutput.name}", type: "${expectedOutput.type}" }.`,
        });
      } else if (normalizeType(actual.type) !== normalizeType(expectedOutput.type)) {
        failures.push({
          atom: contract.atom_name,
          rule: "interface_contract_type",
          message: `Output "${expectedOutput.name}" type mismatch: expected "${expectedOutput.type}", got "${actual.type}"`,
          severity: "error",
          fix_hint: `Change output "${expectedOutput.name}" type from "${actual.type}" to "${expectedOutput.type}".`,
        });
      }
    }
  }

  // 3. Dependency graph — planned edges must exist
  for (const [atomName, expectedDeps] of Object.entries(specs.expected_dependencies)) {
    const actualDeps = adjacency.get(atomName) || [];
    for (const expectedDep of expectedDeps) {
      if (!actualDeps.includes(expectedDep)) {
        failures.push({
          atom: atomName,
          rule: "expected_dependency",
          message: `Planned dependency on "${expectedDep}" is missing`,
          severity: "error",
          fix_hint: `Add "${expectedDep}" to ${atomName}'s depends_on list.`,
        });
      }
    }
  }

  // 4. Complexity bounds
  if (atoms.length < specs.complexity_bounds.min_atoms) {
    failures.push({
      atom: "_pipeline",
      rule: "complexity_min_atoms",
      message: `Only ${atoms.length} atoms built, expected at least ${specs.complexity_bounds.min_atoms}`,
      severity: "warning",
      fix_hint: "Implement additional planned atoms to meet the minimum count.",
    });
  }
  if (atoms.length > specs.complexity_bounds.max_atoms) {
    failures.push({
      atom: "_pipeline",
      rule: "complexity_max_atoms",
      message: `${atoms.length} atoms exceeds maximum of ${specs.complexity_bounds.max_atoms}`,
      severity: "warning",
      fix_hint: "Consolidate atoms to reduce total count below the maximum.",
    });
  }

  const typeCounts = { core: 0, feature: 0, util: 0 };
  for (const atom of atoms) {
    if (atom.type in typeCounts) typeCounts[atom.type as keyof typeof typeCounts]++;
  }
  for (const [type, min] of Object.entries(specs.complexity_bounds.required_types)) {
    if ((typeCounts[type as keyof typeof typeCounts] || 0) < min) {
      failures.push({
        atom: "_pipeline",
        rule: `complexity_${type}_count`,
        message: `Only ${typeCounts[type as keyof typeof typeCounts] || 0} ${type} atoms, expected at least ${min}`,
        severity: "warning",
        fix_hint: `Create more ${type}-type atoms to meet the required count of ${min}.`,
      });
    }
  }

  // 5. Genre-specific rules
  for (const rule of specs.genre_rules) {
    const genreFailure = (msg?: string) => ({
      atom: rule.target_atom,
      rule: rule.rule_id,
      message: msg || rule.description,
      severity: "warning" as ValidationSeverity,
      fix_hint: rule.description,
    });

    switch (rule.check_type) {
      case "atom_exists":
        if (!atomNames.has(rule.target_atom)) {
          failures.push(genreFailure());
        }
        break;
      case "atom_has_input": {
        const atom = atomByName.get(rule.target_atom);
        if (atom && !(atom.inputs || []).some((i) => i.name === rule.expected_value)) {
          failures.push(genreFailure());
        }
        break;
      }
      case "atom_has_output": {
        const atom = atomByName.get(rule.target_atom);
        if (atom && !(atom.outputs || []).some((o) => o.name === rule.expected_value)) {
          failures.push(genreFailure());
        }
        break;
      }
      case "atom_depends_on": {
        const deps = adjacency.get(rule.target_atom) || [];
        if (rule.expected_value && !deps.includes(rule.expected_value)) {
          failures.push(genreFailure());
        }
        break;
      }
      case "atom_code_contains": {
        const atom = atomByName.get(rule.target_atom);
        if (atom && rule.expected_value && !atom.code.includes(rule.expected_value)) {
          failures.push(genreFailure());
        }
        break;
      }
      case "atom_type_is": {
        const atom = atomByName.get(rule.target_atom);
        if (atom && rule.expected_value && atom.type !== rule.expected_value) {
          failures.push(genreFailure(`Atom "${rule.target_atom}" should be type "${rule.expected_value}", got "${atom.type}"`));
        }
        break;
      }
      case "atom_output_type_is": {
        const atom = atomByName.get(rule.target_atom);
        if (atom && rule.expected_value) {
          const [outputName, expectedType] = rule.expected_value.split(":");
          const output = (atom.outputs || []).find((o) => o.name === outputName);
          if (output && expectedType && normalizeType(output.type) !== normalizeType(expectedType)) {
            failures.push(genreFailure(`Output "${outputName}" should be type "${expectedType}", got "${output.type}"`));
          }
        }
        break;
      }
      case "atom_code_matches_regex": {
        const atom = atomByName.get(rule.target_atom);
        if (atom && rule.expected_value) {
          try {
            const re = new RegExp(rule.expected_value);
            if (!re.test(atom.code)) {
              failures.push(genreFailure());
            }
          } catch {
            // Invalid regex — skip
          }
        }
        break;
      }
    }
  }

  // 6. Score event specs — verify trigger atoms exist
  for (const spec of specs.score_event_specs) {
    if (!atomNames.has(spec.trigger_atom)) {
      failures.push({
        atom: spec.trigger_atom,
        rule: "score_event_trigger_missing",
        message: `Score event "${spec.event_name}" trigger atom "${spec.trigger_atom}" does not exist`,
        severity: "warning",
        fix_hint: `Create atom "${spec.trigger_atom}" to trigger the "${spec.event_name}" score event.`,
      });
    }
  }

  return buildReport(atoms.length, failures);
}

export function validateInterfaceCompatibility(
  atoms: ValidationAtom[],
  dependencies: ValidationDependency[],
): ValidationReport {
  const failures: ValidationFailure[] = [];
  const atomByName = new Map(atoms.map((a) => [a.name, a]));

  for (const dep of dependencies) {
    const consumer = atomByName.get(dep.atom_name);
    const provider = atomByName.get(dep.depends_on);
    if (!consumer || !provider) continue;

    for (const input of consumer.inputs || []) {
      const matchingOutput = (provider.outputs || []).find(
        (o) => o.name === input.name,
      );
      if (matchingOutput && normalizeType(input.type) !== normalizeType(matchingOutput.type)) {
        failures.push({
          atom: dep.atom_name,
          rule: "interface_compatibility",
          message: `Input "${input.name}" expects type "${input.type}" but provider "${dep.depends_on}" outputs type "${matchingOutput.type}"`,
          severity: "error",
          fix_hint: `Change ${dep.depends_on}'s output "${input.name}" to type "${input.type}", or change ${dep.atom_name}'s input to type "${matchingOutput.type}".`,
        });
      }
    }
  }

  return buildReport(atoms.length, failures);
}

export function validateReachability(
  atoms: ValidationAtom[],
  dependencies: ValidationDependency[],
): ValidationReport {
  const failures: ValidationFailure[] = [];
  if (atoms.length === 0) return buildReport(0, failures);

  // Build forward dependency graph: atom -> atoms it depends on
  const adjacency = buildAdjacency(dependencies);

  // BFS from entry points through dependency chains
  const reachable = new Set<string>();
  const entryPoints = ["game_loop", "create_scene"];
  const queue: string[] = [];

  for (const entry of entryPoints) {
    if (!reachable.has(entry)) {
      reachable.add(entry);
      queue.push(entry);
    }
  }

  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const dep of adjacency.get(current) || []) {
      if (!reachable.has(dep)) {
        reachable.add(dep);
        queue.push(dep);
      }
    }
  }

  // Also build reverse adjacency: atom -> atoms that depend on it
  const reverseAdj = new Map<string, string[]>();
  for (const dep of dependencies) {
    const list = reverseAdj.get(dep.depends_on) || [];
    list.push(dep.atom_name);
    reverseAdj.set(dep.depends_on, list);
  }

  // BFS reverse from entry points too (atoms that depend on entry points)
  const reverseQueue = [...entryPoints];
  for (const entry of entryPoints) reachable.add(entry);

  while (reverseQueue.length > 0) {
    const current = reverseQueue.shift()!;
    for (const dependent of reverseAdj.get(current) || []) {
      if (!reachable.has(dependent)) {
        reachable.add(dependent);
        reverseQueue.push(dependent);
      }
    }
  }

  // score_tracker is always considered reachable
  reachable.add("score_tracker");

  for (const atom of atoms) {
    if (!reachable.has(atom.name)) {
      failures.push({
        atom: atom.name,
        rule: "unreachable_atom",
        message: `Atom "${atom.name}" is not reachable from game_loop or create_scene`,
        severity: "warning",
        fix_hint: `Add "${atom.name}" as a dependency of a core or feature atom, or remove it if unused.`,
      });
    }
  }

  return buildReport(atoms.length, failures);
}

export function validateCodeQuality(
  atoms: ValidationAtom[],
): ValidationReport {
  const failures: ValidationFailure[] = [];

  for (const atom of atoms) {
    const code = atom.code || "";

    // Strip single-line and multi-line comments, then whitespace
    const stripped = code
      .replace(/\/\/.*$/gm, "")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\s+/g, "");

    if (stripped.length < 50) {
      failures.push({
        atom: atom.name,
        rule: "empty_atom",
        message: `Atom code is effectively empty (${stripped.length} chars after stripping)`,
        severity: "warning",
        fix_hint: "Implement the atom's logic as described in its description.",
      });
    }

    if (PHASER_AUTO_RE.test(code)) {
      failures.push({
        atom: atom.name,
        rule: "phaser_explicit_render_type",
        message: "Phaser atoms must use an explicit render type. Phaser.AUTO breaks in Atomic's custom iframe runtime.",
        severity: "error",
        fix_hint: "Set `type: Phaser.CANVAS` (or another explicit Phaser render type) instead of `Phaser.AUTO`.",
      });
    }

    if (PHASER_DIRECT_LOAD_RE.test(code) && DIRECT_ASSET_PATH_RE.test(code) && !/\bPIXEL_ASSETS\b/.test(code)) {
      failures.push({
        atom: atom.name,
        rule: "phaser_pixel_assets_required",
        message: "2D Phaser atoms must load runtime art through window.PIXEL_ASSETS instead of direct asset paths.",
        severity: "error",
        fix_hint:
          "Replace direct this.load.image/spritesheet/atlas calls that use assets/*.png or raw URLs with PIXEL_ASSETS.preloadPhaser(...) and PIXEL_ASSETS.createPhaserAnimations(...).",
      });
    }

    if (SCRIPT_INJECTION_RE.test(code)) {
      failures.push({
        atom: atom.name,
        rule: "runtime_script_injection",
        message: "Atoms must not inject `<script>` tags at runtime. External libraries are loaded by the platform.",
        severity: "error",
        fix_hint: "Remove runtime script loading and use installed externals from `window.*` globals instead.",
      });
    }

    if (LOCKDOWN_RE.test(code)) {
      failures.push({
        atom: atom.name,
        rule: "runtime_lockdown_forbidden",
        message: "SES/lockdown bootstraps are not allowed in game atoms and will break the browser runtime.",
        severity: "error",
        fix_hint: "Remove `lockdown`, `Compartment`, `harden`, and any `lockdown-install.js` references from atom code.",
      });
    }

    // Check for unused inputs — input name not referenced in code
    for (const input of atom.inputs || []) {
      if (!code.includes(input.name)) {
        failures.push({
          atom: atom.name,
          rule: "unused_input",
          message: `Declared input "${input.name}" is never referenced in code`,
          severity: "warning",
          fix_hint: `Use the "${input.name}" input in the atom's logic or remove it from inputs.`,
        });
      }
    }
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

export function normalizeType(type: string): string {
  let t = type.trim().toLowerCase();
  const arrayMatch = t.match(/^array\s*<\s*(.+)\s*>$/);
  if (arrayMatch) {
    t = `${arrayMatch[1].trim()}[]`;
  }
  return t;
}

function buildReport(
  atomCount: number,
  failures: ValidationFailure[],
): ValidationReport {
  const error_count = failures.filter((f) => f.severity !== "warning").length;
  const warning_count = failures.filter((f) => f.severity === "warning").length;
  return {
    passed: error_count === 0,
    failures,
    atom_count: atomCount,
    checked_at: new Date().toISOString(),
    summary: { error_count, warning_count },
  };
}

function detectCycle(adjacency: Map<string, string[]>): string[] | null {
  // 0 = white (unvisited), 1 = gray (in current path), 2 = black (done)
  const color = new Map<string, number>();
  const parent = new Map<string, string | null>();

  for (const node of adjacency.keys()) {
    color.set(node, 0);
  }

  for (const node of adjacency.keys()) {
    if ((color.get(node) ?? 0) === 0) {
      const cyclePath = dfsCycle(node, adjacency, color, parent);
      if (cyclePath) return cyclePath;
    }
  }

  return null;
}

function dfsCycle(
  node: string,
  adjacency: Map<string, string[]>,
  color: Map<string, number>,
  parent: Map<string, string | null>,
): string[] | null {
  color.set(node, 1);

  for (const neighbor of adjacency.get(node) || []) {
    const currentColor = color.get(neighbor) ?? 0;
    if (currentColor === 1) {
      // Back edge found — reconstruct cycle path
      const path: string[] = [neighbor, node];
      let current = node;
      while (current !== neighbor) {
        const p = parent.get(current);
        if (!p || p === neighbor) break;
        path.push(p);
        current = p;
      }
      path.reverse();
      path.push(neighbor); // close the cycle
      return path;
    }
    if (currentColor === 0) {
      parent.set(neighbor, node);
      const cyclePath = dfsCycle(neighbor, adjacency, color, parent);
      if (cyclePath) return cyclePath;
    }
  }

  color.set(node, 2);
  return null;
}
