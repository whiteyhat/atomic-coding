import { createAgentUIStreamResponse } from "ai";
import type { UIMessage } from "ai";
import { createAtomicAgent } from "@/lib/agent";
import { DEFAULT_MODEL } from "@/lib/constants";
import { getChatMessages, getGame, createWarRoom } from "@/lib/api";
import { verifyAuthToken } from "@/lib/auth";
import {
  streamMastraChat,
  isMastraConfigured,
  type MastraMessage,
} from "@/lib/mastra-client";
import { SYSTEM_PROMPT, getGenreContext } from "@/lib/system-prompt";

export const maxDuration = 120;

export async function POST(req: Request) {
  const reqId = Math.random().toString(36).slice(2, 8);
  const startTime = Date.now();

  // Verify authentication
  const authUser = await verifyAuthToken(req);
  if (!authUser) {
    console.warn(`[chat][${reqId}] auth failed — rejecting with 401`);
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const body = await req.json();
  const { messages, model, gameId, sessionId, assetModelIds } = body;

  const selectedModel = model ?? DEFAULT_MODEL;

  console.log(`[chat][${reqId}] POST request`, {
    model: selectedModel,
    gameId,
    sessionId,
    gameName: body.gameName,
    assetModelIds: assetModelIds ?? [],
    userId: authUser.userId,
    clientMessageCount: messages?.length ?? 0,
    useMastra: isMastraConfigured(),
    warRoomFlag: !!body.war_room,
  });

  const clientProvidedGenre = Object.prototype.hasOwnProperty.call(body, "genre");
  const clientProvidedGameFormat = Object.prototype.hasOwnProperty.call(body, "gameFormat");
  let genre: string | null =
    typeof body.genre === "string" ? body.genre : body.genre === null ? null : null;
  let gameFormat: "2d" | "3d" | null =
    body.gameFormat === "2d" || body.gameFormat === "3d" ? body.gameFormat : null;

  if (clientProvidedGenre) {
    console.log(`[chat][${reqId}] genre accepted from client`, { genre });
  }
  if (clientProvidedGameFormat) {
    console.log(`[chat][${reqId}] game format accepted from client`, { gameFormat });
  }

  if ((!clientProvidedGenre || !clientProvidedGameFormat) && body.gameName) {
    try {
      const game = await getGame(body.gameName);
      if (!clientProvidedGenre) {
        genre = game?.genre ?? null;
      }
      if (!clientProvidedGameFormat) {
        gameFormat = game?.game_format ?? null;
      }
      console.log(`[chat][${reqId}] game context resolved`, {
        gameName: body.gameName,
        genre,
        gameFormat,
      });
    } catch (err) {
      console.warn(`[chat][${reqId}] game context fetch failed, continuing without`, { error: (err as Error).message });
    }
  }

  // ── War Room Mode ─────────────────────────────────────────────────────────
  // When explicitly requested via war_room flag, create a war room and return
  // its ID so the frontend can switch to the war room view.
  if (body.war_room && isMastraConfigured() && body.gameName) {
    console.log(`[chat][${reqId}] routing → war room creation`);
    // Extract the raw auth token to forward to the Supabase edge function
    const rawToken = req.headers.get("Authorization")?.replace("Bearer ", "");
    return handleWarRoomCreation(body, gameId, genre, gameFormat, authUser.userId, reqId, rawToken);
  }

  // ── Mastra Gateway Mode ────────────────────────────────────────────────────
  // When the Mastra server is configured, proxy through it for multi-agent.
  // Otherwise, fall back to the local Vercel AI SDK agent.
  if (isMastraConfigured()) {
    console.log(`[chat][${reqId}] routing → mastra proxy`);
    return handleMastraProxy(body, gameId, genre, gameFormat, sessionId, reqId);
  }

  // ── Local Agent Mode (fallback) ────────────────────────────────────────────
  console.log(`[chat][${reqId}] routing → local agent`);

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
        console.log(`[chat][${reqId}] loaded history from DB`, {
          dbCount: dbMessages.length,
          newFromClient: newFromClient.length,
          total: uiMessages.length,
        });
      }
    } catch (err) {
      console.warn(`[chat][${reqId}] failed to load session history, using client messages`, { error: (err as Error).message });
    }
  }

  const agentStart = Date.now();
  const { agent, cleanup } = await createAtomicAgent(selectedModel, gameId, genre, gameFormat);
  console.log(`[chat][${reqId}] agent created`, { durationMs: Date.now() - agentStart });

  const streamStart = Date.now();
  const response = await createAgentUIStreamResponse({
    agent,
    uiMessages,
  });
  console.log(`[chat][${reqId}] stream response created`, { messageCount: uiMessages.length, durationMs: Date.now() - streamStart });

  // Pipe through a pass-through so we can clean up MCP clients
  // only AFTER the stream is fully consumed by the client.
  const originalBody = response.body!;
  const transform = new TransformStream();

  originalBody.pipeTo(transform.writable).then(
    () => {
      const totalMs = Date.now() - startTime;
      console.log(`[chat][${reqId}] stream finished`, { totalMs });
      cleanup().then(() => console.log(`[chat][${reqId}] MCP clients closed`));
    },
    (err: unknown) => {
      const totalMs = Date.now() - startTime;
      console.error(`[chat][${reqId}] stream error`, { totalMs, error: err });
      cleanup().then(() =>
        console.log(`[chat][${reqId}] MCP clients closed after error`)
      );
    }
  );

  return new Response(transform.readable, {
    headers: response.headers,
    status: response.status,
  });
}

