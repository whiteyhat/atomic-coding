export const DRAFT_CHAT_PREFIX = "draft:";

export interface ActiveChatSession {
  clientId: string;
  persistedId: string | null;
}

export function createDraftChatSession(): ActiveChatSession {
  return {
    clientId: `${DRAFT_CHAT_PREFIX}${crypto.randomUUID()}`,
    persistedId: null,
  };
}

export function createPersistedChatSession(
  sessionId: string,
): ActiveChatSession {
  return {
    clientId: sessionId,
    persistedId: sessionId,
  };
}

export function isDraftChatSessionId(
  sessionId: string | null | undefined,
): boolean {
  return !!sessionId && sessionId.startsWith(DRAFT_CHAT_PREFIX);
}

export function shouldLoadPersistedChatHistory(
  clientId: string,
  persistedId: string | null,
): boolean {
  return !isDraftChatSessionId(clientId) && persistedId === clientId;
}
