import { createAgentUIStreamResponse } from "ai";
import type { UIMessage } from "ai";
import { createAtomicAgent } from "@/lib/agent";
import { DEFAULT_MODEL } from "@/lib/constants";
import { getChatMessages, getGame, createWarRoom } from "@/lib/api";
import { verifyAuthToken } from "@/lib/auth";
import {
  streamOpenClawChat,
  isOpenClawConfigured,
  type OpenClawMessage,
} from "@/lib/openclaw-client";
import { SYSTEM_PROMPT, getGenreContext } from "@/lib/system-prompt";

export const maxDuration = 120;

export async function POST(req: Request) {
  // Verify authentication
  const authUser = await verifyAuthToken(req);
  if (!authUser) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const body = await req.json();
  const { messages, model, gameId, sessionId } = body;

  const selectedModel = model ?? DEFAULT_MODEL;

  console.log("[chat] POST request", {
    model: selectedModel,
    gameId,
    sessionId,
    userId: authUser.userId,
    clientMessageCount: messages?.length ?? 0,
    useOpenClaw: isOpenClawConfigured(),
  });

  // Fetch game to get genre for system prompt context
  let genre: string | null = null;
  if (body.gameName) {
    try {
      const game = await getGame(body.gameName);
      genre = game?.genre ?? null;
    } catch {
      // Continue without genre context
    }
  }

  // ── War Room Mode ─────────────────────────────────────────────────────────
  // When explicitly requested via war_room flag, create a war room and return
  // its ID so the frontend can switch to the war room view.
  if (body.war_room && isOpenClawConfigured() && body.gameName) {
    return handleWarRoomCreation(body, gameId, genre, authUser.userId);
  }

  // ── OpenClaw Gateway Mode ──────────────────────────────────────────────────
  // When the OpenClaw gateway is configured, proxy through it for multi-agent.
  // Otherwise, fall back to the local Vercel AI SDK agent.
  if (isOpenClawConfigured()) {
    return handleOpenClawProxy(body, gameId, genre, sessionId);
  }

  // ── Local Agent Mode (fallback) ────────────────────────────────────────────

  // Build the full conversation from DB + new client messages
  let uiMessages: UIMessage[] = messages ?? [];

  if (sessionId) {
    try {
      const dbMessages = await getChatMessages(
        body.gameName ?? "",
        sessionId
      );

      if (dbMessages.length > 0) {
        const dbUIMessages: UIMessage[] = dbMessages.map((m) => ({
          id: m.message_id,
          role: m.role as "user" | "assistant",
          parts: m.parts as UIMessage["parts"],
        }));

        const dbIds = new Set(dbMessages.map((m) => m.message_id));
        const newFromClient = (messages ?? []).filter(
          (m: UIMessage) => !dbIds.has(m.id)
        );

        uiMessages = [...dbUIMessages, ...newFromClient];
        console.log("[chat] Loaded history from DB", {
          dbCount: dbMessages.length,
          newFromClient: newFromClient.length,
          total: uiMessages.length,
        });
      }
    } catch (err) {
      console.warn("[chat] Failed to load session history, using client messages:", err);
    }
  }

  const { agent, cleanup } = await createAtomicAgent(selectedModel, gameId, genre);
  console.log("[chat] Agent created, starting stream");

  const response = await createAgentUIStreamResponse({
    agent,
    uiMessages,
  });

  // Pipe through a pass-through so we can clean up MCP clients
  // only AFTER the stream is fully consumed by the client.
  const originalBody = response.body!;
  const transform = new TransformStream();

  originalBody.pipeTo(transform.writable).then(
    () => {
      console.log("[chat] Stream finished, closing MCP clients...");
      cleanup().then(() => console.log("[chat] MCP clients closed"));
    },
    (err: unknown) => {
      console.error("[chat] Stream error:", err);
      cleanup().then(() =>
        console.log("[chat] MCP clients closed after error")
      );
    }
  );

  return new Response(transform.readable, {
    headers: response.headers,
    status: response.status,
  });
}

/**
 * Proxy the chat request through the OpenClaw gateway.
 * Converts UI messages to OpenAI-compatible format and streams back.
 */
async function handleOpenClawProxy(
  body: Record<string, unknown>,
  gameId: string,
  genre: string | null,
  sessionId: string | null
): Promise<Response> {
  const messages = body.messages as UIMessage[] | undefined;

  // Convert UIMessage parts to plain text for OpenAI-compatible format
  const openClawMessages: OpenClawMessage[] = [
    {
      role: "system",
      content: SYSTEM_PROMPT + getGenreContext(genre),
    },
  ];

  for (const msg of messages ?? []) {
    const textParts = msg.parts
      ?.filter((p): p is { type: "text"; text: string } => p.type === "text")
      .map((p) => p.text)
      .join("\n");

    if (textParts) {
      openClawMessages.push({
        role: msg.role as "user" | "assistant",
        content: textParts,
      });
    }
  }

  console.log("[chat:openclaw] Proxying to gateway", {
    messageCount: openClawMessages.length,
    gameId,
    genre,
  });

  try {
    const stream = await streamOpenClawChat({
      messages: openClawMessages,
      gameId,
      gameName: (body.gameName as string) ?? "",
      genre,
      sessionId,
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    console.error("[chat:openclaw] Gateway error:", err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "OpenClaw gateway error",
      }),
      {
        status: 502,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

/**
 * Create a War Room for multi-agent orchestration.
 * Returns the war room ID + tasks so the frontend switches to war room view.
 */
async function handleWarRoomCreation(
  body: Record<string, unknown>,
  gameId: string,
  genre: string | null,
  userId: string
): Promise<Response> {
  const messages = body.messages as { parts?: { type: string; text: string }[] }[] | undefined;

  // Extract the user's prompt from the last message
  const lastUserMsg = [...(messages ?? [])].reverse().find((m) =>
    m.parts?.some((p) => p.type === "text")
  );
  const prompt =
    lastUserMsg?.parts
      ?.filter((p) => p.type === "text")
      .map((p) => p.text)
      .join("\n") ?? "";

  if (!prompt) {
    return new Response(
      JSON.stringify({ error: "No prompt found in messages" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  console.log("[chat:warroom] Creating war room", {
    gameId,
    genre,
    promptLength: prompt.length,
  });

  try {
    const warRoom = await createWarRoom(
      body.gameName as string,
      prompt,
      userId,
      genre ?? undefined
    );

    return new Response(
      JSON.stringify({
        type: "war_room",
        war_room: warRoom,
      }),
      {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("[chat:warroom] Creation failed:", err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "War room creation failed",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
