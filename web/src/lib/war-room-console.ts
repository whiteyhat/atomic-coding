import type { AgentName, AgentHeartbeat, WarRoomEvent } from "./types";
import type { WarRoomTaskState } from "./war-room-state";

export interface WarRoomAgentEventView {
  id: string;
  title: string;
  detail: string | null;
  tone: "info" | "success" | "warning" | "error";
  createdAt: string;
  taskNumber: number | null;
}

export interface WarRoomAgentViewModel {
  agent: AgentName;
  label: string;
  status: "idle" | "working" | "error" | "timeout" | "stale";
  currentTask: WarRoomTaskState | null;
  phase: string | null;
  elapsedSeconds: number | null;
  lastPingAgeSeconds: number | null;
  latestEventAt: string | null;
  latestEventLabel: string | null;
  retry: { attempt: number; max: number } | null;
  dependencies: number[];
  waitingOn: number[];
  outputKeys: string[];
  tasksHandled: number;
  validationSummaries: string[];
  warnings: string[];
  errors: string[];
  recentEvents: WarRoomAgentEventView[];
}

const AGENT_LABELS: Record<AgentName, string> = {
  jarvis: "Jarvis",
  forge: "Forge",
  pixel: "Pixel",
  checker: "Checker",
};

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function toString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getCurrentTask(
  agent: AgentName,
  tasks: WarRoomTaskState[],
  heartbeat: AgentHeartbeat | undefined,
): WarRoomTaskState | null {
  const heartbeatTaskNumber = toNumber(heartbeat?.metadata?.task_number);
  if (heartbeatTaskNumber != null) {
    const matchingTask = tasks.find((task) => task.task_number === heartbeatTaskNumber);
    if (matchingTask) return matchingTask;
  }

  return (
    tasks.find(
      (task) =>
        task.assigned_agent === agent &&
        (task.status === "running" || task.status === "assigned"),
    ) ??
    tasks
      .filter((task) => task.assigned_agent === agent)
      .sort((a, b) => {
        const aTime = new Date(a.last_event_at ?? a.completed_at ?? a.started_at ?? 0).getTime();
        const bTime = new Date(b.last_event_at ?? b.completed_at ?? b.started_at ?? 0).getTime();
        return bTime - aTime;
      })[0] ??
    null
  );
}

function getStatus(
  task: WarRoomTaskState | null,
  heartbeat: AgentHeartbeat | undefined,
  now: number,
): WarRoomAgentViewModel["status"] {
  const lastPingAgeSeconds =
    heartbeat?.last_ping != null
      ? Math.max(0, Math.round((now - new Date(heartbeat.last_ping).getTime()) / 1000))
      : null;

  if (heartbeat?.status === "working" && lastPingAgeSeconds != null && lastPingAgeSeconds > 45) {
    return "stale";
  }

  if (heartbeat?.status) return heartbeat.status;
  if (task?.status === "running") return "working";
  if (task?.status === "failed") return "error";
  return "idle";
}

function describeEvent(event: WarRoomEvent): WarRoomAgentEventView {
  const taskLabel = event.task_number != null ? `Task #${event.task_number}` : "Pipeline";

  switch (event.event_type) {
    case "task_completed":
      return {
        id: event.id,
        title: `${taskLabel} completed`,
        detail: toString(event.payload.title),
        tone: "success",
        createdAt: event.created_at,
        taskNumber: event.task_number,
      };
    case "task_failed":
      return {
        id: event.id,
        title: `${taskLabel} failed`,
        detail: toString(event.payload.error),
        tone: "error",
        createdAt: event.created_at,
        taskNumber: event.task_number,
      };
    case "task_retry":
      return {
        id: event.id,
        title: `${taskLabel} retry`,
        detail: `Attempt ${toNumber(event.payload.attempt) ?? "?"}/${toNumber(event.payload.max) ?? "?"}`,
        tone: "warning",
        createdAt: event.created_at,
        taskNumber: event.task_number,
      };
    case "retry_cycle":
    case "smart_retry_cycle":
      return {
        id: event.id,
        title: `${taskLabel} retry cycle`,
        detail:
          event.event_type === "smart_retry_cycle"
            ? "Smart retry routed directly into Task 10"
            : "Full Task 9 -> 10 retry loop queued",
        tone: "warning",
        createdAt: event.created_at,
        taskNumber: event.task_number,
      };
    case "agent_thinking":
      return {
        id: event.id,
        title: `${taskLabel} ${toString(event.payload.phase) ?? "processing"}`,
        detail: null,
        tone: "info",
        createdAt: event.created_at,
        taskNumber: event.task_number,
      };
    case "deterministic_validation":
    case "deterministic_validation_report":
    case "post_task_validation":
    case "post_fix_validation":
      return {
        id: event.id,
        title: `${taskLabel} validation update`,
        detail: toNumber(event.payload.failure_count)
          ? `${toNumber(event.payload.failure_count)} issue(s) detected`
          : "Validation passed cleanly",
        tone: toNumber(event.payload.failure_count) ? "warning" : "success",
        createdAt: event.created_at,
        taskNumber: event.task_number,
      };
    case "scope_complexity_warning":
      return {
        id: event.id,
        title: "Scope complexity warning",
        detail: `Planned atoms: ${toNumber(event.payload.total_atoms) ?? "?"}`,
        tone: "warning",
        createdAt: event.created_at,
        taskNumber: event.task_number,
      };
    default:
      return {
        id: event.id,
        title: event.event_type.replaceAll("_", " "),
        detail: toString(event.payload.error) ?? toString(event.payload.title),
        tone: "info",
        createdAt: event.created_at,
        taskNumber: event.task_number,
      };
  }
}

