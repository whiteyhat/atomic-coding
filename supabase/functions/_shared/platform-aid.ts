import * as games from "./services/games.ts";
import * as openclaw from "./services/openclaw.ts";
import * as users from "./services/users.ts";
import type { GameWithBuild } from "./services/games.ts";
import type { OpenClawAgent, OpenClawHealthScore } from "./services/openclaw.ts";
import type { UserProfile } from "./services/users.ts";

const OPENROUTER_CHAT_COMPLETIONS_URL =
  "https://openrouter.ai/api/v1/chat/completions";
const PLATFORM_AID_MODEL =
  Deno.env.get("PLATFORM_AID_MODEL") ??
  Deno.env.get("OPENROUTER_PLATFORM_AID_MODEL") ??
  "google/gemini-3.1-flash-lite-preview";

const MAX_REPLY_WORDS = 60;
const MAX_RAW_REPLY_WORDS = 90;

const HUMANIZER_OPENING_PATTERNS = [
  /^great question!?/i,
  /^good question!?/i,
  /^excellent question!?/i,
  /^of course!?/i,
  /^certainly!?/i,
  /^absolutely!?/i,
  /^you'?re absolutely right[!. ]*/i,
  /^you'?re right[!. ]*/i,
];

const HUMANIZER_SENTENCE_CUTS = [
  /i hope this helps/i,
  /let me know if you(?:'d| would) like/i,
  /if you(?:'d| would) like,? i can/i,
  /if you want,? i can/i,
  /happy to help/i,
  /feel free to ask/i,
];

const PAGE_KNOWLEDGE: Record<
  PlatformAidPageId,
  {
    label: string;
    summary: string;
    knowledge: string;
    suggestions: string[];
  }
> = {
  dashboard: {
    label: "Dashboard",
    summary: "Overview of creations, stats, and next steps.",
    knowledge:
      "Dashboard is the main launch surface. It shows creations, stats, token feed, and the create-game entry point.",
    suggestions: [
      "How do I create my first game?",
      "What should I do after creating a game?",
      "How does publishing work here?",
    ],
  },
  analytics: {
    label: "Analytics",
    summary: "Static architecture view of the current platform stack.",
    knowledge:
      "Analytics explains the architecture: Next.js web app, Supabase Edge API, Mastra orchestration, MCP servers, bundles, and supporting services.",
    suggestions: [
      "What does the architecture view show?",
      "What does Mastra handle in this platform?",
      "How do the MCP tools fit into the stack?",
    ],
  },
  library: {
    label: "Library",
    summary: "Browse, filter, reopen, and publish owned games.",
    knowledge:
      "Library is where creators browse owned games, filter by build state and visibility, reopen a workspace, and manage publish state.",
    suggestions: [
      "How do private and published games differ?",
      "How do I reopen a game workspace?",
      "Where do I publish a game from?",
    ],
  },
  settings: {
    label: "Settings",
    summary: "Profile and platform runtime details.",
    knowledge:
      "Settings lets the user update display name and avatar URL and review platform runtime and health information.",
    suggestions: [
      "What can I change in Settings?",
      "What do the health cards mean?",
      "How does account auth work here?",
    ],
  },
  openclaw: {
    label: "OpenClaw",
    summary: "Import, manage, and monitor an OpenClaw agent.",
    knowledge:
      "OpenClaw handles import and replacement flows, claim links, API keys, webhook config, connection testing, and health score monitoring.",
    suggestions: [
      "How do I import OpenClaw?",
      "What does the claim flow do?",
      "What are OpenClaw API keys and webhooks for?",
    ],
  },
  other: {
    label: "Platform",
    summary: "General product guidance for Atomic Game Maker.",
    knowledge:
      "Atomic Game Maker centers on dashboard, library, workspace chat, War Room, externals, publishing, OpenClaw, and architecture tooling.",
    suggestions: [
      "How do I create my first game?",
      "Where should I go next in the platform?",
      "How does publishing work here?",
    ],
  },
};

const PLATFORM_KNOWLEDGE = [
  "Dashboard: create games, review creations, stats, and token activity.",
  "Library: filter games, reopen a workspace, see visibility and build status.",
  "Workspace: feature chat handles quick edits; War Room handles larger multi-agent orchestration.",
  "Actions console: externals, builds, atoms, and settings live there inside the workspace.",
  "Publishing: publish from a game workspace or library-backed flow to get a public slug and playable route.",
  "Analytics: architecture view explains web app, Supabase Edge API, Mastra, MCP servers, and bundle pipeline.",
  "Settings: profile edits and platform runtime details.",
  "OpenClaw: import or replace an agent, inspect connection health, rotate API keys, and manage webhooks.",
  "Tokens: token-launch support is still a skeleton. Users can view draft status but full token flow is not complete.",
].join("\n");

const OFF_TOPIC_PATTERNS = [
  /\bweather\b/i,
  /\brecipe\b/i,
  /\bsports?\b/i,
  /\bpresident\b/i,
  /\bcapital of\b/i,
  /\bbitcoin\b/i,
  /\bstock price\b/i,
  /\btranslate\b/i,
  /\bpoem\b/i,
  /\bjoke\b/i,
];

type PlatformAidTopic =
  | "create_game"
  | "publish_game"
  | "library"
  | "analytics"
  | "settings"
  | "openclaw"
  | "war_room"
  | "workspace"
  | "externals"
  | "token"
  | "navigation"
  | "dashboard"
  | "general"
  | "off_topic";

export type PlatformAidPageId =
  | "dashboard"
  | "analytics"
  | "library"
  | "settings"
  | "openclaw"
  | "other";

export interface PlatformAidHistoryEntry {
  role: "user" | "assistant";
  content: string;
}

export interface PlatformAidRequestBody {
  message: string;
  sessionId: string;
  history?: PlatformAidHistoryEntry[];
  clientContext: {
    pathname: string;
    pageId: PlatformAidPageId;
  };
}

export interface PlatformAidAction {
  label: string;
  href: string;
}

export interface PlatformAidAccountContext {
  displayName: string | null;
  email: string | null;
  walletAddress: string | null;
}

export interface PlatformAidGamesContext {
  totalCount: number;
  publishedCount: number;
  latestGame:
    | {
        name: string;
        href: string;
        updatedAt: string;
        buildStatus: string | null;
        isPublished: boolean;
      }
    | null;
}

export interface PlatformAidRouteContext {
  pageId: PlatformAidPageId;
  label: string;
  summary: string;
}

export interface PlatformAidOpenClawContext {
  hasAgent: boolean;
  agentName: string | null;
  connectionStatus: string | null;
  healthStatus: string | null;
  healthScore: number | null;
  docsHref: string;
}

export interface PlatformAidLiveContext {
  account: PlatformAidAccountContext;
  games: PlatformAidGamesContext;
  route: PlatformAidRouteContext;
  openclaw?: PlatformAidOpenClawContext;
}

export interface PlatformAidArtifacts {
  actions: PlatformAidAction[];
  fallbackReply: string;
  offTopic: boolean;
  suggestions: string[];
  topic: PlatformAidTopic;
}

interface OpenRouterChatResponse {
  choices?: Array<{
    message?: {
      content?: unknown;
    };
  }>;
  error?: {
    message?: string;
  };
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function ensureSentenceEnding(text: string): string {
  const trimmed = text.trim().replace(/\s+/g, " ");
  if (!trimmed) return "";
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function compressSentenceToWordTarget(sentence: string, maxWords: number): string {
  let next = sentence
    .replace(/\([^)]*\)/g, " ")
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const transforms = [
    (value: string) =>
      value.replace(/,\s+(especially|mainly|including)\b[\s\S]*$/i, ""),
    (value: string) =>
      value.replace(/\s+(because|which|while|where|when|if|so that)\b[\s\S]*$/i, ""),
    (value: string) => value.replace(/,\s*[^,]+$/, ""),
    (value: string) =>
      value.replace(/\s+(with|including|covering|across)\b[\s\S]*$/i, ""),
    (value: string) => value.replace(/\s+(and|but)\s+[^.?!]+$/i, ""),
  ];

  for (const transform of transforms) {
    if (countWords(next) <= maxWords) break;
    const candidate = transform(next).replace(/\s+/g, " ").trim();
    if (candidate && candidate !== next) {
      next = candidate;
    }
  }

  if (countWords(next) <= maxWords) {
    return ensureSentenceEnding(next);
  }

  const words = next.split(/\s+/).filter(Boolean);
  const limit = Math.min(maxWords, words.length);
  let cutIndex = limit;

  for (
    let index = limit;
    index >= Math.max(12, Math.floor(maxWords * 0.65));
    index -= 1
  ) {
    const word = words[index - 1] ?? "";
    if (
      /[,:;]$/.test(word) ||
      /^(and|but|because|which|while|with|including|if|when)$/i.test(word)
    ) {
      cutIndex = Math.max(index - 1, 1);
      break;
    }
  }

  const candidate = words
    .slice(0, cutIndex)
    .join(" ")
    .replace(/[,:;]+$/, "")
    .trim();

  return ensureSentenceEnding(candidate || words.slice(0, limit).join(" "));
}

function clampReplyWords(text: string, maxWords = MAX_REPLY_WORDS): string {
  const normalized = text.trim().replace(/\s+/g, " ");
  if (!normalized) return "";
  if (countWords(normalized) <= maxWords) return ensureSentenceEnding(normalized);

  const sentences = normalized
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  if (sentences.length > 1) {
    const selected: string[] = [];
    let wordsUsed = 0;

    for (const sentence of sentences) {
      const sentenceWords = countWords(sentence);
      if (selected.length === 0 && sentenceWords > maxWords) {
        return compressSentenceToWordTarget(sentence, maxWords);
      }
      if (wordsUsed + sentenceWords > maxWords) break;
      selected.push(ensureSentenceEnding(sentence));
      wordsUsed += sentenceWords;
    }

    if (selected.length > 0) {
      return selected.join(" ");
    }
  }

  return compressSentenceToWordTarget(normalized, maxWords);
}

export function humanizePlatformAidReply(rawText: string): string {
  if (!rawText.trim()) return "";

  let next = rawText
    .replace(/[“”]/g, "\"")
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, ", ")
    .replace(/\s+/g, " ")
    .trim();

  for (const pattern of HUMANIZER_OPENING_PATTERNS) {
    next = next.replace(pattern, "").trim();
  }

  for (let pass = 0; pass < 2; pass += 1) {
    next = next
      .replace(/\bAdditionally\b/gi, "Also")
      .replace(/\bIn order to\b/gi, "To")
      .replace(/\bDue to the fact that\b/gi, "Because")
      .replace(/\bAt this point in time\b/gi, "Now")
      .replace(/\bIt is important to note that\b/gi, "")
      .replace(/\butilize\b/gi, "use")
      .replace(/\bshowcases?\b/gi, "shows")
      .replace(/\bunderscores?\b/gi, "shows")
      .replace(/\btestament to\b/gi, "sign of")
      .replace(/\btransformative\b/gi, "big")
      .replace(/\bpivotal\b/gi, "important")
      .replace(/\bcrucial\b/gi, "important")
      .replace(/\bserves as\b/gi, "is")
      .replace(/\bstands as\b/gi, "is")
      .replace(/\bboasts\b/gi, "has")
      .replace(/\s+([,.;!?])/g, "$1")
      .replace(/([,;!?])([^\s])/g, "$1 $2")
      .replace(/\s{2,}/g, " ")
      .trim();
  }

  const filteredSentences = next
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
    .filter((sentence) => !HUMANIZER_SENTENCE_CUTS.some((pattern) => pattern.test(sentence)));

  next = (filteredSentences.join(" ").trim() || next)
    .replace(/^[,;:\-\s]+/, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  return clampReplyWords(next, MAX_REPLY_WORDS);
}

function normalizeQuestion(question: string): string {
  return question.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function addSuggestion(
  collection: string[],
  seen: Set<string>,
  currentMessage: string,
  history: PlatformAidHistoryEntry[],
  suggestion: string,
): void {
  const trimmed = suggestion.trim();
  if (!trimmed) return;

  const key = normalizeQuestion(trimmed);
  if (!key) return;
  if (key === normalizeQuestion(currentMessage)) return;

  const recentMessages = new Set(
    history
      .filter((entry) => entry.role === "user")
      .slice(-4)
      .map((entry) => normalizeQuestion(entry.content)),
  );

  if (recentMessages.has(key) || seen.has(key)) return;
  seen.add(key);
  collection.push(trimmed);
}

function isLikelyOffTopic(message: string): boolean {
  return OFF_TOPIC_PATTERNS.some((pattern) => pattern.test(message));
}

function detectTopic(message: string, pageId: PlatformAidPageId): PlatformAidTopic {
  const lower = message.toLowerCase();

  if (isLikelyOffTopic(message)) return "off_topic";
  if (/(create|start|first game|new game|wizard)/.test(lower)) return "create_game";
  if (/(publish|public slug|share link|unpublish)/.test(lower)) return "publish_game";
  if (/(library|private|published|reopen)/.test(lower)) return "library";
  if (/(analytics|architecture|mastra|mcp|supabase|bundle pipeline)/.test(lower)) {
    return "analytics";
  }
  if (/(settings|profile|avatar|display name|auth|health card)/.test(lower)) {
    return "settings";
  }
  if (/(openclaw|claim|webhook|api key|heartbeat|import agent|connection test)/.test(lower)) {
    return "openclaw";
  }
  if (/(war room|orchestration|pipeline)/.test(lower)) return "war_room";
  if (/(workspace|feature thread|chat session|editor)/.test(lower)) return "workspace";
  if (/(externals|libraries|atoms|actions console|builds)/.test(lower)) {
    return "externals";
  }
  if (/(token|distribution|launch token)/.test(lower)) return "token";
  if (/(where|navigate|find|route|page|go next)/.test(lower)) return "navigation";
  if (/(dashboard|creations|stats)/.test(lower)) return "dashboard";

  switch (pageId) {
    case "analytics":
      return "analytics";
    case "library":
      return "library";
    case "settings":
      return "settings";
    case "openclaw":
      return "openclaw";
    case "dashboard":
      return "dashboard";
    default:
      return "general";
  }
}

function formatBuildStatus(game: GameWithBuild | null): string | null {
  return game?.active_build?.status ?? null;
}

function createAccountContext(profile: UserProfile | null): PlatformAidAccountContext {
  return {
    displayName: profile?.display_name ?? null,
    email: profile?.email ?? null,
    walletAddress: profile?.wallet_address ?? null,
  };
}

function createGamesContext(userGames: GameWithBuild[]): PlatformAidGamesContext {
  const latestGame =
    [...userGames].sort((left, right) =>
      right.updated_at.localeCompare(left.updated_at),
    )[0] ?? null;

  return {
    totalCount: userGames.length,
    publishedCount: userGames.filter((game) => game.is_published).length,
    latestGame: latestGame
      ? {
          name: latestGame.name,
          href: `/games/${encodeURIComponent(latestGame.name)}`,
          updatedAt: latestGame.updated_at,
          buildStatus: formatBuildStatus(latestGame),
          isPublished: latestGame.is_published,
        }
      : null,
  };
}

function createRouteContext(pageId: PlatformAidPageId): PlatformAidRouteContext {
  return {
    pageId,
    label: PAGE_KNOWLEDGE[pageId].label,
    summary: PAGE_KNOWLEDGE[pageId].summary,
  };
}

function createOpenClawContext(
  agent: OpenClawAgent | null,
  health: OpenClawHealthScore | null,
): PlatformAidOpenClawContext {
  return {
    hasAgent: Boolean(agent),
    agentName: agent?.name ?? null,
    connectionStatus: agent?.connection_status ?? null,
    healthStatus: health?.status ?? null,
    healthScore: health?.score ?? null,
    docsHref: "/openclaw/docs",
  };
}

function buildOffTopicReply(): string {
  return "I stay focused on Atomic Game Maker. Ask about routes, publishing, workspace chat, War Room, OpenClaw, or platform setup.";
}

function buildFallbackReply(
  message: string,
  topic: PlatformAidTopic,
  context: PlatformAidLiveContext,
): string {
  if (topic === "off_topic") {
    return buildOffTopicReply();
  }

  if (context.games.totalCount === 0 && topic !== "openclaw") {
    return clampReplyWords(
      "Start on /dashboard and use Create. The wizard seeds a game shell, then drops you into the workspace for chat edits or a larger War Room run.",
    );
  }

  switch (topic) {
    case "create_game":
      return clampReplyWords(
        "Use the dashboard create flow to generate the starter game, then continue in the workspace. Feature chat handles quick edits, and War Room is for broader multi-agent execution.",
      );
    case "publish_game":
      return clampReplyWords(
        context.games.latestGame
          ? `Open ${context.games.latestGame.name} or the Library, then use Publish to assign a public slug and shareable play route.`
          : "Publishing happens from a game workspace or the Library once you have a game ready.",
      );
    case "library":
      return clampReplyWords(
        "Library is the management surface for owned games. Use it to filter builds, compare private versus published work, reopen a workspace, and move toward publishing.",
      );
    case "analytics":
      return clampReplyWords(
        "Analytics is the platform map. It explains how the web app, Supabase Edge API, Mastra, MCP tools, and bundle pipeline fit together.",
      );
    case "settings":
      return clampReplyWords(
        "Settings covers profile edits and platform runtime details. Update display name or avatar there, then use the health details to inspect platform status.",
      );
    case "openclaw":
      if (!context.openclaw?.hasAgent) {
        return clampReplyWords(
          "OpenClaw starts with the import flow on /openclaw. Generate a claim link, send it to OpenClaw, then come back here for connection health, API keys, and webhooks.",
        );
      }

      return clampReplyWords(
        `${context.openclaw.agentName ?? "Your OpenClaw agent"} is ${
          context.openclaw.connectionStatus ?? "pending"
        }${context.openclaw.healthScore != null ? ` with health ${context.openclaw.healthScore}/100` : ""}. Use /openclaw for connection checks, API keys, and webhook config.`,
      );
    case "war_room":
      return clampReplyWords(
        "War Room is the larger orchestration path inside a game workspace. Use it when the job is broader than a single feature edit and needs multiple agents working in sequence.",
      );
    case "workspace":
      return clampReplyWords(
        "The workspace is where game work happens. Feature chat handles iterative edits, the actions console manages externals and builds, and War Room handles larger coordinated runs.",
      );
    case "externals":
      return clampReplyWords(
        "Externals live in the actions console inside a workspace. Install or manage libraries there before expecting agents to use them in the game.",
      );
    case "token":
      return clampReplyWords(
        "Token support is still a skeleton. You can view draft status and related platform framing, but the full token launch flow is not complete yet.",
      );
    case "navigation":
      return clampReplyWords(
        `Use /dashboard for starting, /library for game management, /analytics for architecture, /settings for profile controls, and /openclaw for agent import and health.`,
      );
    case "dashboard":
      return clampReplyWords(
        "Dashboard is the launch surface. Start games there, review recent creations, and use it as the quickest way into your next workspace session.",
      );
    default:
      return clampReplyWords(
        `${PAGE_KNOWLEDGE[context.route.pageId].label} is the current focus. ${PAGE_KNOWLEDGE[context.route.pageId].summary}`,
      );
  }
}

function buildActions(
  topic: PlatformAidTopic,
  context: PlatformAidLiveContext,
): PlatformAidAction[] {
  const actions: PlatformAidAction[] = [];
  const seen = new Set<string>();

  const addAction = (label: string, href: string) => {
    if (!label || !href || seen.has(href)) return;
    seen.add(href);
    actions.push({ label, href });
  };

  if (topic === "openclaw" || context.route.pageId === "openclaw") {
    addAction("Open OpenClaw", "/openclaw");
    addAction("Open Docs", "/openclaw/docs");
    return actions.slice(0, 2);
  }

  if (context.games.totalCount === 0) {
    addAction("Create Game", "/dashboard?aid=create");
    addAction("Open Library", "/library");
    return actions.slice(0, 2);
  }

  if (
    (topic === "publish_game" || context.games.publishedCount === 0) &&
    context.games.latestGame
  ) {
    addAction(`Open ${context.games.latestGame.name}`, context.games.latestGame.href);
    addAction("Open Library", "/library");
    return actions.slice(0, 2);
  }

  if (topic === "analytics") {
    addAction("Open Analytics", "/analytics");
    if (context.games.latestGame) {
      addAction(`Open ${context.games.latestGame.name}`, context.games.latestGame.href);
    }
    return actions.slice(0, 2);
  }

  if (topic === "settings") {
    addAction("Open Settings", "/settings");
    if (context.games.latestGame) {
      addAction(`Open ${context.games.latestGame.name}`, context.games.latestGame.href);
    }
    return actions.slice(0, 2);
  }

  if (topic === "create_game") {
    addAction("Create Game", "/dashboard?aid=create");
    addAction("Open Library", "/library");
    return actions.slice(0, 2);
  }

  if (context.games.latestGame) {
    addAction(`Open ${context.games.latestGame.name}`, context.games.latestGame.href);
  }
  addAction("Open Library", "/library");

  return actions.slice(0, 2);
}

function buildSuggestions(
  message: string,
  topic: PlatformAidTopic,
  context: PlatformAidLiveContext,
  history: PlatformAidHistoryEntry[],
): string[] {
  const suggestions: string[] = [];
  const seen = new Set<string>();

  if (context.route.pageId === "openclaw" && !context.openclaw?.hasAgent) {
    addSuggestion(
      suggestions,
      seen,
      message,
      history,
      "What does the OpenClaw claim flow do?",
    );
    addSuggestion(
      suggestions,
      seen,
      message,
      history,
      "What are OpenClaw API keys and webhooks for?",
    );
  } else if (context.route.pageId === "openclaw" && context.openclaw?.hasAgent) {
    addSuggestion(
      suggestions,
      seen,
      message,
      history,
      "What does the OpenClaw health score measure?",
    );
    addSuggestion(
      suggestions,
      seen,
      message,
      history,
      "When should I run a connection test?",
    );
  }

  if (context.games.totalCount === 0 && context.route.pageId !== "openclaw") {
    addSuggestion(
      suggestions,
      seen,
      message,
      history,
      "What happens after the create wizard finishes?",
    );
    addSuggestion(
      suggestions,
      seen,
      message,
      history,
      "When should I use War Room instead of normal chat?",
    );
    addSuggestion(
      suggestions,
      seen,
      message,
      history,
      "Where do externals and builds live?",
    );
    return suggestions.slice(0, 3);
  }

  if (context.games.totalCount > 0 && context.games.publishedCount === 0) {
    addSuggestion(
      suggestions,
      seen,
      message,
      history,
      "How do I publish my latest game?",
    );
    addSuggestion(
      suggestions,
      seen,
      message,
      history,
      "What is the fastest way back into my workspace?",
    );
  }

  switch (topic) {
    case "create_game":
      addSuggestion(
        suggestions,
        seen,
        message,
        history,
        "What should I do after creating a game?",
      );
      addSuggestion(
        suggestions,
        seen,
        message,
        history,
        "When should I use War Room instead of normal chat?",
      );
      break;
    case "publish_game":
      addSuggestion(
        suggestions,
        seen,
        message,
        history,
        "Where do I reopen my latest game?",
      );
      addSuggestion(
        suggestions,
        seen,
        message,
        history,
        "How do private and published games differ?",
      );
      break;
    case "analytics":
      addSuggestion(
        suggestions,
        seen,
        message,
        history,
        "What does Mastra handle in this platform?",
      );
      addSuggestion(
        suggestions,
        seen,
        message,
        history,
        "How do the MCP tools fit into the stack?",
      );
      break;
    case "settings":
      addSuggestion(
        suggestions,
        seen,
        message,
        history,
        "What can I change in Settings?",
      );
      addSuggestion(
        suggestions,
        seen,
        message,
        history,
        "What do the health cards mean?",
      );
      break;
    case "openclaw":
      addSuggestion(
        suggestions,
        seen,
        message,
        history,
        "How do I import OpenClaw?",
      );
      addSuggestion(
        suggestions,
        seen,
        message,
        history,
        "What does the claim flow do?",
      );
      break;
    case "library":
      addSuggestion(
        suggestions,
        seen,
        message,
        history,
        "How do I reopen a game workspace?",
      );
      addSuggestion(
        suggestions,
        seen,
        message,
        history,
        "Where do I publish a game from?",
      );
      break;
    default:
      break;
  }

  for (const fallback of PAGE_KNOWLEDGE[context.route.pageId].suggestions) {
    addSuggestion(suggestions, seen, message, history, fallback);
  }

  return suggestions.slice(0, 3);
}

export function buildPlatformAidArtifacts(input: {
  message: string;
  history: PlatformAidHistoryEntry[];
  context: PlatformAidLiveContext;
}): PlatformAidArtifacts {
  const topic = detectTopic(input.message, input.context.route.pageId);
  const offTopic = topic === "off_topic";
  const fallbackReply = buildFallbackReply(input.message, topic, input.context);
  const suggestions = buildSuggestions(
    input.message,
    topic,
    input.context,
    input.history,
  );
  const actions = buildActions(topic, input.context);

  return {
    actions,
    fallbackReply,
    offTopic,
    suggestions,
    topic,
  };
}

function emitSse(
  writer: WritableStreamDefaultWriter<Uint8Array>,
  encoder: TextEncoder,
  payload: Record<string, unknown>,
) {
  return writer.write(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
}

function emitReplyTokens(
  writer: WritableStreamDefaultWriter<Uint8Array>,
  encoder: TextEncoder,
  reply: string,
) {
  const chunks = reply.match(/\S+\s*/g) ?? [reply];
  return Promise.all(
    chunks.map((chunk) => emitSse(writer, encoder, { type: "token", token: chunk })),
  );
}

function extractOpenRouterText(content: unknown): string {
  if (typeof content === "string") {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content
      .flatMap((part) => {
        if (!part || typeof part !== "object") return [];
        const record = part as Record<string, unknown>;
        if (typeof record.text === "string") return [record.text];
        if (typeof record.content === "string") return [record.content];
        return [];
      })
      .join(" ")
      .trim();
  }

  return "";
}

function buildSystemPrompt(
  context: PlatformAidLiveContext,
  artifacts: PlatformAidArtifacts,
): string {
  return [
    "You are Atomic Aid Agent, the platform aide inside Atomic Game Maker.",
    "Scope is platform-only: dashboard, library, analytics, settings, OpenClaw, workspace chat, War Room, externals, publishing, and token skeleton status.",
    "Never answer unrelated general knowledge. Redirect off-topic requests in one short sentence.",
    "Never say you are an AI or language model.",
    "Keep every response under 60 words and end with complete sentences.",
    "No markdown bullets. No em dashes. No canned praise. No filler closers.",
    "Use route names when useful: /dashboard, /library, /analytics, /settings, /openclaw, /openclaw/docs.",
    "If the user has no games, steer them to the create-game flow.",
    "If the user has games but none published, steer them toward library and publish flow.",
    "If OpenClaw is relevant and there is no agent, explain import and claim flow.",
    "If OpenClaw is connected, explain health, API keys, webhooks, and connection testing.",
    `Current page: ${context.route.label} (${context.route.pageId}).`,
    `Current topic: ${artifacts.topic}.`,
    PLATFORM_KNOWLEDGE,
    `Page knowledge: ${PAGE_KNOWLEDGE[context.route.pageId].knowledge}`,
    "After your reply, on a new line write FOLLOWUP: followed by 2 or 3 short follow-up questions the user might ask next, separated by |. These must relate to your reply content. Example: FOLLOWUP: How do I publish my game?|What is War Room used for?",
  ].join("\n");
}

function buildUserPrompt(
  message: string,
  context: PlatformAidLiveContext,
  artifacts: PlatformAidArtifacts,
): string {
  return [
    `User request: ${message}`,
    "Live context is attached below. Use it directly and do not invent product state.",
    `Fallback answer if needed: ${artifacts.fallbackReply}`,
    `Live context JSON: ${JSON.stringify(context)}`,
  ].join("\n\n");
}

function extractDynamicSuggestions(rawText: string): {
  reply: string;
  dynamicSuggestions: string[];
} {
  const followupMatch = rawText.match(/\n?\s*FOLLOWUP:\s*(.+)$/i);
  if (!followupMatch) {
    return { reply: rawText, dynamicSuggestions: [] };
  }

  const reply = rawText.slice(0, followupMatch.index).trim();
  const dynamicSuggestions = followupMatch[1]
    .split("|")
    .map((s) => s.trim())
    .filter((s) => s.length > 5 && s.length < 120);

  return { reply, dynamicSuggestions: dynamicSuggestions.slice(0, 3) };
}

async function generateModelReply(input: {
  message: string;
  history: PlatformAidHistoryEntry[];
  context: PlatformAidLiveContext;
  artifacts: PlatformAidArtifacts;
}): Promise<{ model: string; reply: string; dynamicSuggestions: string[] }> {
  const apiKey = Deno.env.get("OPENROUTER_API_KEY");
  if (!apiKey || input.artifacts.offTopic) {
    return { model: "fallback", reply: input.artifacts.fallbackReply, dynamicSuggestions: [] };
  }

  const response = await fetch(OPENROUTER_CHAT_COMPLETIONS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer":
        Deno.env.get("OPENROUTER_SITE_URL") ?? "https://atomic-coding.local",
      "X-Title":
        Deno.env.get("OPENROUTER_APP_NAME") ?? "Atomic Coding Platform Aid",
    },
    body: JSON.stringify({
      model: PLATFORM_AID_MODEL,
      temperature: 0.35,
      max_tokens: 250,
      messages: [
        {
          role: "system",
          content: buildSystemPrompt(input.context, input.artifacts),
        },
        ...input.history.map((entry) => ({
          role: entry.role,
          content: entry.content,
        })),
        {
          role: "user",
          content: buildUserPrompt(
            input.message,
            input.context,
            input.artifacts,
          ),
        },
      ],
    }),
  });

  const payload = (await response.json().catch(() => ({}))) as OpenRouterChatResponse;
  if (!response.ok) {
    return { model: "fallback", reply: input.artifacts.fallbackReply, dynamicSuggestions: [] };
  }

  const rawContent =
    extractOpenRouterText(payload.choices?.[0]?.message?.content) ||
    input.artifacts.fallbackReply;

  const { reply: replyText, dynamicSuggestions } = extractDynamicSuggestions(rawContent);

  const reply = clampReplyWords(replyText, MAX_RAW_REPLY_WORDS);

  return {
    model: PLATFORM_AID_MODEL,
    reply,
    dynamicSuggestions,
  };
}

async function buildLiveContext(
  userId: string,
  pageId: PlatformAidPageId,
  message: string,
): Promise<PlatformAidLiveContext> {
  const [profile, userGames] = await Promise.all([
    users.getUserProfile(userId),
    games.listGamesByUser(userId),
  ]);

  const context: PlatformAidLiveContext = {
    account: createAccountContext(profile),
    games: createGamesContext(userGames),
    route: createRouteContext(pageId),
  };

  const topic = detectTopic(message, pageId);
  if (pageId === "openclaw" || topic === "openclaw") {
    const agent = await openclaw.getCurrentAgent(userId);
    let health: OpenClawHealthScore | null = null;

    if (agent) {
      try {
        health = await openclaw.computeOpenClawHealthScore(userId);
      } catch {
        health = null;
      }
    }

    context.openclaw = createOpenClawContext(agent, health);
  }

  return context;
}

export async function streamPlatformAidChatResponse(
  userId: string,
  body: PlatformAidRequestBody,
): Promise<Response> {
  const stream = new TransformStream<Uint8Array, Uint8Array>();
  const writer = stream.writable.getWriter();
  const encoder = new TextEncoder();
  const startedAt = Date.now();

  const run = async () => {
    try {
      await emitSse(writer, encoder, {
        type: "trace",
        key: "account",
        label: "Account",
        status: "Loading account context",
      });
      await emitSse(writer, encoder, {
        type: "trace",
        key: "games",
        label: "Games",
        status: "Loading game context",
      });

      const context = await buildLiveContext(
        userId,
        body.clientContext.pageId,
        body.message,
      );

      await emitSse(writer, encoder, {
        type: "trace",
        key: "account",
        label: "Account",
        status: "Account context ready",
        state: "done",
      });
      await emitSse(writer, encoder, {
        type: "context",
        kind: "account",
        data: context.account,
      });

      await emitSse(writer, encoder, {
        type: "trace",
        key: "games",
        label: "Games",
        status: "Game context ready",
        state: "done",
      });
      await emitSse(writer, encoder, {
        type: "context",
        kind: "games",
        data: context.games,
      });

      await emitSse(writer, encoder, {
        type: "trace",
        key: "route",
        label: "Route",
        status: "Current page context ready",
        state: "done",
      });
      await emitSse(writer, encoder, {
        type: "context",
        kind: "route",
        data: context.route,
      });

      if (context.openclaw) {
        await emitSse(writer, encoder, {
          type: "trace",
          key: "openclaw",
          label: "OpenClaw",
          status: context.openclaw.hasAgent
            ? "OpenClaw status ready"
            : "No claimed OpenClaw agent found",
          state: "done",
        });
        await emitSse(writer, encoder, {
          type: "context",
          kind: "openclaw",
          data: context.openclaw,
        });
      }

      await emitSse(writer, encoder, {
        type: "trace",
        key: "reply",
        label: "Atomic Aid Agent",
        status: "Drafting answer",
      });

      const artifacts = buildPlatformAidArtifacts({
        message: body.message,
        history: body.history ?? [],
        context,
      });

      const generated = await generateModelReply({
        message: body.message,
        history: body.history ?? [],
        context,
        artifacts,
      });

      const reply =
        humanizePlatformAidReply(generated.reply) ||
        humanizePlatformAidReply(artifacts.fallbackReply) ||
        buildOffTopicReply();

      await emitSse(writer, encoder, {
        type: "trace",
        key: "reply",
        label: "Atomic Aid Agent",
        status: "Answer ready",
        state: "done",
      });

      // Build final suggestions: dynamic from reply (2-3) + 1 platform static
      const finalSuggestions: string[] = [];
      const seenKeys = new Set<string>();
      const msgKey = normalizeQuestion(body.message);

      for (const ds of generated.dynamicSuggestions) {
        const key = normalizeQuestion(ds);
        if (key && key !== msgKey && !seenKeys.has(key)) {
          seenKeys.add(key);
          finalSuggestions.push(ds);
        }
      }

      // Add 1 platform feature suggestion if we have room
      for (const ps of artifacts.suggestions) {
        if (finalSuggestions.length >= 3) break;
        const key = normalizeQuestion(ps);
        if (key && !seenKeys.has(key)) {
          seenKeys.add(key);
          finalSuggestions.push(ps);
          break;
        }
      }

      await emitReplyTokens(writer, encoder, reply);
      await emitSse(writer, encoder, {
        type: "done",
        reply,
        latencyMs: Date.now() - startedAt,
        model: generated.model,
        suggestions: finalSuggestions.slice(0, 3),
        actions: artifacts.actions,
        contexts: context,
      });
    } catch (error) {
      await emitSse(writer, encoder, {
        type: "error",
        error:
          error instanceof Error
            ? error.message
            : "Unable to reach Atomic Aid Agent right now.",
      });
    } finally {
      await writer.close();
    }
  };

  void run();

  return new Response(stream.readable, {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream; charset=utf-8",
    },
  });
}
