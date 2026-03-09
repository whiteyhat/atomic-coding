"use client";

import useSWR from "swr";
import { getSwapQuote } from "../api";
import type { SwapQuote } from "../types";

/** Debounced swap quote — only fetches when amount > 0 */
export function useSwapQuote(
  gameName: string | null,
  direction: "buy" | "sell",
  amount: number,
) {
  return useSWR<SwapQuote>(
    gameName && amount > 0
      ? `quote:${gameName}:${direction}:${amount}`
      : null,
    () => getSwapQuote(gameName!, direction, amount),
    { dedupingInterval: 500 },
  );
}
