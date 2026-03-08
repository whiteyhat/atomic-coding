import { Hono } from "hono";
import { createUIMessageStream, createUIMessageStreamResponse } from "ai";
import { toAISdkStream } from "@mastra/ai-sdk";
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
  const { messages, gameId, gameName, genre } = body;

  if (!messages || !Array.isArray(messages)) {
    return c.json({ error: "messages array is required" }, 400);
  }

  const jarvis = mastra.getAgent("jarvis");
  const gameContext = gameId
    ? `\n\n## Current Game\n- **Game ID (UUID)**: \`${gameId}\`\n- **Game Name**: \`${gameName ?? "unknown"}\`\nAlways use the Game ID above when calling tools (get-code-structure, read-atoms, upsert-atom).`
    : "";
  const instructions = SYSTEM_PROMPT + getGenreContext(genre ?? null) + gameContext;

  console.log("[chat] streaming with jarvis", {
    messageCount: messages.length,
    gameId,
    genre,
  });

  try {
    const stream = await jarvis.stream(messages, {
      instructions,
      maxSteps: 30,
    });

    // Convert Mastra stream to AI SDK UI message stream protocol.
    // This preserves tool calls, tool results, and step boundaries.
    const uiMessageStream = createUIMessageStream({
      originalMessages: messages,
      execute: async ({ writer }) => {
        for await (const part of toAISdkStream(stream, { from: "agent" })) {
          writer.write(part as Parameters<typeof writer.write>[0]);
        }
      },
    });

    return createUIMessageStreamResponse({ stream: uiMessageStream });
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
