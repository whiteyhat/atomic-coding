import { getSupabaseClient } from "../lib/supabase.js";
import type {
  WarRoom,
  WarRoomTask,
  WarRoomEvent,
  AgentHeartbeat,
  WarRoomWithTasks,
  WarRoomStatus,
  TaskStatus,
  AgentName,
  HeartbeatStatus,
} from "./types.js";

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

// =============================================================================
// War Room CRUD
// =============================================================================

export async function getWarRoom(
  warRoomId: string
): Promise<WarRoomWithTasks | null> {
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

  if (taskErr)
    throw new Error(`Failed to get war room tasks: ${taskErr.message}`);

  return {
    ...mapWarRoom(room),
    tasks: (tasks || []).map(mapTask),
  };
}

export async function updateWarRoomStatus(
  warRoomId: string,
  status: WarRoomStatus,
  suggestedPrompts?: string[],
  finalBuildId?: string
): Promise<WarRoom> {
  const supabase = getSupabaseClient();

  const updates: Record<string, unknown> = { status };
  if (suggestedPrompts) updates.suggested_prompts = suggestedPrompts;
  if (finalBuildId) updates.final_build_id = finalBuildId;
  if (
    status === "completed" ||
    status === "failed" ||
    status === "cancelled"
  ) {
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

  console.log("[warrooms] status updated", { warRoomId, status });
  return mapWarRoom(data);
}

// =============================================================================
// Task Management
// =============================================================================

export async function updateTaskStatus(
  warRoomId: string,
  taskNumber: number,
  status: TaskStatus,
  output?: Record<string, unknown>
): Promise<WarRoomTask> {
  const supabase = getSupabaseClient();

  const updates: Record<string, unknown> = { status };
  if (output !== undefined) updates.output = output;
  if (status === "running") updates.started_at = new Date().toISOString();
  if (status === "completed" || status === "failed") {
    updates.completed_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from("war_room_tasks")
    .update(updates)
    .eq("war_room_id", warRoomId)
    .eq("task_number", taskNumber)
    .select("*")
    .single();

  if (error) throw new Error(`Failed to update task: ${error.message}`);

  await recordEvent(
    warRoomId,
    `task_${status}`,
    data.assigned_agent,
    taskNumber,
    {
      title: data.title,
      ...(output ? { output_summary: Object.keys(output) } : {}),
    }
  );

  console.log("[warrooms] task updated", { warRoomId, taskNumber, status });
  return mapTask(data);
}

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
// Events
// =============================================================================

export async function recordEvent(
  warRoomId: string,
  eventType: string,
  agent?: string | null,
  taskNumber?: number | null,
  payload?: Record<string, unknown>
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

// =============================================================================
// Heartbeats
// =============================================================================

export async function upsertHeartbeat(
  warRoomId: string,
  agent: AgentName,
  status: HeartbeatStatus,
  metadata?: Record<string, unknown>
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
      { onConflict: "war_room_id,agent" }
    )
    .select("*")
    .single();

  if (error) throw new Error(`Failed to upsert heartbeat: ${error.message}`);
  return mapHeartbeat(data);
}
