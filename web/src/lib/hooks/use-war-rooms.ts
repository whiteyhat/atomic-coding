import useSWR from "swr";
import { listWarRooms } from "@/lib/api";

export function useWarRooms(gameName: string | null, limit = 20) {
  return useSWR(
    gameName ? `warrooms:${gameName}:${limit}` : null,
    () => listWarRooms(gameName!, limit),
  );
}
