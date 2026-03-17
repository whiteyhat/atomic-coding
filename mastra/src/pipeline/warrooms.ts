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
  WarRoomGeneratedAsset,
  WarRoomVisualReference,
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
    game_format: row.game_format || null,
    status: row.status,
    scope: row.scope || null,
    visual_references: Array.isArray(row.visual_references)
      ? row.visual_references.map(mapVisualReference)
      : [],
    suggested_prompts: row.suggested_prompts || null,
    final_build_id: row.final_build_id || null,
    created_at: row.created_at,
    completed_at: row.completed_at || null,
  };
}

function mapVisualReference(value: any): WarRoomVisualReference {
  return {
    id: String(value?.id ?? ""),
    prompt: String(value?.prompt ?? ""),
    style: value?.style ? String(value.style) : null,
    image_url: String(value?.image_url ?? ""),
    created_at: value?.created_at ? String(value.created_at) : null,
    is_public: Boolean(value?.is_public),
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

function mapGeneratedAsset(row: any): WarRoomGeneratedAsset {
  return {
    id: row.id,
    war_room_id: row.war_room_id,
    task_number: row.task_number,
    stable_asset_id: row.stable_asset_id,
    asset_kind: row.asset_kind,
    variant: row.variant || "",
    storage_path: row.storage_path || null,
    public_url: row.public_url || null,
    width: typeof row.width === "number" ? row.width : null,
    height: typeof row.height === "number" ? row.height : null,
    layout_version: typeof row.layout_version === "number" ? row.layout_version : 1,
    runtime_ready: Boolean(row.runtime_ready),
    editor_only: Boolean(row.editor_only),
    source_service: row.source_service,
    metadata: row.metadata || {},
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function buildTaskEventPayload(
  task: WarRoomTask,
  status: TaskStatus,
  output?: Record<string, unknown>,
  extraPayload?: Record<string, unknown>
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
  output?: Record<string, unknown>,
  eventPayload?: Record<string, unknown>
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
    buildTaskEventPayload(mappedTask, status, output, eventPayload)
  );

  console.log("[warrooms] task updated", { warRoomId, taskNumber, status });
  return mappedTask;
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

export async function getWarRoomEvents(
  warRoomId: string,
  filters?: {
    eventTypes?: string[];
    taskNumbers?: number[];
    limit?: number;
  }
): Promise<WarRoomEvent[]> {
  const supabase = getSupabaseClient();

  let query = supabase
    .from("war_room_events")
    .select("*")
    .eq("war_room_id", warRoomId)
    .order("created_at", { ascending: false });

  if (filters?.eventTypes?.length) {
    query = query.in("event_type", filters.eventTypes);
  }
  if (filters?.taskNumbers?.length) {
    query = query.in("task_number", filters.taskNumbers);
  }
  query = query.limit(filters?.limit ?? 50);

  const { data, error } = await query;
  if (error) throw new Error(`Failed to get events: ${error.message}`);
  return (data || []).map(mapEvent);
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

export async function listGeneratedAssets(
  warRoomId: string,
): Promise<WarRoomGeneratedAsset[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("war_room_generated_assets")
    .select("*")
    .eq("war_room_id", warRoomId)
    .order("task_number", { ascending: true })
    .order("stable_asset_id", { ascending: true })
    .order("asset_kind", { ascending: true })
    .order("variant", { ascending: true });

  if (error) {
    throw new Error(`Failed to list generated assets: ${error.message}`);
  }

  return (data || []).map(mapGeneratedAsset);
}

export async function upsertGeneratedAsset(input: {
  war_room_id: string;
  task_number: 7 | 8;
  stable_asset_id: string;
  asset_kind: WarRoomGeneratedAsset["asset_kind"];
  variant?: string | null;
  storage_path?: string | null;
  public_url?: string | null;
  width?: number | null;
  height?: number | null;
  layout_version?: number | null;
  runtime_ready?: boolean;
  editor_only?: boolean;
  source_service?: string;
  metadata?: Record<string, unknown>;
}): Promise<WarRoomGeneratedAsset> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("war_room_generated_assets")
    .upsert(
      {
        war_room_id: input.war_room_id,
        task_number: input.task_number,
        stable_asset_id: input.stable_asset_id,
        asset_kind: input.asset_kind,
        variant: input.variant ?? "",
        storage_path: input.storage_path ?? null,
        public_url: input.public_url ?? null,
        width: input.width ?? null,
        height: input.height ?? null,
        layout_version: input.layout_version ?? 1,
        runtime_ready: input.runtime_ready ?? false,
        editor_only: input.editor_only ?? false,
        source_service: input.source_service ?? "unknown",
        metadata: input.metadata ?? {},
      },
      { onConflict: "war_room_id,task_number,stable_asset_id,asset_kind,variant" },
    )
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to upsert generated asset: ${error.message}`);
  }

  return mapGeneratedAsset(data);
}
