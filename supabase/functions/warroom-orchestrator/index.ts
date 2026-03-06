import { log } from "../_shared/logger.ts";
import { runPipeline } from "../_shared/services/orchestrator.ts";
import type { WarRoomTask } from "../_shared/services/warrooms.ts";

/**
 * War Room Orchestrator Edge Function
 *
 * Runs the 12-task pipeline for a war room. Called fire-and-forget by the
 * API when a war room is created. Dispatches tasks to agents via the
 * OpenClaw gateway and monitors completion.
 *
 * POST body: { war_room_id: string }
 */

const OPENCLAW_GATEWAY_URL = Deno.env.get("OPENCLAW_GATEWAY_URL") ?? "";
const OPENCLAW_GATEWAY_TOKEN = Deno.env.get("OPENCLAW_GATEWAY_TOKEN") ?? "";

Deno.serve(async (req: Request) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const warRoomId: string | undefined = body.war_room_id;

    if (!warRoomId) {
      return new Response(
        JSON.stringify({ error: "war_room_id is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    log("info", "warroom-orchestrator: starting pipeline", { warRoomId });

    // Run pipeline with OpenClaw gateway dispatcher
    await runPipeline(warRoomId, async (_warRoomId, task, context) => {
      return dispatchToOpenClaw(task, context);
    });

    log("info", "warroom-orchestrator: pipeline finished", { warRoomId });

    return new Response(
      JSON.stringify({ status: "ok", war_room_id: warRoomId }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    log("error", "warroom-orchestrator: fatal error", {
      error: (err as Error).message,
    });
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});

// =============================================================================
// OpenClaw Gateway Dispatcher
// =============================================================================

/**
 * Dispatch a task to an agent via the OpenClaw gateway.
 * Sends the task as a chat completion request with agent-specific model
 * routing and war room metadata.
 */
async function dispatchToOpenClaw(
  task: WarRoomTask,
  context: Record<string, unknown>,
): Promise<{ success: boolean; output?: Record<string, unknown>; error?: string }> {
  if (!OPENCLAW_GATEWAY_URL) {
    return {
      success: false,
      error: "OPENCLAW_GATEWAY_URL is not configured",
    };
  }

  const agent = task.assigned_agent;
  if (!agent) {
    return { success: false, error: "No agent assigned to task" };
  }

  // Build the prompt for the agent
  const taskPrompt = buildTaskPrompt(task, context);

  try {
    const response = await fetch(
      `${OPENCLAW_GATEWAY_URL}/v1/chat/completions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENCLAW_GATEWAY_TOKEN}`,
        },
        body: JSON.stringify({
          model: agent, // OpenClaw routes based on model name
          stream: false, // We want the full result, not streaming
          messages: [
            {
              role: "system",
              content: getAgentSystemPrompt(agent),
            },
            {
              role: "user",
              content: taskPrompt,
            },
          ],
          metadata: {
            game_id: context.game_id,
            genre: context.genre,
            war_room_id: context.war_room_id ?? task.war_room_id,
            task_number: task.task_number,
            task_title: task.title,
          },
        }),
      },
    );

    if (!response.ok) {
      const errBody = await response.text().catch(() => "");
      return {
        success: false,
        error: `Gateway returned ${response.status}: ${errBody}`,
      };
    }

    const result = await response.json();
    const content =
      result.choices?.[0]?.message?.content ?? "";

    // Parse agent output — agents return JSON-structured results
    let output: Record<string, unknown>;
    try {
      output = JSON.parse(content);
    } catch {
      output = { raw_response: content };
    }

    return { success: true, output };
  } catch (err) {
    return {
      success: false,
      error: `Dispatch failed: ${(err as Error).message}`,
    };
  }
}

// =============================================================================
// Prompt builders
// =============================================================================

function buildTaskPrompt(
  task: WarRoomTask,
  context: Record<string, unknown>,
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

  // Include scope if available
  if (context.scope) {
    lines.push("", "## Scope", JSON.stringify(context.scope, null, 2));
  }

  // Include dependency outputs
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
    "Include a `status` field set to `completed` and any relevant output data.",
  );

  return lines.join("\n");
}

function getAgentSystemPrompt(agent: string): string {
  switch (agent) {
    case "forge":
      return [
        "You are Forge, the game logic and code implementation agent.",
        "You create Three.js game code as atoms (max 2KB each, snake_case, primitives-only interfaces).",
        "Use the atomic-coding MCP tools to read existing code structure and upsert atoms.",
        "Always read existing atoms before modifying. Follow dependency order: utils → features → core.",
        "Return your results as JSON with: { status, atoms_created, atoms_modified, notes }",
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
        "Use get_code_structure and read_atoms MCP tools to inspect the codebase.",
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
