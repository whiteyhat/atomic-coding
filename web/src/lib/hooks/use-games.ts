import useSWR from "swr";
import { listGames, getGame } from "@/lib/api";

export function useGames() {
  return useSWR("games", listGames);
}

export function useGame(name: string | null) {
  return useSWR(name ? `game:${name}` : null, () => getGame(name!), { keepPreviousData: true });
}
