import { mastra } from "../mastra.js";
import { getSupabaseClient } from "../lib/supabase.js";
import {
  mergeValidationReports,
  validateScoreSystemRules,
  validateStructuralRules,
  type ValidationReport,
} from "../shared/atom-validation.js";
import * as warrooms from "./warrooms.js";
import { buildTaskPrompt, getAgentSystemPrompt } from "./prompts.js";
import type { WarRoomTask, DispatchResult } from "./types.js";

const MAX_RETRY_CYCLES = 3;
const MAX_TASK_RETRIES = 2;
const PIPELINE_TIMEOUT_MS = 20 * 60 * 1000; // 20 minutes
const TASK_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes per task

/** Find tasks whose dependencies are all completed. */
export function getNextRunnableTasks(tasks: WarRoomTask[]): WarRoomTask[] {
  const tasksByNumber = new Map(tasks.map((task) => [task.task_number, task]));

  return tasks.filter((t) => {
    if (t.status !== "pending" && t.status !== "assigned") return false;
    return t.depends_on.every((dep) =>
      isDependencySatisfied(t.task_number, dep, tasksByNumber)
    );
  });
}

/** Check if all tasks are in a terminal state. */
export function isPipelineComplete(tasks: WarRoomTask[]): boolean {
  return tasks.every(
    (t) => t.status === "completed" || t.status === "failed"
  );
}

/** Collect outputs from completed dependency tasks. */
function gatherDependencyOutputs(
  task: WarRoomTask,
  tasks: WarRoomTask[]
): Record<string, unknown> {
  const outputs: Record<string, unknown> = {};
  for (const depNum of task.depends_on) {
    const dep = tasks.find((t) => t.task_number === depNum);
    if (dep?.output) {
      outputs[`task_${depNum}`] = dep.output;
    }
  }
  return outputs;
}

function isDependencySatisfied(
  taskNumber: number,
  dependencyNumber: number,
  tasksByNumber: Map<number, WarRoomTask>
): boolean {
  const dependency = tasksByNumber.get(dependencyNumber);
  if (!dependency) return false;
  if (dependency.status === "completed") return true;

  return (
    taskNumber === 10 &&
    dependencyNumber === 9 &&
    dependency.status === "failed"
  );
}

function getLatestValidationOutputs(
  tasks: WarRoomTask[]
): Record<string, unknown> {
  const outputs: Record<string, unknown> = {};

  for (const taskNumber of [11, 9]) {
    const task = tasks.find((candidate) => candidate.task_number === taskNumber);
    if (task?.output) {
      outputs[`task_${taskNumber}_latest_validation`] = task.output;
    }
  }

  return outputs;
}

async function runDeterministicValidation(
  gameId: string
): Promise<ValidationReport> {
  const supabase = getSupabaseClient();

  const { data: atoms, error: atomsError } = await supabase
    .from("atoms")
    .select("name, type, code, description, inputs, outputs")
    .eq("game_id", gameId);
  if (atomsError) {
    throw new Error(`Failed to fetch atoms for validation: ${atomsError.message}`);
  }

  const { data: deps, error: depsError } = await supabase
    .from("atom_dependencies")
    .select("atom_name, depends_on")
    .eq("game_id", gameId);
  if (depsError) {
    throw new Error(`Failed to fetch dependencies for validation: ${depsError.message}`);
  }

  const structuralReport = validateStructuralRules(atoms || [], deps || []);
  const scoreReport = validateScoreSystemRules(atoms || [], deps || []);

  return mergeValidationReports(structuralReport, scoreReport);
}

/**
 * Dispatch a task to a Mastra agent.
 * Replaces the old OpenClaw gateway dispatch with local agent.generate() calls.
 */
