import { describe, it, expect } from "vitest";
import { getNextRunnableTasks, isPipelineComplete } from "../orchestrator.js";
import type { WarRoomTask } from "../types.js";

function makeTask(overrides: Partial<WarRoomTask> & { task_number: number }): WarRoomTask {
  return {
    id: `task-${overrides.task_number}`,
    war_room_id: "wr-1",
    title: `Task ${overrides.task_number}`,
    description: null,
    assigned_agent: null,
    status: "pending",
    depends_on: [],
    output: null,
    started_at: null,
    completed_at: null,
    ...overrides,
  };
}

describe("getNextRunnableTasks", () => {
  it("returns tasks with no dependencies", () => {
    const tasks = [
      makeTask({ task_number: 1 }),
      makeTask({ task_number: 2 }),
    ];
    const runnable = getNextRunnableTasks(tasks);
    expect(runnable).toHaveLength(2);
  });

  it("returns tasks whose dependencies are all completed", () => {
    const tasks = [
      makeTask({ task_number: 1, status: "completed" }),
      makeTask({ task_number: 2, depends_on: [1] }),
    ];
    const runnable = getNextRunnableTasks(tasks);
    expect(runnable).toHaveLength(1);
    expect(runnable[0].task_number).toBe(2);
  });

  it("blocks tasks with incomplete dependencies", () => {
    const tasks = [
      makeTask({ task_number: 1, status: "running" }),
      makeTask({ task_number: 2, depends_on: [1] }),
    ];
    const runnable = getNextRunnableTasks(tasks);
    expect(runnable).toHaveLength(0);
  });

  it("excludes completed and running tasks from results", () => {
    const tasks = [
      makeTask({ task_number: 1, status: "completed" }),
      makeTask({ task_number: 2, status: "running" }),
      makeTask({ task_number: 3, depends_on: [1] }),
    ];
    const runnable = getNextRunnableTasks(tasks);
    expect(runnable).toHaveLength(1);
    expect(runnable[0].task_number).toBe(3);
  });

  it("includes assigned tasks as runnable", () => {
    const tasks = [
      makeTask({ task_number: 1, status: "assigned" }),
    ];
    const runnable = getNextRunnableTasks(tasks);
    expect(runnable).toHaveLength(1);
  });

  it("allows task 10 to run when task 9 fails (retry path)", () => {
    const tasks = [
      makeTask({ task_number: 9, status: "failed" }),
      makeTask({ task_number: 10, depends_on: [9] }),
    ];
    const runnable = getNextRunnableTasks(tasks);
    expect(runnable).toHaveLength(1);
    expect(runnable[0].task_number).toBe(10);
  });

  it("blocks non-task-10 when dependency fails", () => {
    const tasks = [
      makeTask({ task_number: 1, status: "failed" }),
      makeTask({ task_number: 2, depends_on: [1] }),
    ];
    const runnable = getNextRunnableTasks(tasks);
    expect(runnable).toHaveLength(0);
  });

  it("handles missing dependency gracefully", () => {
    const tasks = [
      makeTask({ task_number: 2, depends_on: [99] }),
    ];
    const runnable = getNextRunnableTasks(tasks);
    expect(runnable).toHaveLength(0);
  });
});

describe("isPipelineComplete", () => {
  it("returns true when all tasks completed", () => {
    const tasks = [
      makeTask({ task_number: 1, status: "completed" }),
      makeTask({ task_number: 2, status: "completed" }),
    ];
    expect(isPipelineComplete(tasks)).toBe(true);
  });

  it("returns true when all tasks are terminal (mix of completed/failed)", () => {
    const tasks = [
      makeTask({ task_number: 1, status: "completed" }),
      makeTask({ task_number: 2, status: "failed" }),
    ];
    expect(isPipelineComplete(tasks)).toBe(true);
  });

  it("returns false when tasks are still pending", () => {
    const tasks = [
      makeTask({ task_number: 1, status: "completed" }),
      makeTask({ task_number: 2, status: "pending" }),
    ];
    expect(isPipelineComplete(tasks)).toBe(false);
  });

  it("returns false when tasks are running", () => {
    const tasks = [
      makeTask({ task_number: 1, status: "running" }),
    ];
    expect(isPipelineComplete(tasks)).toBe(false);
  });

  it("returns true for empty task list", () => {
    expect(isPipelineComplete([])).toBe(true);
  });
});
