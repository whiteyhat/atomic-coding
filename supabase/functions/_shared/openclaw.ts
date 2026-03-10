export const OPENCLAW_DEFAULT_SCOPES = [
  "profile",
  "boilerplates",
  "games",
  "atoms",
  "externals",
  "builds",
  "publishing",
  "tokens",
  "chat",
  "warrooms",
  "ops",
] as const;

export const OPENCLAW_ACTIVE_WINDOW_MS = 15 * 60 * 1000;
export const OPENCLAW_ONBOARDING_TTL_MS = 15 * 60 * 1000;

export const OPENCLAW_WEBHOOK_EVENTS = [
  { key: "*", label: "All events", description: "Receive every OpenClaw event Atomic emits." },
  { key: "build:*", label: "Build events", description: "Build triggers, successes, failures, and rollbacks." },
  { key: "warroom:*", label: "War room events", description: "War room lifecycle updates across planning and execution." },
  { key: "game:published", label: "Game published", description: "Triggered when a game is published." },
  { key: "game:unpublished", label: "Game unpublished", description: "Triggered when a game is taken offline." },
  { key: "token:updated", label: "Token updated", description: "Triggered when token draft settings change." },
  { key: "openclaw:test", label: "Webhook test", description: "Manual test event from the OpenClaw dashboard." },
] as const;

export const OPENCLAW_CAPABILITY_GROUPS = [
  {
    key: "profile",
    label: "Profile",
    description: "Read and update the owner profile that powers Atomic surfaces.",
    operations: [
      { method: "GET", path: "/openclaw/tools/profile", summary: "Get the owner profile." },
      { method: "PUT", path: "/openclaw/tools/profile", summary: "Update display name and avatar URL." },
    ],
  },
  {
    key: "catalog",
    label: "Catalog",
    description: "Inspect reusable platform resources before taking action.",
    operations: [
      { method: "GET", path: "/openclaw/tools/boilerplates", summary: "List genre boilerplates." },
      { method: "GET", path: "/openclaw/tools/boilerplates/{slug}", summary: "Get a boilerplate by slug." },
      { method: "GET", path: "/openclaw/tools/registry/externals", summary: "List the external registry." },
    ],
  },
  {
    key: "games",
    label: "Games",
    description: "Create and manage the owner’s games, atoms, externals, and builds.",
    operations: [
      { method: "GET", path: "/openclaw/tools/games", summary: "List the owner’s games." },
      { method: "POST", path: "/openclaw/tools/games", summary: "Create a game." },
      { method: "GET", path: "/openclaw/tools/games/{name}", summary: "Get a game by name." },
      { method: "GET", path: "/openclaw/tools/games/{name}/structure", summary: "Read atom structure." },
      { method: "POST", path: "/openclaw/tools/games/{name}/atoms/read", summary: "Read specific atoms." },
      { method: "POST", path: "/openclaw/tools/games/{name}/atoms/search", summary: "Search atoms semantically." },
      { method: "PUT", path: "/openclaw/tools/games/{name}/atoms/{atom_name}", summary: "Upsert an atom." },
      { method: "DELETE", path: "/openclaw/tools/games/{name}/atoms/{atom_name}", summary: "Delete an atom." },
      { method: "GET", path: "/openclaw/tools/games/{name}/externals", summary: "List installed externals." },
      { method: "POST", path: "/openclaw/tools/games/{name}/externals", summary: "Install an external." },
      { method: "DELETE", path: "/openclaw/tools/games/{name}/externals/{ext_name}", summary: "Uninstall an external." },
      { method: "GET", path: "/openclaw/tools/games/{name}/builds", summary: "List builds." },
      { method: "POST", path: "/openclaw/tools/games/{name}/builds", summary: "Trigger a rebuild." },
      { method: "POST", path: "/openclaw/tools/games/{name}/builds/{id}/rollback", summary: "Rollback to a prior build." },
      { method: "POST", path: "/openclaw/tools/games/{name}/publish", summary: "Publish a game." },
      { method: "POST", path: "/openclaw/tools/games/{name}/unpublish", summary: "Unpublish a game." },
    ],
  },
  {
    key: "tokens",
    label: "Tokens",
    description: "Read and update token draft settings attached to a game.",
    operations: [
      { method: "PUT", path: "/openclaw/tools/games/{name}/token", summary: "Create or update token launch settings." },
      { method: "GET", path: "/openclaw/tools/games/{name}/token", summary: "Get token launch settings." },
      { method: "GET", path: "/openclaw/tools/games/{name}/token/distributions", summary: "List token distributions." },
    ],
  },
  {
    key: "chat",
    label: "Chat",
    description: "Manage saved chat sessions and their message history.",
    operations: [
      { method: "GET", path: "/openclaw/tools/games/{name}/chat/sessions", summary: "List chat sessions." },
      { method: "POST", path: "/openclaw/tools/games/{name}/chat/sessions", summary: "Create a chat session." },
      { method: "DELETE", path: "/openclaw/tools/games/{name}/chat/sessions/{sessionId}", summary: "Delete a chat session." },
      { method: "GET", path: "/openclaw/tools/games/{name}/chat/sessions/{sessionId}/messages", summary: "Get chat messages." },
      { method: "POST", path: "/openclaw/tools/games/{name}/chat/sessions/{sessionId}/messages", summary: "Save chat messages." },
    ],
  },
  {
    key: "warrooms",
    label: "War Rooms",
    description: "Create and monitor multi-agent war rooms inside Atomic.",
    operations: [
      { method: "POST", path: "/openclaw/tools/games/{name}/warrooms", summary: "Create a war room." },
      { method: "GET", path: "/openclaw/tools/games/{name}/warrooms", summary: "List war rooms." },
      { method: "GET", path: "/openclaw/tools/games/{name}/warrooms/{id}", summary: "Get a war room feed." },
      { method: "POST", path: "/openclaw/tools/games/{name}/warrooms/{id}/cancel", summary: "Cancel a war room." },
    ],
  },
  {
    key: "ops",
    label: "Ops",
    description: "Inspect platform health and maintain the OpenClaw runtime connection.",
    operations: [
      { method: "GET", path: "/openclaw/tools/platform-health", summary: "Get Atomic platform health." },
      { method: "GET", path: "/openclaw/tools/agent-status", summary: "Get imported agent runtime status." },
      { method: "GET", path: "/openclaw/tools/health-score", summary: "Get the OpenClaw runtime health score." },
      { method: "POST", path: "/openclaw/tools/heartbeat", summary: "Send a runtime heartbeat." },
    ],
  },
] as const;

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

