import { getSupabaseClient } from "../../supabase-client.ts";
import { log } from "../../logger.ts";
import {
  mergeValidationReports,
  validateScoreSystemRules,
  validateStructuralRules,
  type ValidationFailure,
  type ValidationReport,
} from "../../../../mastra/src/shared/atom-validation.ts";

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

/**
 * Run structural validation on all atoms for a game.
 * Includes score-system requirements so checker can block non-compliant games.
 */
export async function validate(gameId: string): Promise<ValidationReport> {
  const supabase = getSupabaseClient();

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

  const { data: deps, error: depErr } = await supabase
    .from("atom_dependencies")
    .select("atom_name, depends_on")
    .eq("game_id", gameId);

  if (depErr) throw new Error(`Failed to fetch deps: ${depErr.message}`);

  const structuralReport = validateStructuralRules(
    atoms as AtomRow[],
    (deps || []) as DepRow[],
  );
  const scoreReport = validateScoreSystemRules(
    atoms as AtomRow[],
    (deps || []) as DepRow[],
  );
  const report = mergeValidationReports(structuralReport, scoreReport);

  log("info", "structural validation complete", {
    gameId,
    passed: report.passed,
    failureCount: report.failures.length,
    atomCount: atoms.length,
  });

  return report;
}

export type { ValidationFailure, ValidationReport };
