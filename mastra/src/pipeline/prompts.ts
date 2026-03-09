import type { WarRoomTask } from "./types.js";
import { SYSTEM_PROMPT, getGenreContext } from "../lib/system-prompt.js";
import { buildPixelSystemPrompt, PIXEL_STYLE_PILLARS } from "../lib/pixel-guidelines.js";

/**
 * Build the user prompt for a pipeline task.
 * Includes task details, context, user request, scope, and dependency outputs.
 */
export function buildTaskPrompt(
  task: WarRoomTask,
  context: Record<string, unknown>
): string {
  const lines = [
    `## Task ${task.task_number}: ${task.title}`,
    "",
    task.description ?? "",
    "",
    "## Context",
    `- Genre: ${context.genre ?? "custom"}`,
    `- Game ID: ${context.game_id}`,
    "",
    "## User Request",
    String(context.prompt ?? ""),
  ];

  if (context.scope) {
    lines.push("", "## Scope", JSON.stringify(context.scope, null, 2));
  }

  const depOutputs = context.dependency_outputs as
    | Record<string, unknown>
    | undefined;
  if (depOutputs && Object.keys(depOutputs).length > 0) {
    lines.push("", "## Previous Task Outputs");
    for (const [key, value] of Object.entries(depOutputs)) {
      lines.push(`### ${key}`, JSON.stringify(value, null, 2));
    }
  }

  const latestValidationOutputs = context.latest_validation_outputs as
    | Record<string, unknown>
    | undefined;
  if (latestValidationOutputs && Object.keys(latestValidationOutputs).length > 0) {
    lines.push("", "## Latest Validation Outputs");
    for (const [key, value] of Object.entries(latestValidationOutputs)) {
      lines.push(`### ${key}`, JSON.stringify(value, null, 2));
    }
  }

  lines.push(
    "",
    "## Instructions",
    "Complete this task and return a JSON object with your results.",
    "Include a `status` field set to `completed` and any relevant output data.",
    "Every game in this pipeline MUST preserve a compliant score system."
  );

  return lines.join("\n");
}

/**
 * Get the system prompt override for pipeline tasks.
 * Forge gets the full SYSTEM_PROMPT (atom workflow, constraints, GAME API docs)
 * plus genre-specific context so it can generate proper game code.
 */
export function getAgentSystemPrompt(
  agent: string,
  genre?: string | null
): string {
  switch (agent) {
    case "forge":
      return [
        SYSTEM_PROMPT,
        getGenreContext(genre ?? null),
        "",
        "## Pipeline Mode",
        "You are running inside the war room pipeline, not interactive chat.",
        "Score support is mandatory for every game build.",
        'Every playable game must keep a `score_tracker` atom with a numeric `score` output.',
        'The score system must emit `window.parent.postMessage({ type: "SCORE_UPDATE", score: ... })`.',
        "At least one core or feature atom must depend on score_tracker so score updates are wired into gameplay.",
        "Use the upsert-atom tool to create/update atoms directly. Do NOT ask the user for confirmation.",
        "After all upserts, return JSON: { status: \"completed\", atoms_created: [...], atoms_modified: [...], notes: \"...\" }",
      ].join("\n");

    case "pixel":
      return [
        buildPixelSystemPrompt(),
        "",
        "## Pipeline Mode",
        "You are running inside the war room pipeline, not interactive chat.",
        "When the task is about UI, prioritize these design pillars:",
        ...PIXEL_STYLE_PILLARS.map((pillar) => `- ${pillar}`),
        "For task 7, produce gameplay-facing UI packs such as HUD, menus, buttons, or overlays.",
        "For task 8, align sprites and textures with the mechanics and silhouettes described by Jarvis and Forge outputs.",
        "Always mention polish choices such as safe text zones, contrast handling, hover/pressed states, motion cues, or damage feedback.",
        "Return JSON with: { status: \"completed\", art_direction, assets_created: [{ name, type, url_or_base64, prompt_used, aspect_ratio, image_size, polish_notes, source_model }], notes }",
      ].join("\n");

    case "checker":
      return [
        "You are Checker, the quality assurance and validation agent.",
        "You validate atoms for structural correctness: size limits (2KB), snake_case naming,",
        "primitive-only interfaces, dependency completeness, DAG integrity, and score-system compliance.",
        "A valid game must include score_tracker, a numeric score output, SCORE_UPDATE postMessage emission, and score wiring into gameplay atoms.",
        "Use get-code-structure and read-atoms tools to inspect the codebase.",
        "Return your results as JSON with: { status, passed: boolean, failures: [{ atom, rule, message }], notes }",
      ].join("\n");

    case "jarvis":
      return [
        "You are Jarvis, the orchestrator and coordinator agent for Atomic Coding game development.",
        "All games in this pipeline must retain a compliant score system and leaderboard-ready score reporting.",
        "",
        "## Task 1: Parse Scope & Plan",
        "When assigned task 1, analyze the user's game prompt thoroughly:",
        "- Identify the game genre, core mechanics, and required features",
        "- List the atoms needed: utils (helpers, math, config), features (gameplay systems), and core (game_loop, create_scene)",
        "- Consider the dependency order: utils → features → core",
        "- Return JSON: { status: \"completed\", scope: { genre, atoms: [...], features: [...], architecture: \"description\" } }",
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
