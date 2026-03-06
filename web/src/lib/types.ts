// ── Game ──────────────────────────────────────────────────────────────────────

export interface Game {
  id: string;
  name: string;
  description: string | null;
  active_build_id: string | null;
  user_id: string | null;
  genre: string | null;
  thumbnail_url: string | null;
  is_published: boolean;
  published_at: string | null;
  public_slug: string | null;
  published_bundle_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface GameWithBuild extends Game {
  active_build?: BuildSummary | null;
}

// ── Boilerplates ─────────────────────────────────────────────────────────────

export interface BoilerplateSummary {
  slug: string;
  display_name: string;
  description: string | null;
  thumbnail_url: string | null;
  externals: string[];
  template_prompts: string[];
}

// ── Atoms ─────────────────────────────────────────────────────────────────────

export interface Port {
  name: string;
  type:
    | "number"
    | "string"
    | "boolean"
    | "number[]"
    | "string[]"
    | "boolean[]"
    | "void";
  description?: string;
  optional?: boolean;
}

export type AtomType = "core" | "feature" | "util";

export interface AtomSummary {
  name: string;
  type: AtomType;
  inputs: Port[];
  outputs: Port[];
  depends_on: string[];
}

export interface AtomFull extends AtomSummary {
  code: string;
  description: string | null;
  version: number;
}

// ── Externals ─────────────────────────────────────────────────────────────────

export interface RegistryEntry {
  id: string;
  name: string;
  display_name: string;
  package_name: string;
  version: string;
  cdn_url: string;
  global_name: string;
  description: string | null;
}

export interface InstalledExternal extends RegistryEntry {
  load_type: string;
  module_imports: Record<string, string> | null;
  installed_at: string;
}

// ── Chat ─────────────────────────────────────────────────────────────────────

export interface ChatSession {
  id: string;
  game_id: string;
  title: string | null;
  model: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  message_id: string;
  role: "user" | "assistant";
  parts: unknown[];
  created_at: string;
}

// ── Scores & Leaderboard ─────────────────────────────────────────────────────

export interface LeaderboardEntry {
  id: string;
  game_id: string;
  user_id: string | null;
  player_name: string;
  avatar_url: string | null;
  score: number;
  created_at: string;
}

// ── Token Launches ──────────────────────────────────────────────────────────

export interface TokenLaunch {
  id: string;
  game_id: string;
  creator_id: string;
  token_name: string;
  token_symbol: string;
  status: "draft" | "pending" | "launched" | "failed";
  chain_id: string | null;
  contract_address: string | null;
  total_supply: number | null;
  leaderboard_allocation_pct: number;
  metadata: Record<string, unknown>;
  created_at: string;
}

// ── War Rooms ────────────────────────────────────────────────────────────────

export type WarRoomStatus =
  | "planning"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export type WarRoomTaskStatus =
  | "pending"
  | "assigned"
  | "running"
  | "completed"
  | "failed"
  | "blocked";

export type AgentName = "jarvis" | "forge" | "pixel" | "checker";

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
  status: WarRoomTaskStatus;
  depends_on: number[];
  output: Record<string, unknown> | null;
  started_at: string | null;
  completed_at: string | null;
}

export interface WarRoomWithTasks extends WarRoom {
  tasks: WarRoomTask[];
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
  status: "idle" | "working" | "error" | "timeout";
  last_ping: string;
  metadata: Record<string, unknown>;
}

// ── Builds ────────────────────────────────────────────────────────────────────

export type BuildStatus = "building" | "success" | "error";

export interface BuildSummary {
  id: string;
  status: BuildStatus;
  bundle_url: string | null;
  atom_count: number | null;
  error_message: string | null;
  created_at: string;
}
