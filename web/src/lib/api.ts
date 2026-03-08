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
  TokenLaunch,
  WarRoom,
  WarRoomWithTasks,
} from "./types";

// ── Auth token helper ────────────────────────────────────────────────────────

let getAuthTokenFn: (() => Promise<string | null>) | null = null;

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
  score: number,
  userId?: string,
  playerName?: string
): Promise<void> {
  await apiFetch(`/games/${encodeURIComponent(gameName)}/scores`, {
    method: "POST",
    body: JSON.stringify({ score, user_id: userId, player_name: playerName }),
  });
}

export async function getLeaderboard(
  gameName: string,
  limit = 20
): Promise<LeaderboardEntry[]> {
  return apiFetch(
    `/games/${encodeURIComponent(gameName)}/leaderboard?limit=${limit}`
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
