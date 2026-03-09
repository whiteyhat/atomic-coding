import useSWR from "swr";
import { listChatSessions } from "@/lib/api";

export function useChatSessions(gameName: string | null, limit = 20) {
  return useSWR(
    gameName ? `chatSessions:${gameName}:${limit}` : null,
    () => listChatSessions(gameName!, limit),
  );
}
