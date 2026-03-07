import { Hono } from "hono";
import { mastra } from "../mastra.js";
import {
  SYSTEM_PROMPT,
  getGenreContext,
} from "../lib/system-prompt.js";

const app = new Hono();

/**
 * POST /chat/stream
 *
 * Streaming chat with the Jarvis agent. Accepts messages in OpenAI-compatible
 * format and returns an SSE stream.
 *
 * Body: {
 *   messages: { role: string, content: string }[],
 *   gameId: string,
 *   gameName: string,
 *   genre?: string,
 *   sessionId?: string,
 * }
 */
app.post("/stream", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { messages, genre } = body;

  if (!messages || !Array.isArray(messages)) {
    return c.json({ error: "messages array is required" }, 400);
  }

  const jarvis = mastra.getAgent("jarvis");
  const instructions = SYSTEM_PROMPT + getGenreContext(genre ?? null);

  console.log("[chat] streaming with jarvis", {
    messageCount: messages.length,
    genre,
  });

  try {
    const stream = await jarvis.stream(messages, {
      instructions,
      maxSteps: 30,
    });

    // Return the text stream as SSE
    return new Response(stream.textStream as ReadableStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    console.error("[chat] stream error:", err);
    return c.json(
      { error: (err as Error).message ?? "Stream error" },
      500
    );
  }
});

/**
 * POST /chat/generate
 *
 * Non-streaming chat with any agent. Returns the full response.
 *
 * Body: {
 *   agent: string,        // "jarvis" | "forge" | "pixel" | "checker"
 *   messages: { role: string, content: string }[],
 *   instructions?: string,
 * }
 */
app.post("/generate", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { agent: agentId, messages, instructions } = body;

  if (!agentId || !messages) {
    return c.json({ error: "agent and messages are required" }, 400);
  }

  try {
    const agent = mastra.getAgent(agentId);
    const result = await agent.generate(messages, {
      ...(instructions ? { instructions } : {}),
      maxSteps: 10,
    });

    return c.json({
      text: result.text,
      usage: result.usage,
    });
  } catch (err) {
    console.error("[chat] generate error:", err);
    return c.json(
      { error: (err as Error).message ?? "Generate error" },
      500
    );
  }
});

export { app as chatRoutes };
