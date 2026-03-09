"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TokenStatusBadge } from "@/components/token/token-status-badge";
import { BondProgressBar } from "@/components/token/bond-progress-bar";
import { useTokenExplore } from "@/lib/hooks";
import { cn } from "@/lib/utils";
import type { TokenExploreItem } from "@/lib/types";

type FilterTab = "all" | "live" | "about_to_graduate" | "graduated";
type SortOption = "newest" | "bonding_pct" | "market_cap" | "volume";

const FILTER_TABS: { value: FilterTab; label: string }[] = [
  { value: "all", label: "All" },
  { value: "live", label: "Live" },
  { value: "about_to_graduate", label: "About to Graduate" },
  { value: "graduated", label: "Graduated" },
];

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "bonding_pct", label: "Bonding %" },
  { value: "market_cap", label: "Market Cap" },
  { value: "volume", label: "Volume" },
];

const PAGE_SIZE = 12;

function formatCompact(value: number): string {
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(2)}K`;
  if (value >= 1) return `$${value.toFixed(2)}`;
  if (value >= 0.0001) return `$${value.toFixed(6)}`;
  return `$${value.toExponential(2)}`;
}

export default function TokensExplorePage() {
  const [filter, setFilter] = useState<FilterTab>("all");
  const [sort, setSort] = useState<SortOption>("newest");
  const [offset, setOffset] = useState(0);

  // Build API filters
  const apiFilters = useMemo(() => {
    const f: { status?: string; sort?: string; limit?: number; offset?: number } = {
      limit: PAGE_SIZE,
      offset,
    };

    if (filter === "live" || filter === "about_to_graduate") {
      f.status = "live";
    } else if (filter === "graduated") {
      f.status = "graduated";
    }

    if (filter === "about_to_graduate") {
      f.sort = "bonding_pct";
    } else if (sort === "bonding_pct") {
      f.sort = "bonding_pct";
    } else if (sort === "market_cap") {
      f.sort = "market_cap";
    } else if (sort === "volume") {
      f.sort = "volume";
    } else {
      f.sort = "newest";
    }

    return f;
  }, [filter, sort, offset]);

  const { data, isLoading } = useTokenExplore(apiFilters);
  const tokens = data?.tokens ?? [];
  const total = data?.total ?? 0;
  const hasMore = offset + PAGE_SIZE < total;

  function handleFilterChange(tab: FilterTab) {
    setFilter(tab);
    setOffset(0);
  }

  function handleSortChange(value: string) {
    setSort(value as SortOption);
    setOffset(0);
  }

  function handleLoadMore() {
    setOffset((prev) => prev + PAGE_SIZE);
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-white/5">
        <div className="max-w-6xl mx-auto px-6 py-6">
          <div className="flex items-center gap-3 mb-1">
            <Link href="/">
              <Button variant="ghost" size="icon" className="size-8">
                <ArrowLeft className="size-4" />
              </Button>
            </Link>
            <h1 className="text-2xl font-bold">Explore Tokens</h1>
          </div>
          <p className="text-sm text-muted-foreground ml-11">
            Discover games with active bonding curves
          </p>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">
        {/* Filters */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          {/* Filter tabs */}
          <div className="flex items-center gap-1 rounded-lg border border-white/5 bg-white/[0.02] p-1">
            {FILTER_TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => handleFilterChange(tab.value)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  filter === tab.value
                    ? "bg-white/10 text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Sort select */}
          <Select value={sort} onValueChange={handleSortChange}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Loading */}
        {isLoading && tokens.length === 0 && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Empty state */}
        {!isLoading && tokens.length === 0 && (
          <div className="text-center py-20 text-muted-foreground">
            <p className="text-sm">No tokens found for this filter.</p>
          </div>
        )}

        {/* Token grid */}
        {tokens.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {tokens.map((token) => (
              <TokenCard key={token.id} token={token} />
            ))}
          </div>
        )}

        {/* Load more */}
        {hasMore && (
          <div className="flex justify-center pt-4">
            <Button
              variant="outline"
              onClick={handleLoadMore}
              disabled={isLoading}
              className="gap-2"
            >
              {isLoading && <Loader2 className="size-4 animate-spin" />}
              Load More
            </Button>
          </div>
        )}

        {/* Result count */}
        {tokens.length > 0 && (
          <p className="text-center text-xs text-muted-foreground">
            Showing {Math.min(offset + PAGE_SIZE, total)} of {total} tokens
          </p>
        )}
      </div>
    </div>
  );
}

// ── Token Card ──────────────────────────────────────────────────────────────

function TokenCard({ token }: { token: TokenExploreItem }) {
  const state = token.state;
  const gameName = token.metadata?.game_name as string | undefined;
  const priceChange = state?.price_change_24h ?? 0;

  return (
    <Link
      href={`/games/${encodeURIComponent(gameName ?? token.game_id)}/token`}
      className="group block rounded-xl border border-white/5 bg-white/[0.02] p-4 hover:bg-white/[0.04] hover:border-white/10 transition-all"
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold truncate">{token.token_name}</h3>
            <span className="text-xs text-muted-foreground">${token.token_symbol}</span>
          </div>
          {gameName && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">{gameName}</p>
          )}
        </div>
        <TokenStatusBadge status={token.status} className="shrink-0" />
      </div>

      {/* Mini progress bar */}
      {state && (
        <BondProgressBar
          bondingPct={state.bonding_pct}
          className="mb-3"
        />
      )}

      {/* Metrics row */}
      <div className="flex items-center justify-between text-xs">
        <div className="space-y-0.5">
          <span className="text-muted-foreground">Price</span>
          <p className="font-medium tabular-nums">
            {state ? formatCompact(state.current_price_usd) : "--"}
          </p>
        </div>
        <div className="text-center space-y-0.5">
          <span className="text-muted-foreground">24h</span>
          <p
            className={cn(
              "font-medium tabular-nums",
              priceChange > 0
                ? "text-green-400"
                : priceChange < 0
                  ? "text-red-400"
                  : "text-muted-foreground"
            )}
          >
            {priceChange !== 0
              ? `${priceChange > 0 ? "+" : ""}${priceChange.toFixed(2)}%`
              : "--"}
          </p>
        </div>
        <div className="text-right space-y-0.5">
          <span className="text-muted-foreground">MCap</span>
          <p className="font-medium tabular-nums">
            {state ? formatCompact(state.current_mcap_usd) : "--"}
          </p>
        </div>
      </div>
    </Link>
  );
}
