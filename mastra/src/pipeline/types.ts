import { z } from "zod";

// =============================================================================
// Task 1 Output Schema (Parse Scope & Plan)
// =============================================================================

export const AtomSpecSchema = z.object({
  name: z.string().regex(/^[a-z][a-z0-9]*(_[a-z0-9]+)*$/, "Must be snake_case"),
  type: z.enum(["core", "feature", "util"]),
  description: z.string().min(10, "Description must be meaningful"),
  inputs: z.array(z.object({ name: z.string(), type: z.string() })).default([]),
  outputs: z.array(z.object({ name: z.string(), type: z.string() })).default([]),
  depends_on: z.array(z.string()).default([]),
  creation_order: z.number().int().positive(),
  notes: z.string().optional(),
});

export const SpriteAnimationRequirementSchema = z.enum([
  "idle",
  "walk",
  "jump",
  "attack",
]);

export const Task1CharacterSpriteRequirementSchema = z.object({
  stable_id: z.string().regex(/^[a-z][a-z0-9]*(_[a-z0-9]+)*$/, "Must be snake_case"),
  label: z.string().min(1),
  prompt_brief: z.string().min(10),
  required_animations: z.array(SpriteAnimationRequirementSchema).min(1),
  uses_visual_reference: z.boolean().default(false),
  dimensions_hint: z.string().optional(),
});

export const Task1EnvironmentSpriteRequirementSchema = z.object({
  stable_id: z.string().regex(/^[a-z][a-z0-9]*(_[a-z0-9]+)*$/, "Must be snake_case"),
  label: z.string().min(1),
  prompt_brief: z.string().min(10),
  delivery_kind: z.enum(["tile_texture", "background_plate", "environment_sprite"]),
  generate_parallax_layers: z.boolean().default(false),
  dimensions_hint: z.string().optional(),
});

export const Task1EffectSpriteRequirementSchema = z.object({
  stable_id: z.string().regex(/^[a-z][a-z0-9]*(_[a-z0-9]+)*$/, "Must be snake_case"),
  label: z.string().min(1),
  prompt_brief: z.string().min(10),
  delivery_kind: z.enum(["isolated_sprite", "effect_sheet"]),
  required_animations: z.array(SpriteAnimationRequirementSchema).default([]),
  dimensions_hint: z.string().optional(),
});

export const Task1ScopeSchema = z.object({
  genre: z.string(),
  genre_rationale: z.string(),
  core_mechanics: z.array(z.string()).min(1),
  atoms: z.array(AtomSpecSchema).min(3),
  dependency_graph: z.record(z.array(z.string())),
  architecture: z.string().min(50),
  score_system: z.object({
    tracker_atom: z.literal("score_tracker"),
    score_events: z.array(z.string()).min(1),
    wired_to: z.array(z.string()).min(1),
  }),
  complexity: z.object({
    total_atoms: z.number().int(),
    util_count: z.number().int(),
    feature_count: z.number().int(),
    core_count: z.number().int(),
    estimated_difficulty: z.enum(["simple", "medium", "ambitious"]),
  }),
  existing_atoms_reused: z.array(z.string()).default([]),
  ui_requirements: z.object({
    hud_elements: z.array(z.string()).default([]),
    menus: z.array(z.string()).default([]),
    art_style_hints: z.string().optional(),
    color_palette: z.object({
      primary: z.string(),
      secondary: z.string(),
      accent: z.string(),
      background: z.string(),
    }).optional(),
    typography_style: z.string().optional(),
    component_inventory: z.array(z.object({
      name: z.string(),
      category: z.enum(["hud", "menu", "button", "panel", "icon", "overlay"]),
      needs_states: z.array(z.string()).default([]),
    })).default([]),
    layout_zones: z.array(z.object({
      zone: z.string(),
      elements: z.array(z.string()),
    })).default([]),
  }),
  sprite_requirements: z.object({
    characters: z.array(Task1CharacterSpriteRequirementSchema).default([]),
    environment: z.array(Task1EnvironmentSpriteRequirementSchema).default([]),
    effects: z.array(Task1EffectSpriteRequirementSchema).default([]),
  }).optional().describe("Sprite requirements for 2D games. Omit for 3D games (no 2D sprites)."),
});

export const Task1OutputSchema = z.object({
  status: z.literal("completed"),
  scope: Task1ScopeSchema,
});

