import { getSupabaseClient } from "../supabase-client.ts";
import { log } from "../logger.ts";
import {
  OPENCLAW_CAPABILITY_GROUPS,
  OPENCLAW_DEFAULT_SCOPES,
  OPENCLAW_ONBOARDING_TTL_MS,
  buildOpenClawSkillJson,
  deriveApiKeyPrefix,
  deriveConnectionStatus,
  generateApiKeyValue,
  generateClaimToken,
  generateWebhookSecret,
  matchesWebhookEvent,
  normalizeOptionalExternalUrl,
  normalizeWebhookEvents,
  parseStringArray,
  randomBase64Url,
  sha256Hex,
  type OpenClawConnectionStatus,
  type OpenClawOnboardingStatus,
} from "../openclaw.ts";

export interface OpenClawAgent {
  id: string;
  user_id: string;
  name: string;
  avatar_emoji: string;
  description: string | null;
  agent_url: string;
  delivery_channel: "custom" | "telegram";
  endpoint_url: string | null;
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

export interface OpenClawWebhookDelivery {
  event: string;
  url: string;
  status_code: number | null;
  latency_ms: number;
  attempt: number;
  error: string | null;
  created_at: string;
}

export interface OpenClawActivityEntry {
  tool_name: string;
  method: string;
  status_code: number;
  latency_ms: number;
  created_at: string;
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

export interface OpenClawApiKeyContext {
  key_id: string;
  agent_id: string;
  user_id: string;
  key_prefix: string;
  scopes: string[];
  agent: OpenClawAgent;
}

type OpenClawAgentRow = {
  id: string;
  user_id: string;
  name: string;
  avatar_emoji: string;
  description: string | null;
  agent_url: string;
  delivery_channel: "custom" | "telegram" | null;
  endpoint_url: string | null;
  telegram_bot_token: string | null;
  telegram_chat_id: string | null;
  webhook_secret: string;
  webhook_events: unknown;
  connection_status: string | null;
  last_heartbeat: string | null;
  last_error: string | null;
  capabilities: unknown;
  api_key_prefix: string | null;
  claimed_at: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type OpenClawSessionRow = {
  id: string;
  user_id: string;
  token_hash: string;
  status: OpenClawOnboardingStatus;
  mode: "import" | "replace";
  expires_at: string;
  claimed_at: string | null;
  agent_id: string | null;
  replaces_agent_id: string | null;
  identity_name: string | null;
  identity_description: string | null;
  identity_avatar: string | null;
  agent_url: string | null;
  endpoint_url: string | null;
  webhook_events: unknown;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

type OpenClawApiKeyRow = {
  id: string;
  agent_id: string;
  user_id: string;
  key_hash: string;
  key_prefix: string;
  scopes: unknown;
  rate_limit_tier: string;
  created_at: string;
  revoked_at: string | null;
  last_used_at: string | null;
};

function mapAgent(row: OpenClawAgentRow): OpenClawAgent {
  return {
    id: row.id,
    user_id: row.user_id,
    name: row.name,
    avatar_emoji: row.avatar_emoji,
    description: row.description,
    agent_url: row.agent_url,
    delivery_channel: row.delivery_channel === "telegram" ? "telegram" : "custom",
    endpoint_url: row.endpoint_url,
    telegram_chat_id: row.telegram_chat_id,
    webhook_events: parseStringArray(row.webhook_events),
    connection_status: deriveConnectionStatus(
      row.connection_status,
      row.last_heartbeat,
    ),
    last_heartbeat: row.last_heartbeat,
    last_error: row.last_error,
    capabilities: parseStringArray(row.capabilities),
    api_key_prefix: row.api_key_prefix,
    claimed_at: row.claimed_at,
    is_active: row.is_active,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapSession(row: OpenClawSessionRow): OpenClawOnboardingSession {
  return {
    session_id: row.id,
    status: row.status,
    mode: row.mode,
    expires_at: row.expires_at,
    claimed_at: row.claimed_at,
    agent_id: row.agent_id,
    replaces_agent_id: row.replaces_agent_id,
    identity:
      row.identity_name != null
        ? {
            name: row.identity_name,
            description: row.identity_description,
            avatar: row.identity_avatar ?? "🦞",
          }
        : null,
    agent_url: row.agent_url,
    endpoint_url: row.endpoint_url,
    webhook_events: parseStringArray(row.webhook_events),
    last_error: row.last_error,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapApiKey(row: OpenClawApiKeyRow): OpenClawApiKeySummary {
  return {
    id: row.id,
    key_prefix: row.key_prefix,
    scopes: parseStringArray(row.scopes),
    rate_limit_tier: row.rate_limit_tier,
    created_at: row.created_at,
    revoked_at: row.revoked_at,
    last_used_at: row.last_used_at,
    active: row.revoked_at == null,
  };
}

function normalizeTelegramBotToken(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeTelegramChatId(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function assertDeliveryChannelConfig(input: {
  delivery_channel: "custom" | "telegram";
  endpoint_url: string | null;
  telegram_bot_token: string | null;
  telegram_chat_id: string | null;
}): void {
  if (
    input.delivery_channel === "telegram" &&
    (!input.telegram_bot_token || !input.telegram_chat_id)
  ) {
    throw new Error("Telegram delivery requires both a bot token and chat ID");
  }
}

function formatOpenClawTelegramMessage(
  agent: OpenClawAgent,
  event: string,
  payload: Record<string, unknown>,
): string {
  const lines = [
    `Atomic Coding update`,
    `Agent: ${agent.name}`,
    `Event: ${event}`,
    `Time: ${new Date().toISOString()}`,
  ];

  const payloadJson = JSON.stringify(payload, null, 2);
  if (payloadJson && payloadJson !== "{}") {
    lines.push("", "Payload:", payloadJson);
  }

  const message = lines.join("\n");
  return message.length > 3500 ? `${message.slice(0, 3497)}...` : message;
}

async function getSessionByTokenHash(tokenHash: string): Promise<OpenClawSessionRow | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("openclaw_onboarding_sessions")
    .select("*")
    .eq("token_hash", tokenHash)
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`Failed to load onboarding session: ${error.message}`);
  return (data as OpenClawSessionRow | null) ?? null;
}

async function updateSession(
  sessionId: string,
  updates: Record<string, unknown>,
): Promise<OpenClawSessionRow> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("openclaw_onboarding_sessions")
    .update(updates)
    .eq("id", sessionId)
    .select("*")
    .single();

  if (error) throw new Error(`Failed to update onboarding session: ${error.message}`);
  return data as OpenClawSessionRow;
}

async function getAgentRowById(agentId: string): Promise<OpenClawAgentRow | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("openclaw_agents")
    .select("*")
    .eq("id", agentId)
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`Failed to load OpenClaw agent: ${error.message}`);
  return (data as OpenClawAgentRow | null) ?? null;
}

export async function getCurrentAgent(userId: string): Promise<OpenClawAgent | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("openclaw_agents")
    .select("*")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("claimed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`Failed to load current OpenClaw agent: ${error.message}`);
  return data ? mapAgent(data as OpenClawAgentRow) : null;
}

export async function createOnboardingSession(
  userId: string,
  mode: "import" | "replace",
  replacesAgentId: string | null,
): Promise<{ token: string; session: OpenClawOnboardingSession }> {
  const activeAgent = await getCurrentAgent(userId);
  if (mode === "import" && activeAgent) {
    throw new Error("An OpenClaw agent is already imported. Use the replace flow instead.");
  }
  if (mode === "replace" && !activeAgent) {
    throw new Error("No active OpenClaw agent found to replace.");
  }

  const token = generateClaimToken();
  const tokenHash = await sha256Hex(token);
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("openclaw_onboarding_sessions")
    .insert({
      user_id: userId,
      token_hash: tokenHash,
      status: "pending_claim",
      mode,
      expires_at: new Date(Date.now() + OPENCLAW_ONBOARDING_TTL_MS).toISOString(),
      replaces_agent_id: replacesAgentId ?? activeAgent?.id ?? null,
      webhook_events: ["*"],
    })
    .select("*")
    .single();

  if (error) throw new Error(`Failed to create onboarding session: ${error.message}`);

  log("info", "openclaw:onboarding_created", {
    userId,
    mode,
    replacesAgentId: replacesAgentId ?? activeAgent?.id ?? null,
    sessionId: data.id,
  });

  return { token, session: mapSession(data as OpenClawSessionRow) };
}

function getNormalizedSessionStatus(row: OpenClawSessionRow): OpenClawOnboardingStatus {
  if (row.status === "pending_claim" && new Date(row.expires_at).getTime() <= Date.now()) {
    return "expired";
  }
  return row.status;
}

export async function getOnboardingSessionForUser(
  sessionId: string,
  userId: string,
): Promise<OpenClawOnboardingSession | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("openclaw_onboarding_sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`Failed to fetch onboarding session: ${error.message}`);
  if (!data) return null;

  const row = data as OpenClawSessionRow;
  const normalizedStatus = getNormalizedSessionStatus(row);
  if (normalizedStatus !== row.status) {
    return mapSession(await updateSession(sessionId, { status: normalizedStatus }));
  }

  return mapSession(row);
}

export async function cancelOnboardingSessionForUser(
  sessionId: string,
  userId: string,
): Promise<OpenClawOnboardingSession | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("openclaw_onboarding_sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`Failed to fetch onboarding session: ${error.message}`);
  if (!data) return null;

  const row = data as OpenClawSessionRow;
  const normalizedStatus = getNormalizedSessionStatus(row);

  if (normalizedStatus === "claimed") {
    throw new Error("Claimed OpenClaw sessions cannot be cancelled");
  }

  if (normalizedStatus === "cancelled") {
    return mapSession(row);
  }

  const cancelledSession = await updateSession(sessionId, {
    status: "cancelled",
    last_error: null,
  });

  log("info", "openclaw:onboarding_cancelled", {
    userId,
    sessionId,
    mode: row.mode,
  });

  return mapSession(cancelledSession);
}

export async function createApiKey(
  agentId: string,
  userId: string,
  scopes = [...OPENCLAW_DEFAULT_SCOPES],
): Promise<{ api_key: string; summary: OpenClawApiKeySummary }> {
  const fullKey = generateApiKeyValue();
  const keyHash = await sha256Hex(fullKey);
  const keyPrefix = deriveApiKeyPrefix(fullKey);
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("openclaw_api_keys")
    .insert({
      agent_id: agentId,
      user_id: userId,
      key_hash: keyHash,
      key_prefix: keyPrefix,
      scopes,
    })
    .select("*")
    .single();

  if (error) throw new Error(`Failed to create OpenClaw API key: ${error.message}`);

  await supabase
    .from("openclaw_agents")
    .update({ api_key_prefix: keyPrefix })
    .eq("id", agentId);

  return {
    api_key: fullKey,
    summary: mapApiKey(data as OpenClawApiKeyRow),
  };
}

async function revokeKeysForAgent(agentId: string): Promise<void> {
  const supabase = getSupabaseClient();
  await supabase
    .from("openclaw_api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("agent_id", agentId)
    .is("revoked_at", null);
}

export async function claimOnboardingSession(
  claimToken: string,
  body: {
    name: string;
    description?: string | null;
    agent_url: string;
    endpoint_url?: string | null;
    webhook_events?: string[];
  },
): Promise<{
  session: OpenClawOnboardingSession;
  agent: OpenClawAgent;
  credentials: {
    agent_id: string;
    api_key: string;
    api_key_prefix: string;
    api_base_url: string;
    skill_manifest_url: string;
    skill_json_url: string;
    heartbeat_url: string;
    webhook_secret: string;
    capabilities: typeof OPENCLAW_CAPABILITY_GROUPS;
  };
}> {
  const tokenHash = await sha256Hex(claimToken);
  const session = await getSessionByTokenHash(tokenHash);
  if (!session) {
    throw new Error("Invalid or expired claim token");
  }

  const normalizedStatus = getNormalizedSessionStatus(session);
  if (normalizedStatus === "expired") {
    await updateSession(session.id, { status: "expired" });
    throw new Error("Claim token expired");
  }

  if (normalizedStatus !== "pending_claim") {
    throw new Error("Claim token has already been used");
  }

  const agentUrl = normalizeOptionalExternalUrl(body.agent_url, "agent_url");
  if (!agentUrl.ok || !agentUrl.normalizedUrl) {
    throw new Error(agentUrl.error);
  }

  const endpointUrl = normalizeOptionalExternalUrl(body.endpoint_url, "endpoint_url");
  if (!endpointUrl.ok) {
    throw new Error(endpointUrl.error);
  }

  const webhookEvents = normalizeWebhookEvents(body.webhook_events);
  if (!webhookEvents.ok) {
    throw new Error(webhookEvents.error);
  }

  const supabase = getSupabaseClient();
  const webhookSecret = generateWebhookSecret();

  const { data: insertedAgent, error: insertError } = await supabase
    .from("openclaw_agents")
    .insert({
      user_id: session.user_id,
      name: body.name.trim(),
      avatar_emoji: "🦞",
      description: body.description?.trim() || null,
      agent_url: agentUrl.normalizedUrl,
      endpoint_url: endpointUrl.normalizedUrl,
      webhook_secret: webhookSecret,
      webhook_events: webhookEvents.events,
      connection_status: "pending",
      capabilities: OPENCLAW_DEFAULT_SCOPES,
      is_active: true,
      claimed_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (insertError) {
    throw new Error(`Failed to create imported OpenClaw agent: ${insertError.message}`);
  }

  const agentRow = insertedAgent as OpenClawAgentRow;
  const keyResult = await createApiKey(agentRow.id, session.user_id);

  if (session.replaces_agent_id) {
    await supabase
      .from("openclaw_agents")
      .update({
        is_active: false,
        connection_status: "replaced",
        replaced_by_agent_id: agentRow.id,
      })
      .eq("id", session.replaces_agent_id);
    await revokeKeysForAgent(session.replaces_agent_id);
  } else {
    const { data: previousAgents } = await supabase
      .from("openclaw_agents")
      .select("id")
      .eq("user_id", session.user_id)
      .eq("is_active", true)
      .neq("id", agentRow.id);

    for (const previous of previousAgents ?? []) {
      await supabase
        .from("openclaw_agents")
        .update({
          is_active: false,
          connection_status: "replaced",
          replaced_by_agent_id: agentRow.id,
        })
        .eq("id", previous.id);
      await revokeKeysForAgent(previous.id);
    }
  }

  const updatedSession = await updateSession(session.id, {
    status: "claimed",
    claimed_at: new Date().toISOString(),
    agent_id: agentRow.id,
    identity_name: body.name.trim(),
    identity_description: body.description?.trim() || null,
    identity_avatar: "🦞",
    agent_url: agentUrl.normalizedUrl,
    endpoint_url: endpointUrl.normalizedUrl,
    webhook_events: webhookEvents.events,
    last_error: null,
  });

  const agent = mapAgent({
    ...agentRow,
    api_key_prefix: keyResult.summary.key_prefix,
  });

  log("info", "openclaw:claim_succeeded", {
    sessionId: session.id,
    agentId: agent.id,
    userId: session.user_id,
    mode: session.mode,
  });

  return {
    session: mapSession(updatedSession),
    agent,
    credentials: {
      agent_id: agent.id,
      api_key: keyResult.api_key,
      api_key_prefix: keyResult.summary.key_prefix,
      api_base_url: "",
      skill_manifest_url: "",
      skill_json_url: "",
      heartbeat_url: "",
      webhook_secret: webhookSecret,
      capabilities: OPENCLAW_CAPABILITY_GROUPS,
    },
  };
}

export async function listApiKeysForCurrentAgent(userId: string): Promise<OpenClawApiKeySummary[]> {
  const agent = await getCurrentAgent(userId);
  if (!agent) return [];

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("openclaw_api_keys")
    .select("*")
    .eq("agent_id", agent.id)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to list OpenClaw API keys: ${error.message}`);
  return (data ?? []).map((row) => mapApiKey(row as OpenClawApiKeyRow));
}

export async function revokeApiKey(
  userId: string,
  keyId: string,
): Promise<OpenClawApiKeySummary> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("openclaw_api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", keyId)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error) throw new Error(`Failed to revoke OpenClaw API key: ${error.message}`);
  return mapApiKey(data as OpenClawApiKeyRow);
}

export async function rotateApiKey(
  userId: string,
  keyId: string,
): Promise<{ api_key: string; summary: OpenClawApiKeySummary }> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("openclaw_api_keys")
    .select("*")
    .eq("id", keyId)
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`Failed to load OpenClaw API key: ${error.message}`);
  if (!data) throw new Error("API key not found");

  const key = data as OpenClawApiKeyRow;
  if (key.revoked_at) throw new Error("API key is already revoked");

  await revokeApiKey(userId, keyId);
  return createApiKey(key.agent_id, userId, parseStringArray(key.scopes));
}

export async function authenticateApiKey(
  fullKey: string,
): Promise<OpenClawApiKeyContext | null> {
  const keyHash = await sha256Hex(fullKey);
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("openclaw_api_keys")
    .select("*")
    .eq("key_hash", keyHash)
    .is("revoked_at", null)
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`Failed to authenticate OpenClaw API key: ${error.message}`);
  if (!data) return null;

  const row = data as OpenClawApiKeyRow;
  const agentRow = await getAgentRowById(row.agent_id);
  if (!agentRow || !agentRow.is_active) return null;

  await supabase
    .from("openclaw_api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", row.id);

  return {
    key_id: row.id,
    agent_id: row.agent_id,
    user_id: row.user_id,
    key_prefix: row.key_prefix,
    scopes: parseStringArray(row.scopes),
    agent: mapAgent(agentRow),
  };
}

export async function logOpenClawRequest(input: {
  agentId: string;
  userId: string;
  toolName: string;
  method: string;
  statusCode: number;
  latencyMs: number;
  error?: string | null;
}) {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from("openclaw_request_log").insert({
    agent_id: input.agentId,
    user_id: input.userId,
    tool_name: input.toolName,
    method: input.method,
    status_code: input.statusCode,
    latency_ms: input.latencyMs,
    error: input.error ?? null,
  });

  if (error) {
    log("warn", "openclaw:request_log_failed", {
      agentId: input.agentId,
      toolName: input.toolName,
      error: error.message,
    });
  }
}

export async function listOpenClawActivity(
  userId: string,
  limit = 50,
  offset = 0,
): Promise<{ entries: OpenClawActivityEntry[]; hasMore: boolean }> {
  const agent = await getCurrentAgent(userId);
  if (!agent) return { entries: [], hasMore: false };

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("openclaw_request_log")
    .select("tool_name, method, status_code, latency_ms, created_at")
    .eq("agent_id", agent.id)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit);

  if (error) throw new Error(`Failed to list OpenClaw activity: ${error.message}`);

  return {
    entries: ((data ?? []) as OpenClawActivityEntry[]).slice(0, limit),
    hasMore: (data ?? []).length > limit,
  };
}

export async function listWebhookDeliveries(
  userId: string,
  limit = 20,
): Promise<OpenClawWebhookDelivery[]> {
  const agent = await getCurrentAgent(userId);
  if (!agent) return [];

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("openclaw_webhook_delivery_log")
    .select("event, url, status_code, latency_ms, attempt, error, created_at")
    .eq("agent_id", agent.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Failed to list webhook deliveries: ${error.message}`);
  return (data ?? []) as OpenClawWebhookDelivery[];
}

function finalizeHealthScore(input: {
  totalRequests24h: number;
  errorCount24h: number;
  avgLatencyMs: number | null;
  heartbeatIntervals24h: number;
  connectionStatus: OpenClawConnectionStatus;
}): OpenClawHealthScore {
  const connectionScore =
    input.connectionStatus === "connected"
      ? 100
      : input.connectionStatus === "pending"
        ? 40
        : input.connectionStatus === "disconnected"
          ? 20
          : 0;

  if (input.totalRequests24h < 3 || input.heartbeatIntervals24h < 1) {
    return {
      status: "insufficient_data",
      score: null,
      grade: null,
      components: {
        uptime:
          input.heartbeatIntervals24h > 0
            ? Math.min(100, Math.round((input.heartbeatIntervals24h / 288) * 100))
            : null,
        error_rate:
          input.totalRequests24h > 0
            ? Math.max(
                0,
                Math.min(
                  100,
                  Math.round(
                    (1 - input.errorCount24h / Math.max(input.totalRequests24h, 1) / 0.15) *
                      100,
                  ),
                ),
              )
            : null,
        latency:
          input.avgLatencyMs == null
            ? null
            : Math.max(0, Math.min(100, Math.round(((2000 - input.avgLatencyMs) / 1900) * 100))),
        connection: connectionScore,
      },
      total_requests_24h: input.totalRequests24h,
      error_count_24h: input.errorCount24h,
      avg_latency_ms: input.avgLatencyMs == null ? null : Math.round(input.avgLatencyMs),
      heartbeat_samples_24h: input.heartbeatIntervals24h,
      connection_status: input.connectionStatus,
      message: "Not enough runtime telemetry yet. Keep OpenClaw connected and calling Atomic before relying on this score.",
    };
  }

  const uptimeScore = Math.min(100, (input.heartbeatIntervals24h / 288) * 100);
  const errorRate = input.errorCount24h / Math.max(input.totalRequests24h, 1);
  const errorScore = Math.max(0, Math.min(100, (1 - errorRate / 0.15) * 100));
  const latencyScore =
    input.avgLatencyMs == null
      ? 0
      : Math.max(0, Math.min(100, ((2000 - input.avgLatencyMs) / 1900) * 100));
  const score = Math.round(
    uptimeScore * 0.4 +
      errorScore * 0.3 +
      latencyScore * 0.2 +
      connectionScore * 0.1,
  );
  const grade =
    score >= 90 ? "A" :
    score >= 75 ? "B" :
    score >= 60 ? "C" :
    score >= 40 ? "D" :
    "F";

  return {
    status: score >= 85 ? "healthy" : score >= 60 ? "degraded" : "critical",
    score,
    grade,
    components: {
      uptime: Math.round(uptimeScore),
      error_rate: Math.round(errorScore),
      latency: Math.round(latencyScore),
      connection: connectionScore,
    },
    total_requests_24h: input.totalRequests24h,
    error_count_24h: input.errorCount24h,
    avg_latency_ms: input.avgLatencyMs == null ? null : Math.round(input.avgLatencyMs),
    heartbeat_samples_24h: input.heartbeatIntervals24h,
    connection_status: input.connectionStatus,
    message:
      score >= 85
        ? "Telemetry looks healthy across connection quality, request success, and latency."
        : score >= 60
          ? "Runtime is available but degraded. Review heartbeat freshness, failures, or latency."
          : "Runtime health is critical. Investigate the connection and recent OpenClaw request failures.",
  };
}

export async function computeOpenClawHealthScore(
  userId: string,
): Promise<OpenClawHealthScore | null> {
  const agent = await getCurrentAgent(userId);
  if (!agent) return null;

  const supabase = getSupabaseClient();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: stats, error: statsError } = await supabase
    .from("openclaw_request_log")
    .select("status_code, latency_ms, tool_name, created_at")
    .eq("agent_id", agent.id)
    .gte("created_at", since);

  if (statsError) throw new Error(`Failed to compute OpenClaw health score: ${statsError.message}`);

  const rows = stats ?? [];
  const totalRequests24h = rows.length;
  const errorCount24h = rows.filter((row) => row.status_code >= 400).length;
  const latencyValues = rows
    .map((row) => row.latency_ms)
    .filter((value): value is number => typeof value === "number");
  const avgLatencyMs =
    latencyValues.length > 0
      ? latencyValues.reduce((sum, value) => sum + value, 0) / latencyValues.length
      : null;

  const heartbeatIntervals = new Set(
    rows
      .filter((row) => row.tool_name === "heartbeat" || row.tool_name.endsWith(".heartbeat"))
      .map((row) => {
        const ms = new Date(row.created_at).getTime();
        return Math.floor(ms / 300000);
      }),
  ).size;

  return finalizeHealthScore({
    totalRequests24h,
    errorCount24h,
    avgLatencyMs,
    heartbeatIntervals24h: heartbeatIntervals,
    connectionStatus: agent.connection_status,
  });
}

export async function updateAgentConnectionStatus(
  agentId: string,
  status: OpenClawConnectionStatus,
  lastError?: string | null,
): Promise<OpenClawAgent> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("openclaw_agents")
    .update({
      connection_status: status,
      last_error: lastError ?? null,
    })
    .eq("id", agentId)
    .select("*")
    .single();

  if (error) throw new Error(`Failed to update OpenClaw connection status: ${error.message}`);
  return mapAgent(data as OpenClawAgentRow);
}

export async function recordHeartbeat(
  agentId: string,
  metadata?: Record<string, unknown>,
): Promise<OpenClawAgent> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("openclaw_agents")
    .update({
      last_heartbeat: new Date().toISOString(),
      connection_status: "connected",
      last_error: metadata?.error ? String(metadata.error) : null,
    })
    .eq("id", agentId)
    .select("*")
    .single();

  if (error) throw new Error(`Failed to record OpenClaw heartbeat: ${error.message}`);
  return mapAgent(data as OpenClawAgentRow);
}

export async function updateWebhookConfig(
  userId: string,
  input: {
    delivery_channel: "custom" | "telegram";
    endpoint_url: string | null;
    telegram_bot_token: string | null;
    telegram_chat_id: string | null;
    webhook_events: string[];
  },
): Promise<OpenClawAgent> {
  const agent = await getCurrentAgent(userId);
  if (!agent) throw new Error("No imported OpenClaw agent found");
  const existingAgentRow = await getAgentRowById(agent.id);

  const endpointUrl = normalizeOptionalExternalUrl(input.endpoint_url, "endpoint_url");
  if (!endpointUrl.ok) throw new Error(endpointUrl.error);
  const telegramBotToken =
    normalizeTelegramBotToken(input.telegram_bot_token) ??
    normalizeTelegramBotToken(existingAgentRow?.telegram_bot_token);
  const telegramChatId =
    normalizeTelegramChatId(input.telegram_chat_id) ??
    normalizeTelegramChatId(existingAgentRow?.telegram_chat_id);
  const webhookEvents = normalizeWebhookEvents(input.webhook_events);
  if (!webhookEvents.ok) throw new Error(webhookEvents.error);
  const deliveryChannel = input.delivery_channel === "telegram" ? "telegram" : "custom";

  assertDeliveryChannelConfig({
    delivery_channel: deliveryChannel,
    endpoint_url: endpointUrl.normalizedUrl,
    telegram_bot_token: telegramBotToken,
    telegram_chat_id: telegramChatId,
  });

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("openclaw_agents")
    .update({
      delivery_channel: deliveryChannel,
      endpoint_url: endpointUrl.normalizedUrl,
      telegram_bot_token: telegramBotToken,
      telegram_chat_id: telegramChatId,
      webhook_events: webhookEvents.events,
    })
    .eq("id", agent.id)
    .select("*")
    .single();

  if (error) throw new Error(`Failed to update OpenClaw webhook config: ${error.message}`);
  return mapAgent(data as OpenClawAgentRow);
}

async function getWebhookSecret(agentId: string): Promise<string | null> {
  const row = await getAgentRowById(agentId);
  return row?.webhook_secret ?? null;
}

export async function emitOpenClawEvent(
  userId: string,
  event: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const agent = await getCurrentAgent(userId);
  if (!agent) return;
  if (!matchesWebhookEvent(agent.webhook_events, event)) return;

  const start = performance.now();
  let statusCode: number | null = null;
  let errorMessage: string | null = null;
  let destinationUrl = agent.endpoint_url ?? "";

  try {
    let response: Response;

    if (agent.delivery_channel === "telegram") {
      const agentRow = await getAgentRowById(agent.id);
      const botToken = normalizeTelegramBotToken(agentRow?.telegram_bot_token);
      const chatId = normalizeTelegramChatId(agentRow?.telegram_chat_id ?? agent.telegram_chat_id);
      assertDeliveryChannelConfig({
        delivery_channel: "telegram",
        endpoint_url: null,
        telegram_bot_token: botToken,
        telegram_chat_id: chatId,
      });

      destinationUrl = `telegram://chat/${chatId}`;
      response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chat_id: chatId,
          text: formatOpenClawTelegramMessage(agent, event, payload),
          disable_web_page_preview: true,
        }),
        signal: AbortSignal.timeout(10_000),
      });
    } else {
      if (!agent.endpoint_url) {
        return;
      }

      destinationUrl = agent.endpoint_url;
      const webhookSecret = await getWebhookSecret(agent.id);
      const requestBody = JSON.stringify({
        event,
        data: payload,
        timestamp: new Date().toISOString(),
      });
      const signature = webhookSecret
        ? `sha256=${await sha256Hex(`${webhookSecret}:${requestBody}`)}`
        : null;
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "X-Atomic-Event": event,
        "X-Atomic-Agent": agent.id,
        "X-Atomic-Timestamp": new Date().toISOString(),
      };
      if (signature) headers["X-Atomic-Signature"] = signature;