export function getApiBaseFromRequest(requestOrUrl: Request | string): string {
  const request = typeof requestOrUrl === "string" ? null : requestOrUrl;
  const url = new URL(typeof requestOrUrl === "string" ? requestOrUrl : requestOrUrl.url);
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const envOrigin = supabaseUrl ? new URL(supabaseUrl).origin : null;
  const forwardedProto = request?.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const forwardedHost = request?.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || request?.headers.get("host") || url.host;
  const protocol = forwardedProto || url.protocol.replace(/:$/, "");
  const origin = envOrigin || `${protocol}://${host}`;
  const edgeFunctionPrefix = "/functions/v1/api";
  const edgeFunctionIdx = url.pathname.indexOf(edgeFunctionPrefix);
  if (edgeFunctionIdx >= 0) {
    return `${origin}${edgeFunctionPrefix}`;
  }

  const apiIdx = url.pathname.indexOf("/api");
  if (apiIdx >= 0) {
    return `${origin}${url.pathname.slice(0, apiIdx + "/api".length)}`;
  }

  return `${origin}${edgeFunctionPrefix}`;
}

export function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  return toHex(await crypto.subtle.digest("SHA-256", bytes));
}

export function randomBase64Url(size = 24): string {
  const bytes = crypto.getRandomValues(new Uint8Array(size));
  const binary = String.fromCharCode(...bytes);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function generateClaimToken(): string {
  return `ocl_claim_${randomBase64Url(24)}`;
}

export function generateApiKeyValue(): string {
  return `ocl_live_${randomBase64Url(32)}`;
}

export function generateWebhookSecret(): string {
  return `ocl_whsec_${randomBase64Url(32)}`;
}

export function deriveApiKeyPrefix(fullKey: string): string {
  return fullKey.slice(0, 16);
}

export function deriveConnectionStatus(
  connectionStatus: string | null,
  lastHeartbeat: string | null,
  now = Date.now(),
): OpenClawConnectionStatus {
  if (connectionStatus === "error" || connectionStatus === "replaced") {
    return connectionStatus;
  }

  if (!lastHeartbeat) {
    return connectionStatus === "connected" ? "pending" : "pending";
  }

  const ageMs = now - new Date(lastHeartbeat).getTime();
  if (!Number.isFinite(ageMs) || ageMs < 0) {
    return connectionStatus === "error" ? "error" : "pending";
  }

  return ageMs <= OPENCLAW_ACTIVE_WINDOW_MS ? "connected" : "disconnected";
}

function isPrivateOrInternalHost(hostnameRaw: string): boolean {
  const host = hostnameRaw.toLowerCase();
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "0.0.0.0" ||
    host.startsWith("10.") ||
    host.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    host === "[::1]" ||
    host === "::1" ||
    host.endsWith(".local") ||
    host.endsWith(".internal")
  );
}

export function validateExternalHttpsUrl(
  value: unknown,
  fieldName: "endpoint_url" | "agent_url",
):
  | { ok: true; normalizedUrl: string }
  | { ok: false; error: string } {
  if (typeof value !== "string" || !value.trim()) {
    return { ok: false, error: `${fieldName} is required` };
  }

  const trimmed = value.trim();
  if (trimmed.length > 500) {
    return { ok: false, error: `${fieldName} must be 500 characters or less` };
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "https:") {
      return { ok: false, error: `${fieldName} must use HTTPS` };
    }

    if (isPrivateOrInternalHost(parsed.hostname)) {
      return {
        ok: false,
        error: `${fieldName} must not point to a private or internal address`,
      };
    }

    return { ok: true, normalizedUrl: parsed.toString() };
  } catch {
    return { ok: false, error: `${fieldName} must be a valid URL` };
  }
}

