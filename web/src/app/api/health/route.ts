import { NextResponse } from "next/server";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "";
const MASTRA_SERVER_URL = process.env.MASTRA_SERVER_URL ?? "";

function toHost(value?: string | null): string | null {
  if (!value) return null;

  try {
    return new URL(value).host;
  } catch {
    return null;
  }
}

export async function GET() {
  const checks: {
    web: "ok";
    supabase: "ok" | "error";
    mastra: "ok" | "error" | "not_configured";
  } = {
    web: "ok",
    supabase: "error",
    mastra: "not_configured",
  };

  // Check Supabase connectivity
  if (SUPABASE_URL) {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/`, {
        method: "HEAD",
        headers: {
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
        },
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok || res.status === 400) {
        checks.supabase = "ok";
      }
    } catch {
      // Leave as error
    }
  }

  if (MASTRA_SERVER_URL) {
    try {
      const res = await fetch(`${MASTRA_SERVER_URL}/health`, {
        method: "GET",
        signal: AbortSignal.timeout(5000),
      });

      if (res.ok) {
        checks.mastra = "ok";
      } else {
        checks.mastra = "error";
      }
    } catch {
      checks.mastra = "error";
    }
  }

  const allHealthy =
    checks.web === "ok" &&
    checks.supabase === "ok" &&
    (checks.mastra === "ok" || checks.mastra === "not_configured");

  const payload = {
    status: allHealthy ? "ok" : "degraded",
    checks,
    config: {
      apiBaseHost: SUPABASE_URL ? `${toHost(SUPABASE_URL) ?? "Unavailable"}` : "Unavailable",
      supabaseHost: toHost(SUPABASE_URL),
      mastraHost: toHost(MASTRA_SERVER_URL),
      privyConfigured: Boolean(PRIVY_APP_ID),
      mastraConfigured: Boolean(MASTRA_SERVER_URL),
    },
  };

  return NextResponse.json(
    payload,
    { status: allHealthy ? 200 : 503 },
  );
}
