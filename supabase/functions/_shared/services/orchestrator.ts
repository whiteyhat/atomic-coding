import { log } from "../logger.ts";
import * as warrooms from "./warrooms.ts";
import type {
  AgentName,
  WarRoomTask,
  WarRoomWithTasks,
} from "./warrooms.ts";

// =============================================================================
// Types
// =============================================================================

export interface Scope {
  summary: string;
  required_atoms: { name: string; type: "core" | "feature" | "util"; description: string }[];
  ui_assets: string[];
  sprites: string[];
}

export interface DispatchResult {
  success: boolean;
  output?: Record<string, unknown>;
  error?: string;
}

/** Function signature for dispatching a task to an agent via the OpenClaw gateway. */
export type AgentDispatcher = (
  warRoomId: string,
  task: WarRoomTask,
  context: Record<string, unknown>,
) => Promise<DispatchResult>;

// =============================================================================
// Pipeline logic
// =============================================================================

const MAX_RETRY_CYCLES = 3;

/** Find tasks whose dependencies are all completed. */
export function getNextRunnableTasks(tasks: WarRoomTask[]): WarRoomTask[] {
  const completedNumbers = new Set(
    tasks.filter((t) => t.status === "completed").map((t) => t.task_number),
  );

  return tasks.filter((t) => {
    if (t.status !== "pending" && t.status !== "assigned") return false;
    return t.depends_on.every((dep) => completedNumbers.has(dep));
  });
}

/** Check if all tasks are in a terminal state. */
export function isPipelineComplete(tasks: WarRoomTask[]): boolean {
  return tasks.every(
    (t) => t.status === "completed" || t.status === "failed",
  );
}

/** Collect outputs from completed dependency tasks. */
function gatherDependencyOutputs(
  task: WarRoomTask,
  tasks: WarRoomTask[],
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

/**
 * Run the full war room pipeline.
 *
 * This is the main orchestration loop. It dispatches runnable tasks
 * in dependency order, waits for results, and repeats until done.
 *
 * @param warRoomId - The war room to run
 * @param dispatch  - Function that sends a task to an agent and returns the result.
 *                    Pluggable so the Edge Function can inject the OpenClaw gateway client.
 */
export async function runPipeline(
  warRoomId: string,
  dispatch: AgentDispatcher,
): Promise<void> {
  const room = await warrooms.getWarRoom(warRoomId);
  if (!room) throw new Error(`War room ${warRoomId} not found`);

  // Mark war room as running
  await warrooms.updateWarRoomStatus(warRoomId, "running");
  await warrooms.upsertHeartbeat(warRoomId, "jarvis", "working", {
    phase: "orchestrating",
  });

  let retryCycles = 0;

  try {
    while (true) {
      // Refresh task state
      const tasks = await warrooms.getTasks(warRoomId);

      if (isPipelineComplete(tasks)) {
        log("info", "pipeline complete", { warRoomId });
        break;
      }

      const runnable = getNextRunnableTasks(tasks);

      if (runnable.length === 0) {
        // Check for stuck state (no runnable tasks but pipeline not complete)
        const hasRunning = tasks.some((t) => t.status === "running");
        if (!hasRunning) {
          log("error", "pipeline stuck: no runnable or running tasks", {
            warRoomId,
          });
          await warrooms.updateWarRoomStatus(warRoomId, "failed");
          await warrooms.recordEvent(warRoomId, "pipeline_stuck", "jarvis");
          return;
        }
        // Tasks are still running — wait and re-check
        await sleep(2000);
        continue;
      }

      // Dispatch all runnable tasks (some can run in parallel, e.g. tasks 7+8)
      const dispatches = runnable.map(async (task) => {
        const agent = task.assigned_agent;
        if (!agent) {
          log("error", "task has no assigned agent", {
            warRoomId,
            taskNumber: task.task_number,
          });
          return;
        }

        // Mark running + heartbeat
        await warrooms.updateTaskStatus(warRoomId, task.task_number, "running");
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

        // Dispatch to agent
        const result = await dispatch(warRoomId, task, context);

        if (result.success) {
          await warrooms.updateTaskStatus(
            warRoomId,
            task.task_number,
            "completed",
            result.output,
          );
          await warrooms.upsertHeartbeat(warRoomId, agent, "idle");
        } else {
          // Special handling for task 10 (fix failures) — retry loop
          if (task.task_number === 10 && retryCycles < MAX_RETRY_CYCLES) {
            retryCycles++;
            log("info", "retrying fix cycle", {
              warRoomId,
              cycle: retryCycles,
            });
            // Reset tasks 9 and 10 to pending so the loop re-runs
            await warrooms.updateTaskStatus(warRoomId, 9, "pending");
            await warrooms.updateTaskStatus(warRoomId, 10, "pending");
            await warrooms.recordEvent(
              warRoomId,
              "retry_cycle",
              "jarvis",
              10,
              { cycle: retryCycles, max: MAX_RETRY_CYCLES },
            );
          } else {
            await warrooms.updateTaskStatus(
              warRoomId,
              task.task_number,
              "failed",
              { error: result.error },
            );
            await warrooms.upsertHeartbeat(warRoomId, agent, "error", {
              error: result.error,
            });
          }
        }
      });

      // Wait for all dispatched tasks to complete
      await Promise.allSettled(dispatches);

      // Brief pause before next iteration
      await sleep(500);
    }

    // Pipeline complete — determine final status
    const finalTasks = await warrooms.getTasks(warRoomId);
    const allPassed = finalTasks.every((t) => t.status === "completed");

    if (allPassed) {
      // Extract suggested prompts from task 12 output
      const task12 = finalTasks.find((t) => t.task_number === 12);
      const suggestions = (task12?.output?.suggested_prompts as string[]) || [];
      const buildId = (task12?.output?.build_id as string) || undefined;

      await warrooms.updateWarRoomStatus(
        warRoomId,
        "completed",
        suggestions,
        buildId,
      );
    } else {
      await warrooms.updateWarRoomStatus(warRoomId, "failed");
    }

    await warrooms.upsertHeartbeat(warRoomId, "jarvis", "idle");
  } catch (err) {
    log("error", "pipeline error", {
      warRoomId,
      error: (err as Error).message,
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

// =============================================================================
// Helpers
// =============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
