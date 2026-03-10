// ── API ───────────────────────────────────────────────────────────────────────

export const APP_NAME = "Atomic Game Maker";
export const APP_DESCRIPTION = "Build Phaser and Three.js games with AI agents";
export const GITHUB_REPO_URL = "https://github.com/Buu-AI/atomic-coding";
export const ARCHITECTURE_DOC_URL = `${GITHUB_REPO_URL}/blob/master/docs/system-architecture.md`;
export const LOCAL_DEV_DOC_URL = `${GITHUB_REPO_URL}/blob/master/docs/local-development.md`;
export const DEPLOYMENTS_DOC_URL = `${GITHUB_REPO_URL}/blob/master/docs/deployments.md`;

export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  "https://dhnwlfbvyffmnnkqtcdw.supabase.co";

export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const API_BASE = `${SUPABASE_URL}/functions/v1/api`;

// ── Auth ──────────────────────────────────────────────────────────────────────

export const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "";

// ── Mastra ───────────────────────────────────────────────────────────────────

export const MASTRA_SERVER_URL = process.env.MASTRA_SERVER_URL ?? "";

// ── Models ────────────────────────────────────────────────────────────────────

export interface ModelOption {
  id: string;
  name: string;
  provider: string;
  icon: string;
}

export const MODELS: ModelOption[] = [
  {
    id: "google/gemini-3-pro-preview",
    name: "Gemini 3 Pro",
    provider: "Google",
    icon: "https://registry.npmmirror.com/@lobehub/icons-static-png/1.75.0/files/dark/gemini-color.png",
  },
  {
    id: "anthropic/claude-opus-4.6",
    name: "Claude Opus 4.6",
    provider: "Anthropic",
    icon: "https://upload.wikimedia.org/wikipedia/commons/b/b0/Claude_AI_symbol.svg",
  },
];

export const DEFAULT_MODEL = MODELS[0].id;
