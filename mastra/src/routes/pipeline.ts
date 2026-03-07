import { Hono } from "hono";
import { runPipeline } from "../pipeline/orchestrator.js";

const app = new Hono();

/**
 * POST /pipeline/run
 *
 * Trigger the 12-task war room pipeline. Runs asynchronously
 * (fire-and-forget) and returns immediately.
 *
 * Body: { war_room_id: string }
 */
app.post("/run", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const warRoomId: string | undefined = body.war_room_id;

  if (!warRoomId) {
    return c.json({ error: "war_room_id is required" }, 400);
  }

  console.log("[pipeline] starting pipeline", { warRoomId });

  // Fire-and-forget: start pipeline in background
  runPipeline(warRoomId).catch((err) => {
    console.error("[pipeline] fatal error", {
      warRoomId,
      error: (err as Error).message,
    });
  });

  return c.json({ status: "started", war_room_id: warRoomId });
});

export { app as pipelineRoutes };
