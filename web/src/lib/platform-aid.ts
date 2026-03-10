"use client";

export type PlatformAidPageId =
  | "dashboard"
  | "analytics"
  | "library"
  | "settings"
  | "openclaw"
  | "other";

export type PlatformAidContextKind =
  | "account"
  | "games"
  | "route"
  | "openclaw";

export interface PlatformAidTraceEvent {
  type: "trace";
  key: string;
  label: string;
  status: string;
  state?: "running" | "done";
  detail?: string;
}

export interface PlatformAidContextEvent {
  type: "context";
  kind: PlatformAidContextKind;
  data: unknown;
}

export interface PlatformAidTokenEvent {
  type: "token";
  token: string;
}

export interface PlatformAidAction {
  label: string;
  href: string;
}

export interface PlatformAidDoneEvent {
  type: "done";
  reply?: string;
  latencyMs?: number;
  model?: string;
  suggestions?: string[];
  actions?: PlatformAidAction[];
  contexts?: Record<string, unknown>;
}

export interface PlatformAidErrorEvent {
  type: "error";
  error?: string;
}

export type PlatformAidEvent =
  | PlatformAidTraceEvent
  | PlatformAidContextEvent
  | PlatformAidTokenEvent
  | PlatformAidDoneEvent
  | PlatformAidErrorEvent;

export const PLATFORM_AID_SESSION_KEY = "buu_platform_aid_session";
export const PLATFORM_AID_OPENED_KEY = "buu_platform_aid_opened";

const PAGE_SUGGESTIONS: Record<PlatformAidPageId, string[]> = {
  dashboard: [
    "How do I create my first game?",
    "What should I do after creating a game?",
    "How does publishing work here?",
  ],
  analytics: [
    "What does the architecture view show?",
    "What does Mastra handle in this platform?",
    "How do the MCP tools fit into the stack?",
  ],
  library: [
    "How do private and published games differ?",
    "How do I reopen a game workspace?",
    "Where do I publish a game from?",
  ],
  settings: [
    "What can I change in Settings?",
    "What do the health cards mean?",
    "How does account auth work here?",
  ],
  openclaw: [
    "How do I import OpenClaw?",
    "What does the claim flow do?",
    "What are OpenClaw API keys and webhooks for?",
  ],
  other: [
    "How do I create my first game?",
    "Where should I go next in the platform?",
    "How does publishing work here?",
  ],
};

