import { API_BASE } from "./constants";
import type {
  OpenClawAgentEnvelope,
  OpenClawCapabilityGroup,
  OpenClawOnboardingSession,
  OpenClawSkillManifest,
  OpenClawWebhookEventOption,
} from "./types";

export const OPENCLAW_SESSION_STORAGE_KEY = "openclaw:onboarding-session-id";
export const OPENCLAW_SESSION_SNAPSHOT_STORAGE_KEY = "openclaw:onboarding-session-snapshot";
export const OPENCLAW_BACKEND_UNAVAILABLE_MESSAGE =
  "The current Supabase API does not expose the OpenClaw routes yet. Deploy the latest `supabase/functions/api` function and apply migration `025_openclaw_control_plane.sql` for full functionality.";

export const OPENCLAW_WIZARD_STEPS = [
  "Generate Claim Link",
  "Send to OpenClaw",
  "Review & Activate",
] as const;

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

export const OPENCLAW_WEBHOOK_EVENTS: OpenClawWebhookEventOption[] = [
  { key: "*", label: "All events", description: "Receive every OpenClaw event Atomic emits." },
  { key: "build:*", label: "Build events", description: "Build triggers, successes, failures, and rollbacks." },
  { key: "warroom:*", label: "War room events", description: "War room lifecycle updates across planning and execution." },
  { key: "game:published", label: "Game published", description: "Triggered when a game is published." },
  { key: "game:unpublished", label: "Game unpublished", description: "Triggered when a game is taken offline." },
  { key: "token:updated", label: "Token updated", description: "Triggered when token draft settings change." },
  { key: "openclaw:test", label: "Webhook test", description: "Manual test event from the OpenClaw dashboard." },
];

export const OPENCLAW_CAPABILITY_GROUPS: OpenClawCapabilityGroup[] = [
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
];

export function formatOpenClawTimeRemaining(
  expiresAt: string,
  now = Date.now(),
): string {
  const remainingMs = new Date(expiresAt).getTime() - now;

  if (!Number.isFinite(remainingMs) || remainingMs <= 0) {
    return "Expired";
  }

  const totalMinutes = Math.ceil(remainingMs / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0 && minutes > 0) {
    return `${hours}h ${minutes}m remaining`;
  }

  if (hours > 0) {
    return `${hours}h remaining`;
  }

  return `${Math.max(1, totalMinutes)}m remaining`;
}

export function formatOpenClawRelativeTime(
  value: string | null | undefined,
  now = Date.now(),
): string {
  if (!value) {
    return "Never";
  }

  const target = new Date(value).getTime();
  if (!Number.isFinite(target)) {
    return "Unknown";
  }

  const deltaMs = target - now;
  const absMs = Math.abs(deltaMs);
  const minutes = Math.round(absMs / 60_000);
  const hours = Math.round(absMs / 3_600_000);
  const days = Math.round(absMs / 86_400_000);

  if (absMs < 60_000) {
    return deltaMs >= 0 ? "in under a minute" : "just now";
  }

  if (absMs < 3_600_000) {
    return deltaMs >= 0 ? `in ${minutes}m` : `${minutes}m ago`;
  }

  if (absMs < 86_400_000) {
    return deltaMs >= 0 ? `in ${hours}h` : `${hours}h ago`;
  }

  return deltaMs >= 0 ? `in ${days}d` : `${days}d ago`;
}

export function getOpenClawWizardStep(
  session: OpenClawOnboardingSession | null | undefined,
): number {
  if (!session) {
    return 0;
  }

  switch (session.status) {
    case "claimed":
      return 2;
    case "expired":
    case "failed":
    case "cancelled":
      return 0;
    case "pending_claim":
    default:
      return session.identity ? 2 : 1;
  }
}

