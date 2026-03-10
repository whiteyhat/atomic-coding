import { log } from "../_shared/logger.ts";

/**
 * War Room Orchestrator Edge Function
 *
 * Thin trigger that forwards pipeline execution to the Mastra server.
 * Called fire-and-forget by the API when a war room is created.
 *
 * POST body: { war_room_id: string }
 */

const MASTRA_SERVER_URL = Deno.env.get("MASTRA_SERVER_URL") ?? "";

Deno.serve(async (req: Request) => {
  const allowedOrigins = (Deno.env.get("ALLOWED_ORIGINS") || "*")
    .split(",").map((o: string) => o.trim());
  const reqOrigin = req.headers.get("Origin") || "";
  const origin = allowedOrigins.includes("*") ? "*"
    : allowedOrigins.includes(reqOrigin) ? reqOrigin
    : allowedOrigins[0];
  const corsHeaders: Record<string, string> = {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    ...(origin !== "*" ? { Vary: "Origin" } : {}),
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const warRoomId: string | undefined = body.war_room_id;

    if (!warRoomId) {
      return new Response(
        JSON.stringify({ error: "war_room_id is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (!MASTRA_SERVER_URL) {
      return new Response(
        JSON.stringify({ error: "MASTRA_SERVER_URL is not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    log("info", "warroom-orchestrator: forwarding to Mastra", { warRoomId });

    const response = await fetch(`${MASTRA_SERVER_URL}/pipeline/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ war_room_id: warRoomId }),
    });

    const result = await response.json().catch(() => ({}));

    log("info", "warroom-orchestrator: Mastra responded", {
      warRoomId,
      status: response.status,
    });

    return new Response(JSON.stringify(result), {
      status: response.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    log("error", "warroom-orchestrator: failed", {
      error: (err as Error).message,
    });
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
