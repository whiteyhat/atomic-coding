/**
 * OpenClaw Gateway HTTP client.
 * Sends messages to the OpenClaw gateway's OpenAI-compatible endpoint
 * and streams back SSE responses.
 */

const OPENCLAW_GATEWAY_URL = process.env.OPENCLAW_GATEWAY_URL ?? "";
const OPENCLAW_GATEWAY_TOKEN = process.env.OPENCLAW_GATEWAY_TOKEN ?? "";

export interface OpenClawMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface OpenClawRequestOptions {
  messages: OpenClawMessage[];
  gameId: string;
  gameName: string;
  genre?: string | null;
  sessionId?: string | null;
}

/**
 * Stream a chat completion from the OpenClaw gateway.
 * Returns a ReadableStream of SSE chunks.
 */
export async function streamOpenClawChat(
  options: OpenClawRequestOptions
): Promise<ReadableStream<Uint8Array>> {
  const { messages, gameId, gameName, genre, sessionId } = options;

  if (!OPENCLAW_GATEWAY_URL) {
    throw new Error("OPENCLAW_GATEWAY_URL is not configured");
  }

  const response = await fetch(`${OPENCLAW_GATEWAY_URL}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENCLAW_GATEWAY_TOKEN}`,
    },
    body: JSON.stringify({
      model: "jarvis",
      stream: true,
      messages,
      // Pass game context as metadata for MCP tool routing
      metadata: {
        game_id: gameId,
        game_name: gameName,
        genre: genre ?? undefined,
        session_id: sessionId ?? undefined,
      },
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new Error(
      `OpenClaw gateway error ${response.status}: ${errorBody}`
    );
  }

  if (!response.body) {
    throw new Error("No response body from OpenClaw gateway");
  }

  return response.body;
}

/**
 * Check if the OpenClaw gateway is configured and available.
 */
export function isOpenClawConfigured(): boolean {
  return !!OPENCLAW_GATEWAY_URL && !!OPENCLAW_GATEWAY_TOKEN;
}

// =============================================================================
// War Room support
// =============================================================================

export interface WarRoomDispatchOptions {
  warRoomId: string;
  taskNumber: number;
  agent: string;
  gameId: string;
  gameName: string;
  genre?: string | null;
  taskContext: Record<string, unknown>;
}

/**
 * Dispatch a war room task to a specific agent via the OpenClaw gateway.
 * Unlike streamOpenClawChat, this waits for the full response (non-streaming).
 */
export async function dispatchWarRoomTask(
  options: WarRoomDispatchOptions
): Promise<Record<string, unknown>> {
  const { warRoomId, taskNumber, agent, gameId, gameName, genre, taskContext } =
    options;

  if (!OPENCLAW_GATEWAY_URL) {
    throw new Error("OPENCLAW_GATEWAY_URL is not configured");
  }

  const response = await fetch(`${OPENCLAW_GATEWAY_URL}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENCLAW_GATEWAY_TOKEN}`,
    },
    body: JSON.stringify({
      model: agent,
      stream: false,
      messages: [
        {
          role: "user",
          content: JSON.stringify(taskContext),
        },
      ],
      metadata: {
        game_id: gameId,
        game_name: gameName,
        genre: genre ?? undefined,
        war_room_id: warRoomId,
        task_number: taskNumber,
      },
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new Error(
      `OpenClaw gateway error ${response.status}: ${errorBody}`
    );
  }

  const result = await response.json();
  const content = result.choices?.[0]?.message?.content ?? "{}";

  try {
    return JSON.parse(content);
  } catch {
    return { raw_response: content };
  }
}