export type AtomSpec = z.infer<typeof AtomSpecSchema>;
export type Task1CharacterSpriteRequirement = z.infer<typeof Task1CharacterSpriteRequirementSchema>;
export type Task1EnvironmentSpriteRequirement = z.infer<typeof Task1EnvironmentSpriteRequirementSchema>;
export type Task1EffectSpriteRequirement = z.infer<typeof Task1EffectSpriteRequirementSchema>;
export type Task1Scope = z.infer<typeof Task1ScopeSchema>;
export type Task1Output = z.infer<typeof Task1OutputSchema>;

// =============================================================================
// Task 2 Output Schema (Load Genre Boilerplate)
// =============================================================================

export const Task2OutputSchema = z.object({
  status: z.literal("completed"),
  boilerplate_loaded: z.boolean(),
  genre_slug: z.string(),
  atoms_verified: z.array(z.string()).describe("Atoms confirmed present and correct"),
  atoms_customized: z.array(z.string()).describe("Atoms modified for game scope"),
  atoms_created: z.array(z.string()).describe("New atoms added beyond boilerplate"),
  existing_atom_structure: z.object({
    total_atoms: z.number().int(),
    atom_names: z.array(z.string()),
  }),
  customization_notes: z.string().describe("What was changed and why"),
});

export type Task2Output = z.infer<typeof Task2OutputSchema>;

// =============================================================================
// Task 3 Output Schema (Write Validation Specs)
// =============================================================================

export const InterfaceContractSchema = z.object({
  atom_name: z.string(),
  expected_inputs: z.array(z.object({ name: z.string(), type: z.string() })).default([]),
  expected_outputs: z.array(z.object({ name: z.string(), type: z.string() })).default([]),
});

export const ScoreEventSpecSchema = z.object({
  event_name: z.string(),
  trigger_atom: z.string(),
  description: z.string(),
});

export const GenreRuleSchema = z.object({
  rule_id: z.string(),
  description: z.string(),
  check_type: z.enum([
    "atom_exists",
    "atom_has_input",
    "atom_has_output",
    "atom_depends_on",
    "atom_code_contains",
  ]),
  target_atom: z.string(),
  expected_value: z.string().optional(),
});

export const ValidationSpecsSchema = z.object({
  required_atoms: z.array(z.string()).min(3),
  interface_contracts: z.array(InterfaceContractSchema).min(1),
  score_event_specs: z.array(ScoreEventSpecSchema).min(1),
  expected_dependencies: z.record(z.array(z.string())),
  complexity_bounds: z.object({
    min_atoms: z.number().int().min(1),
    max_atoms: z.number().int().min(1),
    required_types: z.object({
      core: z.number().int().min(1),
      feature: z.number().int().min(1),
      util: z.number().int().min(0),
    }),
  }),
  genre_rules: z.array(GenreRuleSchema).default([]),
  notes: z.string().optional(),
});

export const Task3OutputSchema = z.object({
  status: z.literal("completed"),
  validation_specs: ValidationSpecsSchema,
});

export type InterfaceContract = z.infer<typeof InterfaceContractSchema>;
export type ScoreEventSpec = z.infer<typeof ScoreEventSpecSchema>;
export type GenreRule = z.infer<typeof GenreRuleSchema>;
export type ValidationSpecs = z.infer<typeof ValidationSpecsSchema>;
export type Task3Output = z.infer<typeof Task3OutputSchema>;

// =============================================================================
// Task 4 Output Schema (Implement Util Atoms)
// =============================================================================

export const Task4OutputSchema = z.object({
  status: z.literal("completed"),
  atoms_created: z.array(z.string()).describe("New util atoms created"),
  atoms_modified: z.array(z.string()).default([]).describe("Existing util atoms modified"),
  util_atoms_detail: z.array(z.object({
    name: z.string().regex(/^[a-z][a-z0-9]*(_[a-z0-9]+)*$/, "Must be snake_case"),
    type: z.literal("util"),
    depends_on: z.array(z.string()),
    code_size_bytes: z.number().int().max(2048),
  })),
  total_atoms_after: z.number().int(),
  notes: z.string().optional(),
});

export type Task4Output = z.infer<typeof Task4OutputSchema>;

// =============================================================================
// Task 5 Output Schema (Implement Feature Atoms)
// =============================================================================

