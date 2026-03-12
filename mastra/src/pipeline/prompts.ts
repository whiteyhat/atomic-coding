import type { WarRoomTask } from "./types.js";
import { SYSTEM_PROMPT, getGenreContext } from "../lib/system-prompt.js";
import { buildPixelSystemPrompt, PIXEL_STYLE_PILLARS } from "../lib/pixel-guidelines.js";

/**
 * Fields each task needs from each of its dependency task outputs.
 * Any key listed here is KEPT; all other fields are stripped before prompt injection.
 * This prevents large blobs (e.g. base64 images, full atom code) from bloating context.
 * "assets_created" is intentionally excluded from task_7 here because task 8 already
 * injects design_system + art_direction separately, and the image data is useless to the LLM.
 */
const DEP_FIELD_ALLOWLIST: Record<number, Record<string, string[]>> = {
  7: {
    // Scope is already injected via context.scope — only keep status from Task 1
    task_1: ["status"],
  },
  8: {
    task_1: ["status"],
    task_5: ["status", "atoms_created", "notes"],
    task_7: ["status", "design_system", "art_direction", "pack_cohesion_notes", "generation_model", "notes"],
    task_6: ["status", "atoms_created", "atoms_modified", "notes"],
  },
  9: {
    task_6: ["status", "atoms_created", "atoms_modified", "notes"],
  },
  11: {
    task_6: ["status", "atoms_created", "atoms_modified", "notes"],
    task_10: ["status", "atoms_fixed", "atoms_created", "failures_remaining", "notes"],
  },
};

/**
 * Sanitize a single dependency task output before stringifying into a prompt.
 * Applies DEP_FIELD_ALLOWLIST for the current task, then strips any remaining
 * assets_created arrays to prevent base64 image data from inflating the context.
 */
function sanitizeDependencyOutput(
  taskNumber: number,
  depKey: string,
  value: unknown,
): unknown {
  if (typeof value !== "object" || !value) return value;
  const output = value as Record<string, unknown>;

  // Apply per-task allowlist if defined
  const allowlist = DEP_FIELD_ALLOWLIST[taskNumber]?.[depKey];
  let filtered: Record<string, unknown>;
  if (allowlist) {
    filtered = {};
    for (const field of allowlist) {
      if (field in output) filtered[field] = output[field];
    }
  } else {
    filtered = { ...output };
  }

  // Final safety net: strip any assets_created array (may contain image URLs or base64)
  // from ANY dependency output regardless of allowlist, to prevent context overflow.
  if (Array.isArray(filtered.assets_created)) {
    const count = (filtered.assets_created as unknown[]).length;
    filtered = {
      ...filtered,
      assets_created: `[${count} assets — image data omitted from context to prevent overflow]`,
    };
  }

  return filtered;
}

type GameFormat = "2d" | "3d" | null | undefined;

function getRuntimeName(gameFormat: GameFormat): "phaser" | "three" {
  return gameFormat === "2d" ? "phaser" : "three";
}

function getRuntimeLabel(gameFormat: GameFormat): string {
  return getRuntimeName(gameFormat) === "phaser" ? "Phaser" : "Three.js";
}

function getRuntimeSceneInstruction(gameFormat: GameFormat): string {
  return getRuntimeName(gameFormat) === "phaser"
    ? "- `create_scene` should initialize a Phaser.Game that uses `canvas: window.GAME.canvas`, then expose scene/state hooks the rest of the atoms can drive."
    : "- `create_scene` should initialize the Three.js scene, camera, renderer, and call feature init functions.";
}

function getRuntimeLoopInstruction(gameFormat: GameFormat): string {
  return getRuntimeName(gameFormat) === "phaser"
    ? "- `game_loop` should coordinate Phaser scene update hooks or shared gameplay state without fighting Phaser's internal frame loop."
    : "- `game_loop` should call window.GAME.tick() each frame and update all feature systems.";
}

function getRuntimeValidationInstruction(gameFormat: GameFormat): string {
  return getRuntimeName(gameFormat) === "phaser"
    ? "   - create_scene boots Phaser on window.GAME.canvas and game_loop hooks do not fight Phaser's internal step loop"
    : "   - create_scene sets up Three.js scene/camera/renderer";
}

/**
 * Extract atoms of a given type from the scope, sorted by creation_order.
 * Returns a formatted numbered list and the raw atom objects.
 */
function filterScopeAtoms(
  scope: Record<string, unknown> | null,
  atomType: "util" | "feature" | "core"
): { list: string; atoms: Array<Record<string, unknown>> } {
  if (!scope) return { list: "(no scope available)", atoms: [] };
  const allAtoms = (scope.atoms as Array<Record<string, unknown>>) || [];
  const filtered = allAtoms
    .filter((a) => a.type === atomType)
    .sort(
      (a, b) => (a.creation_order as number) - (b.creation_order as number)
    );
  if (filtered.length === 0)
    return { list: `(no ${atomType} atoms in scope)`, atoms: [] };
  const list = filtered
    .map((a, i) => {
      const deps = (a.depends_on as string[]) || [];
      const ins = (a.inputs as Array<{ name: string; type: string }>) || [];
      const outs = (a.outputs as Array<{ name: string; type: string }>) || [];
      return [
        `${i + 1}. **${a.name}**`,
        `   Description: ${a.description}`,
        `   Inputs: ${ins.length > 0 ? ins.map((p) => `${p.name}: ${p.type}`).join(", ") : "(none)"}`,
        `   Outputs: ${outs.length > 0 ? outs.map((p) => `${p.name}: ${p.type}`).join(", ") : "(none)"}`,
        `   Depends on: [${deps.join(", ")}]`,
      ].join("\n");
    })
    .join("\n");
  return { list, atoms: filtered };
}

type ExternalEntry = {
  name: string;
  display_name: string;
  global_name: string;
  version: string;
  cdn_url?: string;
  load_type?: string;
  api_surface?: string;
};

/**
 * Format the installed externals section for a task prompt.
 * Code-writing tasks (Forge) get full api_surface + enforcement instructions.
 * Planning/validation tasks (Jarvis/Checker) get a compact list.
 * Pixel tasks (7, 8) get nothing — they generate images, not code.
 */
function formatExternalsSection(
  externals: ExternalEntry[],
  taskNumber: number
): string | null {
  if (!externals || externals.length === 0) return null;
  if (taskNumber === 7 || taskNumber === 8) return null;

  // Code-writing tasks — Forge: full api_surface + strong enforcement
  if ([2, 4, 5, 6, 10].includes(taskNumber)) {
    const lines = [
      "## Active Externals — USE THESE, DO NOT REIMPLEMENT",
      "These libraries are installed in this game. Your atoms MUST use them via their window globals.",
      "Never implement 3D rendering, 2D physics, or game loops from scratch — use the installed externals.",
      "",
    ];
    for (const ext of externals) {
      lines.push(`### ${ext.display_name} (${ext.name})`);
      lines.push(`- **Window global**: \`window.${ext.global_name}\``);
      lines.push(`- **Version**: ${ext.version}`);
      lines.push(`- **Access in atoms**: \`const ${ext.global_name} = window.${ext.global_name};\``);
      if (ext.api_surface) {
        lines.push("", "**API Surface:**", ext.api_surface);
      }
      lines.push("");
    }
    lines.push("Call `read-externals` with specific names if you need more API detail.");
    return lines.join("\n");
  }

  // Planning (Jarvis 1, 12) and validation (Checker 3, 9, 11): compact list
  const lines = [
    "## Installed Externals",
    "These libraries are active in this game:",
    "",
  ];
  for (const ext of externals) {
    lines.push(`- **${ext.display_name}** (\`${ext.name}\`): \`window.${ext.global_name}\` — v${ext.version}`);
  }
  return lines.join("\n");
}

/**
 * Build the user prompt for a pipeline task.
 * Includes task details, context, user request, scope, and dependency outputs.
 */
