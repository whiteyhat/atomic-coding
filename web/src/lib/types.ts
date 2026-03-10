// ── Game ──────────────────────────────────────────────────────────────────────

export interface Game {
  id: string;
  name: string;
  description: string | null;
  active_build_id: string | null;
  user_id: string | null;
  genre: string | null;
  game_format: "2d" | "3d" | null;
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
  game_format: "2d" | "3d";
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

export type LeaderboardPeriod = "day" | "week" | "lifetime";

// ── User Profiles ────────────────────────────────────────────────────────────

export interface UserProfile {
  id: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
  wallet_address: string | null;
  created_at: string;
  updated_at: string;
}

// ── OpenClaw ────────────────────────────────────────────────────────────────

export type OpenClawConnectionStatus =
  | "pending"
  | "connected"
  | "disconnected"
  | "error"
  | "replaced";

export type OpenClawOnboardingStatus =
  | "pending_claim"
  | "claimed"
  | "expired"
  | "failed"
  | "cancelled";

export interface OpenClawAgent {
  id: string;
  user_id: string;
  name: string;
  avatar_emoji: string;
  description: string | null;
  agent_url: string;
  endpoint_url: string | null;
  delivery_channel: "custom" | "telegram";
  telegram_chat_id: string | null;
  webhook_events: string[];
  connection_status: OpenClawConnectionStatus;
  last_heartbeat: string | null;
  last_error: string | null;
  capabilities: string[];
  api_key_prefix: string | null;
  claimed_at: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface OpenClawWebhookEventOption {
  key: string;
  label: string;
  description: string;
}

export interface OpenClawCapabilityOperation {
  method: string;
  path: string;
  summary: string;
}

export interface OpenClawCapabilityGroup {
  key: string;
  label: string;
  description: string;
  operations: OpenClawCapabilityOperation[];
}

export interface OpenClawAgentEnvelope {
  agent: OpenClawAgent | null;
  api_base_url: string;
  skill_manifest_url: string;
  skill_json_url: string;
  heartbeat_url: string;
  docs_url: string;
  capabilities: OpenClawCapabilityGroup[];
  webhook_events: OpenClawWebhookEventOption[];
}

export interface OpenClawOnboardingSession {
  session_id: string;
  status: OpenClawOnboardingStatus;
  mode: "import" | "replace";
  expires_at: string;
  claimed_at: string | null;
  agent_id: string | null;
  replaces_agent_id: string | null;
  identity: {
    name: string;
    description: string | null;
    avatar: string;
  } | null;
  agent_url: string | null;
  endpoint_url: string | null;
  webhook_events: string[];
  last_error: string | null;
  created_at: string;
  updated_at: string;
  onboarding_url?: string;
}

export interface OpenClawApiKeySummary {
  id: string;
  key_prefix: string;
  scopes: string[];
  rate_limit_tier: string;
  created_at: string;
  revoked_at: string | null;
  last_used_at: string | null;
  active: boolean;
}

export interface OpenClawApiKeySecret {
  api_key: string;
  summary: OpenClawApiKeySummary;
}

export interface OpenClawActivityEntry {
  tool_name: string;
  method: string;
  status_code: number;
  latency_ms: number;
  created_at: string;
}

export interface OpenClawActivityResponse {
  entries: OpenClawActivityEntry[];
  hasMore: boolean;
}

export interface OpenClawWebhookDelivery {
  event: string;
  url: string;
  status_code: number | null;
  latency_ms: number;
  attempt: number;
  error: string | null;
  created_at: string;
}

export interface OpenClawWebhookConfig {
  delivery_channel: "custom" | "telegram";
  endpoint_url: string | null;
  telegram_bot_token: string | null;
  telegram_chat_id: string | null;
  webhook_events: string[];
}

export interface OpenClawHealthScore {
  status: "healthy" | "degraded" | "critical" | "insufficient_data";
  score: number | null;
  grade: "A" | "B" | "C" | "D" | "F" | null;
  components: {
    uptime: number | null;
    error_rate: number | null;
    latency: number | null;
    connection: number | null;
  };
  total_requests_24h: number;
  error_count_24h: number;
  avg_latency_ms: number | null;
  heartbeat_samples_24h: number;
  connection_status: OpenClawConnectionStatus;
  message: string;
}

export interface OpenClawWebhookTestResult {
  ok: boolean;
  status_code: number | null;
  latency_ms: number;
  error?: string;
}

export interface OpenClawPlatformHealth {
  status: "ok" | "degraded";
  checks: {
    api: "ok";
    supabase: "ok" | "error";
    mastra: "ok" | "error" | "not_configured";
  };
  config: {
    mastraConfigured: boolean;
  };
}

export interface OpenClawSkillManifest {
  name: string;
  version: string;
  workflow: string;
  api_base_url: string;
  docs_url: string;
  skill_manifest_url: string;
  skill_json_url: string;
  create_session_path: string;
  replace_session_path: string;
  claim_path_template: string;
  heartbeat_url: string;
  claim_required_fields: string[];
  claim_optional_fields: string[];
  webhook_events: OpenClawWebhookEventOption[];
  scopes: string[];
  capabilities: OpenClawCapabilityGroup[];
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
  status: WarRoomTaskStatus;
  depends_on: number[];
  output: Record<string, unknown> | null;
  started_at: string | null;
  completed_at: string | null;
}

export interface WarRoomWithTasks extends WarRoom {
  tasks: WarRoomTask[];
}

export interface WarRoomWithFeed extends WarRoomWithTasks {
  events: WarRoomEvent[];
  heartbeats: AgentHeartbeat[];
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

// ── 3D Model Assets ─────────────────────────────────────────────────────────

export interface AssetMedia {
  url: string;
  alt?: string;
  type?: string;
}

export interface AssetModel {
  _id: string;
  prompt: string;
  style: string | null;
  image: AssetMedia;
  createdAt: string;
  isPublic: boolean;
}

export interface AssetModelPage {
  items: AssetModel[];
  metadata: {
    limit: number;
    offset: number;
    numElements: number;
    page: number;
    pages: number;
  };
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

// ── Health ───────────────────────────────────────────────────────────────────

export type HealthCheckStatus = "ok" | "error" | "not_configured";

export interface AppHealthStatus {
  status: "ok" | "degraded";
  checks: {
    web: HealthCheckStatus;
    supabase: HealthCheckStatus;
    mastra: HealthCheckStatus;
  };
  config: {
    apiBaseHost: string;
    supabaseHost: string | null;
    mastraHost: string | null;
    clerkConfigured: boolean;
    mastraConfigured: boolean;
  };
}

// ── Dashboard ────────────────────────────────────────────────────────────────

export type DashboardTokenStatus =
  | "none"
  | "draft"
  | "pending"
  | "launched"
  | "failed";

export interface DashboardProfile {
  id: string;
  displayName: string | null;
  email: string | null;
  walletAddress: string | null;
  avatarUrl: string | null;
}

export interface DashboardStats {
  totalGames: number;
  publishedGames: number;
  totalAtoms: number;
  successfulBuilds: number;
}

export interface DashboardGameSummary {
  id: string;
  name: string;
  description: string | null;
  genre: string | null;
  gameFormat: "2d" | "3d";
  thumbnailUrl: string | null;
  isPublished: boolean;
  publicSlug: string | null;
  tokenStatus: DashboardTokenStatus;
  externalCount: number;
  topLeaderboardScore: number | null;
  lastChatAt: string | null;
  latestBuild: {
    status: BuildStatus;
    atomCount: number | null;
  } | null;
  currentWarRoom: {
    status: WarRoomStatus;
    prompt: string;
    progress: number;
    completedTasks: number;
    totalTasks: number;
  } | null;
  spotlightReason?: "activeWarRoom" | "building" | "recentlyUpdated";
  updatedAt: string;
}

export interface DashboardSpotlight extends DashboardGameSummary {
  spotlightReason: "activeWarRoom" | "building" | "recentlyUpdated";
}

export interface DashboardActivityItem {
  id: string;
  kind: "warRoom" | "build" | "chat" | "publish" | "unpublish" | "token";
  title: string;
  gameName: string;
  description: string | null;
  status: string | null;
  href: string;
  createdAt: string;
}

export interface BoilerplateQuickStart {
  slug: string;
  displayName: string;
}

export interface DashboardSummary {
  profile: DashboardProfile;
  stats: DashboardStats;
  creations: DashboardGameSummary[];
  spotlight: DashboardSpotlight | null;
  activity: DashboardActivityItem[];
  boilerplates: BoilerplateQuickStart[];
}

export interface TokenActivityItem {
  id: string;
  tokenSymbol: string;
  tokenColor: string;
  action: "bonding" | "sold" | "bought" | "launched";
  changePercent: number;
  timeAgo: string;
  detail: string;
}