      response = await fetch(agent.endpoint_url, {
        method: "POST",
        headers,
        body: requestBody,
        signal: AbortSignal.timeout(10_000),
      });
    }

    statusCode = response.status;
    if (!response.ok) {
      errorMessage = `${agent.delivery_channel === "telegram" ? "Telegram" : "Webhook"} responded with HTTP ${response.status}`;
    }
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : String(error);
  }

  const latencyMs = Math.max(0, Math.round(performance.now() - start));
  const supabase = getSupabaseClient();
  await supabase.from("openclaw_webhook_delivery_log").insert({
    agent_id: agent.id,
    event,
    url: destinationUrl,
    status_code: statusCode,
    latency_ms: latencyMs,
    attempt: 1,
    error: errorMessage,
    payload,
  });

  if (errorMessage) {
    log("warn", "openclaw:webhook_delivery_failed", {
      agentId: agent.id,
      event,
      statusCode,
      error: errorMessage,
    });
  }
}

export async function sendWebhookTest(
  userId: string,
): Promise<{ ok: boolean; status_code: number | null; latency_ms: number; error?: string }> {
  const agent = await getCurrentAgent(userId);
  if (!agent) throw new Error("No imported OpenClaw agent found");
  if (agent.delivery_channel === "telegram") {
    const agentRow = await getAgentRowById(agent.id);
    const botToken = normalizeTelegramBotToken(agentRow?.telegram_bot_token);
    const chatId = normalizeTelegramChatId(agentRow?.telegram_chat_id ?? agent.telegram_chat_id);
    assertDeliveryChannelConfig({
      delivery_channel: "telegram",
      endpoint_url: null,
      telegram_bot_token: botToken,
      telegram_chat_id: chatId,
    });
  } else if (!agent.endpoint_url) {
    throw new Error("No webhook URL configured");
  }

  const before = await listWebhookDeliveries(userId, 1);
  await emitOpenClawEvent(userId, "openclaw:test", {
    message: "Manual webhook test from Atomic Coding",
    nonce: randomBase64Url(10),
  });
  const after = await listWebhookDeliveries(userId, 1);
  const latest = after[0] ?? before[0];

  return {
    ok: !!latest && (latest.status_code ?? 500) < 400 && !latest.error,
    status_code: latest?.status_code ?? null,
    latency_ms: latest?.latency_ms ?? 0,
    ...(latest?.error ? { error: latest.error } : {}),
  };
}