export function buildTaskPrompt(
  task: WarRoomTask,
  context: Record<string, unknown>,
  compactLevel = 0,
): string {
  const gameFormat = (context.game_format as GameFormat) ?? null;
  const runtimeLabel = getRuntimeLabel(gameFormat);
  const lines = [
    `## Task ${task.task_number}: ${task.title}`,
    "",
    task.description ?? "",
    "",
    "## Context",
    `- Genre: ${context.genre ?? "custom"}`,
    `- Game format: ${gameFormat ?? "unspecified"}`,
    `- Runtime: ${runtimeLabel}`,
    `- Game ID: ${context.game_id}`,
    "",
    "## User Request",
    String(context.prompt ?? ""),
  ];

  // Inject active externals so every agent knows which libraries are installed
  const installedExternals = context.installed_externals as ExternalEntry[] | undefined;
  if (installedExternals) {
    const extSection = formatExternalsSection(installedExternals, task.task_number);
    if (extSection) lines.push("", extSection);
  }

  // Inject genre boilerplate for task 1 so Jarvis sees genre-specific atoms
  if (task.task_number === 1 && context.genre) {
    const genreCtx = getGenreContext(context.genre as string, gameFormat ?? null);
    if (genreCtx) {
      lines.push("", "## Genre Boilerplate", genreCtx);
    }
  }

  // Inject structured boilerplate atom specs for task 2 so Forge knows exactly what was seeded
  if (task.task_number === 2) {
    const seededAtoms = context.seeded_atoms as string[] | undefined;
    if (seededAtoms && seededAtoms.length > 0) {
      lines.push("", "## Seeded Boilerplate Atoms", `The following atoms are already in the database: ${seededAtoms.join(", ")}`);
    }
    const boilerplateAtoms = context.boilerplate_atoms as Array<Record<string, unknown>> | undefined;
    if (boilerplateAtoms && boilerplateAtoms.length > 0) {
      lines.push("", "## Boilerplate Atom Specifications", JSON.stringify(boilerplateAtoms));
    }
  }

  // Scope filtering: for implementation tasks 4/5/6, inject only relevant atoms prominently
  if (context.scope && [4, 5, 6].includes(task.task_number)) {
    const scope = context.scope as Record<string, unknown>;
    const atoms = scope.atoms as Array<{ name: string; type: string; creation_order: number }> | undefined;
    if (atoms) {
      const typeFilter = task.task_number === 4 ? "util" : task.task_number === 5 ? "feature" : "core";
      const filtered = atoms
        .filter((a) => a.type === typeFilter)
        .sort((a, b) => a.creation_order - b.creation_order);
      lines.push("", `## Your Atoms to Implement (${typeFilter} only, sorted by creation_order)`, JSON.stringify(filtered));
    }
    lines.push("", "## Full Scope (for reference)", JSON.stringify(scope));
  } else if (context.scope) {
    // Pixel tasks only need visual requirements, not the full atom architecture
    if (task.task_number === 7 || task.task_number === 8) {
      const scope = context.scope as Record<string, unknown>;
      const pixelScope: Record<string, unknown> = {
        genre: scope.genre,
        core_mechanics: scope.core_mechanics,
        ui_requirements: scope.ui_requirements,
        sprite_requirements: scope.sprite_requirements,
        // Level 1+: strip architecture to save tokens (agent can call get-code-structure)
        ...(compactLevel < 1 ? { architecture: scope.architecture } : {}),
      };
      let scopeJson = JSON.stringify(pixelScope);
      // Level 4: hard-cap scope to 5K chars
      if (compactLevel >= 4 && scopeJson.length > 5000) {
        scopeJson = scopeJson.slice(0, 5000) + "…[truncated]";
      }
      lines.push("", "## Scope (visual requirements)", scopeJson);
    } else {
      let scopeJson = JSON.stringify(context.scope);
      if (compactLevel >= 4 && scopeJson.length > 5000) {
        scopeJson = scopeJson.slice(0, 5000) + "…[truncated]";
      }
      lines.push("", "## Scope", scopeJson);
    }
  }

  // Level 3+: drop dependency outputs entirely (agent can use tools to fetch what it needs)
  const depOutputs = context.dependency_outputs as
    | Record<string, unknown>
    | undefined;
  if (compactLevel < 3 && depOutputs && Object.keys(depOutputs).length > 0) {
    lines.push("", "## Previous Task Outputs");
    for (const [key, value] of Object.entries(depOutputs)) {
      const sanitized = sanitizeDependencyOutput(task.task_number, key, value);
      let depJson = JSON.stringify(sanitized);
      // Level 2+: cap each dep output to 2K chars
      if (compactLevel >= 2 && depJson.length > 2000) {
        depJson = depJson.slice(0, 2000) + "…[truncated]";
      }
      lines.push(`### ${key}`, depJson);
    }
  } else if (compactLevel >= 3 && depOutputs && Object.keys(depOutputs).length > 0) {
    lines.push("", "## Previous Task Outputs", "[Omitted to fit context window — use get-code-structure and read-atoms tools to inspect game state.]");
  }

  const latestValidationOutputs = context.latest_validation_outputs as
    | Record<string, unknown>
    | undefined;
  if (latestValidationOutputs && Object.keys(latestValidationOutputs).length > 0) {
    lines.push("", "## Latest Validation Outputs");
    for (const [key, value] of Object.entries(latestValidationOutputs)) {
      lines.push(`### ${key}`, JSON.stringify(value));
    }
  }

  // Task-specific instructions
  if (task.task_number === 1) {
    lines.push(
      "",
      "## Instructions",
      "1. First call get-code-structure with the game_id to see existing atoms.",
      "2. Analyze the user request and plan the full atom architecture.",
      "3. Return a JSON object matching the Task 1 Output Schema from your system instructions.",
      "4. Ensure score_tracker is planned with proper wiring.",
      "5. Every game MUST preserve a compliant score system.",
      "6. Do NOT call upsert-atom — only plan, do not build."
    );
  } else if (task.task_number === 3) {
    lines.push(
      "",
      "## Instructions",
      "You are generating VALIDATION SPECS — machine-readable rules that will be enforced AFTER atoms are built.",
      "No atoms exist yet. Do NOT attempt to validate code. Only produce specs from the planned scope.",
      "",
      "1. Read the Task 1 scope from the Previous Task Outputs above.",
      "2. Optionally call get-code-structure with game_id to see any pre-existing atoms.",
      "3. For every atom in scope.atoms, add its name to `required_atoms` and create an `interface_contracts` entry with its planned inputs/outputs.",
      "4. Copy `scope.dependency_graph` into `expected_dependencies`.",
      "5. For each event in `scope.score_system.score_events`, create a `score_event_specs` entry identifying which atom triggers it.",
      "6. Set `complexity_bounds`:",
      "   - min_atoms = scope.complexity.total_atoms - 2",
      "   - max_atoms = scope.complexity.total_atoms + 5",
      "   - required_types.core = scope.complexity.core_count",
      "   - required_types.feature = max(1, scope.complexity.feature_count - 1)",
      "   - required_types.util = 0",
      "7. Add `genre_rules` based on scope.genre:",
      "   - hex-grid-tbs: atom_exists for hex_grid_create, turn_manager",
      "   - side-scroller-2d-3d: atom_exists for platform_physics, camera_follow",
      "   - 3d-roguelike-deckbuilder: atom_exists for deck_manager, room_generator",
      "   - arena-dogfighter: atom_exists for flight_controls, projectile_system",
      "   - base-builder: atom_exists for grid_placement, resource_manager",
      "   - Always: atom_exists for game_loop, create_scene, score_tracker",
      "8. Return JSON matching this exact schema:",
      "```json",
      "{",
      '  "status": "completed",',
      '  "validation_specs": {',
      '    "required_atoms": ["game_loop", "create_scene", "score_tracker", "..."],',
      '    "interface_contracts": [{ "atom_name": "score_tracker", "expected_inputs": [{"name":"points","type":"number"}], "expected_outputs": [{"name":"score","type":"number"}] }],',
      '    "score_event_specs": [{ "event_name": "coin_collected", "trigger_atom": "coin_system", "description": "Awards points when player collects a coin" }],',
      '    "expected_dependencies": { "game_loop": ["create_scene", "score_tracker"] },',
      '    "complexity_bounds": { "min_atoms": 8, "max_atoms": 15, "required_types": { "core": 3, "feature": 4, "util": 0 } },',
      '    "genre_rules": [{ "rule_id": "genre_game_loop", "description": "game_loop atom must exist", "check_type": "atom_exists", "target_atom": "game_loop" }],',
      '    "notes": "Optional notes about edge cases"',
      "  }",
      "}",
      "```"
    );
  } else if (task.task_number === 2) {
    lines.push(
      "",
      "## Instructions",
      "1. The orchestrator has already verified boilerplate atoms exist in the database.",
      "2. Call get-code-structure with game_id to read the full current atom structure.",
      "3. Review the Task 1 scope output and compare against existing boilerplate atoms.",
      "4. Customize boilerplate atoms to match the game scope:",
      "   - Adjust descriptions to reference specific game mechanics from the scope",
      "   - Modify inputs/outputs if the scope requires different interfaces",
      "   - Add any missing utility atoms implied by the scope but not in the boilerplate",
      "5. Use upsert-atom ONLY for atoms that need customization — do NOT re-create atoms that are already correct.",
      "6. Return JSON matching this exact schema:",
      "```json",
      "{",
      '  "status": "completed",',
      '  "boilerplate_loaded": true,',
      '  "genre_slug": "<genre>",',
      '  "atoms_verified": ["<atoms confirmed correct>"],',
      '  "atoms_customized": ["<atoms you modified>"],',
      '  "atoms_created": ["<new atoms added beyond boilerplate>"],',
      '  "existing_atom_structure": { "total_atoms": 0, "atom_names": [] },',
      '  "customization_notes": "<what you changed and why>"',
      "}",
      "```",
      "Every game in this pipeline MUST preserve a compliant score system."
    );
  } else if (task.task_number === 4) {
    const { list: utilList } = filterScopeAtoms(
      context.scope as Record<string, unknown> | null,
      "util"
    );
    lines.push(
      "",
      "## Instructions — Implement Util Atoms",
      "You are building the UTILITY LAYER — helpers, math, config, and reusable primitives.",
      "These atoms are the foundation that feature and core atoms will compose.",
      "",
      "## Util Atoms to Build (from scope, sorted by creation_order)",
      utilList,
      "",
      "## Steps",
      "1. Call get-code-structure with game_id to see what already exists.",
      "2. For each util atom listed above, in creation_order:",
      "   a. If it already exists and is correct, skip it (add to atoms_skipped).",
      "   b. If it exists but needs changes, read it with read-atoms, then upsert the updated version.",
      "   c. If it does not exist, create it with upsert-atom.",
      "3. Each atom MUST be under 2KB, use snake_case naming, and primitives-only interfaces.",
      "4. Follow dependency order — if atom B depends on atom A, build A first.",
      "5. Always pass skipRebuild: true when using upsert-atom (the orchestrator handles the final rebuild).",
      "",
      "## Boundaries",
      "- ONLY build atoms of type `util`. Do NOT create feature or core atoms.",
      "- If you discover a missing util not in the scope, you MAY create it but note it in your output.",
      "",
      "## Output Schema",
      "Return JSON matching this exact schema:",
      "```json",
      "{",
      '  "status": "completed",',
      '  "atoms_created": ["<util atoms you built from scratch>"],',
      '  "atoms_modified": ["<existing atoms you updated>"],',
      '  "util_atoms_detail": [{ "name": "math_clamp", "type": "util", "depends_on": [], "code_size_bytes": 245 }],',
      '  "total_atoms_after": 10,',
      '  "notes": "<brief summary>"',
      "}",
      "```",
      "- `util_atoms_detail`: For EACH util atom you created or modified, include name, type (always \"util\"), depends_on array, and code_size_bytes (use `new TextEncoder().encode(code).length` or estimate).",
      "- `total_atoms_after`: Call get-code-structure at the end and count total atoms.",
      "Every game in this pipeline MUST preserve a compliant score system."
    );
  } else if (task.task_number === 5) {
    const { list: featureList } = filterScopeAtoms(
      context.scope as Record<string, unknown> | null,
      "feature"
    );
    const { list: utilList } = filterScopeAtoms(
      context.scope as Record<string, unknown> | null,
      "util"
    );
    lines.push(
      "",
      "## Instructions — Implement Feature Atoms",
      "You are building the FEATURE LAYER — gameplay systems that compose utilities into playable mechanics.",
      "This is the most critical implementation step. Features are what make the game fun.",
      "",
      "## Feature Atoms to Build (from scope, sorted by creation_order)",
      featureList,
      "",
      "## Available Util Atoms (built in Task 4, use as building blocks)",
      utilList,
      "",
      "## Steps",
      "1. Call get-code-structure with game_id to see ALL current atoms (utils should be present from Task 4).",
      "2. Call read-atoms for any util atoms you need to understand before composing them.",
      "3. For each feature atom listed above, in creation_order:",
      "   a. If it already exists and is correct, skip it (add to atoms_skipped).",
      "   b. If it exists but needs changes, read it with read-atoms, then upsert the updated version.",
      "   c. If it does not exist, create it with upsert-atom.",
      "4. Each atom MUST be under 2KB, use snake_case naming, and primitives-only interfaces.",
      "5. Reference util atoms via depends_on — DO NOT duplicate logic that already exists in utils.",
      "6. Always pass skipRebuild: true when using upsert-atom (the orchestrator handles the final rebuild).",
      "",
      "## Score System — CRITICAL",
      "If `score_tracker` is in your feature atom list, it MUST:",
      "- Expose output: { name: 'score', type: 'number' }",
      "- Emit `window.parent.postMessage({ type: 'SCORE_UPDATE', score: <number> })` when score changes",
      "- Be a standalone feature atom that other atoms can depend on",
      "This is non-negotiable. The game will fail validation without a compliant score_tracker.",
      "",
      "## Boundaries",
      "- ONLY build atoms of type `feature`. Do NOT create util atoms (Task 4) or core atoms (Task 6).",
      "- Each feature should compose one or more util atoms into a gameplay system.",
      "- If you need a missing util, note it in your output but do NOT create it.",
      "",
      "## Composition Pattern",
      "Feature atoms should follow this pattern:",
      "- Read inputs from the game state (via window.GAME or function parameters)",
      "- Use util atoms for calculations (math, clamping, config lookups)",
      "- Produce gameplay-affecting outputs (position changes, spawns, score updates)",
      "- Declare all dependencies in depends_on",
      "",
      "## Output Schema",
      "Return JSON matching this exact schema:",
      "```json",
      "{",
      '  "status": "completed",',
      '  "atoms_created": ["<feature atoms you built from scratch>"],',
      '  "atoms_modified": ["<existing atoms you updated>"],',
      '  "feature_atoms_detail": [{ "name": "player_jump", "type": "feature", "depends_on": ["math_clamp"], "code_size_bytes": 512 }],',
      '  "score_tracker_included": true,',
      '  "total_atoms_after": 12,',
      '  "notes": "<how features compose utils>"',
      "}",
      "```",
      "- `feature_atoms_detail`: For EACH feature atom you created or modified, include name, type (always \"feature\"), depends_on array, and code_size_bytes.",
      "- `score_tracker_included`: true if you created or verified score_tracker exists.",
      "- `total_atoms_after`: Call get-code-structure at the end and count total atoms.",
      "Every game in this pipeline MUST preserve a compliant score system."
    );
  } else if (task.task_number === 6) {
    const gameFormat = (context.game_format as GameFormat) ?? null;
    const { list: coreList } = filterScopeAtoms(
      context.scope as Record<string, unknown> | null,
      "core"
    );
    const { list: featureList } = filterScopeAtoms(
      context.scope as Record<string, unknown> | null,
      "feature"
    );
    const { list: utilList } = filterScopeAtoms(
      context.scope as Record<string, unknown> | null,
      "util"
    );
    lines.push(
      "",
      "## Instructions — Implement Core Atoms",
      "You are building the CORE LAYER — the game_loop, create_scene, and other entry points",
      "that wire all features and utilities into a playable game.",
      "",
      "## Core Atoms to Build (from scope, sorted by creation_order)",
      coreList,
      "",
      "## Available Feature Atoms (built in Task 5, wire into core)",
      featureList,
      "",
      "## Available Util Atoms (built in Task 4)",
      utilList,
      "",
      "## Steps",
      "1. Call get-code-structure with game_id to see ALL current atoms (utils + features should be present).",
      "2. Call read-atoms for key feature atoms to understand their interfaces before wiring.",
      "3. For each core atom listed above, in creation_order:",
      "   a. If it already exists and is correct, skip it (add to atoms_skipped).",
      "   b. If it exists but needs changes, read it with read-atoms, then upsert the updated version.",
      "   c. If it does not exist, create it with upsert-atom.",
      "4. Each atom MUST be under 2KB, use snake_case naming, and primitives-only interfaces.",
      "5. Always pass skipRebuild: true when using upsert-atom (the orchestrator handles the final rebuild).",
      "",
      "## Wiring Requirements",
      "- `game_loop` MUST depend on `create_scene` and `score_tracker` (at minimum).",
      getRuntimeLoopInstruction(gameFormat),
      getRuntimeSceneInstruction(gameFormat),
      "- Core atoms are the TOP of the dependency graph — they depend on features, which depend on utils.",
      "",
      "## Boundaries",
      "- ONLY build atoms of type `core`. Do NOT create util or feature atoms.",
      "- Wire existing feature atoms via depends_on. Do NOT reimplement feature logic.",
      "",
      "## Output Schema",
      "Return JSON matching this exact schema:",
      "```json",
      "{",
      '  "status": "completed",',
      '  "atoms_created": ["create_scene", "game_loop"],',
      '  "atoms_modified": [],',
      '  "core_atoms_detail": [',
      '    { "name": "create_scene", "type": "core", "depends_on": ["player_movement", "enemy_spawner"], "code_size_bytes": 980 },',
      '    { "name": "game_loop", "type": "core", "depends_on": ["create_scene", "score_tracker", "player_movement"], "code_size_bytes": 1100 }',
      "  ],",
      '  "wiring_verification": {',
      '    "game_loop_depends_on": ["create_scene", "score_tracker"],',
      '    "create_scene_exists": true,',
      '    "score_tracker_wired": true,',
      '    "total_atoms_after": 14',
      "  },",
      '  "notes": "<how core atoms wire features together>"',
      "}",
      "```",
      "- `core_atoms_detail`: For EACH core atom, include name, type (always \"core\"), depends_on array, and code_size_bytes.",
      "- `wiring_verification`: After all upserts, call get-code-structure to verify:",
      "  - `game_loop_depends_on`: actual dependencies of game_loop",
      "  - `create_scene_exists`: true if create_scene atom exists",
      "  - `score_tracker_wired`: true if game_loop depends on score_tracker",
      "  - `total_atoms_after`: total atom count in the game",
      "Every game in this pipeline MUST preserve a compliant score system."
    );
  } else if (task.task_number === 9) {
    lines.push(
      "",
      "## Instructions — Run Validation Suite",
      "The orchestrator has already run deterministic validation (structural rules, score system,",
      "interface compatibility, reachability, code quality). Those results are in your context as `deterministic_validation`.",
      "Deterministic failures are CONFIRMED — include them all in your output.",
      "",
      "Your job is SEMANTIC validation that deterministic checks cannot catch.",
      "",
      "### Step 1: Inspect Code",
      "1. Call get-code-structure with the game_id to list all atoms.",
      "2. Call read-atoms to read the source code of ALL atoms.",
      "",
      "### Step 2: Semantic Validation Rubric",
      "Check each of the following. For each issue found, add a failure with the matching rule prefix.",
      "",
      "**2a. Code-Description Alignment** (rule: `semantic_description_mismatch`)",
      "For each atom: does the code actually implement what its description says?",
      "Flag atoms whose code does something fundamentally different from their description.",
      "",
      "**2b. Gameplay Coherence** (rule: `semantic_gameplay_coherence`)",
      "Do the atoms compose into a playable game?",
      "- Does game_loop call/reference all feature atoms it depends on?",
      "- Does create_scene initialize all necessary systems?",
      "- Are there feature atoms that exist but are never invoked by any core atom?",
      "",
      "**2c. Score System Behavior** (rule: `semantic_score_behavior`)",
      "Does the score actually change during gameplay?",
      "- Is updateScore/addScore/etc. called from gameplay event handlers?",
      "- Are score events actually triggered by game mechanics?",
      "- Could a player play the game and never trigger a score change?",
      "",
      "**2d. Input/Output Usage** (rule: `semantic_unused_ports`)",
      "Are declared inputs/outputs actually used in the atom's code?",
      "- Does the function signature match the declared ports?",
      "- Are outputs actually returned/set?",
      "",
      "**2e. Runtime Safety** (rule: `semantic_missing_guards`)",
      "Do atoms handle basic edge cases?",
      "- Division by zero in math utils",
      "- Null/undefined checks for external data",
      "- Array bounds and negative value guards",
      "",
      "### Step 3: Merge & Report",
      "3. Merge your semantic findings with ALL deterministic failures from context.",
      "4. Each failure must include: { atom, rule, message }",
      "5. Failures with severity 'error' block the pipeline. Severity 'warning' does not block.",
      "6. If deterministic_validation has fix_hint fields, preserve them in your output.",
      "",
      "### Output",
      "Return JSON:",
      "```json",
      "{",
      '  "status": "completed",',
      '  "passed": true,',
      '  "failures": [{ "atom": "name", "rule": "rule_id", "message": "description", "severity": "error", "fix_hint": "..." }],',
      '  "total_atoms_checked": 0,',
      '  "notes": "Summary of findings"',
      "}",
      "```",
      "Set passed=false and status='failed' if ANY error-severity failures exist."
    );
  } else if (task.task_number === 10) {
    // Inject categorized deterministic validation results
    const detValidation = context.deterministic_validation as { passed: boolean; failures: Array<{ atom: string; rule: string; message: string }> } | undefined;
    if (detValidation && detValidation.failures.length > 0) {
      const criticalRules = ["no_cycles", "required_atom", "required_score_tracker", "dependency_exists", "duplicate_atom_name"];
      const structuralRules = ["size_limit", "snake_case", "primitive_interface", "valid_type", "score_output_contract", "score_update_postmessage", "score_tracker_wired"];
      const critical = detValidation.failures.filter((f) => criticalRules.includes(f.rule));
      const structural = detValidation.failures.filter((f) => structuralRules.includes(f.rule));
      const scopeLevel = detValidation.failures.filter((f) => !criticalRules.includes(f.rule) && !structuralRules.includes(f.rule));

      lines.push(
        "",
        "## CONFIRMED Failures (deterministic validation — ground truth)",
        `Total: ${detValidation.failures.length} failures`,
        "",
        "### CRITICAL (fix first — these block the game from running)",
        critical.length > 0
          ? critical.map((f, i) => `${i + 1}. [${f.rule}] **${f.atom}**: ${f.message}`).join("\n")
          : "(none)",
        "",
        "### STRUCTURAL (fix second — these violate atom constraints)",
        structural.length > 0
          ? structural.map((f, i) => `${i + 1}. [${f.rule}] **${f.atom}**: ${f.message}`).join("\n")
          : "(none)",
        "",
        "### SCOPE/CONTRACT (fix third — these deviate from planned architecture)",
        scopeLevel.length > 0
          ? scopeLevel.map((f, i) => `${i + 1}. [${f.rule}] **${f.atom}**: ${f.message}`).join("\n")
          : "(none)",
      );
    }

    // Inject pipeline diagnostic events
    const diagnosticEvents = context.pipeline_diagnostic_events as Array<{ event_type: string; task_number: number | null; payload: Record<string, unknown>; created_at: string }> | undefined;
    if (diagnosticEvents && diagnosticEvents.length > 0) {
      lines.push(
        "",
        "## Pipeline Diagnostic Log (warnings and errors from earlier tasks)",
        ...diagnosticEvents.map((e) => `- [${e.event_type}] Task ${e.task_number ?? "N/A"}: ${JSON.stringify(e.payload)}`),
      );
    }

    // Inject accumulated fix history from retry cycles
    const retryContext = context._retry_context as { accumulated_fix_history?: Array<{ cycle: number; fixes_attempted: string[]; error: string }> } | undefined;
    if (retryContext?.accumulated_fix_history && retryContext.accumulated_fix_history.length > 0) {
      lines.push(
        "",
        "## Previous Fix Attempts (DO NOT repeat failed approaches)",
        ...retryContext.accumulated_fix_history.map((h) =>
          `- Cycle ${h.cycle}: Tried fixing [${h.fixes_attempted.join(", ")}] → Failed: ${h.error}`
        ),
        "Use a DIFFERENT strategy for atoms that failed in previous cycles.",
      );
    }

    lines.push(
      "",
      "## Instructions — Fix Validation Failures",
      "You have CONFIRMED failure data from deterministic validation above. These are ground truth.",
      "Fix failures in PRIORITY ORDER: critical first, then structural, then scope/contract.",
      "",
      "## Fix Strategy",
      "1. Start by calling get-code-structure to see ALL atoms and their current state.",
      "2. For CRITICAL failures (cycles, missing required atoms, broken dependencies):",
      "   a. These must be fixed first as they block everything downstream.",
      "   b. For cycles: identify the cycle path, remove or redirect one dependency edge.",
      "   c. For missing required atoms: create them with proper interfaces.",
      "   d. For broken dependencies: create the missing atom OR remove the dangling reference.",
      "   e. For duplicate atoms: remove duplicate definitions, keeping the most complete version.",
      "3. For STRUCTURAL failures (size, naming, interface types, score system):",
      "   a. size_limit: Read the atom, split into smaller atoms, update all dependents.",
      "   b. snake_case: Rename the atom. Update all atoms that depend on it.",
      "   c. primitive_interface: Change types to primitives (number, string, boolean, arrays, void).",
      "   d. score_update_postmessage: Add window.parent.postMessage({ type: 'SCORE_UPDATE', score }) to score_tracker.",
      "   e. score_tracker_wired: Add score_tracker to depends_on of a core or feature atom.",
      "4. For SCOPE/CONTRACT failures (missing planned atoms, interface mismatches):",
      "   a. scope_required_atom: Create the missing atom matching the planned spec.",
      "   b. interface_contract: Adjust inputs/outputs to match the plan from Task 3.",
      "   c. expected_dependency: Add the missing dependency edge via upsert-atom.",
      "",
      "## Verification After Each Fix",
      "After fixing an atom, call read-atoms to verify the fix was persisted correctly.",
      "After ALL fixes, call get-code-structure to verify the full atom graph.",
      "",
      "## What NOT to Do",
      "- Do NOT touch atoms that are passing all checks.",
      "- Do NOT create new gameplay features — only fix what is broken.",
      "- Do NOT remove atoms unless they cause cycles and cannot be fixed otherwise.",
      "- Always pass skipRebuild: true when using upsert-atom.",
      "",
      "## Output Schema",
      "Return JSON matching this exact schema:",
      "```json",
      "{",
      '  "status": "completed",',
      '  "atoms_fixed": ["<names of fixed atoms>"],',
      '  "atoms_created": ["<names of new atoms created to resolve issues>"],',
      '  "fixes_detail": [',
      '    {',
      '      "atom": "score_tracker",',
      '      "rule": "score_update_postmessage",',
      '      "original_message": "score_tracker must emit window.parent.postMessage...",',
      '      "fix_applied": "Added SCORE_UPDATE postMessage emission to score update function",',
      '      "fix_type": "code_modified",',
      '      "verified": true',
      '    }',
      '  ],',
      '  "failures_addressed": 3,',
      '  "failures_remaining": [{ "atom": "name", "rule": "rule_id", "message": "...", "reason_unfixed": "why" }],',
      '  "pre_fix_snapshot": { "total_failures": 5, "critical_failures": 1, "warning_failures": 4 },',
      '  "notes": "Fixed all 5 failures: 1 missing required atom, 2 interface mismatches, 2 score system issues"',
      "}",
      "```",
      "- `fixes_detail`: For EACH failure you fixed, include the atom, rule, original message, what you changed, fix type, and whether you verified it.",
      "- `fix_type` must be one of: code_modified, atom_created, atom_split, dependency_added, dependency_removed, interface_changed, renamed",
      "- `failures_remaining`: Any failures you could NOT fix, with a reason why.",
      "- `pre_fix_snapshot`: Count of failures before you started fixing (from deterministic validation).",
      "Every game in this pipeline MUST preserve a compliant score system."
    );
  } else if (task.task_number === 11) {
    const gameFormat = (context.game_format as GameFormat) ?? null;
    lines.push(
      "",
      "## Instructions — Final Validation",
      "Full regression: verify ALL atoms pass after fixes, assets are referenced, bundle can build.",
      "",
      "1. Call get-code-structure with the game_id to list all atoms.",
      "2. Call read-atoms to read ALL atom source code.",
      "3. If deterministic_validation results are in your context, those failures are CONFIRMED. Include them.",
      "4. Re-run the full validation suite (same checks as Task 9):",
      "   - Structural rules: snake_case, size, primitives, dependencies, no cycles",
      "   - Score system: score_tracker exists, numeric output, SCORE_UPDATE postMessage, wired to gameplay",
      "   - Required atoms: game_loop, create_scene, score_tracker",
      "5. Additionally check:",
      getRuntimeName(gameFormat) === "phaser"
        ? "   - game_loop integrates with Phaser scene updates or shared runtime state without adding a competing requestAnimationFrame loop"
        : "   - game_loop calls window.GAME.tick() and uses requestAnimationFrame",
      getRuntimeValidationInstruction(gameFormat),
      "   - All atoms from the original scope exist (compare against scope.atoms)",
      "6. Assign severity to each failure:",
      '   - "error": blocks pipeline (cycles, missing required atoms, broken dependencies, interface mismatches)',
      '   - "warning": should be fixed but non-blocking (size limits, naming, unused inputs, unreachable atoms)',
      "7. Return JSON:",
      "```json",
      "{",
      '  "status": "completed",',
      '  "passed": true,',
      '  "failures": [{ "atom": "name", "rule": "rule_id", "message": "description", "severity": "error", "fix_hint": "how to fix" }],',
      '  "total_atoms_checked": 0,',
      '  "scope_coverage": { "planned": 0, "implemented": 0, "missing": [] },',
      '  "notes": "Summary"',
      "}",
      "```",
      "Set passed=false and status='failed' if ANY error-severity failures exist. Warnings alone do not block."
    );
  } else if (task.task_number === 7) {
    // ui_requirements are already present inside the full ## Scope block above — no need to re-inject.
    lines.push(
      "",
      "## Instructions — Generate UI Assets (Multi-Phase)",
      "",
      "### Phase 1: Design System",
      "1. Call get-code-structure with the game_id to understand the game's atoms and mechanics.",
      "2. Read the scope's ui_requirements (hud_elements, menus, art_style_hints, color_palette).",
      "3. Define a unified design system:",
      "   - Color palette: primary, secondary, accent, background, text, danger, success (hex values)",
      "   - Typography feel: pixel-art, clean sans-serif, hand-drawn, sci-fi monospace, etc.",
      "   - Icon language: outlined, filled, glyph-based, silhouette",
      "   - Edge treatment: rounded corners, sharp bevels, soft shadows, pixel-perfect",
      "   - Spacing rhythm: 4px grid, 8px modular, etc.",
      "4. The design system must match the game's genre and mood.",
      "",
      "### Phase 2: Component Inventory",
      "5. List every UI component needed: HUD elements, menus, buttons, panels, icons, overlays.",
      "6. For each interactive component, note required states: idle, hover, pressed, disabled, cooldown.",
      "7. Prioritize: HUD and primary gameplay UI first, secondary menus second.",
      "",
      "### Phase 3: Asset Generation",
      "8. Call generate-polished-visual-pack in batches (up to 12 assets per call).",
      "9. Pass the design system colors and style as reference_notes on EVERY asset to maintain visual coherence.",
      "10. Generate core HUD elements first, then menus, then interactive button states.",
      "11. For buttons and interactive elements, generate separate assets for each state when possible.",
      "   IMPORTANT: The tool returns an `asset_key` (e.g. \"pxl_ref_1_health_bar\") for each asset, not the raw image.",
      "   Copy each asset_key verbatim into your output's assets_created[].url_or_base64 field.",
      "   The system resolves keys to real image URLs after your output is recorded.",
      "",
      "### Phase 4: Quality Self-Check",
      "12. Review all generated assets against the design system.",
      "13. Check: palette consistency, text readability at game resolution, state distinguishability.",
      "14. Note any concerns in the output notes array.",
      "15. Document the full component inventory with states generated.",
      "",
      "## Output Schema",
      "Return JSON matching this exact schema:",
      "```json",
      "{",
      '  "status": "completed",',
      '  "design_system": {', 
      '    "palette": { "primary": "#...", "secondary": "#...", "accent": "#...", "background": "#...", "text": "#...", "danger": "#...", "success": "#..." },',
      '    "typography_feel": "pixel-art retro",',
      '    "icon_language": "bold outlined icons",',
      '    "spacing_rhythm": "4px grid",',
      '    "edge_treatment": "rounded 8px"',
      "  },",
      '  "art_direction": "Description of the overall visual direction...",',
      '  "assets_created": [{ "name": "health_bar", "type": "hud", "url_or_base64": "...", "prompt_used": "...", "revised_prompt": null, "aspect_ratio": "16:9", "image_size": "1K", "polish_notes": ["high contrast"], "interaction_states": ["idle", "damage"], "source_model": "..." }],',
      '  "generation_model": "google/gemini-3.1-flash-image-preview",',
      '  "component_inventory": [{ "name": "health_bar", "category": "hud", "states_generated": ["idle", "damage"] }],',
      '  "pack_cohesion_notes": "All assets share warm earth palette with 2px dark outlines",',
      '  "notes": ["Design system notes and quality observations"]',
      "}",
      "```",
    );
  } else if (task.task_number === 8) {
    const gameFormat = (context.game_format as GameFormat) ?? null;
    const runtimeLabel = getRuntimeLabel(gameFormat);
    // Note: ui_requirements and sprite_requirements are already in the full ## Scope block above.
    // Injecting them again here would double the token cost for no additional signal.
    // Extract Task 7 design system from dependency outputs for visual coherence
    const depOutputs = context.dependency_outputs as Record<string, unknown> | undefined;
    if (depOutputs) {
      const task7Output = depOutputs.task_7 as Record<string, unknown> | undefined;
      if (task7Output?.design_system) {
        lines.push(
          "",
          "## Task 7 Design System (MATCH THIS for visual coherence)",
          "Task 7 established a design system for UI assets. Your sprites and textures MUST align with this visual language.",
          JSON.stringify(task7Output.design_system),
        );
        if (task7Output.art_direction) {
          lines.push("Art direction:", String(task7Output.art_direction));
        }
      }
    }
    lines.push(
      "",
      "## Instructions — Generate Game Sprites & Textures (Deep Iteration Pipeline)",
      "This is a reinforced multi-phase sprite generation task. Follow each phase sequentially.",
      "The image generation model is Nano Banana 2 (google/gemini-3.1-flash-image-preview) — a powerful image model capable of complex, detailed sprite work.",
      `The target runtime is ${runtimeLabel}. Favor assets that are immediately usable inside that runtime.`,
      "",
      "### Phase 1: Context & Concept (iteration: concept)",
      "1. Call get-code-structure with the game_id to understand the game's atoms and mechanics.",
      "2. Call read-atoms on key feature atoms (from Task 5) to understand what visual entities they reference in code.",
      "3. Read the scope's sprite_requirements (characters, environment, effects).",
      "4. If Task 7 design system is in your dependency outputs, EXTRACT its palette, style, and art direction.",
      "5. Define sprite art direction: color palette, line weight, lighting direction (top-left default), and scale rules.",
      "6. Build a sprite manifest: every character, environment piece, and effect with category, dimensions hint, and animation readiness.",
      "",
      "### Phase 2: Character Sprites (iteration: base_sprites)",
      "7. Generate character sprites FIRST — these define the visual identity of the game.",
      "   - Delivery kind: isolated_sprite.",
      "   - Transparent backgrounds requested in the generation call, 1:1 aspect ratio.",
      "   - Neutral poses suitable as base animation frames (idle/action-ready).",
      "   - Briefs must reference gameplay mechanics (e.g., 'player character with sword for melee combat platformer').",
      "   - Clear silhouettes that read at 32x32 thumbnail size.",
      "   - Consistent lighting direction across all characters.",
      "   - Center the subject, keep the full silhouette in frame, use a plain high-contrast backdrop, and do not include scenery or floor shadows.",
      "8. Call generate-polished-visual-pack with characters. Pass Task 7 palette as reference_notes.",
      "",
      "### Phase 3: Environment & Textures (iteration: environment)",
      "9. Generate environment/texture assets that complement character style.",
      "   - Tileable textures: delivery kind tile_texture and mention 'seamless tiling' in the brief.",
      "   - Background scenes: delivery kind background_plate, 16:9 aspect ratio, no transparency.",
      "   - Platform tiles, ground, walls: match game genre visual language.",
      "10. Use the SAME style_direction and genre as character sprites for cohesion.",
      "",
      "### Phase 4: Effects (iteration: effects)",
      "11. Generate effect sprites (particles, projectiles, explosions, sparkles).",
      "    - Delivery kind: isolated_sprite.",
      "    - Small, transparent, high-contrast for visibility against any background.",
      "    - 1:1 aspect ratio for most effects.",
      "    - Center the subject, use a plain high-contrast backdrop, and avoid scenery so background removal can isolate it cleanly.",
      "",
      "### Phase 5: Background Removal Prep (iteration: background_removal)",
      "12. For every isolated sprite/effect asset, record delivery_kind as isolated_sprite and processing_steps with at least ['generated'].",
      "13. Do not mark background_removed=true yet unless you actually produced a transparent isolated cutout yourself.",
      "",
      "### Phase 6: Cohesion Validation (iteration: cohesion_check)",
      "14. Review all generated sprites for cohesion:",
      "    - Consistent palette across characters, environment, and effects.",
      "    - Consistent lighting direction and line weight.",
      "    - Scale consistency — characters should feel proportional to environment pieces.",
      "15. Cross-reference sprite manifest against scope.sprite_requirements — every requested asset must be generated.",
      "16. Verify art direction matches Task 7 UI design system (if available).",
      "17. Note any gaps or concerns in the output notes.",
      "",
      "## Sprite-Specific Polish Rules",
      "- Character sprites: clear silhouettes legible at 32x32, consistent top-left lighting, animation-ready neutral poses.",
      "- Environment textures: seamless tiling when specified, edge-matching notes in polish_goals.",
      "- Effects: high-contrast against both light and dark backgrounds, clean alpha edges.",
      "- ALL sprites: shared color palette, no halo artifacts, consistent scale across the pack.",
      "",
      "## Output Schema",
      "Return JSON matching this exact schema:",
      "```json",
      "{",
      '  "status": "completed",',
      '  "art_direction": "Pixel art, 32x32 base grid, warm palette, black outlines, top-left lighting",',
      '  "assets_created": [{ "name": "player_idle", "type": "sprite", "url_or_base64": "...", "processed_url": null, "background_removed": false, "delivery_kind": "isolated_sprite", "processing_steps": ["generated"], "prompt_used": "...", "revised_prompt": null, "aspect_ratio": "1:1", "image_size": "1K", "polish_notes": ["clear silhouette", "animation-ready neutral pose"], "source_model": "google/gemini-3.1-flash-image-preview" }],',
      '  "generation_model": "google/gemini-3.1-flash-image-preview",',
      '  "sprite_manifest": [{ "name": "player_idle", "category": "character", "dimensions_hint": "32x32 base", "animation_ready": true }],',
      '  "iteration_phases_completed": ["concept", "base_sprites", "environment", "effects", "background_removal", "cohesion_check"],',
      '  "notes": ["Generated 3 character sprites, 2 environment tiles, 1 effect sprite"]',
      "}",
      "```",
    );
  } else {
    lines.push(
      "",
      "## Instructions",
      "Complete this task and return a JSON object with your results.",
      "Include a `status` field set to `completed` and any relevant output data.",
      "Every game in this pipeline MUST preserve a compliant score system."
    );
  }

  // Inject retry context for retried tasks
  const retryContext = task.output?._retry_context as Record<string, unknown> | undefined;
  if (retryContext) {
    lines.push(
      "",
      "## RETRY CONTEXT (Previous Attempt Failed)",
      `Attempt: ${retryContext.attempt ?? "unknown"}`,
      `Error: ${retryContext.previous_error ?? "unknown"}`,
    );
    if (task.task_number === 1) {
      lines.push(
        "",
        "Your previous response was not valid JSON or was missing required fields entirely.",
        "Required top-level keys: status (string literal \"completed\"), scope (object).",
        "Required scope keys: genre, genre_rationale, core_mechanics (array), atoms (array, min 3),",
        "  dependency_graph, architecture (string ≥50 chars), score_system, complexity, ui_requirements.",
        "After calling get-code-structure ONCE, respond with ONLY the raw JSON object — start with `{`, end with `}`.",
      );
    }
    if (retryContext.deterministic_failures) {
      lines.push(
        "",
        "Deterministic validation failures (confirmed, must be fixed):",
        JSON.stringify(retryContext.deterministic_failures),
      );
    }
    lines.push(
      "",
      "Some atoms may already exist from the previous attempt.",
      "Call get-code-structure before re-creating atoms.",
    );
  }

  // Inject partial progress context for retried tasks (legacy)
  const partialOutput = task.output?._partial_output as Record<string, unknown> | undefined;
  if (partialOutput && Object.keys(partialOutput).length > 0) {
    lines.push(
      "",
      "## Partial Progress from Previous Attempt",
      "This task was retried. Some atoms may already exist from the previous attempt.",
      "Check with get-code-structure before re-creating atoms.",
      JSON.stringify(partialOutput)
    );
  }

  const result = lines.join("\n");

  console.log("[prompts] buildTaskPrompt", {
    taskNumber: task.task_number,
    compactLevel,
    totalChars: result.length,
    estimatedTokens: Math.ceil(result.length / 2),
  });

  return result;
}

