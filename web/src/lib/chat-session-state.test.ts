import { describe, expect, it } from "vitest";
import {
  createDraftChatSession,
  createPersistedChatSession,
  isDraftChatSessionId,
  shouldLoadPersistedChatHistory,
} from "./chat-session-state";

describe("chat-session-state", () => {
  it("creates draft sessions with a local-only client id", () => {
    const draft = createDraftChatSession();

    expect(isDraftChatSessionId(draft.clientId)).toBe(true);
    expect(draft.persistedId).toBeNull();
    expect(shouldLoadPersistedChatHistory(draft.clientId, draft.persistedId)).toBe(false);
  });

  it("treats persisted sessions as loadable from storage", () => {
    const session = createPersistedChatSession("session-123");

    expect(isDraftChatSessionId(session.clientId)).toBe(false);
    expect(shouldLoadPersistedChatHistory(session.clientId, session.persistedId)).toBe(true);
  });

  it("skips persisted history fetches after a draft is promoted", () => {
    expect(shouldLoadPersistedChatHistory("draft:abc", "session-123")).toBe(false);
  });
});
