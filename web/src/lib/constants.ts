// ── API ───────────────────────────────────────────────────────────────────────

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

// ── Solana ────────────────────────────────────────────────────────────────────

export const SOLANA_RPC_URL =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ??
  "https://api.mainnet-beta.solana.com";

export const SOLANA_NETWORK =
  process.env.NEXT_PUBLIC_SOLANA_NETWORK ?? "mainnet-beta";

export const JUPITER_API_URL =
  process.env.NEXT_PUBLIC_JUPITER_API_URL ?? "https://datapi.jup.ag";
