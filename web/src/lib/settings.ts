import {
  API_BASE,
  APP_DESCRIPTION,
  APP_NAME,
  ARCHITECTURE_DOC_URL,
  DEPLOYMENTS_DOC_URL,
  LOCAL_DEV_DOC_URL,
  MODELS,
  SUPABASE_URL,
} from "./constants";
import type { AppHealthStatus, HealthCheckStatus } from "./types";

export interface SettingsDocLink {
  href: string;
  label: string;
  description: string;
}

export interface SettingsPlatformItem {
  label: string;
  value: string;
  description: string;
}

export interface SettingsHealthItem {
  key: string;
  label: string;
  status: HealthCheckStatus;
  description: string;
}

export const SETTINGS_DOC_LINKS: SettingsDocLink[] = [
  {
    href: ARCHITECTURE_DOC_URL,
    label: "System architecture",
    description: "Runtime source of truth for the current platform layout.",
  },
  {
    href: LOCAL_DEV_DOC_URL,
    label: "Local development",
    description: "Setup, auth bypass, and local verification workflow.",
  },
  {
    href: DEPLOYMENTS_DOC_URL,
    label: "Deployments",
    description: "Railway and Supabase deployment steps.",
  },
];

function getHost(value: string | null | undefined): string | null {
  if (!value) return null;

  try {
    return new URL(value).host;
  } catch {
    return null;
  }
}

export function buildSettingsPlatformItems(
  health: AppHealthStatus | null,
): SettingsPlatformItem[] {
  const config = health?.config;
  const apiBaseHost = config?.apiBaseHost ?? getHost(API_BASE) ?? "Unavailable";
  const supabaseHost = config?.supabaseHost ?? getHost(SUPABASE_URL) ?? "Unavailable";

  return [
    {
      label: "Application",
      value: APP_NAME,
      description: APP_DESCRIPTION,
    },
    {
      label: "API base",
      value: apiBaseHost,
      description: "Supabase Edge API host serving the product state boundary.",
    },
    {
      label: "Supabase",
      value: supabaseHost,
      description: "Primary database, storage, and realtime host.",
    },
    {
      label: "Mastra",
      value: config?.mastraConfigured
        ? config.mastraHost ?? "Configured"
        : "Not configured",
      description: config?.mastraConfigured
        ? "Agent orchestration endpoint for chat and pipeline execution."
        : "Local fallback agent flow remains available when Mastra is unset.",
    },
    {
      label: "Privy",
      value: config?.privyConfigured ? "Configured" : "Not configured",
      description: "Authentication provider for creator sign-in and wallet identity.",
    },
    {
      label: "Supported models",
      value: MODELS.map((model) => model.name).join(", "),
      description: "Models currently exposed in the creator UI.",
    },
  ];
}

export function buildSettingsHealthItems(
  health: AppHealthStatus | null,
): SettingsHealthItem[] {
  if (!health) {
    return [
      {
        key: "web",
        label: "Web app",
        status: "error",
        description: "Health status is unavailable right now.",
      },
      {
        key: "supabase",
        label: "Supabase",
        status: "error",
        description: "Health status is unavailable right now.",
      },
      {
        key: "mastra",
        label: "Mastra",
        status: "error",
        description: "Health status is unavailable right now.",
      },
    ];
  }

  return [
    {
      key: "web",
      label: "Web app",
      status: health.checks.web,
      description: "Next.js UI runtime and internal app routes.",
    },
    {
      key: "supabase",
      label: "Supabase",
      status: health.checks.supabase,
      description: "Database and Edge API reachability.",
    },
    {
      key: "mastra",
      label: "Mastra",
      status: health.checks.mastra,
      description: health.config.mastraConfigured
        ? "Agent orchestration service reachability."
        : "Optional orchestration service is not configured in this environment.",
    },
  ];
}
