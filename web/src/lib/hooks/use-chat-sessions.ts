import useSWR from "swr";
import { listChatSessions } from "@/lib/api";

export function getChatSessionsKey(gameName: string, limit = 20) {
  return `chatSessions:${gameName}:${limit}`;
}

export function useChatSessions(gameName: string | null, limit = 20) {
  return useSWR(
    gameName ? getChatSessionsKey(gameName, limit) : null,
    () => listChatSessions(gameName!, limit),
  );
}
