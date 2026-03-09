import { API_BASE } from "./constants";
import type {
  GameWithBuild,
  Game,
  AtomSummary,
  InstalledExternal,
  RegistryEntry,
  BuildSummary,
  ChatSession,
  ChatMessage,
  BoilerplateSummary,
  LeaderboardEntry,
  LeaderboardPeriod,
  TokenLaunch,
  BondingCurveState,
  TokenTransaction,
  TokenHolder,
  SwapQuote,
  TokenExploreItem,
  WarRoom,
  WarRoomWithTasks,
} from "./types";

// ── Auth token helper ────────────────────────────────────────────────────────

let getAuthTokenFn: (() => Promise<string | null>) | null = null;
const DEV_AUTH_BYPASS =
  process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS === "true" ||
  process.env.DEV_AUTH_BYPASS === "true";
const DEV_AUTH_BYPASS_TOKEN =
  process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS_TOKEN ??
  process.env.DEV_AUTH_BYPASS_TOKEN ??
  "dev-bypass";
const DEV_AUTH_BYPASS_ORIGIN =
  process.env.DEV_AUTH_BYPASS_ORIGIN ?? "http://127.0.0.1:3000";

/**
 * Called once from the PrivyProvider to register a function that returns
 * the current Privy auth token. This avoids importing Privy in the API module.
 */
export function registerAuthTokenGetter(fn: () => Promise<string | null>) {
  getAuthTokenFn = fn;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function apiFetch<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init?.headers as Record<string, string>),
  };

  // Attach Privy auth token if available
  if (getAuthTokenFn) {
    try {
      const token = await getAuthTokenFn();
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
    } catch {
      // Continue without auth token
    }
  }

  if (!headers.Authorization && DEV_AUTH_BYPASS) {
    headers.Authorization = `Bearer ${DEV_AUTH_BYPASS_TOKEN}`;
    if (typeof window === "undefined" && !headers.Origin) {
      headers.Origin = DEV_AUTH_BYPASS_ORIGIN;
    }
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `API error ${res.status}`);
  }
  return res.json();
}

// ── Games ─────────────────────────────────────────────────────────────────────

export async function listGames(): Promise<GameWithBuild[]> {
  return apiFetch("/games");
}

export async function getGame(name: string): Promise<GameWithBuild> {
  return apiFetch(`/games/${encodeURIComponent(name)}`);
}

export async function createGame(
  name: string,
  description?: string,
  userId?: string,
  genre?: string
): Promise<Game> {
  return apiFetch("/games", {
    method: "POST",
    body: JSON.stringify({ name, description, user_id: userId, genre }),
  });
}

// ── Publishing ───────────────────────────────────────────────────────────────

export async function publishGame(
  gameName: string,
  slug: string
): Promise<Game> {
  return apiFetch(`/games/${encodeURIComponent(gameName)}/publish`, {
    method: "POST",
    body: JSON.stringify({ slug }),
  });
}

export async function unpublishGame(gameName: string): Promise<Game> {
  return apiFetch(`/games/${encodeURIComponent(gameName)}/unpublish`, {
    method: "POST",
  });
}

export async function getPublishedGame(slug: string): Promise<GameWithBuild> {
  return apiFetch(`/public/games/${encodeURIComponent(slug)}`);
}

// ── Boilerplates ─────────────────────────────────────────────────────────────

export async function listBoilerplates(): Promise<BoilerplateSummary[]> {
  return apiFetch("/boilerplates");
}

// ── Scores & Leaderboard ─────────────────────────────────────────────────────

export async function submitScore(
  gameName: string,
  score: number
): Promise<void> {
  await apiFetch(`/games/${encodeURIComponent(gameName)}/scores`, {
    method: "POST",
    body: JSON.stringify({ score }),
  });
}

export async function getLeaderboard(
  gameName: string,
  period: LeaderboardPeriod = "lifetime",
  limit = 10
): Promise<LeaderboardEntry[]> {
  return apiFetch(
    `/games/${encodeURIComponent(gameName)}/leaderboard?period=${period}&limit=${limit}`
  );
}

// ── Atoms ─────────────────────────────────────────────────────────────────────

export async function getStructure(
  gameName: string,
  typeFilter?: string
): Promise<AtomSummary[]> {
  const qs = typeFilter ? `?type=${typeFilter}` : "";
  return apiFetch(`/games/${encodeURIComponent(gameName)}/structure${qs}`);
}