function summarizeValidation(event: WarRoomEvent): string | null {
  const failureCount = toNumber(event.payload.failure_count);

  switch (event.event_type) {
    case "deterministic_validation":
    case "deterministic_validation_report":
      return failureCount != null
        ? `${failureCount === 0 ? "Deterministic check passed" : `Deterministic check found ${failureCount} issue(s)`}`
        : null;
    case "post_task_validation":
      return failureCount != null
        ? `${failureCount === 0 ? "Post-task validation passed" : `Post-task validation flagged ${failureCount} issue(s)`}`
        : null;
    case "post_fix_validation":
      return failureCount != null
        ? `${failureCount === 0 ? "Post-fix validation passed" : `Post-fix validation left ${failureCount} issue(s)`}`
        : null;
    default:
      return null;
  }
}

export function buildWarRoomAgentViewModels({
  events,
  heartbeats,
  now = Date.now(),
  tasks,
}: {
  events: WarRoomEvent[];
  heartbeats: AgentHeartbeat[];
  now?: number;
  tasks: WarRoomTaskState[];
}): WarRoomAgentViewModel[] {
  const safeEvents = Array.isArray(events) ? events : [];
  const safeHeartbeats = Array.isArray(heartbeats) ? heartbeats : [];
  const safeTasks = Array.isArray(tasks) ? tasks : [];

  return (Object.keys(AGENT_LABELS) as AgentName[]).map((agent) => {
    const heartbeat = safeHeartbeats.find((entry) => entry.agent === agent);
    const currentTask = getCurrentTask(agent, safeTasks, heartbeat);
    const agentEvents = safeEvents
      .filter((event) => event.agent === agent)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const latestEvent = agentEvents[0];
    const phase =
      toString(heartbeat?.metadata?.phase) ??
      currentTask?.active_phase ??
      null;
    const elapsedSeconds =
      toNumber(heartbeat?.metadata?.elapsed_seconds) ??
      (currentTask?.started_at
        ? Math.max(0, Math.round((now - new Date(currentTask.started_at).getTime()) / 1000))
        : null);
    const lastPingAgeSeconds =
      heartbeat?.last_ping != null
        ? Math.max(0, Math.round((now - new Date(heartbeat.last_ping).getTime()) / 1000))
        : null;
    const retry =
      currentTask?.retry_attempt != null
        ? {
            attempt: currentTask.retry_attempt,
            max: currentTask.retry_max ?? currentTask.retry_attempt,
          }
        : null;

    const validationSummaries = agentEvents
      .map(summarizeValidation)
      .filter((value): value is string => !!value)
      .slice(0, 3);

    const warningEvents = agentEvents.filter((event) =>
      [
        "scope_complexity_warning",
        "task_retry",
        "retry_cycle",
        "smart_retry_cycle",
        "pipeline_timeout",
      ].includes(event.event_type),
    );

    const errorEvents = agentEvents.filter((event) =>
      ["task_failed", "trigger_failed", "pipeline_error"].includes(event.event_type),
    );

    return {
      agent,
      label: AGENT_LABELS[agent],
      status: getStatus(currentTask, heartbeat, now),
      currentTask,
      phase,
      elapsedSeconds,
      lastPingAgeSeconds,
      latestEventAt: latestEvent?.created_at ?? currentTask?.last_event_at ?? null,
      latestEventLabel: latestEvent ? describeEvent(latestEvent).title : null,
      retry,
      dependencies: currentTask?.depends_on ?? [],
      waitingOn: currentTask?.waiting_on ?? [],
      outputKeys: currentTask?.output_keys ?? [],
      tasksHandled: safeTasks.filter((task) => task.assigned_agent === agent).length,
      validationSummaries,
      warnings: warningEvents
        .map((event) => describeEvent(event).detail ?? describeEvent(event).title)
        .filter(Boolean)
        .slice(0, 3),
      errors: [
        ...(currentTask?.error_message ? [currentTask.error_message] : []),
        ...errorEvents
          .map((event) => describeEvent(event).detail ?? describeEvent(event).title)
          .filter(Boolean),
      ].slice(0, 3),
      recentEvents: agentEvents.slice(0, 4).map(describeEvent),
    };
  });
}
