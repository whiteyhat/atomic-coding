/**
 * Mastra server HTTP client.
 * Sends messages to the Mastra server's streaming endpoint
 * and streams back SSE responses.
 */

const MASTRA_SERVER_URL = process.env.MASTRA_SERVER_URL ?? "";

export interface MastraMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface MastraRequestOptions {
  messages: MastraMessage[];
  gameId: string;
  gameName: string;
  genre?: string | null;
  sessionId?: string | null;
  assetModelIds?: string[];
}

/**
 * Stream a chat completion from the Mastra server.
 * Returns a ReadableStream of SSE chunks.
 */
export async function streamMastraChat(
  options: MastraRequestOptions
): Promise<Response> {
  const { messages, gameId, gameName, genre, sessionId, assetModelIds } = options;

  if (!MASTRA_SERVER_URL) {
    throw new Error("MASTRA_SERVER_URL is not configured");
  }

  const response = await fetch(`${MASTRA_SERVER_URL}/chat/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messages,
      gameId,
      gameName,
      genre: genre ?? undefined,
      sessionId: sessionId ?? undefined,
      ...(assetModelIds?.length ? { assetModelIds } : {}),
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new Error(
      `Mastra server error ${response.status}: ${errorBody}`
    );
  }

  return response;
}

/**
 * Trigger the war room pipeline on the local Mastra server.
 * Called after war room creation so the pipeline runs locally
 * instead of relying on the remote Supabase Edge Function trigger.
 */
export async function triggerPipeline(warRoomId: string): Promise<void> {
  if (!MASTRA_SERVER_URL) return;

  try {
    const res = await fetch(`${MASTRA_SERVER_URL}/pipeline/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ war_room_id: warRoomId }),
    });
    console.log("[mastra-client] pipeline triggered", {
      warRoomId,
      status: res.status,
    });
  } catch (err) {
    console.error("[mastra-client] pipeline trigger failed", {
      warRoomId,
      error: (err as Error).message,
    });
  }
}

/**
 * Check if the Mastra server is configured and available.
 */
export function isMastraConfigured(): boolean {
  return !!MASTRA_SERVER_URL;
}
