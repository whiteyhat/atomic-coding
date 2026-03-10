import { describe, it, expect } from "vitest";
import {
  validateStructuralRules,
  validateScoreSystemRules,
  validateGameSpecificRules,
  validateInterfaceCompatibility,
  validateReachability,
  validateCodeQuality,
  mergeValidationReports,
  normalizeType,
  type ValidationAtom,
  type ValidationDependency,
  type ValidationSpecs,
} from "../atom-validation.js";

function makeAtom(overrides: Partial<ValidationAtom> & { name: string }): ValidationAtom {
  return {
    type: "core",
    code: "function run() { const x = 1; return x + 1; }",
    description: null,
    inputs: [],
    outputs: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// normalizeType
// ---------------------------------------------------------------------------
describe("normalizeType", () => {
  it("trims and lowercases", () => {
    expect(normalizeType("  Number  ")).toBe("number");
  });

  it("normalizes Array<T> to T[]", () => {
    expect(normalizeType("Array<number>")).toBe("number[]");
  });

  it("normalizes Array<string> to string[]", () => {
    expect(normalizeType("Array<string>")).toBe("string[]");
  });

  it("leaves already-normalized types unchanged", () => {
    expect(normalizeType("number[]")).toBe("number[]");
  });

  it("handles identity for simple types", () => {
    expect(normalizeType("boolean")).toBe("boolean");
  });
});

// ---------------------------------------------------------------------------
// validateStructuralRules
// ---------------------------------------------------------------------------
describe("validateStructuralRules", () => {
  const minimalAtoms: ValidationAtom[] = [
    makeAtom({ name: "game_loop" }),
    makeAtom({ name: "create_scene" }),
  ];

  it("passes with minimal valid atoms", () => {
    const report = validateStructuralRules(minimalAtoms, []);
    expect(report.passed).toBe(true);
    expect(report.failures).toHaveLength(0);
    expect(report.atom_count).toBe(2);
    expect(report.summary).toBeDefined();
    expect(report.summary!.error_count).toBe(0);
    expect(report.summary!.warning_count).toBe(0);
  });

  it("fails when game_loop is missing", () => {
    const atoms = [makeAtom({ name: "create_scene" })];
    const report = validateStructuralRules(atoms, []);
    expect(report.passed).toBe(false);
    expect(report.failures).toContainEqual(
      expect.objectContaining({ atom: "game_loop", rule: "required_atom", severity: "error" })
    );
  });

  it("fails when create_scene is missing", () => {
    const atoms = [makeAtom({ name: "game_loop" })];
    const report = validateStructuralRules(atoms, []);
    expect(report.passed).toBe(false);
    expect(report.failures).toContainEqual(
      expect.objectContaining({ atom: "create_scene", rule: "required_atom", severity: "error" })
    );
  });

  it("warns on non-snake_case names (does not block)", () => {
    const atoms = [
      ...minimalAtoms,
      makeAtom({ name: "myBadName" }),
    ];
    const report = validateStructuralRules(atoms, []);
    expect(report.passed).toBe(true); // warning-only, does not block
    expect(report.failures).toContainEqual(
      expect.objectContaining({ atom: "myBadName", rule: "snake_case", severity: "warning" })
    );
  });

  it("warns on code exceeding 2048 bytes (does not block)", () => {
    const atoms = [
      ...minimalAtoms,
      makeAtom({ name: "big_atom", code: "x".repeat(2049) }),
    ];
    const report = validateStructuralRules(atoms, []);
    expect(report.passed).toBe(true); // warning-only
    expect(report.failures).toContainEqual(
      expect.objectContaining({ atom: "big_atom", rule: "size_limit", severity: "warning" })
    );
  });

  it("warns on non-primitive port types (does not block)", () => {
    const atoms = [
      ...minimalAtoms,
      makeAtom({
        name: "typed_atom",
        inputs: [{ name: "data", type: "CustomType" }],
      }),
    ];
    const report = validateStructuralRules(atoms, []);
    expect(report.passed).toBe(true); // warning-only
    expect(report.failures).toContainEqual(
      expect.objectContaining({ rule: "primitive_interface", severity: "warning" })
    );
  });

  it("accepts primitive types (number, string, boolean, etc.)", () => {
    const atoms = [
      ...minimalAtoms,
      makeAtom({
        name: "typed_atom",
        inputs: [{ name: "x", type: "number" }],
        outputs: [{ name: "y", type: "string" }],
      }),
    ];
    const report = validateStructuralRules(atoms, []);
    expect(report.passed).toBe(true);
  });

  it("warns on object[] and any[] as non-primitive types", () => {
    const atoms = [
      ...minimalAtoms,
      makeAtom({
        name: "array_atom",
        inputs: [{ name: "items", type: "object[]" }],
        outputs: [{ name: "results", type: "any[]" }],
      }),
    ];
    const report = validateStructuralRules(atoms, []);
    expect(report.passed).toBe(true); // warnings don't block
    expect(report.failures.filter((f) => f.rule === "primitive_interface")).toHaveLength(2);
  });

  it("warns on invalid atom types (does not block)", () => {
    const atoms = [
      ...minimalAtoms,
      makeAtom({ name: "bad_type", type: "widget" }),
    ];
    const report = validateStructuralRules(atoms, []);
    expect(report.passed).toBe(true); // warning-only
    expect(report.failures).toContainEqual(
      expect.objectContaining({ rule: "valid_type", severity: "warning" })
    );
  });

  it("fails on missing dependency target (error)", () => {
    const deps: ValidationDependency[] = [
      { atom_name: "game_loop", depends_on: "nonexistent" },
    ];
    const report = validateStructuralRules(minimalAtoms, deps);
    expect(report.passed).toBe(false);
    expect(report.failures).toContainEqual(
      expect.objectContaining({ rule: "dependency_exists", severity: "error" })
    );
  });

  it("fails on circular dependencies (error)", () => {
    const atoms = [
      ...minimalAtoms,
      makeAtom({ name: "alpha" }),
      makeAtom({ name: "beta" }),
    ];
    const deps: ValidationDependency[] = [
      { atom_name: "alpha", depends_on: "beta" },
      { atom_name: "beta", depends_on: "alpha" },
    ];
    const report = validateStructuralRules(atoms, deps);
    expect(report.passed).toBe(false);
    expect(report.failures).toContainEqual(
      expect.objectContaining({ rule: "no_cycles", severity: "error" })
    );
  });

  it("includes fix_hint on all failures", () => {
    const atoms = [makeAtom({ name: "game_loop" })]; // missing create_scene
    const report = validateStructuralRules(atoms, []);
    for (const f of report.failures) {
      expect(f.fix_hint).toBeDefined();
      expect(f.fix_hint!.length).toBeGreaterThan(0);
    }
  });

  it("warns when total code size exceeds 40KB", () => {
    const atoms = [
      ...minimalAtoms,
      ...Array.from({ length: 25 }, (_, i) =>
        makeAtom({ name: `atom_${i}`, code: "x".repeat(1800) })
      ),
    ];
    const report = validateStructuralRules(atoms, []);
    expect(report.failures).toContainEqual(
      expect.objectContaining({ rule: "total_code_size", severity: "warning" })
    );
  });

  it("warns when atom count exceeds hard cap of 30", () => {
    const atoms = [
      ...minimalAtoms,
      ...Array.from({ length: 30 }, (_, i) =>
        makeAtom({ name: `atom_${i}` })
      ),
    ];
    const report = validateStructuralRules(atoms, []);
    expect(report.failures).toContainEqual(
      expect.objectContaining({ rule: "max_atom_count", severity: "warning" })
    );
  });
});

// ---------------------------------------------------------------------------
// validateScoreSystemRules
// ---------------------------------------------------------------------------
describe("validateScoreSystemRules", () => {
  const validScoreTracker = makeAtom({
    name: "score_tracker",
    type: "feature",
    outputs: [{ name: "score", type: "number" }],
    code: `
      function updateScore(points) {
        score += points;
        window.parent.postMessage({ type: "SCORE_UPDATE", score: score });
      }
    `,
  });

  it("passes with valid score_tracker wired to a consumer", () => {
    const atoms = [validScoreTracker, makeAtom({ name: "game_loop" })];
    const deps: ValidationDependency[] = [
      { atom_name: "game_loop", depends_on: "score_tracker" },
    ];
    const report = validateScoreSystemRules(atoms, deps);
    expect(report.passed).toBe(true);
  });

  it("fails when score_tracker is missing", () => {
    const report = validateScoreSystemRules([], []);
    expect(report.passed).toBe(false);
    expect(report.failures).toContainEqual(
      expect.objectContaining({ rule: "required_score_tracker", severity: "error" })
    );
  });

  it("fails when score output is missing", () => {
    const noOutput = makeAtom({
      name: "score_tracker",
      type: "feature",
      code: validScoreTracker.code,
    });
    const atoms = [noOutput, makeAtom({ name: "game_loop" })];
    const deps: ValidationDependency[] = [
      { atom_name: "game_loop", depends_on: "score_tracker" },
    ];
    const report = validateScoreSystemRules(atoms, deps);
    expect(report.passed).toBe(false);
    expect(report.failures).toContainEqual(
      expect.objectContaining({ rule: "score_output_contract", severity: "error" })
    );
  });

  it("fails when postMessage pattern is missing", () => {
    const noPostMessage = makeAtom({
      name: "score_tracker",
      type: "feature",
      outputs: [{ name: "score", type: "number" }],
      code: "function run() { return score; }",
    });
    const atoms = [noPostMessage, makeAtom({ name: "game_loop" })];
    const deps: ValidationDependency[] = [
      { atom_name: "game_loop", depends_on: "score_tracker" },
    ];
    const report = validateScoreSystemRules(atoms, deps);
    expect(report.passed).toBe(false);
    expect(report.failures).toContainEqual(
      expect.objectContaining({ rule: "score_update_postmessage", severity: "error" })
    );
  });

  it("warns when no core/feature atom depends on score_tracker", () => {
    const atoms = [validScoreTracker];
    const report = validateScoreSystemRules(atoms, []);
    // score_tracker_wired is a warning, so passed should be true
    expect(report.passed).toBe(true);
    expect(report.failures).toContainEqual(
      expect.objectContaining({ rule: "score_tracker_wired", severity: "warning" })
    );
  });

  it("includes fix_hint on all score failures", () => {
    const report = validateScoreSystemRules([], []);
    for (const f of report.failures) {
      expect(f.fix_hint).toBeDefined();
    }
  });
});

// ---------------------------------------------------------------------------
// validateInterfaceCompatibility
// ---------------------------------------------------------------------------
describe("validateInterfaceCompatibility", () => {
  it("passes when port types match between connected atoms", () => {
    const atoms = [
      makeAtom({ name: "provider", outputs: [{ name: "value", type: "number" }] }),
      makeAtom({ name: "consumer", inputs: [{ name: "value", type: "number" }] }),
    ];
    const deps: ValidationDependency[] = [
      { atom_name: "consumer", depends_on: "provider" },
    ];
    const report = validateInterfaceCompatibility(atoms, deps);
    expect(report.passed).toBe(true);
  });

  it("fails when port types mismatch between connected atoms", () => {
    const atoms = [
      makeAtom({ name: "provider", outputs: [{ name: "value", type: "string" }] }),
      makeAtom({ name: "consumer", inputs: [{ name: "value", type: "number" }] }),
    ];
    const deps: ValidationDependency[] = [
      { atom_name: "consumer", depends_on: "provider" },
    ];
    const report = validateInterfaceCompatibility(atoms, deps);
    expect(report.passed).toBe(false);
    expect(report.failures).toContainEqual(
      expect.objectContaining({ rule: "interface_compatibility", severity: "error" })
    );
  });

  it("passes when no port names overlap (no check needed)", () => {
    const atoms = [
      makeAtom({ name: "provider", outputs: [{ name: "x", type: "number" }] }),
      makeAtom({ name: "consumer", inputs: [{ name: "y", type: "string" }] }),
    ];
    const deps: ValidationDependency[] = [
      { atom_name: "consumer", depends_on: "provider" },
    ];
    const report = validateInterfaceCompatibility(atoms, deps);
    expect(report.passed).toBe(true);
  });

  it("handles Array<T> normalization in compatibility checks", () => {
    const atoms = [
      makeAtom({ name: "provider", outputs: [{ name: "items", type: "Array<number>" }] }),
      makeAtom({ name: "consumer", inputs: [{ name: "items", type: "number[]" }] }),
    ];
    const deps: ValidationDependency[] = [
      { atom_name: "consumer", depends_on: "provider" },
    ];
    const report = validateInterfaceCompatibility(atoms, deps);
    expect(report.passed).toBe(true);
  });

  it("includes fix_hint on compatibility failures", () => {
    const atoms = [
      makeAtom({ name: "provider", outputs: [{ name: "val", type: "boolean" }] }),
      makeAtom({ name: "consumer", inputs: [{ name: "val", type: "number" }] }),
    ];
    const deps: ValidationDependency[] = [
      { atom_name: "consumer", depends_on: "provider" },
    ];
    const report = validateInterfaceCompatibility(atoms, deps);
    expect(report.failures[0].fix_hint).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// validateReachability
// ---------------------------------------------------------------------------
describe("validateReachability", () => {
  it("passes when all atoms are reachable from entry points", () => {
    const atoms = [
      makeAtom({ name: "game_loop" }),
      makeAtom({ name: "create_scene" }),
      makeAtom({ name: "player_move", type: "feature" }),
    ];
    const deps: ValidationDependency[] = [
      { atom_name: "game_loop", depends_on: "player_move" },
    ];
    const report = validateReachability(atoms, deps);
    expect(report.passed).toBe(true);
  });

  it("warns on orphan atoms not reachable from entry points", () => {
    const atoms = [
      makeAtom({ name: "game_loop" }),
      makeAtom({ name: "create_scene" }),
      makeAtom({ name: "orphan_atom", type: "util" }),
    ];
    const report = validateReachability(atoms, []);
    expect(report.failures).toContainEqual(
      expect.objectContaining({ atom: "orphan_atom", rule: "unreachable_atom", severity: "warning" })
    );
  });

  it("score_tracker is always considered reachable", () => {
    const atoms = [
      makeAtom({ name: "game_loop" }),
      makeAtom({ name: "create_scene" }),
      makeAtom({ name: "score_tracker", type: "feature" }),
    ];
    const report = validateReachability(atoms, []);
    expect(report.failures.find((f) => f.atom === "score_tracker")).toBeUndefined();
  });

  it("detects disconnected subgraph as unreachable", () => {
    const atoms = [
      makeAtom({ name: "game_loop" }),
      makeAtom({ name: "create_scene" }),
      makeAtom({ name: "island_a", type: "util" }),
      makeAtom({ name: "island_b", type: "util" }),
    ];
    const deps: ValidationDependency[] = [
      { atom_name: "island_a", depends_on: "island_b" },
    ];
    const report = validateReachability(atoms, deps);
    const unreachable = report.failures.filter((f) => f.rule === "unreachable_atom");
    expect(unreachable).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// validateCodeQuality
// ---------------------------------------------------------------------------
describe("validateCodeQuality", () => {
  it("passes for atoms with substantial code", () => {
    const atoms = [
      makeAtom({ name: "good_atom", code: "function run(x) { const result = x * 2 + Math.random(); return result; }" }),
    ];
    const report = validateCodeQuality(atoms);
    expect(report.passed).toBe(true);
  });

  it("warns on empty/no-op atoms", () => {
    const atoms = [
      makeAtom({ name: "empty_atom", code: "function run() {}" }),
    ];
    const report = validateCodeQuality(atoms);
    expect(report.failures).toContainEqual(
      expect.objectContaining({ atom: "empty_atom", rule: "empty_atom", severity: "warning" })
    );
  });

  it("warns on unused inputs", () => {
    const atoms = [
      makeAtom({
        name: "unused_input_atom",
        code: "function run(velocity) { const result = velocity * 2 + Math.random(); return result + Date.now(); }",
        inputs: [{ name: "speed", type: "number" }],
      }),
    ];
    const report = validateCodeQuality(atoms);
    expect(report.failures).toContainEqual(
      expect.objectContaining({ atom: "unused_input_atom", rule: "unused_input", severity: "warning" })
    );
  });

  it("passes when inputs are referenced in code", () => {
    const atoms = [
      makeAtom({
        name: "used_input_atom",
        code: "function run(speed) { return speed * 2 + Math.floor(speed); }",
        inputs: [{ name: "speed", type: "number" }],
      }),
    ];
    const report = validateCodeQuality(atoms);
    expect(report.failures.filter((f) => f.rule === "unused_input")).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// mergeValidationReports
// ---------------------------------------------------------------------------
describe("mergeValidationReports", () => {
  it("merges multiple reports and deduplicates failures", () => {
    const r1 = {
      passed: false,
      failures: [{ atom: "a", rule: "r1", message: "msg" }],
      atom_count: 3,
      checked_at: new Date().toISOString(),
    };
    const r2 = {
      passed: false,
      failures: [
        { atom: "a", rule: "r1", message: "msg" }, // duplicate
        { atom: "b", rule: "r2", message: "other" },
      ],
      atom_count: 5,
      checked_at: new Date().toISOString(),
    };

    const merged = mergeValidationReports(r1, r2);
    expect(merged.failures).toHaveLength(2);
    expect(merged.atom_count).toBe(5);
    expect(merged.passed).toBe(false);
  });

  it("returns passed when no failures", () => {
    const r1 = {
      passed: true,
      failures: [],
      atom_count: 2,
      checked_at: new Date().toISOString(),
    };
    const merged = mergeValidationReports(r1);
    expect(merged.passed).toBe(true);
  });

  it("computes summary with error and warning counts", () => {
    const r1 = {
      passed: false,
      failures: [
        { atom: "a", rule: "r1", message: "err", severity: "error" as const },
        { atom: "b", rule: "r2", message: "warn", severity: "warning" as const },
      ],
      atom_count: 2,
      checked_at: new Date().toISOString(),
    };
    const merged = mergeValidationReports(r1);
    expect(merged.summary).toBeDefined();
    expect(merged.summary!.error_count).toBe(1);
    expect(merged.summary!.warning_count).toBe(1);
  });

  it("passed is true when only warnings exist (no errors)", () => {
    const r1 = {
      passed: true,
      failures: [
        { atom: "a", rule: "size_limit", message: "too big", severity: "warning" as const },
      ],
      atom_count: 1,
      checked_at: new Date().toISOString(),
    };
    const merged = mergeValidationReports(r1);
    expect(merged.passed).toBe(true);
    expect(merged.summary!.warning_count).toBe(1);
    expect(merged.summary!.error_count).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// validateGameSpecificRules
// ---------------------------------------------------------------------------
describe("validateGameSpecificRules", () => {
  const baseSpecs: ValidationSpecs = {
    required_atoms: ["game_loop", "create_scene", "score_tracker"],
    interface_contracts: [
      {
        atom_name: "score_tracker",
        expected_inputs: [{ name: "points", type: "number" }],
        expected_outputs: [{ name: "score", type: "number" }],
      },
    ],
    score_event_specs: [
      { event_name: "coin_collected", trigger_atom: "coin_system", description: "Awards points on coin pickup" },
    ],
    expected_dependencies: {
      game_loop: ["create_scene", "score_tracker"],
    },
    complexity_bounds: {
      min_atoms: 3,
      max_atoms: 10,
      required_types: { core: 2, feature: 1, util: 0 },
    },
    genre_rules: [
      { rule_id: "genre_game_loop", description: "game_loop must exist", check_type: "atom_exists", target_atom: "game_loop" },
    ],
  };

  const validAtoms: ValidationAtom[] = [
    makeAtom({ name: "game_loop", type: "core", inputs: [], outputs: [] }),
    makeAtom({ name: "create_scene", type: "core", inputs: [], outputs: [] }),
    makeAtom({ name: "score_tracker", type: "feature", inputs: [{ name: "points", type: "number" }], outputs: [{ name: "score", type: "number" }] }),
  ];

  const validDeps: ValidationDependency[] = [
    { atom_name: "game_loop", depends_on: "create_scene" },
    { atom_name: "game_loop", depends_on: "score_tracker" },
  ];

  it("passes with all specs satisfied", () => {
    const report = validateGameSpecificRules(validAtoms, validDeps, baseSpecs);
    // score_event_specs trigger_atom "coin_system" doesn't exist → warning only
    const errors = report.failures.filter((f) => f.severity !== "warning");
    expect(errors).toHaveLength(0);
  });

  it("fails when a required atom is missing (error)", () => {
    const atoms = validAtoms.filter((a) => a.name !== "score_tracker");
    const report = validateGameSpecificRules(atoms, validDeps, baseSpecs);
    expect(report.passed).toBe(false);
    expect(report.failures).toContainEqual(
      expect.objectContaining({ atom: "score_tracker", rule: "scope_required_atom", severity: "error" })
    );
  });

  it("fails when interface contract input is missing (error)", () => {
    const atoms = validAtoms.map((a) =>
      a.name === "score_tracker" ? makeAtom({ name: "score_tracker", type: "feature", inputs: [], outputs: [{ name: "score", type: "number" }] }) : a
    );
    const report = validateGameSpecificRules(atoms, validDeps, baseSpecs);
    expect(report.passed).toBe(false);
    expect(report.failures).toContainEqual(
      expect.objectContaining({ atom: "score_tracker", rule: "interface_contract_input", severity: "error" })
    );
  });

  it("fails when interface contract output type mismatches (error)", () => {
    const atoms = validAtoms.map((a) =>
      a.name === "score_tracker"
        ? makeAtom({ name: "score_tracker", type: "feature", inputs: [{ name: "points", type: "number" }], outputs: [{ name: "score", type: "string" }] })
        : a
    );
    const report = validateGameSpecificRules(atoms, validDeps, baseSpecs);
    expect(report.passed).toBe(false);
    expect(report.failures).toContainEqual(
      expect.objectContaining({ atom: "score_tracker", rule: "interface_contract_type", severity: "error" })
    );
  });

  it("fails when expected dependency is missing (error)", () => {
    const deps = [{ atom_name: "game_loop", depends_on: "create_scene" }]; // missing score_tracker dep
    const report = validateGameSpecificRules(validAtoms, deps, baseSpecs);
    expect(report.passed).toBe(false);
    expect(report.failures).toContainEqual(
      expect.objectContaining({ atom: "game_loop", rule: "expected_dependency", severity: "error" })
    );
  });

  it("warns when atom count is below min_atoms", () => {
    const specs = { ...baseSpecs, complexity_bounds: { ...baseSpecs.complexity_bounds, min_atoms: 5 } };
    const report = validateGameSpecificRules(validAtoms, validDeps, specs);
    expect(report.failures).toContainEqual(
      expect.objectContaining({ rule: "complexity_min_atoms", severity: "warning" })
    );
  });

  it("warns when atom count exceeds max_atoms", () => {
    const specs = { ...baseSpecs, complexity_bounds: { ...baseSpecs.complexity_bounds, max_atoms: 2 } };
    const report = validateGameSpecificRules(validAtoms, validDeps, specs);
    expect(report.failures).toContainEqual(
      expect.objectContaining({ rule: "complexity_max_atoms", severity: "warning" })
    );
  });

  it("warns when required type count is not met", () => {
    const specs = {
      ...baseSpecs,
      complexity_bounds: { ...baseSpecs.complexity_bounds, required_types: { core: 5, feature: 1, util: 0 } },
    };
    const report = validateGameSpecificRules(validAtoms, validDeps, specs);
    expect(report.failures).toContainEqual(
      expect.objectContaining({ rule: "complexity_core_count", severity: "warning" })
    );
  });

  it("enforces genre atom_exists rules", () => {
    const specs = {
      ...baseSpecs,
      genre_rules: [
        { rule_id: "genre_hex_grid", description: "hex_grid_create must exist for hex-grid-tbs", check_type: "atom_exists", target_atom: "hex_grid_create" },
      ],
    };
    const report = validateGameSpecificRules(validAtoms, validDeps, specs);
    expect(report.failures).toContainEqual(
      expect.objectContaining({ rule: "genre_hex_grid" })
    );
  });

  it("enforces genre atom_code_contains rules", () => {
    const specs = {
      ...baseSpecs,
      genre_rules: [
        { rule_id: "score_postmessage", description: "score_tracker must emit SCORE_UPDATE", check_type: "atom_code_contains", target_atom: "score_tracker", expected_value: "SCORE_UPDATE" },
      ],
    };
    const report = validateGameSpecificRules(validAtoms, validDeps, specs);
    expect(report.failures).toContainEqual(
      expect.objectContaining({ rule: "score_postmessage" })
    );
  });

  it("enforces genre atom_has_output rules", () => {
    const specs = {
      ...baseSpecs,
      genre_rules: [
        { rule_id: "score_output", description: "score_tracker must have score output", check_type: "atom_has_output", target_atom: "score_tracker", expected_value: "score" },
      ],
    };
    const report = validateGameSpecificRules(validAtoms, validDeps, specs);
    // score_tracker has score output — should not fail on this rule
    expect(report.failures.find((f) => f.rule === "score_output")).toBeUndefined();
  });

  it("enforces genre atom_depends_on rules", () => {
    const specs = {
      ...baseSpecs,
      genre_rules: [
        { rule_id: "loop_scene_dep", description: "game_loop must depend on create_scene", check_type: "atom_depends_on", target_atom: "game_loop", expected_value: "create_scene" },
      ],
    };
    const report = validateGameSpecificRules(validAtoms, validDeps, specs);
    expect(report.failures.find((f) => f.rule === "loop_scene_dep")).toBeUndefined();
  });

  // New genre rule check_types
  it("enforces genre atom_type_is rules", () => {
    const specs = {
      ...baseSpecs,
      genre_rules: [
        { rule_id: "tracker_type", description: "score_tracker must be feature", check_type: "atom_type_is", target_atom: "score_tracker", expected_value: "feature" },
      ],
    };
    const report = validateGameSpecificRules(validAtoms, validDeps, specs);
    expect(report.failures.find((f) => f.rule === "tracker_type")).toBeUndefined();
  });

  it("fails genre atom_type_is when type mismatches", () => {
    const specs = {
      ...baseSpecs,
      genre_rules: [
        { rule_id: "tracker_type", description: "score_tracker must be core", check_type: "atom_type_is", target_atom: "score_tracker", expected_value: "core" },
      ],
    };
    const report = validateGameSpecificRules(validAtoms, validDeps, specs);
    expect(report.failures).toContainEqual(
      expect.objectContaining({ rule: "tracker_type" })
    );
  });

  it("enforces genre atom_code_matches_regex rules", () => {
    const atoms = validAtoms.map((a) =>
      a.name === "score_tracker" ? makeAtom({ ...a, code: "function run() { window.parent.postMessage({ type: 'SCORE_UPDATE', score: 0 }); }" }) : a
    );
    const specs = {
      ...baseSpecs,
      genre_rules: [
        { rule_id: "regex_check", description: "Must emit postMessage", check_type: "atom_code_matches_regex", target_atom: "score_tracker", expected_value: "postMessage\\(" },
      ],
    };
    const report = validateGameSpecificRules(atoms, validDeps, specs);
    expect(report.failures.find((f) => f.rule === "regex_check")).toBeUndefined();
  });

  it("warns when score_event_specs trigger atom is missing", () => {
    // baseSpecs has coin_system as trigger_atom which doesn't exist
    const report = validateGameSpecificRules(validAtoms, validDeps, baseSpecs);
    expect(report.failures).toContainEqual(
      expect.objectContaining({ rule: "score_event_trigger_missing", severity: "warning" })
    );
  });

  it("passes score_event_specs when trigger atom exists", () => {
    const atoms = [
      ...validAtoms,
      makeAtom({ name: "coin_system", type: "feature" }),
    ];
    const report = validateGameSpecificRules(atoms, validDeps, baseSpecs);
    expect(report.failures.find((f) => f.rule === "score_event_trigger_missing")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Edge case: Duplicate atom names
// ---------------------------------------------------------------------------
describe("duplicate atom name detection", () => {
  it("detects duplicate atom names as error", () => {
    const atoms = [
      makeAtom({ name: "game_loop" }),
      makeAtom({ name: "create_scene" }),
      makeAtom({ name: "game_loop" }), // duplicate
    ];
    const report = validateStructuralRules(atoms, []);
    expect(report.passed).toBe(false);
    expect(report.failures).toContainEqual(
      expect.objectContaining({ atom: "game_loop", rule: "duplicate_atom_name", severity: "error" })
    );
  });

  it("passes when all atom names are unique", () => {
    const atoms = [
      makeAtom({ name: "game_loop" }),
      makeAtom({ name: "create_scene" }),
    ];
    const report = validateStructuralRules(atoms, []);
    expect(report.failures.filter((f) => f.rule === "duplicate_atom_name")).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Edge case: Cycle detection with full path
// ---------------------------------------------------------------------------
describe("cycle detection full path", () => {
  it("reports full cycle path in message", () => {
    const atoms = [
      makeAtom({ name: "game_loop" }),
      makeAtom({ name: "create_scene" }),
      makeAtom({ name: "alpha" }),
      makeAtom({ name: "beta" }),
      makeAtom({ name: "gamma" }),
    ];
    const deps: ValidationDependency[] = [
      { atom_name: "alpha", depends_on: "beta" },
      { atom_name: "beta", depends_on: "gamma" },
      { atom_name: "gamma", depends_on: "alpha" },
    ];
    const report = validateStructuralRules(atoms, deps);
    expect(report.passed).toBe(false);
    const cycleFail = report.failures.find((f) => f.rule === "no_cycles");
    expect(cycleFail).toBeDefined();
    // Should contain arrow notation showing the cycle path
    expect(cycleFail!.message).toContain("→");
    // Should mention at least 2 of the cycle participants
    const participants = ["alpha", "beta", "gamma"];
    const mentioned = participants.filter((p) => cycleFail!.message.includes(p));
    expect(mentioned.length).toBeGreaterThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// Edge case: Boundary conditions
// ---------------------------------------------------------------------------
describe("boundary conditions", () => {
  const minimalAtoms = [
    makeAtom({ name: "game_loop" }),
    makeAtom({ name: "create_scene" }),
  ];

  it("passes with exactly 2048 bytes of code", () => {
    const atoms = [
      ...minimalAtoms,
      makeAtom({ name: "boundary_atom", code: "x".repeat(2048) }),
    ];
    const report = validateStructuralRules(atoms, []);
    expect(report.failures.filter((f) => f.rule === "size_limit")).toHaveLength(0);
  });

  it("warns with 2049 bytes of code", () => {
    const atoms = [
      ...minimalAtoms,
      makeAtom({ name: "big_atom", code: "x".repeat(2049) }),
    ];
    const report = validateStructuralRules(atoms, []);
    expect(report.failures).toContainEqual(
      expect.objectContaining({ rule: "size_limit", severity: "warning" })
    );
  });

  it("handles atoms with empty inputs and outputs arrays", () => {
    const atoms = [
      ...minimalAtoms,
      makeAtom({ name: "empty_ports", inputs: [], outputs: [] }),
    ];
    const report = validateStructuralRules(atoms, []);
    expect(report.failures.filter((f) => f.rule === "primitive_interface")).toHaveLength(0);
  });

  it("rejects object and any as non-primitive types", () => {
    const atoms = [
      ...minimalAtoms,
      makeAtom({
        name: "loose_types",
        inputs: [{ name: "data", type: "object" }],
        outputs: [{ name: "result", type: "any" }],
      }),
    ];
    const report = validateStructuralRules(atoms, []);
    expect(report.failures.filter((f) => f.rule === "primitive_interface")).toHaveLength(2);
  });

  it("merge of 3+ reports preserves summary", () => {
    const r1 = {
      passed: false,
      failures: [{ atom: "a", rule: "r1", message: "err", severity: "error" as const }],
      atom_count: 2,
      checked_at: new Date().toISOString(),
    };
    const r2 = {
      passed: true,
      failures: [{ atom: "b", rule: "r2", message: "warn", severity: "warning" as const }],
      atom_count: 3,
      checked_at: new Date().toISOString(),
    };
    const r3 = {
      passed: false,
      failures: [{ atom: "c", rule: "r3", message: "err2", severity: "error" as const }],
      atom_count: 4,
      checked_at: new Date().toISOString(),
    };
    const merged = mergeValidationReports(r1, r2, r3);
    expect(merged.failures).toHaveLength(3);
    expect(merged.atom_count).toBe(4);
    expect(merged.summary!.error_count).toBe(2);
    expect(merged.summary!.warning_count).toBe(1);
    expect(merged.passed).toBe(false);
  });
});
