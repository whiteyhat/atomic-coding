"use client";

import useSWR from "swr";
import { exploreTokens } from "../api";
import type { TokenExploreItem } from "../types";

export function useTokenExplore(filters?: {
  status?: string;
  sort?: string;
  limit?: number;
  offset?: number;
}) {
  const key = filters
    ? `tokens-explore:${JSON.stringify(filters)}`
    : "tokens-explore";

  return useSWR<{ tokens: TokenExploreItem[]; total: number }>(
    key,
    () => exploreTokens(filters),
    { refreshInterval: 30_000 },
  );
}