// ── Externals ─────────────────────────────────────────────────────────────────

export async function listExternals(
  gameName: string
): Promise<InstalledExternal[]> {
  return apiFetch(`/games/${encodeURIComponent(gameName)}/externals`);
}

export async function installExternal(
  gameName: string,
  registryName: string
): Promise<InstalledExternal> {
  return apiFetch(`/games/${encodeURIComponent(gameName)}/externals`, {
    method: "POST",
    body: JSON.stringify({ name: registryName }),
  });
}

export async function uninstallExternal(
  gameName: string,
  extName: string
): Promise<void> {
  await apiFetch(
    `/games/${encodeURIComponent(gameName)}/externals/${encodeURIComponent(extName)}`,
    { method: "DELETE" }
  );
}

export async function listRegistry(): Promise<RegistryEntry[]> {
  return apiFetch("/registry/externals");
}

// ── Builds ────────────────────────────────────────────────────────────────────

export async function listBuilds(
  gameName: string,
  limit = 20
): Promise<BuildSummary[]> {
  return apiFetch(
    `/games/${encodeURIComponent(gameName)}/builds?limit=${limit}`
  );
}

export async function triggerBuild(
  gameName: string
): Promise<{ status: string; game_id: string }> {
  return apiFetch(`/games/${encodeURIComponent(gameName)}/builds`, {
    method: "POST",
  });
}

export async function rollbackBuild(
  gameName: string,
  buildId: string
): Promise<{ checkpointBuildId: string; restoredAtomCount: number }> {
  return apiFetch(
    `/games/${encodeURIComponent(gameName)}/builds/${buildId}/rollback`,
    { method: "POST" }
  );
}

// ── Chat Sessions ────────────────────────────────────────────────────────────

export async function listChatSessions(
  gameName: string,
  limit = 20
): Promise<ChatSession[]> {
  return apiFetch(
    `/games/${encodeURIComponent(gameName)}/chat/sessions?limit=${limit}`
  );
}

export async function createChatSession(
  gameName: string,
  model?: string,
  title?: string
): Promise<ChatSession> {
  return apiFetch(`/games/${encodeURIComponent(gameName)}/chat/sessions`, {
    method: "POST",
    body: JSON.stringify({ model, title }),
  });
}

export async function deleteChatSession(
  gameName: string,
  sessionId: string
): Promise<void> {
  await apiFetch(
    `/games/${encodeURIComponent(gameName)}/chat/sessions/${sessionId}`,
    { method: "DELETE" }
  );
}

export async function getChatMessages(
  gameName: string,
  sessionId: string
): Promise<ChatMessage[]> {
  return apiFetch(
    `/games/${encodeURIComponent(gameName)}/chat/sessions/${sessionId}/messages`
  );
}

export async function saveChatMessages(
  gameName: string,
  sessionId: string,
  messages: { message_id: string; role: string; parts: unknown[] }[]
): Promise<void> {
  await apiFetch(
    `/games/${encodeURIComponent(gameName)}/chat/sessions/${sessionId}/messages`,
    {
      method: "POST",
      body: JSON.stringify({ messages }),
    }
  );
}

// ── War Rooms ───────────────────────────────────────────────────────────────

export async function createWarRoom(
  gameName: string,
  prompt: string,
  userId?: string,
  genre?: string
): Promise<WarRoomWithTasks> {
  return apiFetch(`/games/${encodeURIComponent(gameName)}/warrooms`, {
    method: "POST",
    body: JSON.stringify({ prompt, user_id: userId, genre }),
  });
}

export async function getWarRoom(
  gameName: string,
  warRoomId: string
): Promise<WarRoomWithTasks> {
  return apiFetch(
    `/games/${encodeURIComponent(gameName)}/warrooms/${warRoomId}`
  );
}

export async function listWarRooms(
  gameName: string,
  limit = 20
): Promise<WarRoom[]> {
  return apiFetch(
    `/games/${encodeURIComponent(gameName)}/warrooms?limit=${limit}`
  );
}

export async function cancelWarRoom(
  gameName: string,
  warRoomId: string
): Promise<WarRoom> {
  return apiFetch(
    `/games/${encodeURIComponent(gameName)}/warrooms/${warRoomId}/cancel`,
    { method: "POST" }
  );
}

// ── Token Launches ──────────────────────────────────────────────────────────

