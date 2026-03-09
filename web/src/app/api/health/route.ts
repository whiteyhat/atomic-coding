import { NextResponse } from "next/server";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;

export async function GET() {
  const checks: Record<string, "ok" | "error"> = {
    web: "ok",
    supabase: "error",
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

  const allHealthy = Object.values(checks).every((v) => v === "ok");

  return NextResponse.json(
    { status: allHealthy ? "ok" : "degraded", checks },
    { status: allHealthy ? 200 : 503 },
  );
}
