import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ApiError,
  createChatSession,
  getChatMessages,
  listChatSessions,
  registerAuthTokenGetter,
} from "./api";

describe("chat API auth behavior", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    registerAuthTokenGetter(async () => null);
  });

  afterEach(() => {
    registerAuthTokenGetter(async () => null);
    vi.unstubAllGlobals();
  });

  it("lists chat sessions without requiring auth", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const sessions = await listChatSessions("My First Game");

    expect(sessions).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
      "/games/My%20First%20Game/chat/sessions?limit=20",
    );
    const headers = fetchMock.mock.calls[0]?.[1]?.headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
  });

  it("loads chat messages without requiring auth", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const messages = await getChatMessages("My First Game", "session-123");

    expect(messages).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
      "/games/My%20First%20Game/chat/sessions/session-123/messages",
    );
  });

  it("still rejects chat session creation without auth", async () => {
    await expect(createChatSession("My First Game")).rejects.toMatchObject({
      name: "ApiError",
      status: 401,
    } satisfies Partial<ApiError>);

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
