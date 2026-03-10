import { describe, expect, it } from "vitest";
import type { AgentHeartbeat, WarRoomEvent, WarRoomTask } from "./types";
import { hydrateWarRoomTasks } from "./war-room-state";
import { buildWarRoomAgentViewModels } from "./war-room-console";

function makeTask(
  overrides: Partial<WarRoomTask> & { task_number: number; assigned_agent: WarRoomTask["assigned_agent"] },
): WarRoomTask {
  const { task_number, assigned_agent, ...rest } = overrides;
  return {
    id: `task-${task_number}`,
    war_room_id: "wr-1",
    task_number,
    title: `Task ${task_number}`,
    description: null,
    assigned_agent,
    status: "pending",
    depends_on: [],
    output: null,
    started_at: null,
    completed_at: null,
    ...rest,
  };
}

function makeEvent(
  overrides: Partial<WarRoomEvent> & { event_type: string },
): WarRoomEvent {
  const { event_type, ...rest } = overrides;
  return {
    id: crypto.randomUUID(),
    war_room_id: "wr-1",
    event_type,
    agent: overrides.agent ?? "forge",
    task_number: overrides.task_number ?? 4,
    payload: overrides.payload ?? {},
    created_at: overrides.created_at ?? "2026-03-10T12:05:00.000Z",
    ...rest,
  };
}

describe("war-room-console", () => {
  it("derives agent diagnostics from tasks, heartbeats, and validation events", () => {
    const tasks = hydrateWarRoomTasks(
      [
        makeTask({
          task_number: 4,
          assigned_agent: "forge",
          status: "running",
          depends_on: [2, 3],
          started_at: "2026-03-10T12:00:00.000Z",
        }),
      ],
      [
        makeEvent({
          event_type: "task_retry",
          payload: { attempt: 2, max: 3 },
        }),
      ],
    );

    const heartbeats: AgentHeartbeat[] = [
      {
        id: "hb-1",
        war_room_id: "wr-1",
        agent: "forge",
        status: "working",
        last_ping: "2026-03-10T12:05:20.000Z",
        metadata: {
          task_number: 4,
          phase: "assembling",
          elapsed_seconds: 42,
        },
      },
    ];

    const views = buildWarRoomAgentViewModels({
      tasks,
      heartbeats,
      events: [
        makeEvent({
          event_type: "deterministic_validation",
          payload: { failure_count: 2 },
        }),
        makeEvent({
          event_type: "task_failed",
          payload: { error: "Missing dependency edge" },
          created_at: "2026-03-10T12:05:30.000Z",
        }),
      ],
      now: new Date("2026-03-10T12:05:30.000Z").getTime(),
    });

    const forge = views.find((entry) => entry.agent === "forge");
    expect(forge?.status).toBe("working");
    expect(forge?.phase).toBe("assembling");
    expect(forge?.currentTask?.task_number).toBe(4);
    expect(forge?.validationSummaries[0]).toContain("2 issue");
    expect(forge?.errors[0]).toContain("Missing dependency edge");
  });

  it("marks heartbeats as stale when the active agent stops pinging", () => {
    const tasks = hydrateWarRoomTasks(
      [
        makeTask({
          task_number: 1,
          assigned_agent: "jarvis",
          status: "running",
          started_at: "2026-03-10T12:00:00.000Z",
        }),
      ],
      [],
    );

    const views = buildWarRoomAgentViewModels({
      tasks,
      heartbeats: [
        {
          id: "hb-stale",
          war_room_id: "wr-1",
          agent: "jarvis",
          status: "working",
          last_ping: "2026-03-10T12:00:00.000Z",
          metadata: { task_number: 1 },
        },
      ],
      events: [],
      now: new Date("2026-03-10T12:01:00.000Z").getTime(),
    });

    expect(views.find((entry) => entry.agent === "jarvis")?.status).toBe("stale");
  });
});
