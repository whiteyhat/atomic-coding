import { describe, expect, it } from "vitest";
import type {
  AgentHeartbeat,
  WarRoomEvent,
  WarRoomTask,
  WarRoomWithFeed,
} from "./types";
import {
  applyWarRoomEvent,
  hydrateWarRoomFeed,
  hydrateWarRoomTasks,
  upsertHeartbeatState,
} from "./war-room-state";

function makeTask(
  overrides: Partial<WarRoomTask> & { task_number: number }
): WarRoomTask {
  const { task_number, ...rest } = overrides;
  return {
    id: `task-${task_number}`,
    war_room_id: "wr-1",
    task_number,
    title: `Task ${task_number}`,
    description: null,
    assigned_agent: "jarvis",
    status: "pending",
    depends_on: [],
    output: null,
    started_at: null,
    completed_at: null,
    ...rest,
  };
}

function makeEvent(
  overrides: Partial<WarRoomEvent> & { event_type: string; created_at?: string }
): WarRoomEvent {
  const { event_type, created_at, ...rest } = overrides;
  return {
    id: crypto.randomUUID(),
    war_room_id: "wr-1",
    event_type,
    agent: overrides.agent ?? "jarvis",
    task_number: overrides.task_number ?? null,
    payload: overrides.payload ?? {},
    created_at: created_at ?? "2026-03-10T12:00:00.000Z",
    ...rest,
  };
}

describe("hydrateWarRoomTasks", () => {
  it("derives blocker info from dependency state and blocked events", () => {
    const tasks = hydrateWarRoomTasks(
      [
        makeTask({ task_number: 1, status: "running" }),
        makeTask({ task_number: 2, status: "blocked", depends_on: [1] }),
      ],
      [
        makeEvent({
          event_type: "task_blocked",
          task_number: 2,
          payload: {
            waiting_on: [1],
            resolved_dependencies: [],
          },
        }),
      ]
    );

    expect(tasks[1].status).toBe("blocked");
    expect(tasks[1].waiting_on).toEqual([1]);
    expect(tasks[1].resolved_dependencies).toEqual([]);
  });

  it("stores started_at on task_running and preserves completion metadata", () => {
    const runningEvent = makeEvent({
      event_type: "task_running",
      task_number: 1,
      created_at: "2026-03-10T12:01:00.000Z",
      payload: { started_at: "2026-03-10T12:01:00.000Z" },
    });
    const completedEvent = makeEvent({
      event_type: "task_completed",
      task_number: 1,
      created_at: "2026-03-10T12:02:30.000Z",
      payload: {
        completed_at: "2026-03-10T12:02:30.000Z",
        output_keys: ["status", "notes"],
      },
    });

    const tasks = hydrateWarRoomTasks(
      [makeTask({ task_number: 1, status: "assigned" })],
      [runningEvent, completedEvent]
    );

    expect(tasks[0].started_at).toBe("2026-03-10T12:01:00.000Z");
    expect(tasks[0].completed_at).toBe("2026-03-10T12:02:30.000Z");
    expect(tasks[0].output_keys).toEqual(["status", "notes"]);
  });

  it("tracks retry metadata and keeps dependency-derived waiting state current", () => {
    const taskStates = hydrateWarRoomTasks(
      [
        makeTask({ task_number: 9, status: "assigned", depends_on: [4, 5, 6] }),
        makeTask({ task_number: 10, status: "blocked", depends_on: [9] }),
      ],
      [
        makeEvent({
          event_type: "task_retry",
          task_number: 10,
          payload: { attempt: 2, max: 3 },
        }),
      ]
    );

    expect(taskStates[1].retry_attempt).toBe(2);
    expect(taskStates[1].retry_max).toBe(3);
    expect(taskStates[1].waiting_on).toEqual([9]);
  });
});

describe("applyWarRoomEvent", () => {
  it("updates running task phase from agent_thinking events", () => {
    const initial = hydrateWarRoomTasks(
      [makeTask({ task_number: 1, status: "running", started_at: "2026-03-10T12:01:00.000Z" })],
      []
    );

    const updated = applyWarRoomEvent(
      initial,
      makeEvent({
        event_type: "agent_thinking",
        task_number: 1,
        payload: { phase: "processing", elapsed_seconds: 12 },
      })
    );

    expect(updated[0].active_phase).toBe("processing");
    expect(updated[0].status).toBe("running");
  });
});

describe("hydrateWarRoomFeed", () => {
  it("hydrates tasks, events, and heartbeats together for reloads", () => {
    const heartbeat: AgentHeartbeat = {
      id: "hb-1",
      war_room_id: "wr-1",
      agent: "jarvis",
      status: "working",
      last_ping: "2026-03-10T12:01:30.000Z",
      metadata: {
        task_number: 1,
        title: "Task 1",
        phase: "processing",
        elapsed_seconds: 30,
      },
    };

    const room: WarRoomWithFeed = {
      id: "wr-1",
      game_id: "game-1",
      user_id: "user-1",
      prompt: "Add a new feature",
      genre: "arena-dogfighter",
      game_format: "3d",
      status: "running",
      scope: null,
      suggested_prompts: null,
      final_build_id: null,
      created_at: "2026-03-10T12:00:00.000Z",
      completed_at: null,
      tasks: [makeTask({ task_number: 1, status: "running" })],
      events: [
        makeEvent({
          event_type: "task_running",
          task_number: 1,
          payload: { started_at: "2026-03-10T12:01:00.000Z" },
        }),
      ],
      heartbeats: [heartbeat],
    };

    const hydrated = hydrateWarRoomFeed(room);

    expect(hydrated.tasks[0].started_at).toBe("2026-03-10T12:01:00.000Z");
    expect(hydrated.events).toHaveLength(1);
    expect(hydrated.heartbeats[0].metadata.phase).toBe("processing");
  });

  it("normalizes malformed feed collections so the console does not crash", () => {
    const room = {
      id: "wr-1",
      game_id: "game-1",
      user_id: "user-1",
      prompt: "Add a new feature",
      genre: "arena-dogfighter",
      game_format: "3d",
      status: "running",
      scope: null,
      suggested_prompts: null,
      final_build_id: null,
      created_at: "2026-03-10T12:00:00.000Z",
      completed_at: null,
      tasks: { broken: true },
      events: { latest: [] },
      heartbeats: null,
    } as unknown as WarRoomWithFeed;

    const hydrated = hydrateWarRoomFeed(room);

    expect(hydrated.tasks).toEqual([]);
    expect(hydrated.events).toEqual([]);
    expect(hydrated.heartbeats).toEqual([]);
  });
});

describe("upsertHeartbeatState", () => {
  it("replaces existing agent heartbeat entries", () => {
    const initial: AgentHeartbeat[] = [
      {
        id: "hb-1",
        war_room_id: "wr-1",
        agent: "jarvis",
        status: "idle",
        last_ping: "2026-03-10T12:00:00.000Z",
        metadata: {},
      },
    ];

    const updated = upsertHeartbeatState(initial, {
      id: "hb-2",
      war_room_id: "wr-1",
      agent: "jarvis",
      status: "working",
      last_ping: "2026-03-10T12:01:00.000Z",
      metadata: { phase: "processing" },
    });

    expect(updated).toHaveLength(1);
    expect(updated[0].id).toBe("hb-2");
    expect(updated[0].status).toBe("working");
  });
});