/**
 * Proxy the chat request through the Mastra server.
 * Converts UI messages to plain-text format and streams back.
 */
async function handleMastraProxy(
  body: Record<string, unknown>,
  gameId: string,
  genre: string | null,
  gameFormat: "2d" | "3d" | null,
  sessionId: string | null,
  reqId: string
): Promise<Response> {
  const messages = body.messages as UIMessage[] | undefined;

  // Convert UIMessage parts to plain text for the Mastra server
  const mastraMessages: MastraMessage[] = [
    {
      role: "system",
      content: SYSTEM_PROMPT + getGenreContext(genre, gameFormat),
    },
  ];

  for (const msg of messages ?? []) {
    const textParts = msg.parts
      ?.filter((p): p is { type: "text"; text: string } => p.type === "text")
      .map((p) => p.text)
      .join("\n");

    if (textParts) {
      mastraMessages.push({
        role: msg.role as "user" | "assistant",
        content: textParts,
      });
    }
  }

  console.log(`[chat:mastra][${reqId}] proxying to Mastra server`, {
    messageCount: mastraMessages.length,
    systemPromptLength: mastraMessages[0]?.content?.length ?? 0,
    gameId,
    genre,
    gameFormat,
    sessionId,
  });

  const proxyStart = Date.now();
  try {
    const response = await streamMastraChat({
      messages: mastraMessages,
      gameId,
      gameName: (body.gameName as string) ?? "",
      genre,
      gameFormat,
      sessionId,
      assetModelIds: (body.assetModelIds as string[]) ?? [],
    });

    console.log(`[chat:mastra][${reqId}] response received`, {
      status: response.status,
      contentType: response.headers.get("Content-Type"),
      hasDataStream: !!response.headers.get("x-vercel-ai-data-stream"),
      durationMs: Date.now() - proxyStart,
    });

    // Forward the AI SDK protocol response with its original headers.
    return new Response(response.body, {
      status: response.status,
      headers: {
        "Content-Type": response.headers.get("Content-Type") ?? "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        ...(response.headers.get("x-vercel-ai-data-stream")
          ? { "x-vercel-ai-data-stream": response.headers.get("x-vercel-ai-data-stream")! }
          : {}),
      },
    });
  } catch (err) {
    console.error(`[chat:mastra][${reqId}] server error`, { durationMs: Date.now() - proxyStart, error: err });
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Mastra server error",
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
  gameFormat: "2d" | "3d" | null,
  userId: string,
  reqId: string,
  authToken?: string,
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
    console.warn(`[chat:warroom][${reqId}] no prompt found in messages`);
    return new Response(
      JSON.stringify({ error: "No prompt found in messages" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  console.log(`[chat:warroom][${reqId}] creating war room`, {
    gameId,
    genre,
    gameFormat,
    promptLength: prompt.length,
    promptPreview: prompt.slice(0, 100),
  });

  const createStart = Date.now();
  try {
    const warRoom = await createWarRoom(
      body.gameName as string,
      prompt,
      userId,
      genre ?? undefined,
      gameFormat,
      undefined,
      authToken,
    );

    console.log(`[chat:warroom][${reqId}] war room created`, {
      warRoomId: (warRoom as unknown as Record<string, unknown>).id,
      durationMs: Date.now() - createStart,
    });

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
    console.error(`[chat:warroom][${reqId}] creation failed`, { durationMs: Date.now() - createStart, error: err });
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
