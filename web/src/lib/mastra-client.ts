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
}

/**
 * Stream a chat completion from the Mastra server.
 * Returns a ReadableStream of SSE chunks.
 */
export async function streamMastraChat(
  options: MastraRequestOptions
): Promise<ReadableStream<Uint8Array>> {
  const { messages, gameId, gameName, genre, sessionId } = options;

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
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new Error(
      `Mastra server error ${response.status}: ${errorBody}`
    );
  }

  if (!response.body) {
    throw new Error("No response body from Mastra server");
  }

  return response.body;
}

/**
 * Check if the Mastra server is configured and available.
 */
export function isMastraConfigured(): boolean {
  return !!MASTRA_SERVER_URL;
}
