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

export interface DispatchResult {
  success: boolean;
  output?: Record<string, unknown>;
  error?: string;
}
