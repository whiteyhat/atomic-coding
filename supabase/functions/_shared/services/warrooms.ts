import { getSupabaseClient } from "../supabase-client.ts";
import { log } from "../logger.ts";
import { emitOpenClawEvent } from "./openclaw.ts";

// =============================================================================
// Types
// =============================================================================

export type WarRoomStatus =
  | "planning"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export type TaskStatus =
  | "pending"
  | "assigned"
  | "running"
  | "completed"
  | "failed"
  | "blocked";

export type AgentName = "jarvis" | "forge" | "pixel" | "checker";

export type HeartbeatStatus = "idle" | "working" | "error" | "timeout";

export interface WarRoom {
  id: string;
  game_id: string;
  user_id: string | null;
  prompt: string;
  genre: string | null;
  game_format: "2d" | "3d" | null;
  status: WarRoomStatus;
  scope: Record<string, unknown> | null;
  suggested_prompts: string[] | null;
  final_build_id: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface WarRoomTask {
  id: string;
  war_room_id: string;
  task_number: number;
  title: string;
  description: string | null;
  assigned_agent: AgentName | null;
  status: TaskStatus;
  depends_on: number[];
  output: Record<string, unknown> | null;
  started_at: string | null;
  completed_at: string | null;
}

export interface WarRoomEvent {
  id: string;
  war_room_id: string;
  event_type: string;
  agent: string | null;
  task_number: number | null;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface AgentHeartbeat {
  id: string;
  war_room_id: string;
  agent: AgentName;
  status: HeartbeatStatus;
  last_ping: string;
  metadata: Record<string, unknown>;
}

export interface WarRoomWithTasks extends WarRoom {
  tasks: WarRoomTask[];
}

export interface WarRoomWithFeed extends WarRoomWithTasks {
  events: WarRoomEvent[];
  heartbeats: AgentHeartbeat[];
}

// =============================================================================
// The 12 fixed pipeline tasks
// =============================================================================

const PIPELINE_TASKS: Omit<WarRoomTask, "id" | "war_room_id" | "status" | "output" | "started_at" | "completed_at">[] = [
  {
    task_number: 1,
    title: "Parse scope & plan",
    description: "Analyze the user prompt and determine required atoms, features, and architecture.",
    assigned_agent: "jarvis",
    depends_on: [],
  },
  {
    task_number: 2,
    title: "Load genre boilerplate",
    description: "Verify seeded boilerplate atoms, customize for game scope, and report atom structure.",
    assigned_agent: "forge",
    depends_on: [1],
  },
  {
    task_number: 3,
    title: "Write validation specs",
    description: "Generate structural validation rules for planned atoms.",
    assigned_agent: "checker",
    depends_on: [1],
  },
  {
    task_number: 4,
    title: "Implement util atoms",
    description: "Create utility atoms (helpers, math, config) bottom-up.",
    assigned_agent: "forge",
    depends_on: [2, 3],
  },
  {
    task_number: 5,
    title: "Implement feature atoms",
    description: "Create feature atoms that compose utilities into gameplay systems.",
    assigned_agent: "forge",
    depends_on: [4],
  },
  {
    task_number: 6,
    title: "Implement core atoms",
    description: "Create core atoms (game_loop, create_scene) that wire features together.",
    assigned_agent: "forge",
    depends_on: [2, 3, 5],
  },
  {
    task_number: 7,
    title: "Generate UI assets",
    description: "Establish design system, build component inventory, and generate production-ready UI packs (HUD, menus, buttons, overlays) with interaction states.",
    assigned_agent: "pixel",
    depends_on: [1],
  },
  {
    task_number: 8,
    title: "Generate game sprites",
    description: "Generate character sprites, textures, and environment assets aligned with the Task 7 design system for visual coherence.",
    assigned_agent: "pixel",
    depends_on: [1, 5, 7],
  },
  {
    task_number: 9,
    title: "Run validation suite",
    description: "Validate all atoms against structural rules (size, naming, interfaces, DAG).",
    assigned_agent: "checker",
    depends_on: [4, 5, 6],
  },
  {
    task_number: 10,
    title: "Fix failures",
    description: "Re-implement atoms that failed validation (max 3 retries).",
    assigned_agent: "forge",
    depends_on: [9],
  },
  {
    task_number: 11,
    title: "Final validation",
    description: "Full regression: all atoms pass, assets load, bundle builds.",
    assigned_agent: "checker",
    depends_on: [10, 7, 8],
  },
  {
    task_number: 12,
    title: "Deliver & suggest prompts",
    description: "Aggregate outputs, trigger final build, generate 2 follow-up prompts.",
    assigned_agent: "jarvis",
    depends_on: [11],
  },
];

// =============================================================================
// Helpers
// =============================================================================

function mapWarRoom(row: any): WarRoom {
  return {
    id: row.id,
    game_id: row.game_id,
    user_id: row.user_id || null,
    prompt: row.prompt,
    genre: row.genre || null,
    game_format: row.game_format || null,
    status: row.status,
    scope: row.scope || null,
    suggested_prompts: row.suggested_prompts || null,
    final_build_id: row.final_build_id || null,
    created_at: row.created_at,
    completed_at: row.completed_at || null,
  };
}

function mapTask(row: any): WarRoomTask {
  return {
    id: row.id,
    war_room_id: row.war_room_id,
    task_number: row.task_number,
    title: row.title,
    description: row.description || null,
    assigned_agent: row.assigned_agent || null,
    status: row.status,
    depends_on: row.depends_on || [],
    output: row.output || null,
    started_at: row.started_at || null,
    completed_at: row.completed_at || null,
  };
}

function mapEvent(row: any): WarRoomEvent {
  return {
    id: row.id,
    war_room_id: row.war_room_id,
    event_type: row.event_type,
    agent: row.agent || null,
    task_number: row.task_number ?? null,
    payload: row.payload || {},
    created_at: row.created_at,
  };
}

function mapHeartbeat(row: any): AgentHeartbeat {
  return {
    id: row.id,
    war_room_id: row.war_room_id,
    agent: row.agent,
    status: row.status,
    last_ping: row.last_ping,
    metadata: row.metadata || {},
  };
}

function buildTaskEventPayload(
  task: WarRoomTask,
  status: TaskStatus,
  output?: Record<string, unknown>,
  extraPayload?: Record<string, unknown>,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    title: task.title,
    ...(extraPayload ?? {}),
  };

