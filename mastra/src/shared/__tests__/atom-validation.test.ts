import { describe, it, expect } from "vitest";
import {
  validateStructuralRules,
  validateScoreSystemRules,
  mergeValidationReports,
  type ValidationAtom,
  type ValidationDependency,
} from "../atom-validation.js";

function makeAtom(overrides: Partial<ValidationAtom> & { name: string }): ValidationAtom {
  return {
    type: "core",
    code: "function run() {}",
    description: null,
    inputs: [],
    outputs: [],
    ...overrides,
  };
}

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
  });

  it("fails when game_loop is missing", () => {
    const atoms = [makeAtom({ name: "create_scene" })];
    const report = validateStructuralRules(atoms, []);
    expect(report.passed).toBe(false);
    expect(report.failures).toContainEqual(
      expect.objectContaining({ atom: "game_loop", rule: "required_atom" })
    );
  });

  it("fails when create_scene is missing", () => {
    const atoms = [makeAtom({ name: "game_loop" })];
    const report = validateStructuralRules(atoms, []);
    expect(report.passed).toBe(false);
    expect(report.failures).toContainEqual(
      expect.objectContaining({ atom: "create_scene", rule: "required_atom" })
    );
  });

  it("rejects non-snake_case names", () => {
    const atoms = [
      ...minimalAtoms,
      makeAtom({ name: "myBadName" }),
    ];
    const report = validateStructuralRules(atoms, []);
    expect(report.passed).toBe(false);
    expect(report.failures).toContainEqual(
      expect.objectContaining({ atom: "myBadName", rule: "snake_case" })
    );
  });

  it("rejects code exceeding 2048 bytes", () => {
    const atoms = [
      ...minimalAtoms,
      makeAtom({ name: "big_atom", code: "x".repeat(2049) }),
    ];
    const report = validateStructuralRules(atoms, []);
    expect(report.passed).toBe(false);
    expect(report.failures).toContainEqual(
      expect.objectContaining({ atom: "big_atom", rule: "size_limit" })
    );
  });

  it("rejects non-primitive port types", () => {
    const atoms = [
      ...minimalAtoms,
      makeAtom({
        name: "typed_atom",
        inputs: [{ name: "data", type: "CustomType" }],
      }),
    ];
    const report = validateStructuralRules(atoms, []);
    expect(report.passed).toBe(false);
    expect(report.failures).toContainEqual(
      expect.objectContaining({ rule: "primitive_interface" })
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

  it("rejects invalid atom types", () => {
    const atoms = [
      ...minimalAtoms,
      makeAtom({ name: "bad_type", type: "widget" }),
    ];
    const report = validateStructuralRules(atoms, []);
    expect(report.passed).toBe(false);
    expect(report.failures).toContainEqual(
      expect.objectContaining({ rule: "valid_type" })
    );
  });

  it("detects missing dependency target", () => {
    const deps: ValidationDependency[] = [
      { atom_name: "game_loop", depends_on: "nonexistent" },
    ];
    const report = validateStructuralRules(minimalAtoms, deps);
    expect(report.passed).toBe(false);
    expect(report.failures).toContainEqual(
      expect.objectContaining({ rule: "dependency_exists" })
    );
  });

  it("detects circular dependencies", () => {
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
      expect.objectContaining({ rule: "no_cycles" })
    );
  });
});

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
      expect.objectContaining({ rule: "required_score_tracker" })
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
      expect.objectContaining({ rule: "score_output_contract" })
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
      expect.objectContaining({ rule: "score_update_postmessage" })
    );
  });

  it("fails when no core/feature atom depends on score_tracker", () => {
    const atoms = [validScoreTracker];
    const report = validateScoreSystemRules(atoms, []);
    expect(report.passed).toBe(false);
    expect(report.failures).toContainEqual(
      expect.objectContaining({ rule: "score_tracker_wired" })
    );
  });
});

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
});
