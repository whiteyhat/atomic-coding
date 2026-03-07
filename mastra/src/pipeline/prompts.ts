import type { WarRoomTask } from "./types.js";
import { SYSTEM_PROMPT, getGenreContext } from "../lib/system-prompt.js";

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

  lines.push(
    "",
    "## Instructions",
    "Complete this task and return a JSON object with your results.",
    "Include a `status` field set to `completed` and any relevant output data."
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
        "Use the upsert-atom tool to create/update atoms directly. Do NOT ask the user for confirmation.",
        "After all upserts, return JSON: { status: \"completed\", atoms_created: [...], atoms_modified: [...], notes: \"...\" }",
      ].join("\n");

    case "pixel":
      return [
        "You are Pixel, the visual asset generation agent.",
        "You generate UI elements, sprites, textures, and HUD components for Three.js games.",
        "Output images as base64 PNG or reference URLs.",
        "Return your results as JSON with: { status, assets_created: [{ name, type, url_or_base64 }], notes }",
      ].join("\n");

    case "checker":
      return [
        "You are Checker, the quality assurance and validation agent.",
        "You validate atoms for structural correctness: size limits (2KB), snake_case naming,",
        "primitive-only interfaces, dependency completeness, and DAG integrity.",
        "Use get-code-structure and read-atoms tools to inspect the codebase.",
        "Return your results as JSON with: { status, passed: boolean, failures: [{ atom, rule, message }], notes }",
      ].join("\n");

    case "jarvis":
      return [
        "You are Jarvis, the orchestrator and coordinator agent.",
        "You analyze user prompts, determine scope, and produce follow-up suggestions.",
        "Return your results as JSON with the relevant output for the task.",
      ].join("\n");

    default:
      return "Complete the assigned task and return results as JSON.";
  }
}