  if (task.started_at) {
    payload.started_at = task.started_at;
  }

  if (task.completed_at) {
    payload.completed_at = task.completed_at;
  }

  if (task.started_at && task.completed_at) {
    payload.duration_ms =
      new Date(task.completed_at).getTime() - new Date(task.started_at).getTime();
  }

  if (output) {
    payload.output_keys = Object.keys(output);
    if (typeof output.error === "string") {
      payload.error = output.error;
    }
  }

  if (status === "running" && !payload.started_at) {
    payload.started_at = new Date().toISOString();
  }

  return payload;
}

// =============================================================================
// War Room CRUD
// =============================================================================

/** Create a war room and insert the 12 pipeline tasks. */
export async function createWarRoom(
  gameId: string,
  userId: string | null,
  prompt: string,
  genre: string | null,
  gameFormat: "2d" | "3d" | null,
): Promise<WarRoomWithTasks> {
  const supabase = getSupabaseClient();

  // Check for concurrent war rooms
  const { count, error: countError } = await supabase
    .from("war_rooms")
    .select("*", { count: "exact", head: true })
    .eq("game_id", gameId)
    .in("status", ["planning", "running"]);
  if (countError) throw new Error(countError.message);
  if ((count ?? 0) > 0) {
    throw new Error("A war room is already running for this game. Cancel it first or wait for it to complete.");
  }

  // 1. Create the war room
  const { data: room, error: roomErr } = await supabase
    .from("war_rooms")
    .insert({
      game_id: gameId,
      user_id: userId || null,
      prompt,
      genre: genre || null,
      game_format: gameFormat || null,
    })
    .select("*")
    .single();

  if (roomErr) throw new Error(`Failed to create war room: ${roomErr.message}`);

  // 2. Insert the 12 tasks
  const taskRows = PIPELINE_TASKS.map((t) => ({
    war_room_id: room.id,
    task_number: t.task_number,
    title: t.title,
    description: t.description,
    assigned_agent: t.assigned_agent,
    depends_on: t.depends_on,
    status: t.depends_on.length === 0 ? "assigned" : "blocked",
  }));

  const { data: tasks, error: taskErr } = await supabase
    .from("war_room_tasks")
    .insert(taskRows)
    .select("*")
    .order("task_number", { ascending: true });

  if (taskErr) throw new Error(`Failed to create war room tasks: ${taskErr.message}`);

  // 3. Record creation event
  await recordEvent(room.id, "war_room_created", "jarvis", null, {
    prompt,
    genre,
    game_format: gameFormat,
    task_count: taskRows.length,
  });

  log("info", "war room created", {
    warRoomId: room.id,
    gameId,
    genre,
    gameFormat,
    taskCount: taskRows.length,
  });

  if (room.user_id) {
    await emitOpenClawEvent(room.user_id, "warroom:created", {
      war_room_id: room.id,
      game_id: room.game_id,
      status: room.status,
      prompt: room.prompt,
    });
  }

  return {
    ...mapWarRoom(room),
    tasks: (tasks || []).map(mapTask),
  };
}

/** Get a war room with its tasks. */
export async function getWarRoom(warRoomId: string): Promise<WarRoomWithTasks | null> {
  const supabase = getSupabaseClient();

  const { data: room, error: roomErr } = await supabase
    .from("war_rooms")
    .select("*")
    .eq("id", warRoomId)
    .single();

  if (roomErr) {
    if (roomErr.code === "PGRST116") return null;
    throw new Error(`Failed to get war room: ${roomErr.message}`);
  }

  const { data: tasks, error: taskErr } = await supabase
    .from("war_room_tasks")
    .select("*")
    .eq("war_room_id", warRoomId)
    .order("task_number", { ascending: true });

  if (taskErr) throw new Error(`Failed to get war room tasks: ${taskErr.message}`);

  return {
    ...mapWarRoom(room),
    tasks: (tasks || []).map(mapTask),
  };
}

/** Get a war room with its tasks, events, and heartbeats for UI hydration. */
export async function getWarRoomFeed(warRoomId: string): Promise<WarRoomWithFeed | null> {
  const room = await getWarRoom(warRoomId);
  if (!room) return null;

  const [events, heartbeats] = await Promise.all([
    getEvents(warRoomId),
    getHeartbeats(warRoomId),
  ]);

  return {
    ...room,
    events,
    heartbeats,
  };
}

/** List war rooms for a game, newest first. */
export async function listWarRooms(
  gameId: string,
  limit = 20,
): Promise<WarRoom[]> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("war_rooms")
    .select("*")
    .eq("game_id", gameId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Failed to list war rooms: ${error.message}`);
  return (data || []).map(mapWarRoom);
}

/** Update war room status. */
export async function updateWarRoomStatus(
  warRoomId: string,
  status: WarRoomStatus,
  suggestedPrompts?: string[],
  finalBuildId?: string,
): Promise<WarRoom> {
  const supabase = getSupabaseClient();

  const updates: Record<string, unknown> = { status };
  if (suggestedPrompts) updates.suggested_prompts = suggestedPrompts;
  if (finalBuildId) updates.final_build_id = finalBuildId;
  if (status === "completed" || status === "failed" || status === "cancelled") {
    updates.completed_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from("war_rooms")
    .update(updates)
    .eq("id", warRoomId)
    .select("*")
    .single();

  if (error) throw new Error(`Failed to update war room: ${error.message}`);

  await recordEvent(warRoomId, `war_room_${status}`, null, null, { status });
  if (data.user_id) {
    await emitOpenClawEvent(data.user_id, `warroom:${status}`, {
      war_room_id: data.id,
      game_id: data.game_id,
      status,
      final_build_id: data.final_build_id,
    });
  }

  log("info", "war room status updated", { warRoomId, status });
  return mapWarRoom(data);
}

// =============================================================================
// Task Management
// =============================================================================

/** Assign a task to an agent. */
export async function assignTask(
  warRoomId: string,
  taskNumber: number,
  agent: AgentName,
): Promise<WarRoomTask> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("war_room_tasks")
    .update({
      assigned_agent: agent,
      status: "assigned" as TaskStatus,
    })
    .eq("war_room_id", warRoomId)
    .eq("task_number", taskNumber)
    .select("*")
    .single();

  if (error) throw new Error(`Failed to assign task: ${error.message}`);

  await recordEvent(warRoomId, "task_assigned", agent, taskNumber, {
    title: data.title,
  });

  return mapTask(data);
}

/** Update task status and optionally its output. */
export async function updateTaskStatus(
  warRoomId: string,
  taskNumber: number,
  status: TaskStatus,
  output?: Record<string, unknown>,
  eventPayload?: Record<string, unknown>,
): Promise<WarRoomTask> {
  const supabase = getSupabaseClient();

  const updates: Record<string, unknown> = { status };
  if (status === "pending" || status === "assigned" || status === "blocked") {
    updates.started_at = null;
    updates.completed_at = null;
    updates.output = null;
  }
  if (status === "running") {
    updates.started_at = new Date().toISOString();
    updates.completed_at = null;
    updates.output = null;
  }
  if (status === "completed" || status === "failed") {
    updates.completed_at = new Date().toISOString();
  }
  if (output !== undefined) updates.output = output;

  const { data, error } = await supabase
    .from("war_room_tasks")
    .update(updates)
    .eq("war_room_id", warRoomId)
    .eq("task_number", taskNumber)
    .select("*")
    .single();

  if (error) throw new Error(`Failed to update task: ${error.message}`);

  const mappedTask = mapTask(data);
  await recordEvent(
    warRoomId,
    `task_${status}`,
    data.assigned_agent,
    taskNumber,
    buildTaskEventPayload(mappedTask, status, output, eventPayload),
  );

  log("info", "task status updated", { warRoomId, taskNumber, status });
  return mappedTask;
}

/** Get all tasks for a war room. */
export async function getTasks(warRoomId: string): Promise<WarRoomTask[]> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("war_room_tasks")
    .select("*")
    .eq("war_room_id", warRoomId)
    .order("task_number", { ascending: true });

  if (error) throw new Error(`Failed to get tasks: ${error.message}`);
  return (data || []).map(mapTask);
}

// =============================================================================
// Events (SSE log)
// =============================================================================

/** Record a war room event. */
export async function recordEvent(
  warRoomId: string,
  eventType: string,
  agent?: string | null,
  taskNumber?: number | null,
  payload?: Record<string, unknown>,
): Promise<WarRoomEvent> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("war_room_events")
    .insert({
      war_room_id: warRoomId,
      event_type: eventType,
      agent: agent || null,
      task_number: taskNumber ?? null,
      payload: payload || {},
    })
    .select("*")
    .single();

  if (error) throw new Error(`Failed to record event: ${error.message}`);
  return mapEvent(data);
}

/** Get events for a war room (for initial SSE hydration). */
export async function getEvents(
  warRoomId: string,
  sinceId?: string,
): Promise<WarRoomEvent[]> {
  const supabase = getSupabaseClient();

  let query = supabase
    .from("war_room_events")
    .select("*")
    .eq("war_room_id", warRoomId)
    .order("created_at", { ascending: true });

  if (sinceId) {
    // Get events after a specific event ID for reconnection
    const { data: ref } = await supabase
      .from("war_room_events")
      .select("created_at")
      .eq("id", sinceId)
      .single();

    if (ref) {
      query = query.gt("created_at", ref.created_at);
    }
  }

  const { data, error } = await query;
  if (error) throw new Error(`Failed to get events: ${error.message}`);
  return (data || []).map(mapEvent);
}

// =============================================================================
// Heartbeats
// =============================================================================

/** Upsert an agent heartbeat. */
export async function upsertHeartbeat(
  warRoomId: string,
  agent: AgentName,
  status: HeartbeatStatus,
  metadata?: Record<string, unknown>,
): Promise<AgentHeartbeat> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("agent_heartbeats")
    .upsert(
      {
        war_room_id: warRoomId,
        agent,
        status,
        last_ping: new Date().toISOString(),
        metadata: metadata || {},
      },
      { onConflict: "war_room_id,agent" },
    )
    .select("*")
    .single();

  if (error) throw new Error(`Failed to upsert heartbeat: ${error.message}`);
  return mapHeartbeat(data);
}

/** Get all heartbeats for a war room. */
export async function getHeartbeats(
  warRoomId: string,
): Promise<AgentHeartbeat[]> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("agent_heartbeats")
    .select("*")
    .eq("war_room_id", warRoomId);

  if (error) throw new Error(`Failed to get heartbeats: ${error.message}`);
  return (data || []).map(mapHeartbeat);
}

// =============================================================================
// Stuck War Room Cleanup
// =============================================================================

const PLANNING_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes
const RUNNING_TIMEOUT_MS = 25 * 60 * 1000; // 25 minutes

/**
 * Find and auto-fail war rooms stuck in planning or running state.
 * Returns the number of war rooms that were cleaned up.
 */
export async function cleanupStuckWarRooms(): Promise<number> {
  const supabase = getSupabaseClient();
  const now = new Date();
  let cleaned = 0;

  // 1. Fail war rooms stuck in "planning" (trigger never fired)
  const planningCutoff = new Date(now.getTime() - PLANNING_TIMEOUT_MS).toISOString();
  const { data: stuckPlanning } = await supabase
    .from("war_rooms")
    .select("id")
    .eq("status", "planning")
    .lt("created_at", planningCutoff);

  for (const room of stuckPlanning || []) {
    await updateWarRoomStatus(room.id, "failed");
    await recordEvent(room.id, "pipeline_stuck", "jarvis", null, {
      reason: "War room stuck in planning — trigger likely failed",
      timeout_ms: PLANNING_TIMEOUT_MS,
    });
    cleaned++;
    log("warn", "cleaned up stuck planning war room", { warRoomId: room.id });
  }

  // 2. Fail war rooms stuck in "running" (pipeline crashed or timed out)
  const runningCutoff = new Date(now.getTime() - RUNNING_TIMEOUT_MS).toISOString();
  const { data: stuckRunning } = await supabase
    .from("war_rooms")
    .select("id")
    .eq("status", "running")
    .lt("created_at", runningCutoff);

  for (const room of stuckRunning || []) {
    await updateWarRoomStatus(room.id, "failed");
    await recordEvent(room.id, "pipeline_stuck", "jarvis", null, {
      reason: "War room stuck in running — pipeline likely crashed",
      timeout_ms: RUNNING_TIMEOUT_MS,
    });
    cleaned++;
    log("warn", "cleaned up stuck running war room", { warRoomId: room.id });
  }

  return cleaned;
}