export const Task5OutputSchema = z.object({
  status: z.literal("completed"),
  atoms_created: z.array(z.string()).describe("New feature atoms created"),
  atoms_modified: z.array(z.string()).default([]).describe("Existing feature atoms modified"),
  feature_atoms_detail: z.array(z.object({
    name: z.string().regex(/^[a-z][a-z0-9]*(_[a-z0-9]+)*$/, "Must be snake_case"),
    type: z.literal("feature"),
    depends_on: z.array(z.string()),
    code_size_bytes: z.number().int().max(2048),
  })),
  score_tracker_included: z.boolean().describe("Whether score_tracker was created/verified"),
  total_atoms_after: z.number().int(),
  notes: z.string().optional(),
});

export type Task5Output = z.infer<typeof Task5OutputSchema>;

// =============================================================================
// Task 6 Output Schema (Implement Core Atoms)
// =============================================================================

export const Task6OutputSchema = z.object({
  status: z.literal("completed"),
  atoms_created: z.array(z.string()).describe("Core atoms created"),
  atoms_modified: z.array(z.string()).default([]).describe("Existing atoms modified"),
  core_atoms_detail: z.array(z.object({
    name: z.string().regex(/^[a-z][a-z0-9]*(_[a-z0-9]+)*$/, "Must be snake_case"),
    type: z.literal("core"),
    depends_on: z.array(z.string()),
    code_size_bytes: z.number().int().max(2048),
  })),
  wiring_verification: z.object({
    game_loop_depends_on: z.array(z.string()).min(1),
    create_scene_exists: z.boolean(),
    score_tracker_wired: z.boolean(),
    total_atoms_after: z.number().int(),
  }),
  notes: z.string().optional(),
});

export type Task6Output = z.infer<typeof Task6OutputSchema>;

// =============================================================================
// Tasks 9/11 Output Schema (Validation Suite)
// =============================================================================

export const ValidationFailureSchema = z.object({
  atom: z.string(),
  rule: z.string(),
  message: z.string(),
  severity: z.enum(["error", "warning"]).optional(),
  fix_hint: z.string().optional(),
});

export const CheckerValidationOutputSchema = z.object({
  status: z.enum(["completed", "failed"]),
  passed: z.boolean(),
  failures: z.array(ValidationFailureSchema),
  total_atoms_checked: z.number().int().optional(),
  scope_coverage: z.object({
    planned: z.number().int(),
    implemented: z.number().int(),
    missing: z.array(z.string()),
  }).optional(),
  notes: z.string().optional(),
});

export type CheckerValidationOutput = z.infer<typeof CheckerValidationOutputSchema>;

// =============================================================================
// Task 10 Output Schema (Fix Failures)
// =============================================================================

export const Task10FixDetailSchema = z.object({
  atom: z.string(),
  rule: z.string(),
  original_message: z.string(),
  fix_applied: z.string().describe("Description of what was changed"),
  fix_type: z.enum([
    "code_modified",
    "atom_created",
    "atom_split",
    "dependency_added",
    "dependency_removed",
    "interface_changed",
    "renamed",
  ]),
  verified: z.boolean().describe("Whether the fix was verified by re-reading the atom"),
});

export const Task10FailureSnapshotSchema = z.object({
  total_failures: z.number().int(),
  critical_failures: z.number().int(),
  warning_failures: z.number().int(),
});

export const Task10OutputSchema = z.object({
  status: z.literal("completed"),
  atoms_fixed: z.array(z.string()),
  atoms_created: z.array(z.string()).default([]),
  fixes_detail: z.array(Task10FixDetailSchema).describe("Per-failure fix record"),
  failures_addressed: z.number().int(),
  failures_remaining: z.array(z.object({
    atom: z.string(),
    rule: z.string(),
    message: z.string(),
    reason_unfixed: z.string().describe("Why this failure was not fixed"),
  })).default([]),
  pre_fix_snapshot: Task10FailureSnapshotSchema.optional(),
  post_fix_snapshot: Task10FailureSnapshotSchema.optional(),
  notes: z.string().optional(),
});

export type Task10FixDetail = z.infer<typeof Task10FixDetailSchema>;
export type Task10Output = z.infer<typeof Task10OutputSchema>;

// =============================================================================
// Task 7 Output Schema (Generate UI Assets)
// =============================================================================

