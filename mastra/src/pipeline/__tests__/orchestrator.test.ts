import { describe, it, expect } from "vitest";
import {
  getNextRunnableTasks,
  getTaskGraphTransitions,
  isPipelineComplete,
} from "../orchestrator.js";
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

describe("getTaskGraphTransitions", () => {
  it("marks only task 1 assigned and dependent tasks blocked on initial graph", () => {
    const tasks = [
      makeTask({ task_number: 1, status: "pending" }),
      makeTask({ task_number: 2, status: "pending", depends_on: [1] }),
      makeTask({ task_number: 7, status: "pending", depends_on: [1] }),
    ];

    const transitions = getTaskGraphTransitions(tasks);

    expect(transitions).toEqual([
      {
        taskNumber: 1,
        status: "assigned",
        dependsOn: [],
        waitingOn: [],
        resolvedDependencies: [],
      },
      {
        taskNumber: 2,
        status: "blocked",
        dependsOn: [1],
        waitingOn: [1],
        resolvedDependencies: [],
      },
      {
        taskNumber: 7,
        status: "blocked",
        dependsOn: [1],
        waitingOn: [1],
        resolvedDependencies: [],
      },
    ]);
  });

  it("promotes newly unlocked tasks to assigned after task 1 completes", () => {
    const tasks = [
      makeTask({ task_number: 1, status: "completed" }),
      makeTask({ task_number: 2, status: "blocked", depends_on: [1] }),
      makeTask({ task_number: 7, status: "blocked", depends_on: [1] }),
      makeTask({ task_number: 3, status: "blocked", depends_on: [1, 2] }),
    ];

    const transitions = getTaskGraphTransitions(tasks);

    expect(transitions).toEqual([
      {
        taskNumber: 2,
        status: "assigned",
        dependsOn: [1],
        waitingOn: [],
        resolvedDependencies: [1],
      },
      {
        taskNumber: 7,
        status: "assigned",
        dependsOn: [1],
        waitingOn: [],
        resolvedDependencies: [1],
      },
    ]);
  });

  it("keeps non-retryable descendants blocked when a dependency fails", () => {
    const tasks = [
      makeTask({ task_number: 1, status: "failed" }),
      makeTask({ task_number: 2, status: "pending", depends_on: [1] }),
    ];

    const transitions = getTaskGraphTransitions(tasks);

    expect(transitions).toEqual([
      {
        taskNumber: 2,
        status: "blocked",
        dependsOn: [1],
        waitingOn: [1],
        resolvedDependencies: [],
      },
    ]);
  });

  it("re-blocks task 10 when task 9 is reset for another retry cycle", () => {
    const tasks = [
      makeTask({ task_number: 4, status: "completed" }),
      makeTask({ task_number: 5, status: "completed" }),
      makeTask({ task_number: 6, status: "completed" }),
      makeTask({ task_number: 9, status: "assigned", depends_on: [4, 5, 6] }),
      makeTask({ task_number: 10, status: "pending", depends_on: [9] }),
    ];

    const transitions = getTaskGraphTransitions(tasks);

    expect(transitions).toEqual([
      {
        taskNumber: 10,
        status: "blocked",
        dependsOn: [9],
        waitingOn: [9],
        resolvedDependencies: [],
      },
    ]);
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