export async function getOwnedGameRecordByName(
  userId: string,
  gameName: string,
): Promise<{ id: string; name: string; genre: string | null; game_format: "2d" | "3d" | null } | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("games")
    .select("id, name, genre, game_format")
    .eq("name", gameName)
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`Failed to resolve owned game: ${error.message}`);
  return data ?? null;
}

export async function getPlatformHealth() {
  const supabase = getSupabaseClient();
  let supabaseStatus: "ok" | "error" = "error";
  let mastraStatus: "ok" | "error" | "not_configured" = "not_configured";
  const mastraUrl = Deno.env.get("MASTRA_SERVER_URL") ?? "";

  try {
    const { error } = await supabase.from("games").select("id", { head: true, count: "exact" });
    if (!error) supabaseStatus = "ok";
  } catch {
    supabaseStatus = "error";
  }

  if (mastraUrl) {
    try {
      const response = await fetch(`${mastraUrl}/health`, {
        method: "GET",
        signal: AbortSignal.timeout(5000),
      });
      mastraStatus = response.ok ? "ok" : "error";
    } catch {
      mastraStatus = "error";
    }
  }

  return {
    status:
      supabaseStatus === "ok" &&
      (mastraStatus === "ok" || mastraStatus === "not_configured")
        ? "ok"
        : "degraded",
    checks: {
      api: "ok" as const,
      supabase: supabaseStatus,
      mastra: mastraStatus,
    },
    config: {
      mastraConfigured: Boolean(mastraUrl),
    },
  };
}

export function buildDocsMetadata(baseUrl: string) {
  return {
    ...buildOpenClawSkillJson(baseUrl),
    available_events: buildOpenClawSkillJson(baseUrl).webhook_events,
  };
}

export async function refreshCurrentAgentConnectionStatus(
  userId: string,
): Promise<OpenClawAgent | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("openclaw_agents")
    .select("*")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("claimed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to refresh OpenClaw connection status: ${error.message}`);
  }
  if (!data) return null;

  const row = data as OpenClawAgentRow;
  const derived = deriveConnectionStatus(row.connection_status, row.last_heartbeat);
  if (derived !== row.connection_status) {
    return updateAgentConnectionStatus(row.id, derived);
  }

  return mapAgent(row);
}
