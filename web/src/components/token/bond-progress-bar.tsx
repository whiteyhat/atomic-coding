"use client";

import { cn } from "@/lib/utils";

interface BondProgressBarProps {
  bondingPct: number;
  currentMcap?: number;
  migrationMcap?: number;
  className?: string;
}

function formatSol(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M SOL`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K SOL`;
  return `${value.toFixed(2)} SOL`;
}

function getBarColor(pct: number): string {
  if (pct >= 90) return "from-green-500 to-green-400";
  if (pct >= 60) return "from-amber-500 to-amber-400";
  return "from-blue-500 to-blue-400";
}

export function BondProgressBar({
  bondingPct,
  currentMcap,
  migrationMcap,
  className,
}: BondProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, bondingPct));

  return (
    <div className={cn("w-full space-y-2", className)}>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Bonding Progress</span>
        <span
          className={cn(
            "font-semibold tabular-nums",
            clamped >= 90
              ? "text-green-400"
              : clamped >= 60
                ? "text-amber-400"
                : "text-blue-400"
          )}
        >
          {clamped.toFixed(1)}%
        </span>
      </div>

      <div className="relative h-3 w-full overflow-hidden rounded-full bg-white/5">
        <div
          className={cn(
            "h-full rounded-full bg-gradient-to-r transition-all duration-500 ease-out",
            getBarColor(clamped)
          )}
          style={{ width: `${clamped}%` }}
        />

        {/* Graduation threshold marker */}
        <div className="absolute top-0 right-0 h-full w-px bg-white/20" />
      </div>

      {currentMcap !== undefined && migrationMcap !== undefined && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{formatSol(currentMcap)}</span>
          <span className="opacity-60">/</span>
          <span>{formatSol(migrationMcap)}</span>
        </div>
      )}
    </div>
  );
}
