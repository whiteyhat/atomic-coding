"use client";

import { useState } from "react";
import { useLeaderboard } from "@/lib/hooks";
import type { LeaderboardPeriod } from "@/lib/types";
import { Trophy, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";

interface LeaderboardPanelProps {
  gameName: string;
}

export function LeaderboardPanel({ gameName }: LeaderboardPanelProps) {
  const [period, setPeriod] = useState<LeaderboardPeriod>("lifetime");
  const { data: entries, isLoading, mutate } = useLeaderboard(gameName, period, 10);

  const items = entries ?? [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
        Loading leaderboard...
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="size-4 text-yellow-500" />
          <h3 className="text-sm font-medium">Top 10 Leaderboard</h3>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="size-6"
          onClick={() => mutate()}
        >
          <RefreshCw className="size-3" />
        </Button>
      </div>

      <ButtonGroup className="w-full">
        {([
          ["day", "Day"],
          ["week", "Week"],
          ["lifetime", "Lifetime"],
        ] as const).map(([value, label]) => (
          <Button
            key={value}
            variant={period === value ? "default" : "outline"}
            size="xs"
            className="flex-1"
            onClick={() => setPeriod(value)}
          >
            {label}
          </Button>
        ))}
      </ButtonGroup>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          No scores yet for this period. Play the game to get on the board!
        </p>
      ) : (
        <div className="space-y-1">
          {items.map((entry, i) => (
            <div
              key={entry.id}
              className="flex items-center gap-3 rounded-md px-2 py-1.5 text-sm hover:bg-muted/50"
            >
              <span className="w-6 text-center text-muted-foreground font-mono text-xs">
                {i + 1}
              </span>
              {entry.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={entry.avatar_url}
                  alt=""
                  className="size-5 rounded-full"
                />
              ) : (
                <div className="size-5 rounded-full bg-muted" />
              )}
              <span className="flex-1 truncate">{entry.player_name}</span>
              <span className="font-mono text-xs font-medium">
                {entry.score.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
