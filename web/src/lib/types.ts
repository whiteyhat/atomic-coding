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

export type LeaderboardPeriod = "day" | "week" | "lifetime";

// ── Token Launches ──────────────────────────────────────────────────────────

export interface TokenLaunch {
  id: string;
  game_id: string;
  creator_id: string;
  token_name: string;
  token_symbol: string;
  status: "draft" | "configuring" | "deploying" | "live" | "graduating" | "graduated" | "failed";
  chain_id: string | null;
  contract_address: string | null;
  total_supply: number | null;
  leaderboard_allocation_pct: number;
  metadata: Record<string, unknown>;
  created_at: string;
  // Bonding curve config
  curve_mode: number | null;
  initial_mcap: number | null;
  migration_mcap: number | null;
  total_token_supply: number | null;
  token_decimals: number | null;
  supply_on_migration_pct: number | null;
  migration_option: number | null;
  migration_fee_option: number | null;
  creator_fee_pct: number | null;
  creator_lp_pct: number | null;
  base_fee_mode: number | null;
  starting_fee_bps: number | null;
  ending_fee_bps: number | null;
  dynamic_fee: boolean | null;
  token_image_url: string | null;
  token_description: string | null;
  token_website: string | null;
  token_twitter: string | null;
  token_telegram: string | null;
  // On-chain addresses
  dbc_config_key: string | null;
  pool_address: string | null;
  base_mint: string | null;
  quote_mint: string | null;
  creator_wallet: string | null;
  // Timestamps
  deployed_at: string | null;
  graduated_at: string | null;
  graduated_pool: string | null;
}

export interface BondingCurveState {
  id: string;
  launch_id: string;
  game_id: string;
  bonding_pct: number;
  current_mcap: number;
  current_mcap_usd: number;
  current_price: number;
  current_price_usd: number;
  total_supply_sold: number;
  base_reserve: number;
  quote_reserve: number;
  volume_24h: number;
  volume_24h_usd: number;
  trades_24h: number;
  unique_traders: number;
  holder_count: number;
  fdv: number;
  liquidity: number;
  price_change_5m: number;
  price_change_1h: number;
  price_change_6h: number;
  price_change_24h: number;
  is_graduated: boolean;
  last_synced_at: string;
  created_at: string;
}

export interface TokenTransaction {
  id: string;
  launch_id: string;
  game_id: string;
  tx_signature: string;
  tx_type: "buy" | "sell";
  wallet_address: string;
  amount_in: number;
  amount_out: number;
  price_per_token: number;
  fee_amount: number;
  mcap_at_trade: number | null;
  bonding_pct_at_trade: number | null;
  block_time: string;
  created_at: string;
}

export interface TokenHolder {
  id: string;
  launch_id: string;
  wallet_address: string;
  balance: number;
  percentage: number;
  is_creator: boolean;
  is_contract: boolean;
  last_updated_at: string;
  created_at: string;
}

export interface SwapQuote {
  amountIn: number;
  amountOut: number;
  minimumAmountOut: number;
  priceImpact: number;
  fee: number;
}

export interface TokenExploreItem extends TokenLaunch {
  state: BondingCurveState | null;
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
