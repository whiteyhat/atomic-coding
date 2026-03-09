import useSWR from "swr";
import { getLeaderboard } from "@/lib/api";
import type { LeaderboardPeriod } from "@/lib/types";

export function useLeaderboard(
  gameName: string | null,
  period: LeaderboardPeriod = "lifetime",
  limit = 10,
) {
  return useSWR(
    gameName ? `leaderboard:${gameName}:${period}:${limit}` : null,
    () => getLeaderboard(gameName!, period, limit),
  );
}