export async function getTokenLaunch(
  gameName: string
): Promise<TokenLaunch | null> {
  try {
    return await apiFetch(`/games/${encodeURIComponent(gameName)}/token`);
  } catch {
    return null;
  }
}

export async function upsertTokenLaunch(
  gameName: string,
  creatorId: string,
  tokenName: string,
  tokenSymbol: string,
  opts?: {
    chain_id?: string;
    total_supply?: number;
    leaderboard_allocation_pct?: number;
  }
): Promise<TokenLaunch> {
  return apiFetch(`/games/${encodeURIComponent(gameName)}/token`, {
    method: "PUT",
    body: JSON.stringify({
      creator_id: creatorId,
      token_name: tokenName,
      token_symbol: tokenSymbol,
      ...opts,
    }),
  });
}

// ── Bonding Curve ──────────────────────────────────────────────────────────

export async function configureCurve(
  gameName: string,
  params: Record<string, unknown>,
): Promise<TokenLaunch> {
  return apiFetch(`/games/${encodeURIComponent(gameName)}/token/curve/config`, {
    method: "PUT",
    body: JSON.stringify(params),
  });
}

export async function getCurveData(
  gameName: string,
): Promise<{ launch: TokenLaunch; state: BondingCurveState | null }> {
  return apiFetch(`/games/${encodeURIComponent(gameName)}/token/curve`);
}

export async function recordDeploy(
  gameName: string,
  addresses: {
    dbc_config_key: string;
    pool_address: string;
    base_mint: string;
    creator_wallet: string;
  },
): Promise<TokenLaunch> {
  return apiFetch(`/games/${encodeURIComponent(gameName)}/token/curve/deploy`, {
    method: "POST",
    body: JSON.stringify(addresses),
  });
}

export async function activateToken(gameName: string): Promise<TokenLaunch> {
  return apiFetch(
    `/games/${encodeURIComponent(gameName)}/token/curve/activate`,
    { method: "POST" },
  );
}

export async function getCurveState(
  gameName: string,
): Promise<BondingCurveState | null> {
  try {
    return await apiFetch(
      `/games/${encodeURIComponent(gameName)}/token/curve/state`,
    );
  } catch {
    return null;
  }
}

export async function getHolders(
  gameName: string,
  limit = 10,
): Promise<TokenHolder[]> {
  return apiFetch(
    `/games/${encodeURIComponent(gameName)}/token/curve/holders?limit=${limit}`,
  );
}

export async function getTransactions(
  gameName: string,
  limit = 50,
): Promise<TokenTransaction[]> {
  return apiFetch(
    `/games/${encodeURIComponent(gameName)}/token/curve/transactions?limit=${limit}`,
  );
}

export async function recordTrade(
  gameName: string,
  txData: {
    tx_signature: string;
    tx_type: "buy" | "sell";
    wallet_address: string;
    amount_in: number;
    amount_out: number;
    price_per_token: number;
    fee_amount?: number;
    block_time: string;
  },
): Promise<TokenTransaction> {
  return apiFetch(
    `/games/${encodeURIComponent(gameName)}/token/curve/transactions`,
    { method: "POST", body: JSON.stringify(txData) },
  );
}

export async function getSwapQuote(
  gameName: string,
  direction: "buy" | "sell",
  amount: number,
): Promise<SwapQuote> {
  return apiFetch(
    `/games/${encodeURIComponent(gameName)}/token/curve/quote`,
    { method: "POST", body: JSON.stringify({ direction, amount }) },
  );
}

export async function exploreTokens(filters?: {
  status?: string;
  sort?: string;
  limit?: number;
  offset?: number;
}): Promise<{ tokens: TokenExploreItem[]; total: number }> {
  const params = new URLSearchParams();
  if (filters?.status) params.set("status", filters.status);
  if (filters?.sort) params.set("sort", filters.sort);
  if (filters?.limit) params.set("limit", String(filters.limit));
  if (filters?.offset) params.set("offset", String(filters.offset));
  const qs = params.toString();
  return apiFetch(`/tokens/explore${qs ? `?${qs}` : ""}`);
}

export async function recordGraduation(
  gameName: string,
  graduatedPool: string,
): Promise<TokenLaunch> {
  return apiFetch(
    `/games/${encodeURIComponent(gameName)}/token/curve/graduate`,
    { method: "POST", body: JSON.stringify({ graduated_pool: graduatedPool }) },
  );
}