export const Task7DesignSystemSchema = z.object({
  palette: z.object({
    primary: z.string(),
    secondary: z.string(),
    accent: z.string(),
    background: z.string(),
    text: z.string(),
    danger: z.string(),
    success: z.string(),
  }),
  typography_feel: z.string(),
  icon_language: z.string(),
  spacing_rhythm: z.string(),
  edge_treatment: z.string(),
});

export const Task7AssetSchema = z.object({
  name: z.string(),
  type: z.enum(["hud", "menu", "button", "panel", "icon", "overlay", "cursor"]),
  url_or_base64: z.string(),
  prompt_used: z.string(),
  revised_prompt: z.string().nullable(),
  aspect_ratio: z.string(),
  image_size: z.string(),
  polish_notes: z.array(z.string()),
  interaction_states: z.array(z.string()).default([]),
  source_model: z.string(),
});

export const Task7ComponentSchema = z.object({
  name: z.string(),
  category: z.enum(["hud", "menu", "button", "panel", "icon", "overlay"]),
  states_generated: z.array(z.string()),
});

export const Task7OutputSchema = z.object({
  status: z.literal("completed"),
  design_system: Task7DesignSystemSchema,
  art_direction: z.string(),
  assets_created: z.array(Task7AssetSchema).min(1),
  generation_model: z.string().describe("OpenRouter model ID used for image generation"),
  component_inventory: z.array(Task7ComponentSchema),
  pack_cohesion_notes: z.string().optional().describe("How visual unity was maintained across assets"),
  notes: z.array(z.string()),
});

export type Task7DesignSystem = z.infer<typeof Task7DesignSystemSchema>;
export type Task7Asset = z.infer<typeof Task7AssetSchema>;
export type Task7Output = z.infer<typeof Task7OutputSchema>;

// =============================================================================
// Task 8 Output Schema (Generate Game Sprites)
// =============================================================================

export const Task8AssetSchema = z.object({
  name: z.string(),
  type: z.enum(["sprite", "texture", "background", "effect", "icon"]),
  url_or_base64: z.string(),
  processed_url: z.string().nullable().default(null),
  background_removed: z.boolean().default(false),
  delivery_kind: z
    .enum(["isolated_sprite", "tile_texture", "background_plate"])
    .default("isolated_sprite"),
  processing_steps: z.array(z.string()).default(["generated"]),
  prompt_used: z.string(),
  revised_prompt: z.string().nullable(),
  aspect_ratio: z.string(),
  image_size: z.string(),
  polish_notes: z.array(z.string()),
  source_model: z.string(),
});

export const Task8SpriteManifestEntrySchema = z.object({
  name: z.string(),
  category: z.enum(["character", "environment", "effect", "texture"]),
  dimensions_hint: z.string().optional().describe("e.g. '32x32 base grid', '256x512 tall sprite'"),
  animation_ready: z.boolean().default(false).describe("Whether the pose is suitable as a base animation frame"),
});

export const Task8FrameManifestEntrySchema = z.object({
  index: z.number().int().min(0),
  x: z.number().int().min(0),
  y: z.number().int().min(0),
  width: z.number().int().min(1),
  height: z.number().int().min(1),
  bounds: z
    .object({
      x: z.number().int().min(0),
      y: z.number().int().min(0),
      width: z.number().int().min(1),
      height: z.number().int().min(1),
    })
    .nullable()
    .default(null),
});

export const Task8AnimationSetSchema = z.object({
  stable_asset_id: z.string(),
  character_prompt: z.string(),
  reference_mode: z.enum(["prompt_only", "image_to_image"]),
  reference_image_url: z.string().nullable(),
  character_seed_url: z.string(),
  animations: z.array(
    z.object({
      animation: SpriteAnimationRequirementSchema,
      raw_sheet_url: z.string(),
      processed_sheet_url: z.string(),
      width: z.number().int().min(1).optional(),
      height: z.number().int().min(1).optional(),
      frame_manifest_url: z.string().optional(),
      phaser_descriptor_url: z.string().optional(),
      cols: z.number().int().min(1),
      rows: z.number().int().min(1),
      vertical_dividers: z.array(z.number()),
      horizontal_dividers: z.array(z.number()),
      frames: z.array(Task8FrameManifestEntrySchema).min(1),
    }),
  ).min(1),
});