async function dispatchToAgent(
  task: WarRoomTask,
  context: Record<string, unknown>,
  warRoomId: string
): Promise<DispatchResult> {
  const agentName = task.assigned_agent;
  if (!agentName) {
    return { success: false, error: "No agent assigned to task" };
  }

  const taskPrompt = buildTaskPrompt(task, context);
  const genre = context.genre as string | null | undefined;
  const systemPrompt = getAgentSystemPrompt(agentName, genre);
  const maxSteps = agentName === "forge" ? 25 : 10;

  console.log("[orchestrator] dispatching to agent", {
    taskNumber: task.task_number,
    title: task.title,
    agent: agentName,
    promptLength: taskPrompt.length,
    maxSteps,
    depKeys: Object.keys(context.dependency_outputs as Record<string, unknown> ?? {}),
  });

  const dispatchStart = Date.now();

  // Record an initial thinking event so the UI shows activity immediately
  await warrooms.recordEvent(warRoomId, "agent_thinking", agentName, task.task_number, {
    title: task.title,
    phase: "starting",
    elapsed_seconds: 0,
  });

  // Periodic heartbeat so the frontend sees life signs during long agent calls
  const heartbeatInterval = setInterval(async () => {
    const elapsed = Math.round((Date.now() - dispatchStart) / 1000);
    try {
      await warrooms.upsertHeartbeat(warRoomId, agentName, "working", {
        task_number: task.task_number,
        title: task.title,
        elapsed_seconds: elapsed,
      });
      await warrooms.recordEvent(warRoomId, "agent_thinking", agentName, task.task_number, {
        phase: "processing",
        elapsed_seconds: elapsed,
      });
      console.log("[orchestrator] heartbeat ping", {
        taskNumber: task.task_number,
        agent: agentName,
        elapsed_seconds: elapsed,
      });
    } catch (hbErr) {
      console.warn("[orchestrator] heartbeat update failed:", (hbErr as Error).message);
    }
  }, 15_000);

  try {
    const agent = mastra.getAgent(agentName);
    const result = await Promise.race([
      agent.generate(
        [{ role: "user" as const, content: taskPrompt }],
        {
          instructions: systemPrompt,
          maxSteps,
        }
      ),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`Task timed out after ${TASK_TIMEOUT_MS / 1000}s`)),
          TASK_TIMEOUT_MS
        )
      ),
    ]);

    clearInterval(heartbeatInterval);

    let output: Record<string, unknown>;
    try {
      output = JSON.parse(result.text);
    } catch {
      output = { raw_response: result.text };
    }

    console.log("[orchestrator] agent completed", {
      taskNumber: task.task_number,
      agent: agentName,
      durationMs: Date.now() - dispatchStart,
      responseLength: result.text.length,
      outputKeys: Object.keys(output),
    });

    return { success: true, output };
  } catch (err) {
    clearInterval(heartbeatInterval);

    console.error("[orchestrator] agent dispatch failed", {
      taskNumber: task.task_number,
      agent: agentName,
      durationMs: Date.now() - dispatchStart,
      error: (err as Error).message,
    });
    return {
      success: false,
      error: `Agent dispatch failed: ${(err as Error).message}`,
    };
  }
}

/**
 * Run the full war room pipeline.
 *
 * This is the main orchestration loop. It dispatches runnable tasks
 * in dependency order, waits for results, and repeats until done.
 */