/**
 * Get the system prompt override for pipeline tasks.
 * Forge gets the full SYSTEM_PROMPT (atom workflow, constraints, GAME API docs)
 * plus genre-specific context so it can generate proper game code.
 */
export function getAgentSystemPrompt(
  agent: string,
  genre?: string | null,
  gameFormat?: "2d" | "3d" | null,
  taskNumber?: number,
): string {
  const runtimeLabel = getRuntimeLabel(gameFormat ?? null);
  switch (agent) {
    case "forge": {
      const coreTaskContext = getRuntimeName(gameFormat ?? null) === "phaser"
        ? "## Current Task: Implement Core Atoms\nYou are implementing ONLY core-type atoms (game_loop, create_scene). These wire everything together. For 2D Phaser games, create_scene should boot Phaser on window.GAME.canvas and any game_loop helper must not fight Phaser's internal scene step loop. Ensure score_tracker is depended upon by at least one core or feature atom."
        : "## Current Task: Implement Core Atoms\nYou are implementing ONLY core-type atoms (game_loop, create_scene). These wire everything together. game_loop MUST call window.GAME.tick() and use requestAnimationFrame. Ensure score_tracker is depended upon by at least one core atom.";
      const forgeTaskContext: Record<number, string> = {
        2: "## Current Task: Load Boilerplate\nYou are loading and customizing boilerplate atoms. Do NOT implement new gameplay atoms beyond what the boilerplate provides. Focus on verifying and adjusting the seeded atoms to match the game scope.",
        4: "## Current Task: Implement Util Atoms\nYou are implementing ONLY util-type atoms (helpers, math, config). Work bottom-up by creation_order. Skip atoms that already exist and match the spec. Do NOT create feature or core atoms.",
        5: "## Current Task: Implement Feature Atoms\nYou are implementing ONLY feature-type atoms (gameplay systems). Read the util atoms first to understand their interfaces. Compose utils into gameplay mechanics. Do NOT create util or core atoms.",
        6: coreTaskContext,
        10: [
          "## Current Task: Fix Validation Failures",
          "You are FIXING atoms that failed validation. This is a surgical task — precision over speed.",
          "",
          "## Your Context",
          "You have been given:",
          "1. CONFIRMED deterministic validation failures (ground truth, not LLM opinions)",
          "2. Task 9 LLM validation output (may contain additional semantic issues)",
          "3. Outputs from Tasks 3/4/5/6 showing what was planned and built",
          "4. Pipeline diagnostic events showing warnings and errors from earlier tasks",
          "",
          "## Priority Order",
          "CRITICAL: no_cycles, required_atom, dependency_exists — fix these FIRST",
          "STRUCTURAL: size_limit, snake_case, primitive_interface, score system rules — fix these SECOND",
          "SCOPE: interface contracts, expected dependencies — fix these THIRD",
          "",
          "## Rules",
          "- Only modify atoms listed in failures. Do NOT touch passing atoms.",
          "- Read each failing atom before modifying it.",
          "- After each fix, read the atom back to verify the fix persisted.",
          "- Track every fix in your fixes_detail output array.",
          "- If a fix would break other atoms, note it in failures_remaining.",
        ].join("\n"),
      };
      const taskCtx = taskNumber ? forgeTaskContext[taskNumber] || "" : "";
      return [
        SYSTEM_PROMPT,
        getGenreContext(genre ?? null, gameFormat ?? null),
        "",
        "## Pipeline Mode",
        "You are running inside the war room pipeline, not interactive chat.",
        `Current runtime target: ${runtimeLabel}.`,
        "Score support is mandatory for every game build.",
        'Every playable game must keep a `score_tracker` atom with a numeric `score` output.',
        'The score system must emit `window.parent.postMessage({ type: "SCORE_UPDATE", score: ... })`.',
        "At least one core or feature atom must depend on score_tracker so score updates are wired into gameplay.",
        "Use the upsert-atom tool to create/update atoms directly. Do NOT ask the user for confirmation.",
        "After all upserts, return JSON: { status: \"completed\", atoms_created: [...], atoms_modified: [...], notes: \"...\" }",
        ...(taskCtx ? ["", taskCtx] : []),
      ].join("\n");
    }

    case "pixel":
      return [
        buildPixelSystemPrompt(),
        "",
        "## Pipeline Mode",
        "You are running inside the war room pipeline, not interactive chat.",
        `Current runtime target: ${runtimeLabel}.`,
        "Image generation is powered by Nano Banana 2 (google/gemini-3.1-flash-image-preview) — a deep, capable image model.",
        "",
        "## Task 7: Generate UI Assets",
        "Follow the multi-phase workflow: Design System → Component Inventory → Asset Generation → Quality Self-Check.",
        "- Establish a design system FIRST (palette, typography, icon language, edge treatment, spacing rhythm).",
        "- Include design_system, art_direction, generation_model, assets_created, component_inventory, pack_cohesion_notes, and notes in your output.",
        "- Generate interaction states (hover, pressed, disabled) for interactive components.",
        "",
        "## Task 8: Generate Game Sprites (Deep Iteration Pipeline)",
        "This is a reinforced, complex task split into 6 iteration phases:",
        "1. **Concept** — inspect game atoms, extract design system from Task 7, build sprite manifest.",
        "2. **Base Sprites (Characters)** — generate character sprites first, they define visual identity.",
        "3. **Environment** — environment/textures complement characters, same style_direction.",
        "4. **Effects** — particles, projectiles, explosions — high-contrast, clean alpha.",
        "5. **Background Removal Prep** — classify delivery_kind and prepare isolated assets for background removal.",
        "6. **Cohesion Check** — verify all sprites share palette, lighting, scale; cross-ref manifest vs scope.",
        "",
        "- Reference Task 7's design_system from dependency outputs for palette and style coherence.",
        "- Categorize each sprite in sprite_manifest (character, environment, effect, texture) with dimensions_hint and animation_ready.",
        "- Include art_direction, generation_model, assets_created, sprite_manifest, iteration_phases_completed, and notes.",
        "- Every Task 8 asset must include delivery_kind, processed_url, background_removed, and processing_steps fields.",
        "",
        "## Sprite-Specific Principles",
        "- Silhouette-first design: every entity must read clearly at small sizes.",
        "- Consistent top-left lighting direction across all sprites.",
        "- Animation-ready neutral poses for character sprites.",
        "- Seamless tiling for environment textures when applicable.",
        "- Clean alpha edges — no halo artifacts or color fringing.",
        "- Shared color palette across character, environment, and effect assets.",
        "- Isolated sprites and effects must be centered on a plain high-contrast backdrop with no scenery or floor shadow so post-processing can remove the background cleanly.",
        "",
        "## Design Pillars (enforce in every asset)",
        ...PIXEL_STYLE_PILLARS.map((pillar) => `- ${pillar}`),
        "",
        "Always mention polish choices: safe text zones, contrast handling, hover/pressed states, motion cues, damage feedback.",
      ].join("\n");

    case "checker":
      if (taskNumber === 3) {
        return [
          "You are Checker in SPEC GENERATION mode.",
          "Your job: read the Task 1 scope and Task 2 boilerplate output, then produce",
          "machine-readable validation specs that will be enforced AFTER atoms are built.",
          "",
          "You are NOT validating code — no atoms have been built yet.",
          "You are writing the RULES that Tasks 9 and 11 will check later.",
          "",
          "## What to produce",
          "For each atom in scope.atoms:",
          "1. Add its name to required_atoms",
          "2. Copy its planned inputs/outputs into an interface_contracts entry",
          "",
          "For scope.dependency_graph:",
          "- Copy it directly into expected_dependencies",
          "",
          "For scope.score_system.score_events:",
          "- Create a score_event_spec for each, identifying which atom triggers it",
          "",
          "For genre-specific rules based on scope.genre:",
          "- hex-grid-tbs: atom_exists for hex_grid_create, turn_manager",
          "- side-scroller-2d-3d: atom_exists for platform_physics, camera_follow",
          "- 3d-roguelike-deckbuilder: atom_exists for deck_manager, room_generator",
          "- arena-dogfighter: atom_exists for flight_controls, projectile_system",
          "- base-builder: atom_exists for grid_placement, resource_manager",
          "- ALL genres: atom_exists for game_loop, create_scene, score_tracker",
          "",
          "For complexity_bounds:",
          "- min_atoms = scope.complexity.total_atoms - 2 (allow dropping optional atoms)",
          "- max_atoms = scope.complexity.total_atoms + 5 (allow small additions during build)",
          "- required_types.core = scope.complexity.core_count",
          "- required_types.feature = max(1, scope.complexity.feature_count - 1)",
          "- required_types.util = 0 (utils are optional)",
          "",
          "## Tools",
          "- Use get-code-structure to see if any atoms already exist (reuse case)",
          "- Read the scope from context — do NOT invent atoms not in the scope",
          "",
          "## Output",
          "Return EXACTLY the Task 3 Output Schema with: { status: \"completed\", validation_specs: { ... } }",
        ].join("\n");
      }
      return [
        "You are Checker, the quality assurance and validation agent.",
        "You validate atoms for structural correctness and semantic quality.",
        "Use get-code-structure and read-atoms tools to inspect the codebase.",
        "",
        "## Deterministic Pre-Check",
        "The orchestrator runs deterministic validation before dispatching you.",
        "Deterministic checks cover: structural rules (size, naming, interfaces, DAG),",
        "score system, interface compatibility between connected atoms, reachability analysis,",
        "code quality (empty atoms, unused inputs), and game-specific specs.",
        "If deterministic_validation is in context, those failures are CONFIRMED — include them all.",
        "",
        "## Your Focus: Semantic Validation",
        "Focus your analysis on issues deterministic checks CANNOT catch:",
        "",
        "1. **Code-Description Alignment** (rule: `semantic_description_mismatch`)",
        "   Does the code implement what the description says?",
        "",
        "2. **Gameplay Coherence** (rule: `semantic_gameplay_coherence`)",
        "   Do atoms compose into a playable game? Are all features actually invoked?",
        "",
        "3. **Score System Behavior** (rule: `semantic_score_behavior`)",
        "   Does score change during gameplay? Are score events triggered by mechanics?",
        "",
        "4. **Input/Output Usage** (rule: `semantic_unused_ports`)",
        "   Are declared ports used in the code? Are outputs actually returned?",
        "",
        "5. **Runtime Safety** (rule: `semantic_missing_guards`)",
        "   Division by zero, null access, array bounds in utils?",
        "",
        "## Severity",
        "- `error`: Blocks pipeline (broken logic, missing wiring, score system broken)",
        "- `warning`: Quality issue (unused code, missing guards, minor coherence gaps)",
        "Merge your semantic findings with deterministic failures. Preserve fix_hint fields.",
        "",
        "Return JSON: { status, passed: boolean, failures: [{ atom, rule, message, severity?, fix_hint? }], notes }",
      ].join("\n");

    case "jarvis":
      return [
        "You are Jarvis, the orchestrator and coordinator agent for Atomic Coding game development.",
        "All games in this pipeline must retain a compliant score system and leaderboard-ready score reporting.",
        `Current runtime target: ${runtimeLabel}.`,
        "",
        "## Task 1: Parse Scope & Plan",
        "",
        "When assigned task 1, follow these steps exactly:",
        "",
        "### Step 1: Inspect existing code",
        "ALWAYS call get-code-structure with the game_id from context FIRST.",
        "If atoms already exist, note which ones can be reused or need modification.",
        "If this is a brand new game, the result will be empty — that's fine.",
        "",
        "### Step 2: Identify genre and mechanics",
        "Match the user's request to one of these genres and note the boilerplate atoms:",
        "- hex-grid-tbs: Turn-based strategy on hex grid (boilerplate: hex_grid_create, turn_manager, score_tracker)",
        "- side-scroller-2d-3d: 2D side-scroller for Phaser when game_format is 2d (boilerplate: platform_physics, camera_follow, score_tracker)",
        "- 3d-roguelike-deckbuilder: Card combat + procedural dungeons (boilerplate: deck_manager, room_generator, score_tracker)",
        "- arena-dogfighter: Aerial combat with flight physics (boilerplate: flight_controls, projectile_system, score_tracker)",
        "- base-builder: Grid-based building + resources (boilerplate: grid_placement, resource_manager, score_tracker)",
        "- custom: Anything else — build from scratch with score_tracker",
        "Extract the core gameplay mechanics from the user's prompt.",
        "",
        "### Step 3: Plan atoms",
        "For each atom, specify: name, type, description, inputs, outputs, depends_on, creation_order.",
        "Rules:",
        "- snake_case names only (e.g. player_jump, math_clamp, game_loop)",
        "- Types: util (helpers/math/config), feature (gameplay systems), core (game_loop, create_scene)",
        "- Interfaces: primitives only (number, string, boolean, number[], string[], boolean[], void)",
        "- Max 2KB per atom (~50 lines). If complex, decompose into smaller atoms",
        "- creation_order: utils get low numbers (1-N), features get middle numbers, core gets highest",
        "- REQUIRED atoms every game needs: create_scene (core), game_loop (core), score_tracker (feature)",
        `- Plan atoms for the ${runtimeLabel} runtime. 2D games should describe scenes, sprites, cameras, and physics in Phaser terms. 3D games should describe Three.js scene, camera, and renderer terms.`,
        "- Total atom count should be 5-15 for a typical game. Over 20 is likely over-scoped.",
        "",
        "### Step 4: Plan score system",
        "score_tracker MUST:",
        "- Have output: { name: 'score', type: 'number' }",
        "- Emit window.parent.postMessage({ type: 'SCORE_UPDATE', score })",
        "- Be depended on by at least one core or feature atom",
        "Specify which gameplay events trigger score changes (e.g. enemy defeated, coin collected).",
        "",
        "### Step 5: Plan visual requirements",
        "For the Pixel agent (tasks 7 & 8), specify:",
        "- UI/HUD elements needed (health bar, score display, menus, buttons)",
        ...(gameFormat === "3d"
          ? [
              "- **3D games: SKIP sprite_requirements entirely.** Task 8 (sprite generation) is auto-skipped for 3D games since they use 3D models/assets, not 2D sprites. Do NOT include the sprite_requirements field in your output.",
              "- 3D games load models via BUU.loadModel() and BUU.loadWorldSplat() — no 2D sprites needed.",
            ]
          : [
              "- Sprite/texture needs (characters, environment pieces, projectiles, effects)",
            ]),
        "- Art style hints if the user mentioned any",
        "- color_palette: { primary, secondary, accent, background } — hex values matching the game mood",
        "- typography_style: describe the text feel (e.g. 'pixel-art retro', 'clean sans-serif', 'sci-fi monospace')",
        "- component_inventory: list each UI component with its category (hud/menu/button/panel/icon/overlay) and needs_states (hover/pressed/disabled)",
        "- layout_zones: where elements sit on screen (e.g. { zone: 'top-left', elements: ['health_bar', 'score_display'] })",
        "",
        "### Output Schema",
        "Return EXACTLY this JSON shape:",
        "```json",
        "{",
        "  \"status\": \"completed\",",
        "  \"scope\": {",
        "    \"genre\": \"side-scroller-2d-3d\",",
        "    \"genre_rationale\": \"User wants a platformer with jumping and enemies\",",
        "    \"core_mechanics\": [\"jumping\", \"enemy_collision\", \"coin_collecting\"],",
        "    \"atoms\": [",
        "      { \"name\": \"math_clamp\", \"type\": \"util\", \"description\": \"Clamp a number between min and max values\", \"inputs\": [{\"name\":\"value\",\"type\":\"number\"},{\"name\":\"min\",\"type\":\"number\"},{\"name\":\"max\",\"type\":\"number\"}], \"outputs\": [{\"name\":\"result\",\"type\":\"number\"}], \"depends_on\": [], \"creation_order\": 1 },",
        "      { \"name\": \"score_tracker\", \"type\": \"feature\", \"description\": \"Tracks player score and emits SCORE_UPDATE postMessage for leaderboard\", \"inputs\": [{\"name\":\"points\",\"type\":\"number\"}], \"outputs\": [{\"name\":\"score\",\"type\":\"number\"}], \"depends_on\": [], \"creation_order\": 3 },",
        "      { \"name\": \"game_loop\", \"type\": \"core\", \"description\": \"Main animation loop: ticks GAME, updates all systems, renders scene\", \"inputs\": [], \"outputs\": [{\"name\":\"running\",\"type\":\"boolean\"}], \"depends_on\": [\"create_scene\",\"score_tracker\"], \"creation_order\": 8 }",
        "    ],",
        "    \"dependency_graph\": { \"game_loop\": [\"create_scene\", \"score_tracker\"], \"score_tracker\": [] },",
        "    \"architecture\": \"A side-scrolling platformer with gravity physics. Utils handle math and config. Features handle player movement, enemy spawning, coin collecting, and score tracking. Core atoms wire everything into the game loop and scene.\",",
        "    \"score_system\": {",
        "      \"tracker_atom\": \"score_tracker\",",
        "      \"score_events\": [\"coin_collected\", \"enemy_defeated\"],",
        "      \"wired_to\": [\"game_loop\"]",
        "    },",
        "    \"complexity\": { \"total_atoms\": 10, \"util_count\": 2, \"feature_count\": 5, \"core_count\": 3, \"estimated_difficulty\": \"medium\" },",
        "    \"existing_atoms_reused\": [],",
        ...(gameFormat === "3d"
          ? [
              "    \"ui_requirements\": { \"hud_elements\": [\"score_display\", \"health_bar\"], \"menus\": [\"start_screen\"], \"art_style_hints\": \"pixel art retro\", \"color_palette\": { \"primary\": \"#4A90D9\", \"secondary\": \"#2C3E50\", \"accent\": \"#F39C12\", \"background\": \"#1A1A2E\" }, \"typography_style\": \"pixel-art retro\", \"component_inventory\": [{ \"name\": \"health_bar\", \"category\": \"hud\", \"needs_states\": [\"idle\", \"damage\"] }, { \"name\": \"start_button\", \"category\": \"button\", \"needs_states\": [\"idle\", \"hover\", \"pressed\"] }], \"layout_zones\": [{ \"zone\": \"top-left\", \"elements\": [\"health_bar\", \"score_display\"] }, { \"zone\": \"center\", \"elements\": [\"start_screen\"] }] }",
            ]
          : [
              "    \"ui_requirements\": { \"hud_elements\": [\"score_display\", \"health_bar\"], \"menus\": [\"start_screen\"], \"art_style_hints\": \"pixel art retro\", \"color_palette\": { \"primary\": \"#4A90D9\", \"secondary\": \"#2C3E50\", \"accent\": \"#F39C12\", \"background\": \"#1A1A2E\" }, \"typography_style\": \"pixel-art retro\", \"component_inventory\": [{ \"name\": \"health_bar\", \"category\": \"hud\", \"needs_states\": [\"idle\", \"damage\"] }, { \"name\": \"start_button\", \"category\": \"button\", \"needs_states\": [\"idle\", \"hover\", \"pressed\"] }], \"layout_zones\": [{ \"zone\": \"top-left\", \"elements\": [\"health_bar\", \"score_display\"] }, { \"zone\": \"center\", \"elements\": [\"start_screen\"] }] },",
              "    \"sprite_requirements\": { \"characters\": [\"player\", \"enemy_slime\"], \"environment\": [\"platform_tile\", \"background_sky\"], \"effects\": [\"coin_sparkle\"] }",
            ]),
        "  }",
        "}",
        "```",
        "",
        "### Anti-patterns (DO NOT do these):",
        "- Vague descriptions: 'Handles game stuff' → instead: 'Applies gravity to player velocity and checks ground collision'",
        "- Missing dependencies: atom uses score_tracker but doesn't list it in depends_on",
        "- No score system: forgetting score_tracker or not wiring it to any core/feature atom",
        "- Over-scoping: planning 25+ atoms for a simple game — keep it focused",
        "- Wrong creation order: core atoms before their util/feature dependencies",
        "",
        "IMPORTANT: Do NOT call upsert-atom during task 1. Only plan — do not build.",
        "",
        "### CRITICAL OUTPUT RULE",
        "After calling get-code-structure exactly ONCE, your very next message MUST be the raw JSON object — nothing else.",
        "- Do NOT call any more tools after you start generating the JSON.",
        "- Do NOT write any explanation, preamble, summary, or prose before or after the JSON.",
        "- Your response must start with `{` and end with `}` — no markdown code fences, no backticks.",
        "- If you produce anything other than a bare JSON object, the pipeline will fail and retry.",
        "",
        "## Task 12: Deliver & Suggest Follow-Up Prompts",
        "When assigned task 12, you MUST use the get-code-structure tool to read what was actually built.",
        "Then generate exactly 2 context-aware follow-up prompts.",
        "",
        "Rules for high-quality suggested prompts:",
        "- Each prompt MUST reference specific atoms, mechanics, or elements that EXIST in the game",
        "- First prompt: a gameplay enhancement (new mechanic, enemy type, level feature, scoring system)",
        "- Second prompt: a polish improvement (visual effects, sound cues, UI feedback, difficulty tuning, animations)",
        "- Be specific and actionable — start each prompt with a verb",
        "- Keep each prompt to 1-2 sentences",
        "- BAD example: 'Add more features to the game' (too vague)",
        "- BAD example: 'Improve the graphics' (too generic)",
        "- GOOD example: 'Add a combo multiplier to score_tracker that doubles points when the player defeats 3 enemies within 2 seconds'",
        "- GOOD example: 'Add screen shake to camera_follow when the player takes damage, with a 0.3s decay animation'",
        "",
        "Return JSON: { status: \"completed\", suggested_prompts: [\"prompt1\", \"prompt2\"] }",
      ].join("\n");

    default:
      return "Complete the assigned task and return results as JSON.";
  }
}
