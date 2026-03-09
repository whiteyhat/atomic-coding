import useSWR from "swr";
import { listBuilds } from "@/lib/api";

export function useBuilds(gameName: string | null, limit = 20) {
  return useSWR(
    gameName ? `builds:${gameName}:${limit}` : null,
    () => listBuilds(gameName!, limit),
  );
}
