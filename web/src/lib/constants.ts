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

export const CLERK_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";

// ── Buu ──────────────────────────────────────────────────────────────────────

export const BUU_API_URL =
  process.env.NEXT_PUBLIC_BUU_API_URL ?? "https://dev.api.buu.fun";

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
    id: "google/gemini-3.1-pro-preview",
    name: "Gemini 3.1 Pro",
    provider: "Google",
    icon: "https://registry.npmmirror.com/@lobehub/icons-static-png/1.75.0/files/dark/gemini-color.png",
  },
];

export const DEFAULT_MODEL = MODELS[0].id;
