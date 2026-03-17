import { API_BASE } from "./constants";
import { getAuthTokenGetter } from "./auth-token-registry";
import type { GameFormat } from "./game-genres";
import type {
  AppHealthStatus,
  OpenClawAgent,
  OpenClawAgentEnvelope,
  OpenClawActivityResponse,
  OpenClawApiKeySecret,
  OpenClawApiKeySummary,
  OpenClawHealthScore,
  OpenClawOnboardingSession,
  OpenClawSkillManifest,
  OpenClawWebhookConfig,
  OpenClawWebhookDelivery,
  OpenClawWebhookTestResult,
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
  UserProfile,
  WarRoom,
  WarRoomGeneratedAsset,
  WarRoomGeneratedAssetResponse,
  WarRoomWithFeed,
  WarRoomWithTasks,
} from "./types";
import type {
  WarRoomPreflightResult,
} from "./war-room-preflight";

export { registerAuthTokenGetter } from "./auth-token-registry";

const DEV_AUTH_BYPASS =
  process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS === "true" ||
  process.env.DEV_AUTH_BYPASS === "true";
const DEV_AUTH_BYPASS_TOKEN =
  process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS_TOKEN ??
  process.env.DEV_AUTH_BYPASS_TOKEN ??
  "dev-bypass";
const DEV_AUTH_BYPASS_ORIGIN =
  process.env.DEV_AUTH_BYPASS_ORIGIN ?? "http://127.0.0.1:3000";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export function isApiErrorStatus(error: unknown, status: number): error is ApiError {
  return error instanceof ApiError && error.status === status;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function resolveAuthHeaders(
  headers: Record<string, string>,
): Promise<void> {
  const getAuthTokenFn = getAuthTokenGetter();

  // Attach auth token — bail early if unavailable to avoid 401 noise
  if (getAuthTokenFn) {
    try {
      const token = await getAuthTokenFn();
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
    } catch {
      // token retrieval failed
    }
  }

  // Server-side: use Clerk session token when no client getter is available
  if (!headers.Authorization && typeof window === "undefined") {
    try {
      const { auth } = await import("@clerk/nextjs/server");
      const session = await auth();
      const token = await session.getToken();
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
    } catch {
      // Not in a request context or Clerk not available
    }
  }

  if (!headers.Authorization && DEV_AUTH_BYPASS) {
    headers.Authorization = `Bearer ${DEV_AUTH_BYPASS_TOKEN}`;
    if (typeof window === "undefined" && !headers.Origin) {
      headers.Origin = DEV_AUTH_BYPASS_ORIGIN;
    }
  }
}

async function apiFetch<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init?.headers as Record<string, string>),
  };

  await resolveAuthHeaders(headers);

  if (!headers.Authorization) {
    throw new ApiError("Not authenticated", 401);
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
  });

  // On 401, force a fresh token and retry once — Clerk JWTs are short-lived
  // and can expire between fetch and server verification.
  if (res.status === 401) {
    delete headers.Authorization;
    await resolveAuthHeaders(headers);
    if (headers.Authorization) {
      const retry = await fetch(`${API_BASE}${path}`, {
        ...init,
        headers,
      });
      if (!retry.ok) {
        const body = await retry.json().catch(() => ({}));
        throw new ApiError(body.error ?? `API error ${retry.status}`, retry.status);
      }
      return retry.json();
    }
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(body.error ?? `API error ${res.status}`, res.status);
  }
  return res.json();
}

async function publicApiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init?.headers as Record<string, string>),
  };
  const getAuthTokenFn = getAuthTokenGetter();

  if (getAuthTokenFn) {
    try {
      const token = await getAuthTokenFn();
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
    } catch {
      // token retrieval failed
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
    throw new ApiError(body.error ?? `API error ${res.status}`, res.status);
  }
  return res.json();
}

async function resolveAppAuthHeaders(
  headers: Record<string, string>,
): Promise<void> {
  const getAuthTokenFn = getAuthTokenGetter();

  if (getAuthTokenFn) {
    try {
      const token = await getAuthTokenFn();
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
    } catch {
      // token retrieval failed
    }
  }

  if (!headers.Authorization && DEV_AUTH_BYPASS) {
    headers.Authorization = `Bearer ${DEV_AUTH_BYPASS_TOKEN}`;
  }
}