export function buildOpenClawClaimPrompt(
  session: Pick<OpenClawOnboardingSession, "session_id" | "expires_at" | "onboarding_url" | "mode">,
): string {
  const claimUrl = session.onboarding_url?.trim() || "Unavailable";

  return [
    "Open this Atomic Coding onboarding URL and complete the OpenClaw import flow for this agent.",
    "Read the handshake document from the URL, then POST the OpenClaw identity payload back to the same URL.",
    "Include the public HTTPS `agent_url` in the POST payload.",
    "You can also include `description`, `endpoint_url`, and `webhook_events` if they are already known, but they are optional during claim.",
    "After the claim succeeds, store the returned Atomic credentials for runtime use: `api_key`, `api_base_url`, `skill_manifest_url`, `skill_json_url`, and `heartbeat_url`.",
    "Keep the returned webhook secret for future delivery verification, and use the heartbeat endpoint regularly so Atomic keeps the imported agent marked as connected.",
    "If the claim URL is unavailable, stop and report that back instead of inventing a URL.",
    "",
    `Session ID: ${session.session_id}`,
    `Mode: ${session.mode}`,
    `Expires: ${session.expires_at}`,
    "",
    claimUrl,
  ].join("\n");
}

export function mergeOpenClawOnboardingSession(
  previous: OpenClawOnboardingSession | null | undefined,
  next: OpenClawOnboardingSession,
): OpenClawOnboardingSession {
  if (!previous || previous.session_id !== next.session_id) {
    return next;
  }

  if (!next.onboarding_url && previous.onboarding_url) {
    return {
      ...next,
      onboarding_url: previous.onboarding_url,
    };
  }

  return next;
}

export function readStoredOpenClawSessionSnapshot(): OpenClawOnboardingSession | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(OPENCLAW_SESSION_SNAPSHOT_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as OpenClawOnboardingSession;
    return typeof parsed?.session_id === "string" ? parsed : null;
  } catch {
    return null;
  }
}

export function writeStoredOpenClawSessionSnapshot(session: OpenClawOnboardingSession): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(OPENCLAW_SESSION_SNAPSHOT_STORAGE_KEY, JSON.stringify(session));
}

export function clearStoredOpenClawSessionSnapshot(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(OPENCLAW_SESSION_SNAPSHOT_STORAGE_KEY);
}

export function buildOpenClawFrontendManifest(
  apiBase = API_BASE,
): OpenClawSkillManifest {
  return {
    name: "Atomic Coding OpenClaw Control Plane",
    version: "1.0.0",
    workflow: "openclaw_byo_claim_v1",
    api_base_url: `${apiBase}/openclaw/tools`,
    docs_url: "/openclaw/docs",
    skill_manifest_url: `${apiBase}/openclaw/skill.md`,
    skill_json_url: `${apiBase}/openclaw/skill.json`,
    create_session_path: `${apiBase}/openclaw/onboarding`,
    replace_session_path: `${apiBase}/openclaw/agent/replace`,
    claim_path_template: `${apiBase}/openclaw/claim/{claimToken}`,
    heartbeat_url: `${apiBase}/openclaw/tools/heartbeat`,
    claim_required_fields: ["name", "agent_url"],
    claim_optional_fields: ["description", "endpoint_url", "webhook_events"],
    webhook_events: OPENCLAW_WEBHOOK_EVENTS,
    scopes: [...OPENCLAW_DEFAULT_SCOPES],
    capabilities: OPENCLAW_CAPABILITY_GROUPS,
  };
}

export function buildOpenClawFallbackEnvelope(
  apiBase = API_BASE,
): OpenClawAgentEnvelope {
  const manifest = buildOpenClawFrontendManifest(apiBase);
  return {
    agent: null,
    api_base_url: manifest.api_base_url,
    skill_manifest_url: manifest.skill_manifest_url,
    skill_json_url: manifest.skill_json_url,
    heartbeat_url: manifest.heartbeat_url,
    docs_url: manifest.docs_url,
    capabilities: manifest.capabilities,
    webhook_events: manifest.webhook_events,
  };
}
