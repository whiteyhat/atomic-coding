"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import useSWR from "swr";
import { motion } from "framer-motion";
import {
  getDashboardDisplayName,
  filterDashboardCollections,
  mapGamesToDashboardCreations,
  computeDashboardStats,
} from "@/lib/dashboard";
import { listMyGames, getTokenLaunch } from "@/lib/api";
import { useAppAuth } from "@/lib/auth-provider";
import { MOCK_DASHBOARD_SUMMARY, MOCK_TOKEN_ACTIVITY } from "@/lib/mock-dashboard-data";
import type { GameWithBuild, TokenLaunch } from "@/lib/types";
import { staggerContainer } from "./dashboard-animations";
import { DashboardSidebar } from "./dashboard-sidebar";
import { DashboardHeader } from "./dashboard-header";
import { DashboardHero } from "./dashboard-hero";
import { DashboardCreations } from "./dashboard-creations";
import { DashboardStats } from "./dashboard-stats";
import { DashboardTokenFeed } from "./dashboard-token-feed";
import { DashboardAgentHealth } from "./dashboard-agent-health";
import { CreateGameWizard } from "@/components/games/create-game-wizard";

async function fetchTokensForGames(
  games: GameWithBuild[],
): Promise<Record<string, TokenLaunch>> {
  const results = await Promise.allSettled(
    games.map((g) => getTokenLaunch(g.name)),
  );
  const map: Record<string, TokenLaunch> = {};
  results.forEach((result, i) => {
    if (result.status === "fulfilled" && result.value) {
      map[games[i].name] = result.value;
    }
  });
  return map;
}

interface DashboardShellProps {
  openCreateFromAid?: boolean;
}

export function DashboardShell({
  openCreateFromAid = false,
}: DashboardShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isCreateOpen, setIsCreateOpen] = useState(openCreateFromAid);
  const [initialGenre, setInitialGenre] = useState<string | null>(null);
  const { user, ready, authenticated } = useAppAuth();
  const shouldLoadGames = ready && authenticated && !!user?.id;
  const { data: userGames, error, isLoading } = useSWR(
    shouldLoadGames ? "my-games" : null,
    listMyGames,
  );

  const games = useMemo(() => userGames ?? [], [userGames]);

  const { data: tokensByGame } = useSWR(
    games.length > 0 ? ["tokens-for-games", games.map((g) => g.name).join(",")] : null,
    () => fetchTokensForGames(games),
  );

  const creations = mapGamesToDashboardCreations(games, tokensByGame);
  const stats = useMemo(() => computeDashboardStats(games), [games]);

  const filtered = filterDashboardCollections(
    creations,
    MOCK_DASHBOARD_SUMMARY.activity,
    "",
  );

  const displayName = getDashboardDisplayName({
    id: user?.id ?? "",
    displayName: null,
    email: user?.email?.address ?? null,
    walletAddress: null,
    avatarUrl: null,
  });

  const creationsErrorMessage =
    error instanceof Error
      ? "Unable to load your creations right now."
      : ready && !authenticated
        ? "Sign in to load your creations."
        : null;

  function handleOpenCreate(nextGenre?: string | null) {
    setInitialGenre(nextGenre ?? null);
    setIsCreateOpen(true);
  }

  useEffect(() => {
    if (!openCreateFromAid) return;
    router.replace(pathname, { scroll: false });
  }, [openCreateFromAid, pathname, router]);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#3a1a1f_0%,#1b0b0f_50%,#0f0508_100%)] px-3 py-4 text-stone-50 md:px-5 md:py-5">

      <div className="mx-auto flex max-w-[1920px] gap-5">
        <DashboardSidebar />

        <motion.main
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="min-w-0 flex-1 space-y-5"
        >
          <DashboardHeader displayName={displayName} />

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="space-y-5">
              <DashboardHero onOpenCreate={handleOpenCreate} />
              <DashboardCreations
                creations={filtered.creations}
                isLoading={isLoading}
                errorMessage={creationsErrorMessage}
              />
              {/* <DashboardTokenFeed items={MOCK_TOKEN_ACTIVITY} /> */}
            </div>

            <div className="space-y-5">
              <DashboardStats
                totalAtoms={stats.totalAtoms}
                gamesCount={stats.totalGames}
                publishedCount={stats.publishedGames}
                buildsCount={stats.successfulBuilds}
                isLoading={isLoading}
              />
              <DashboardAgentHealth />
            </div>
          </div>
        </motion.main>
      </div>

      <CreateGameWizard
        open={isCreateOpen}
        onOpenChange={(open) => {
          setIsCreateOpen(open);
          if (!open) setInitialGenre(null);
        }}
        initialGenre={initialGenre}
      />
    </div>
  );
}