export const Task8BackgroundSetSchema = z.object({
  stable_asset_id: z.string(),
  layers: z.array(
    z.object({
      variant: z.enum(["layer_1", "layer_2", "layer_3"]),
      url: z.string(),
      width: z.number().int().min(1),
      height: z.number().int().min(1),
    }),
  ).min(1),
});

export const Task8OutputSchema = z.object({
  status: z.literal("completed"),
  art_direction: z.string(),
  assets_created: z.array(Task8AssetSchema).min(1),
  generation_model: z.string().describe("OpenRouter model ID used for image generation"),
  sprite_manifest: z.array(Task8SpriteManifestEntrySchema).min(1).describe("Manifest of all generated sprites with categorization"),
  animation_sets: z.array(Task8AnimationSetSchema).default([]),
  background_sets: z.array(Task8BackgroundSetSchema).default([]),
  iteration_phases_completed: z.array(z.string()).default([]).describe("Phases completed: concept, base_sprites, polish, cohesion_check"),
  notes: z.array(z.string()),
});

export type Task8Asset = z.infer<typeof Task8AssetSchema>;
export type Task8AnimationSet = z.infer<typeof Task8AnimationSetSchema>;
export type Task8BackgroundSet = z.infer<typeof Task8BackgroundSetSchema>;
export type Task8Output = z.infer<typeof Task8OutputSchema>;

// =============================================================================
// Task schema lookup (for orchestrator warn-mode validation)
// =============================================================================

export const TASK_OUTPUT_SCHEMAS: Record<number, z.ZodType> = {
  1: Task1OutputSchema,
  2: Task2OutputSchema,
  3: Task3OutputSchema,
  4: Task4OutputSchema,
  5: Task5OutputSchema,
  6: Task6OutputSchema,
  7: Task7OutputSchema,
  8: Task8OutputSchema,
  9: CheckerValidationOutputSchema,
  10: Task10OutputSchema,
  11: CheckerValidationOutputSchema,
};

// =============================================================================
// War Room Types
// =============================================================================

export type WarRoomStatus =
  | "planning"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export type TaskStatus =
  | "pending"
  | "assigned"
  | "running"
  | "completed"
  | "failed"
  | "blocked";

export type AgentName = "jarvis" | "forge" | "pixel" | "checker";

export type HeartbeatStatus = "idle" | "working" | "error" | "timeout";

export interface WarRoomVisualReference {
  id: string;
  prompt: string;
  style: string | null;
  image_url: string;
  created_at: string | null;
  is_public: boolean;
}

export interface WarRoom {
  id: string;
  game_id: string;
  user_id: string | null;
  prompt: string;
  genre: string | null;
  game_format: "2d" | "3d" | null;
  status: WarRoomStatus;
  scope: Record<string, unknown> | null;
  visual_references: WarRoomVisualReference[];
  suggested_prompts: string[] | null;
  final_build_id: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface WarRoomTask {
  id: string;
  war_room_id: string;
  task_number: number;
  title: string;
  description: string | null;
  assigned_agent: AgentName | null;
  status: TaskStatus;
  depends_on: number[];
  output: Record<string, unknown> | null;
  started_at: string | null;
  completed_at: string | null;
}

export interface WarRoomEvent {
  id: string;
  war_room_id: string;
  event_type: string;
  agent: string | null;
  task_number: number | null;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface AgentHeartbeat {
  id: string;
  war_room_id: string;
  agent: AgentName;
  status: HeartbeatStatus;
  last_ping: string;
  metadata: Record<string, unknown>;
}

export interface WarRoomGeneratedAsset {
  id: string;
  war_room_id: string;
  task_number: 7 | 8;
  stable_asset_id: string;
  asset_kind:
    | "ui_asset"
    | "character_seed"
    | "animation_pack"
    | "sprite_sheet"
    | "background_layer"
    | "background_plate"
    | "texture_asset"
    | "effect_asset"
    | "pixel_manifest";
  variant: string;
  storage_path: string | null;
  public_url: string | null;
  width: number | null;
  height: number | null;
  layout_version: number;
  runtime_ready: boolean;
  editor_only: boolean;
  source_service: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface WarRoomWithTasks extends WarRoom {
  tasks: WarRoomTask[];
}

export interface DispatchResult {
  success: boolean;
  output?: Record<string, unknown>;
  error?: string;
  /** true if the error came from a transient provider issue (rate limit, server error) */
  isRetryable?: boolean;
  /** HTTP status code from the AI provider, if available */
  providerStatusCode?: number;
}
