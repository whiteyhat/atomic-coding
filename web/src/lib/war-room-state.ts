"use client";

import type {
  AgentHeartbeat,
  WarRoomEvent,
  WarRoomTask,
  WarRoomWithFeed,
} from "./types";

export interface WarRoomTaskState extends WarRoomTask {
  waiting_on: number[];
  resolved_dependencies: number[];
  last_event_at: string | null;
  last_event_type: string | null;
  retry_attempt: number | null;
  retry_max: number | null;
  active_phase: string | null;
  output_keys: string[];
  error_message: string | null;
}

function toArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function toNumberArray(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => Number(entry))
    .filter((entry) => Number.isFinite(entry));
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is string => typeof entry === "string");
}

function toString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function isDependencySatisfied(
  taskNumber: number,
  dependencyNumber: number,
  tasksByNumber: Map<number, WarRoomTaskState>
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

function applyDependencySnapshots(tasks: WarRoomTaskState[]): WarRoomTaskState[] {
  const tasksByNumber = new Map(tasks.map((task) => [task.task_number, task]));

  return tasks.map((task) => {
    const waitingOn: number[] = [];
    const resolvedDependencies: number[] = [];

    for (const dependencyNumber of task.depends_on) {
      if (isDependencySatisfied(task.task_number, dependencyNumber, tasksByNumber)) {
        resolvedDependencies.push(dependencyNumber);
      } else {
        waitingOn.push(dependencyNumber);
      }
    }

    return {
      ...task,
      waiting_on: waitingOn,
      resolved_dependencies: resolvedDependencies,
    };
  });
}

function createTaskState(task: WarRoomTask): WarRoomTaskState {
  return {
    ...task,
    waiting_on: [],
    resolved_dependencies: [],
    last_event_at: null,
    last_event_type: null,
    retry_attempt: null,
    retry_max: null,
    active_phase: null,
    output_keys: task.output ? Object.keys(task.output) : [],
    error_message:
      task.output && typeof task.output.error === "string"
        ? task.output.error
        : null,
  };
}

export function applyWarRoomEvent(
  tasks: WarRoomTaskState[],
  event: WarRoomEvent
): WarRoomTaskState[] {
  if (event.task_number == null) return tasks;

  const nextTasks = tasks.map((task) => {
    if (task.task_number !== event.task_number) return task;

    const nextTask: WarRoomTaskState = {
      ...task,
      last_event_at: event.created_at,
      last_event_type: event.event_type,
    };

    switch (event.event_type) {
      case "task_blocked":
        nextTask.status = "blocked";
        nextTask.started_at = null;
        nextTask.completed_at = null;
        nextTask.output = null;
        nextTask.output_keys = [];
        nextTask.error_message = null;
        nextTask.active_phase = null;
        nextTask.waiting_on = toNumberArray(event.payload.waiting_on);
        nextTask.resolved_dependencies = toNumberArray(
          event.payload.resolved_dependencies
        );
        return nextTask;
      case "task_assigned":
        nextTask.status = "assigned";
        nextTask.started_at = null;
        nextTask.completed_at = null;
        nextTask.output = null;
        nextTask.output_keys = toStringArray(event.payload.output_keys);
        nextTask.error_message = toString(event.payload.error);
        nextTask.active_phase = null;
        nextTask.waiting_on = [];
        nextTask.resolved_dependencies = toNumberArray(
          event.payload.resolved_dependencies
        );
        return nextTask;
      case "task_running":
        nextTask.status = "running";
        nextTask.started_at = toString(event.payload.started_at) ?? event.created_at;
        nextTask.completed_at = null;
        nextTask.output = null;
        nextTask.output_keys = [];
        nextTask.error_message = null;
        nextTask.active_phase = "starting";
        return nextTask;
      case "task_completed":
        nextTask.status = "completed";
        nextTask.completed_at = toString(event.payload.completed_at) ?? event.created_at;
        nextTask.output_keys = toStringArray(event.payload.output_keys);
        nextTask.error_message = null;
        nextTask.active_phase = null;
        return nextTask;
      case "task_failed":
        nextTask.status = "failed";
        nextTask.completed_at = toString(event.payload.completed_at) ?? event.created_at;
        nextTask.output_keys = toStringArray(event.payload.output_keys);
        nextTask.error_message = toString(event.payload.error);
        nextTask.active_phase = null;
        return nextTask;
      case "task_retry":
        nextTask.retry_attempt = Number(event.payload.attempt) || null;
        nextTask.retry_max = Number(event.payload.max) || null;
        return nextTask;
      case "agent_thinking":
        nextTask.status = "running";
        nextTask.active_phase = toString(event.payload.phase);
        return nextTask;
      case "task_pending":
      case "task_retry_manual":
        nextTask.status = "pending";
        nextTask.started_at = null;
        nextTask.completed_at = null;
        nextTask.output = null;
        nextTask.output_keys = [];
        nextTask.error_message = null;
        nextTask.active_phase = null;
        return nextTask;
      default:
        return nextTask;
    }
  });

  return applyDependencySnapshots(nextTasks);
}

export function hydrateWarRoomTasks(
  tasks: WarRoomTask[],
  events: WarRoomEvent[]
): WarRoomTaskState[] {
  const safeTasks = toArray<WarRoomTask>(tasks);
  const safeEvents = toArray<WarRoomEvent>(events);
  let nextTasks = applyDependencySnapshots(safeTasks.map(createTaskState));

  for (const event of safeEvents) {
    nextTasks = applyWarRoomEvent(nextTasks, event);
  }

  return nextTasks;
}

export function hydrateWarRoomFeed(room: WarRoomWithFeed): {
  tasks: WarRoomTaskState[];
  events: WarRoomEvent[];
  heartbeats: AgentHeartbeat[];
} {
  const tasks = toArray<WarRoomTask>(room.tasks);
  const events = toArray<WarRoomEvent>(room.events);
  const heartbeats = toArray<AgentHeartbeat>(room.heartbeats);

  return {
    tasks: hydrateWarRoomTasks(tasks, events),
    events,
    heartbeats,
  };
}

export function upsertHeartbeatState(
  heartbeats: AgentHeartbeat[],
  heartbeat: AgentHeartbeat
): AgentHeartbeat[] {
  const existingIndex = heartbeats.findIndex(
    (entry) => entry.agent === heartbeat.agent
  );

  if (existingIndex === -1) {
    return [...heartbeats, heartbeat];
  }

  const nextHeartbeats = [...heartbeats];
  nextHeartbeats[existingIndex] = heartbeat;
  return nextHeartbeats;
}