async function appFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init?.headers as Record<string, string>),
  };

  await resolveAppAuthHeaders(headers);

  if (!headers.Authorization) {
    throw new ApiError("Not authenticated", 401);
  }

  const res = await fetch(path, {
    ...init,
    headers,
  });

  // On 401, force a fresh token and retry once
  if (res.status === 401) {
    delete headers.Authorization;
    await resolveAppAuthHeaders(headers);
    if (headers.Authorization) {
      const retry = await fetch(path, {
        ...init,
        headers,
      });
      if (!retry.ok) {
        const body = await retry.json().catch(() => ({}));
        throw new ApiError(body.error ?? `App route error ${retry.status}`, retry.status);
      }
      return retry.json();
    }
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(body.error ?? `App route error ${res.status}`, res.status);
  }

  return res.json();
}

// ── Games ─────────────────────────────────────────────────────────────────────

export async function listGames(): Promise<GameWithBuild[]> {
  return apiFetch("/games");
}

export async function listMyGames(): Promise<GameWithBuild[]> {
  return apiFetch("/games/mine");
}

export async function getGame(name: string): Promise<GameWithBuild> {
  return apiFetch(`/games/${encodeURIComponent(name)}`);
}

export async function createGame(
  name: string,
  description?: string,
  genre?: string,
  gameFormat?: GameFormat
): Promise<Game> {
  return apiFetch("/games", {
    method: "POST",
    body: JSON.stringify({ name, description, genre, game_format: gameFormat }),
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

// ── User Profile ─────────────────────────────────────────────────────────────

async function getLegacyProfile(userId: string): Promise<UserProfile> {
  try {
    return await apiFetch(`/users/profile/${encodeURIComponent(userId)}`);
  } catch (error) {
    if (isApiErrorStatus(error, 404)) {
      return apiFetch("/users/profile", {
        method: "POST",
        body: JSON.stringify({ id: userId }),
      });
    }
    throw error;
  }
}

export async function getMyProfile(userId?: string): Promise<UserProfile> {
  try {
    return await apiFetch("/users/me");
  } catch (error) {
    if (userId && isApiErrorStatus(error, 404)) {
      return getLegacyProfile(userId);
    }
    throw error;
  }
}

export async function updateMyProfile(
  userId: string,
  body: {
    display_name?: string;
    avatar_url?: string | null;
  },
): Promise<UserProfile> {
  try {
    return await apiFetch("/users/me", {
      method: "PUT",
      body: JSON.stringify(body),
    });
  } catch (error) {
    if (isApiErrorStatus(error, 404)) {
      return apiFetch("/users/profile", {
        method: "POST",
        body: JSON.stringify({
          id: userId,
          ...body,
        }),
      });
    }
    throw error;
  }
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

export async function registerCustomExternal(input: {
  display_name: string;
  cdn_url: string;
  global_name: string;
  version?: string;
}): Promise<RegistryEntry> {
  return apiFetch("/registry/externals/custom", {
    method: "POST",
    body: JSON.stringify(input),
  });
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
  return publicApiFetch(
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
  return publicApiFetch(
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
  genre?: string,
  gameFormat?: GameFormat | null,
  visualReferences?: Array<{
    id: string;
    prompt: string;
    style: string | null;
    image_url: string;
    created_at?: string | null;
    is_public?: boolean;
  }>,
  authToken?: string,
): Promise<WarRoomWithTasks> {
  return apiFetch(`/games/${encodeURIComponent(gameName)}/warrooms`, {
    method: "POST",
    body: JSON.stringify({
      prompt,
      user_id: userId,
      genre,
      game_format: gameFormat,
      visual_references: visualReferences,
    }),
    ...(authToken
      ? { headers: { Authorization: `Bearer ${authToken}` } }
      : {}),
  });
}

export async function getWarRoom(
  gameName: string,
  warRoomId: string
): Promise<WarRoomWithFeed> {
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

export async function retryWarRoomTask(
  gameName: string,
  warRoomId: string,
  taskNumber: number,
): Promise<void> {
  await apiFetch(
    `/games/${encodeURIComponent(gameName)}/warrooms/${warRoomId}/tasks/${taskNumber}/retry`,
    { method: "POST" },
  );
}

export async function getWarRoomAssets(
  gameName: string,
  warRoomId: string,
): Promise<WarRoomGeneratedAsset[]> {
  const result = await apiFetch<WarRoomGeneratedAssetResponse>(
    `/games/${encodeURIComponent(gameName)}/warrooms/${warRoomId}/assets`,
  );
  return result.items;
}

export async function patchWarRoomAssetLayout(
  gameName: string,
  warRoomId: string,
  assetId: string,
  body: {
    animation: string;
    cols: number;
    rows: number;
    vertical_dividers: number[];
    horizontal_dividers: number[];
    frames: Array<{
      index: number;
      x: number;
      y: number;
      width: number;
      height: number;
      bounds?: { x: number; y: number; width: number; height: number } | null;
    }>;
  },
): Promise<WarRoomGeneratedAsset> {
  return apiFetch(
    `/games/${encodeURIComponent(gameName)}/warrooms/${warRoomId}/assets/${assetId}/layout`,
    {
      method: "PATCH",
      body: JSON.stringify(body),
    },
  );
}

export async function preflightWarRoom(
  body: {
    gameName: string;
    gameFormat: GameFormat | null;
    genre: string | null;
    idea: string;
    assets: Array<{
      _id: string;
      prompt: string;
      style: string | null;
      image: { url: string };
      createdAt: string;
      isPublic: boolean;
    }>;
  },
): Promise<WarRoomPreflightResult> {
  return appFetch("/api/warroom/preflight", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// ── App Health ───────────────────────────────────────────────────────────────

export async function getAppHealth(): Promise<AppHealthStatus> {
  return appFetch("/api/health");
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

// ── OpenClaw ────────────────────────────────────────────────────────────────

export async function getOpenClawAgent(): Promise<OpenClawAgentEnvelope> {
  const envelope = await apiFetch<OpenClawAgentEnvelope>("/openclaw/agent");
  return {
    ...envelope,
    docs_url: "/openclaw/docs",
  };
}

export async function createOpenClawOnboarding(): Promise<OpenClawOnboardingSession> {
  return apiFetch("/openclaw/onboarding", {
    method: "POST",
  });
}

export async function getOpenClawOnboardingSession(
  sessionId: string,
): Promise<OpenClawOnboardingSession> {
  return apiFetch(`/openclaw/onboarding/${encodeURIComponent(sessionId)}`);
}

export async function cancelOpenClawOnboardingSession(
  sessionId: string,
): Promise<OpenClawOnboardingSession> {
  return apiFetch(`/openclaw/onboarding/${encodeURIComponent(sessionId)}/cancel`, {
    method: "POST",
  });
}

export async function replaceOpenClawAgent(): Promise<OpenClawOnboardingSession> {
  return apiFetch("/openclaw/agent/replace", {
    method: "POST",
  });
}

export async function testOpenClawConnection(): Promise<OpenClawAgent> {
  return apiFetch("/openclaw/agent/connection-test", {
    method: "POST",
  });
}

export async function getOpenClawHealthScore(): Promise<OpenClawHealthScore> {
  return apiFetch("/openclaw/agent/health-score");
}

export async function getOpenClawActivity(
  limit = 50,
  offset = 0,
): Promise<OpenClawActivityResponse> {
  return apiFetch(
    `/openclaw/agent/activity?limit=${limit}&offset=${offset}`,
  );
}

export async function getOpenClawWebhookLog(
  limit = 20,
): Promise<OpenClawWebhookDelivery[]> {
  return apiFetch(`/openclaw/agent/webhook-log?limit=${limit}`);
}

export async function getOpenClawWebhookConfig(): Promise<OpenClawWebhookConfig> {
  return apiFetch("/openclaw/agent/webhook-config");
}

export async function updateOpenClawWebhookConfig(
  input: OpenClawWebhookConfig,
): Promise<OpenClawWebhookConfig> {
  return apiFetch("/openclaw/agent/webhook-config", {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export async function testOpenClawWebhook(): Promise<OpenClawWebhookTestResult> {
  return apiFetch("/openclaw/agent/webhook-test", {
    method: "POST",
  });
}

export async function getOpenClawApiKeys(): Promise<OpenClawApiKeySummary[]> {
  const response = await apiFetch<{ keys: OpenClawApiKeySummary[] }>("/openclaw/api-keys");
  return response.keys;
}

export async function createOpenClawApiKey(
  scopes?: string[],
): Promise<OpenClawApiKeySecret> {
  return apiFetch("/openclaw/api-keys", {
    method: "POST",
    body: JSON.stringify(scopes?.length ? { scopes } : {}),
  });
}

export async function rotateOpenClawApiKey(
  keyId: string,
): Promise<OpenClawApiKeySecret> {
  return apiFetch(`/openclaw/api-keys/${encodeURIComponent(keyId)}/rotate`, {
    method: "POST",
  });
}

export async function revokeOpenClawApiKey(
  keyId: string,
): Promise<OpenClawApiKeySummary> {
  return apiFetch(`/openclaw/api-keys/${encodeURIComponent(keyId)}`, {
    method: "DELETE",
  });
}

export async function getOpenClawDocsMetadata(): Promise<OpenClawSkillManifest> {
  return apiFetch("/openclaw/docs-metadata");
}

export async function getOpenClawSkillManifest(): Promise<OpenClawSkillManifest> {
  return apiFetch("/openclaw/skill.json");
}