function createLocalId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `platform-aid-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

export function isPlatformAidRoute(pathname: string): boolean {
  return (
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/analytics") ||
    pathname.startsWith("/library") ||
    pathname.startsWith("/settings") ||
    pathname.startsWith("/openclaw")
  );
}

export function getPlatformAidPageId(pathname: string): PlatformAidPageId {
  if (pathname.startsWith("/analytics")) return "analytics";
  if (pathname.startsWith("/library")) return "library";
  if (pathname.startsWith("/settings")) return "settings";
  if (pathname.startsWith("/openclaw")) return "openclaw";
  if (pathname.startsWith("/dashboard")) return "dashboard";
  return "other";
}

export function getPlatformAidSessionId(storage: Storage | null): string {
  if (!storage) return createLocalId();

  let id = storage.getItem(PLATFORM_AID_SESSION_KEY);
  if (!id) {
    id = createLocalId();
    storage.setItem(PLATFORM_AID_SESSION_KEY, id);
  }

  return id;
}

export function getPlatformAidOpened(storage: Storage | null): boolean {
  if (!storage) return false;
  return storage.getItem(PLATFORM_AID_OPENED_KEY) === "true";
}

export function setPlatformAidOpened(
  storage: Storage | null,
  opened = true,
): void {
  if (!storage) return;
  storage.setItem(PLATFORM_AID_OPENED_KEY, opened ? "true" : "false");
}

export function normalizePlatformAidQuestion(question: string): string {
  return question.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function getPlatformAidFallbackSuggestions(
  pageId: PlatformAidPageId,
): string[] {
  return PAGE_SUGGESTIONS[pageId];
}

export function mergePlatformAidSuggestions(
  pageId: PlatformAidPageId,
  suggestions: string[] | undefined,
): string[] {
  const merged = new Map<string, string>();

  for (const suggestion of suggestions ?? []) {
    const trimmed = suggestion.trim();
    const key = normalizePlatformAidQuestion(trimmed);
    if (trimmed && key) {
      merged.set(key, trimmed);
    }
  }

  for (const fallback of getPlatformAidFallbackSuggestions(pageId)) {
    const key = normalizePlatformAidQuestion(fallback);
    if (!merged.has(key)) {
      merged.set(key, fallback);
    }
  }

  return Array.from(merged.values()).slice(0, 3);
}

export function getPlatformAidIntro(
  pageId: PlatformAidPageId,
  displayName?: string | null,
): string {
  const namePrefix = displayName ? `${displayName}, ` : "";

  switch (pageId) {
    case "analytics":
      return `${namePrefix}Buu Guide is online. I can explain the architecture view, Mastra, MCP tools, and how the platform fits together.`;
    case "library":
      return `${namePrefix}Buu Guide is online. I can help with game management, publishing, and getting back into the right workspace fast.`;
    case "settings":
      return `${namePrefix}Buu Guide is online. I can explain profile settings, runtime health, and where account-level controls live.`;
    case "openclaw":
      return `${namePrefix}Buu Guide is online. I can walk you through OpenClaw import, claim flow, API keys, webhooks, and connection health.`;
    default:
      return `${namePrefix}Buu Guide is online. I can help you start your first game, navigate the platform, and understand what to do next.`;
  }
}

export function parsePlatformAidEvent(payload: string): PlatformAidEvent | null {
  if (!payload) return null;

  try {
    const parsed = JSON.parse(payload) as Record<string, unknown>;

    if (parsed.type === "trace") {
      return {
        type: "trace",
        key: String(parsed.key ?? ""),
        label: String(parsed.label ?? ""),
        status: String(parsed.status ?? ""),
        state: parsed.state === "done" ? "done" : "running",
        detail: typeof parsed.detail === "string" ? parsed.detail : undefined,
      };
    }

    if (parsed.type === "context") {
      return {
        type: "context",
        kind: parsed.kind as PlatformAidContextKind,
        data: parsed.data,
      };
    }

    if (parsed.type === "done") {
      return {
        type: "done",
        reply: typeof parsed.reply === "string" ? parsed.reply : undefined,
        latencyMs:
          typeof parsed.latencyMs === "number" ? parsed.latencyMs : undefined,
        model: typeof parsed.model === "string" ? parsed.model : undefined,
        suggestions: Array.isArray(parsed.suggestions)
          ? parsed.suggestions.filter(
              (item): item is string => typeof item === "string",
            )
          : undefined,
        actions: Array.isArray(parsed.actions)
          ? parsed.actions.flatMap((item) => {
              if (!item || typeof item !== "object") return [];
              const action = item as Record<string, unknown>;
              if (
                typeof action.label === "string" &&
                typeof action.href === "string"
              ) {
                return [{ label: action.label, href: action.href }];
              }
              return [];
            })
          : undefined,
        contexts:
          parsed.contexts && typeof parsed.contexts === "object"
            ? (parsed.contexts as Record<string, unknown>)
            : undefined,
      };
    }

    if (parsed.type === "error") {
      return {
        type: "error",
        error: typeof parsed.error === "string" ? parsed.error : undefined,
      };
    }

    if (
      parsed.type === "token" ||
      typeof parsed.token === "string" ||
      typeof parsed.delta === "string" ||
      typeof parsed.text === "string" ||
      typeof parsed.content === "string"
    ) {
      return {
        type: "token",
        token: String(
          parsed.token ?? parsed.delta ?? parsed.text ?? parsed.content ?? "",
        ),
      };
    }
  } catch {
    return { type: "token", token: payload };
  }

  return null;
}