export async function runPipeline(warRoomId: string): Promise<void> {
  const pipelineStart = Date.now();
  const room = await warrooms.getWarRoom(warRoomId);
  if (!room) throw new Error(`War room ${warRoomId} not found`);

  // Idempotency: skip if already running or completed/cancelled
  if (room.status === "running") {
    console.log("[orchestrator] pipeline already running, skipping", { warRoomId });
    return;
  }
  if (["completed", "cancelled"].includes(room.status)) {
    console.log("[orchestrator] pipeline already terminal, skipping", { warRoomId, status: room.status });
    return;
  }

  // Allow re-running a failed pipeline (e.g. remote trigger failed, local retry)
  if (room.status === "failed") {
    console.log("[orchestrator] resetting failed pipeline for re-run", { warRoomId });
    // Reset all task statuses back to pending
    const existingTasks = await warrooms.getTasks(warRoomId);
    for (const task of existingTasks) {
      if (task.status !== "completed") {
        await warrooms.updateTaskStatus(warRoomId, task.task_number, "pending");
      }
    }
    await warrooms.updateWarRoomStatus(warRoomId, "planning");
  }

  const initialTasks = await warrooms.getTasks(warRoomId);
  console.log("[orchestrator] pipeline starting", {
    warRoomId,
    gameId: room.game_id,
    genre: room.genre,
    promptPreview: room.prompt?.slice(0, 100),
    totalTasks: initialTasks.length,
  });

  // Mark war room as running
  await warrooms.updateWarRoomStatus(warRoomId, "running");
  await warrooms.recordEvent(warRoomId, "pipeline_started", "jarvis", null, {
    totalTasks: initialTasks.length,
  });
  await warrooms.upsertHeartbeat(warRoomId, "jarvis", "working", {
    phase: "orchestrating",
  });

  const retryMap = new Map<number, number>();
  let iteration = 0;

  try {
    while (true) {
      iteration++;
      // Refresh war room + task state in a single query
      const currentRoom = await warrooms.getWarRoom(warRoomId);
      if (!currentRoom) throw new Error(`War room ${warRoomId} disappeared`);
      const tasks = currentRoom.tasks;

      const statusCounts = tasks.reduce(
        (acc, t) => { acc[t.status] = (acc[t.status] || 0) + 1; return acc; },
        {} as Record<string, number>
      );
      console.log(`[orchestrator] iteration ${iteration}`, { warRoomId, statusCounts });

      // Check for cancellation
      if (currentRoom.status === "cancelled") {
        console.log("[orchestrator] pipeline cancelled by user", { warRoomId });
        await warrooms.upsertHeartbeat(warRoomId, "jarvis", "idle");
        return;
      }

      // Check for pipeline timeout
      if (Date.now() - pipelineStart >= PIPELINE_TIMEOUT_MS) {
        console.error("[orchestrator] pipeline timed out", {
          warRoomId,
          durationMs: Date.now() - pipelineStart,
        });
        await warrooms.updateWarRoomStatus(warRoomId, "failed");
        await warrooms.recordEvent(warRoomId, "pipeline_timeout", "jarvis", null, {
          timeout_ms: PIPELINE_TIMEOUT_MS,
          elapsed_ms: Date.now() - pipelineStart,
        });
        await warrooms.upsertHeartbeat(warRoomId, "jarvis", "error", {
          error: "Pipeline timed out after 20 minutes",
        });
        return;
      }

      if (isPipelineComplete(tasks)) {
        console.log("[orchestrator] pipeline complete", { warRoomId });
        break;
      }

      const runnable = getNextRunnableTasks(tasks);

      if (runnable.length === 0) {
        const hasRunning = tasks.some((t) => t.status === "running");
        if (!hasRunning) {
          console.error(
            "[orchestrator] pipeline stuck: no runnable or running tasks",
            { warRoomId }
          );
          await warrooms.updateWarRoomStatus(warRoomId, "failed");
          await warrooms.recordEvent(
            warRoomId,
            "pipeline_stuck",
            "jarvis"
          );
          return;
        }
        // Tasks are still running — wait and re-check
        await sleep(2000);
        continue;
      }

      // Dispatch all runnable tasks (some can run in parallel, e.g. tasks 7+8)
      console.log("[orchestrator] dispatching runnable tasks", {
        warRoomId,
        tasks: runnable.map((t) => `#${t.task_number} ${t.title} → ${t.assigned_agent}`),
      });

      const dispatches = runnable.map(async (task) => {
        const agent = task.assigned_agent;
        if (!agent) {
          console.error("[orchestrator] task has no assigned agent", {
            warRoomId,
            taskNumber: task.task_number,
          });
          return;
        }

        // Mark running + heartbeat
        await warrooms.updateTaskStatus(
          warRoomId,
          task.task_number,
          "running"
        );
        await warrooms.upsertHeartbeat(warRoomId, agent, "working", {
          task_number: task.task_number,
          title: task.title,
        });

        // Build context from dependency outputs
        const depOutputs = gatherDependencyOutputs(task, tasks);
        const context: Record<string, unknown> = {
          game_id: room.game_id,
          genre: room.genre,
          prompt: room.prompt,
          scope: room.scope,
          dependency_outputs: depOutputs,
        };
        const latestValidationOutputs =
          task.task_number === 10 ? getLatestValidationOutputs(tasks) : {};
        if (Object.keys(latestValidationOutputs).length > 0) {
          context.latest_validation_outputs = latestValidationOutputs;
        }

        // Dispatch to Mastra agent
        const taskStart = Date.now();
        const result = await dispatchToAgent(task, context, warRoomId);

        if (result.success) {
          await warrooms.updateTaskStatus(
            warRoomId,
            task.task_number,
            "completed",
            result.output
          );
          await warrooms.upsertHeartbeat(warRoomId, agent, "idle");
        } else {
          const taskRetries = retryMap.get(task.task_number) ?? 0;

          if (task.task_number === 10 && taskRetries < MAX_RETRY_CYCLES) {
            // Special handling for task 10 — retry validation+fix cycle
            retryMap.set(10, taskRetries + 1);
            console.log("[orchestrator] retrying fix cycle", {
              warRoomId,
              cycle: taskRetries + 1,
              durationMs: Date.now() - taskStart,
              error: result.error,
            });
            await warrooms.updateTaskStatus(warRoomId, 9, "pending");
            await warrooms.updateTaskStatus(warRoomId, 10, "pending");
            await warrooms.recordEvent(
              warRoomId,
              "retry_cycle",
              "jarvis",
              10,
              { cycle: taskRetries + 1, max: MAX_RETRY_CYCLES }
            );
          } else if (task.task_number !== 10 && taskRetries < MAX_TASK_RETRIES) {
            // Generic retry for any other task
            retryMap.set(task.task_number, taskRetries + 1);
            console.log("[orchestrator] retrying task", {
              warRoomId,
              taskNumber: task.task_number,
              attempt: taskRetries + 1,
              durationMs: Date.now() - taskStart,
              error: result.error,
            });
            await warrooms.updateTaskStatus(warRoomId, task.task_number, "pending");
            await warrooms.recordEvent(
              warRoomId,
              "task_retry",
              agent,
              task.task_number,
              { attempt: taskRetries + 1, max: MAX_TASK_RETRIES }
            );
          } else {
            // Max retries exceeded — mark as failed
            console.error("[orchestrator] task failed permanently", {
              warRoomId,
              taskNumber: task.task_number,
              agent,
              retries: taskRetries,
              durationMs: Date.now() - taskStart,
              error: result.error,
            });
            await warrooms.updateTaskStatus(
              warRoomId,
              task.task_number,
              "failed",
              { error: result.error }
            );
            await warrooms.upsertHeartbeat(warRoomId, agent, "error", {
              error: result.error,
            });
          }
        }
      });

      // Wait for all dispatched tasks to complete
      await Promise.allSettled(dispatches);
    }

    // Pipeline complete — determine final status
    const finalTasks = await warrooms.getTasks(warRoomId);
    const allPassed = finalTasks.every((t) => t.status === "completed");

    if (allPassed) {
      // Trigger a final rebuild to ensure the game bundle is up-to-date
      const rebuildStart = Date.now();
      await triggerFinalRebuild(room.game_id);
      console.log("[orchestrator] final rebuild done", { durationMs: Date.now() - rebuildStart });

      const task12 = finalTasks.find((t) => t.task_number === 12);
      const suggestions =
        (task12?.output?.suggested_prompts as string[]) || [];
      const buildId = (task12?.output?.build_id as string) || undefined;

      await warrooms.updateWarRoomStatus(
        warRoomId,
        "completed",
        suggestions,
        buildId
      );
      console.log("[orchestrator] pipeline completed successfully", {
        warRoomId,
        suggestionsCount: suggestions.length,
        buildId,
        totalDurationMs: Date.now() - pipelineStart,
      });
    } else {
      await warrooms.updateWarRoomStatus(warRoomId, "failed");
      const finalCounts = finalTasks.reduce(
        (acc, t) => { acc[t.status] = (acc[t.status] || 0) + 1; return acc; },
        {} as Record<string, number>
      );
      console.error("[orchestrator] pipeline completed with failures", {
        warRoomId,
        finalCounts,
        totalDurationMs: Date.now() - pipelineStart,
      });
    }

    await warrooms.upsertHeartbeat(warRoomId, "jarvis", "idle");
  } catch (err) {
    console.error("[orchestrator] pipeline error", {
      warRoomId,
      error: (err as Error).message,
      stack: (err as Error).stack,
      totalDurationMs: Date.now() - pipelineStart,
    });
    await warrooms.updateWarRoomStatus(warRoomId, "failed");
    await warrooms.recordEvent(warRoomId, "pipeline_error", "jarvis", null, {
      error: (err as Error).message,
    });
    await warrooms.upsertHeartbeat(warRoomId, "jarvis", "error", {
      error: (err as Error).message,
    });
  }
}

/**
 * Trigger the rebuild-bundle Edge Function and wait for it to complete.
 * Awaited (not fire-and-forget) so the bundle exists before the pipeline
 * is marked as completed.
 */
async function triggerFinalRebuild(gameId: string): Promise<void> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    console.warn("[orchestrator] triggerFinalRebuild: missing env vars, skipping");
    return;
  }

  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/rebuild-bundle`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ game_id: gameId }),
    });
    const body = await res.json().catch(() => ({}));
    console.log("[orchestrator] final rebuild:", {
      gameId,
      status: res.status,
      buildId: (body as any).build_id,
    });
  } catch (err) {
    console.error("[orchestrator] triggerFinalRebuild failed:", err);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