export function normalizeOptionalExternalUrl(
  value: unknown,
  fieldName: "endpoint_url" | "agent_url",
):
  | { ok: true; normalizedUrl: string | null }
  | { ok: false; error: string } {
  if (value == null || value === "") {
    return { ok: true, normalizedUrl: null };
  }

  const validated = validateExternalHttpsUrl(value, fieldName);
  return validated.ok
    ? { ok: true, normalizedUrl: validated.normalizedUrl }
    : validated;
}

export function normalizeWebhookEvents(value: unknown):
  | { ok: true; events: string[] }
  | { ok: false; error: string } {
  if (value == null) {
    return { ok: true, events: ["*"] };
  }

  if (!Array.isArray(value)) {
    return { ok: false, error: "webhook_events must be an array of strings" };
  }

  const events = Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );

  if (events.length === 0 || events.includes("*")) {
    return { ok: true, events: ["*"] };
  }

  return { ok: true, events };
}

export function parseStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }
  return [];
}

export function matchesWebhookEvent(subscriptions: string[], event: string): boolean {
  if (subscriptions.includes("*") || subscriptions.includes(event)) return true;
  const [group] = event.split(":");
  return subscriptions.includes(`${group}:*`);
}

export function buildOpenClawSkillJson(baseUrl: string) {
  return {
    name: "Atomic Coding OpenClaw Control Plane",
    version: "1.0.0",
    workflow: "openclaw_byo_claim_v1",
    api_base_url: `${baseUrl}/openclaw/tools`,
    docs_url: `${baseUrl}/openclaw/docs`,
    skill_manifest_url: `${baseUrl}/openclaw/skill.md`,
    skill_json_url: `${baseUrl}/openclaw/skill.json`,
    create_session_path: `${baseUrl}/openclaw/onboarding`,
    replace_session_path: `${baseUrl}/openclaw/agent/replace`,
    claim_path_template: `${baseUrl}/openclaw/claim/{claimToken}`,
    heartbeat_url: `${baseUrl}/openclaw/tools/heartbeat`,
    claim_required_fields: ["name", "agent_url"],
    claim_optional_fields: ["description", "endpoint_url", "webhook_events"],
    webhook_events: OPENCLAW_WEBHOOK_EVENTS,
    scopes: [...OPENCLAW_DEFAULT_SCOPES],
    capabilities: OPENCLAW_CAPABILITY_GROUPS,
  };
}

export function buildOpenClawSkillMarkdown(baseUrl: string): string {
  const manifest = buildOpenClawSkillJson(baseUrl);
  const capabilitySections = manifest.capabilities
    .map((group) => {
      const ops = group.operations
        .map((operation) => `- \`${operation.method} ${baseUrl}${operation.path}\` — ${operation.summary}`)
        .join("\n");

      return `### ${group.label}\n${group.description}\n${ops}`;
    })
    .join("\n\n");

  return [
    "# Atomic Coding OpenClaw Skill",
    "",
    "Atomic exposes an owner-scoped control plane for imported OpenClaw agents.",
    "Mastra remains the built-in orchestrator; OpenClaw operates as an external runtime with an API key.",
    "",
    "## Claim Flow",
    `1. The owner creates an onboarding session at \`${manifest.create_session_path}\` or a replacement session at \`${manifest.replace_session_path}\`.`,
    "2. OpenClaw receives a one-time claim URL and reads the handshake document with `GET`.",
    "3. OpenClaw `POST`s its identity payload back to the same claim URL.",
    "4. Atomic returns runtime credentials, the tool API base, and the heartbeat URL.",
    "",
    "### Claim Payload",
    "```json",
    JSON.stringify(
      {
        name: "My OpenClaw Agent",
        description: "Optional description",
        agent_url: "https://agent.example.com",
        endpoint_url: "https://agent.example.com/webhook",
        webhook_events: ["build:*", "warroom:*"],
      },
      null,
      2,
    ),
    "```",
    "",
    "### Claim Response",
    "```json",
    JSON.stringify(
      {
        agent_id: "uuid",
        api_key: "ocl_live_...",
        api_base_url: manifest.api_base_url,
        skill_manifest_url: manifest.skill_manifest_url,
        skill_json_url: manifest.skill_json_url,
        heartbeat_url: manifest.heartbeat_url,
        webhook_secret: "ocl_whsec_...",
      },
      null,
      2,
    ),
    "```",
    "",
    "## Runtime Notes",
    `- Call \`${manifest.heartbeat_url}\` roughly every 5 minutes to stay connected.`,
    "- Use the returned bearer API key only against Atomic endpoints.",
    "- Webhook delivery supports exact events, namespace wildcards like `build:*`, or `*`.",
    "",
    "## Capabilities",
    capabilitySections,
  ].join("\n");
}
