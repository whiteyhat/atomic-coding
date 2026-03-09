import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { syncAllLiveTokens } from "../_shared/services/curve-sync.ts";
import { log } from "../_shared/logger.ts";

/**
 * Curve Sync Cron Edge Function
 *
 * Syncs all live bonding curve tokens with Jupiter pool data.
 * Designed to be triggered by pg_cron or an external scheduler every 30s.
 */

Deno.serve(async (req: Request) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    log("info", "curve-sync-cron: starting sync");
    await syncAllLiveTokens();
    log("info", "curve-sync-cron: sync complete");

    return new Response(
      JSON.stringify({ status: "ok" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    log("error", "curve-sync-cron: failed", { error: (err as Error).message });
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
