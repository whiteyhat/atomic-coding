import useSWR from "swr";
import { listWarRooms } from "@/lib/api";

export function getWarRoomsKey(gameName: string, limit = 20) {
  return `warrooms:${gameName}:${limit}`;
}

export function useWarRooms(gameName: string | null, limit = 20) {
  return useSWR(
    gameName ? getWarRoomsKey(gameName, limit) : null,
    () => listWarRooms(gameName!, limit),
  );
}
