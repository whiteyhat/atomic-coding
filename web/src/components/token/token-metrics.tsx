"use client";

import { cn } from "@/lib/utils";
import type { BondingCurveState, TokenLaunch } from "@/lib/types";

interface TokenMetricsProps {
  state: BondingCurveState;
  launch: TokenLaunch;
  className?: string;
}

function formatCompact(value: number): string {
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(2)}K`;
  if (value >= 1) return `$${value.toFixed(2)}`;
  if (value >= 0.0001) return `$${value.toFixed(6)}`;
  return `$${value.toExponential(2)}`;
}

function formatCount(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString();
}

function PriceChange({ value }: { value: number }) {
  if (value === 0) return <span className="text-muted-foreground">--</span>;
  const isPositive = value > 0;
  return (
    <span
      className={cn(
        "flex items-center gap-0.5 text-xs font-medium",
        isPositive ? "text-green-400" : "text-red-400"
      )}
    >
      <span>{isPositive ? "\u25B2" : "\u25BC"}</span>
      {Math.abs(value).toFixed(2)}%
    </span>
  );
}

interface MetricCardProps {
  label: string;
  value: string;
  change?: number;
}

function MetricCard({ label, value, change }: MetricCardProps) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-white/5 bg-white/[0.02] p-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold tabular-nums">{value}</span>
        {change !== undefined && <PriceChange value={change} />}
      </div>
    </div>
  );
}

export function TokenMetrics({ state, launch, className }: TokenMetricsProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-2 sm:grid-cols-3",
        className
      )}
    >
      <MetricCard
        label="Price"
        value={formatCompact(state.current_price_usd)}
        change={state.price_change_24h}
      />
      <MetricCard
        label="Market Cap"
        value={formatCompact(state.current_mcap_usd)}
        change={state.price_change_24h}
      />
      <MetricCard
        label="FDV"
        value={formatCompact(state.fdv)}
      />
      <MetricCard
        label="24h Volume"
        value={formatCompact(state.volume_24h_usd)}
      />
      <MetricCard
        label="Holders"
        value={formatCount(state.holder_count)}
      />
      <MetricCard
        label="24h Trades"
        value={formatCount(state.trades_24h)}
      />
    </div>
  );
}
