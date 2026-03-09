"use client";

import useSWR from "swr";
import { getCurveState, getCurveData, getHolders, getTransactions } from "../api";
import type { BondingCurveState, TokenLaunch, TokenHolder, TokenTransaction } from "../types";

/** Live curve state with 10s polling */
export function useCurveState(gameName: string | null) {
  return useSWR<BondingCurveState | null>(
    gameName ? `curve-state:${gameName}` : null,
    () => getCurveState(gameName!),
    { refreshInterval: 10_000 },
  );
}

/** Curve config + state combined */
export function useCurveData(gameName: string | null) {
  return useSWR<{ launch: TokenLaunch; state: BondingCurveState | null }>(
    gameName ? `curve-data:${gameName}` : null,
    () => getCurveData(gameName!),
  );
}

/** Top holders with 30s polling */
export function useHolders(gameName: string | null, limit = 10) {
  return useSWR<TokenHolder[]>(
    gameName ? `holders:${gameName}:${limit}` : null,
    () => getHolders(gameName!, limit),
    { refreshInterval: 30_000 },
  );
}

/** Recent transactions with 15s polling */
export function useTransactions(gameName: string | null, limit = 50) {
  return useSWR<TokenTransaction[]>(
    gameName ? `transactions:${gameName}:${limit}` : null,
    () => getTransactions(gameName!, limit),
    { refreshInterval: 15_000 },
  );
}
