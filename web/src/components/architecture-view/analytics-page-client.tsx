"use client";

import dynamic from "next/dynamic";
import { useMemo, type ReactNode } from "react";
import useSWR from "swr";
import { motion } from "framer-motion";
import { Activity, GitBranch, Layers3, Network, Sparkles } from "lucide-react";
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { fadeInUp, staggerContainer } from "@/components/dashboard/dashboard-animations";
import { listMyGames } from "@/lib/api";
import { deriveLastEditedGame } from "@/lib/analytics";
import { formatRelativeTime } from "@/lib/dashboard";
import { getGameGenre } from "@/lib/game-genres";
import { useAppAuth } from "@/lib/privy-provider";
import {
  ARCHITECTURE_AGENT_COUNT,
  ARCHITECTURE_SERVICE_COUNT,
} from "./data/architectureData";

const ArchitectureView = dynamic(
  () =>
    import("@/components/architecture-view").then((module) => ({
      default: module.ArchitectureView,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full min-h-[620px] items-center justify-center rounded-[2rem] border border-white/8 bg-[#12060a]/90">
        <div className="w-full max-w-3xl space-y-4 px-6">
          <div className="h-10 w-64 animate-pulse rounded-2xl bg-white/10" />
          <div className="h-[440px] animate-pulse rounded-[2rem] bg-white/[0.05]" />
        </div>
      </div>
    ),
  },
);

function ContextBadge({
  label,
  tone = "default",
}: {
  label: string;
  tone?: "default" | "warning" | "error";
}) {
  const toneClass =
    tone === "warning"
      ? "border-amber-400/25 bg-amber-500/10 text-amber-100"
      : tone === "error"
        ? "border-rose-400/25 bg-rose-500/10 text-rose-100"
        : "border-white/10 bg-white/[0.04] text-white/75";

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-medium ${toneClass}`}
    >
      <span className="size-1.5 rounded-full bg-current opacity-80" />
      {label}
    </span>
  );
}

export function AnalyticsPageClient() {
  const { user, ready, authenticated } = useAppAuth();
  const shouldLoadGames = ready && authenticated && !!user?.id;
  const {
    data: games,
    error,
    isLoading,
  } = useSWR(shouldLoadGames ? "my-games" : null, listMyGames);

  const lastEditedGame = useMemo(
    () => deriveLastEditedGame(games ?? []),
    [games],
  );
  const genre = getGameGenre(lastEditedGame?.genre);

  let contextBadge: ReactNode = (
    <ContextBadge label="No recent game context yet" />
  );

  if (isLoading || (shouldLoadGames && !games && !error)) {
    contextBadge = <ContextBadge label="Loading recent game context" tone="warning" />;
  } else if (error) {
    contextBadge = <ContextBadge label="Could not load recent game context" tone="error" />;
  } else if (lastEditedGame) {
    contextBadge = (
      <ContextBadge
        label={`${lastEditedGame.name} · updated ${formatRelativeTime(lastEditedGame.updatedAt)}`}
      />
    );
  }

  const stats = [
    {
      label: "Agents",
      value: ARCHITECTURE_AGENT_COUNT,
      icon: Activity,
      tone: "text-fuchsia-200",
    },
    {
      label: "Services",
      value: ARCHITECTURE_SERVICE_COUNT,
      icon: Network,
      tone: "text-sky-200",
    },
    {
      label: "Topology",
      value: "1 core",
      icon: GitBranch,
      tone: "text-emerald-200",
    },
  ];

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#3a1a1f_0%,#1b0b0f_52%,#0f0508_100%)] px-3 py-4 text-stone-50 md:px-5 md:py-5">
      <div className="mx-auto flex max-w-[1920px] gap-5">
        <DashboardSidebar activeId="stats" />

        <motion.main
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="min-w-0 flex-1 space-y-5"
        >
          <motion.section
            variants={fadeInUp}
            className="overflow-hidden rounded-[2.25rem] border border-white/8 bg-[#2a0f14]/90 shadow-[0_24px_90px_rgba(24,8,10,0.34)]"
          >
            <div className="grid gap-4 p-5 lg:grid-cols-[minmax(0,1.2fr)_300px] lg:p-6">
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-white/40">
                  <Sparkles className="size-3.5 text-rose-300" />
                  System topology
                </div>

                <div className="space-y-2.5">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06]">
                      <Layers3 className="size-4.5 text-white/85" />
                    </div>
                    <div>
                      <h1 className="text-xl font-semibold tracking-tight text-white md:text-[1.7rem]">
                        Buu AI Game Maker architecture
                      </h1>
                      <p className="mt-1 max-w-3xl text-[13px] leading-5.5 text-white/58">
                        Static system map of the platform core, the four live Mastra agents,
                        and the tool and runtime services they coordinate across the game
                        development pipeline.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {contextBadge}
                    {genre && (
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-medium ${genre.pillClass}`}
                      >
                        <span>{genre.emoji}</span>
                        {genre.displayName}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid gap-2.5 sm:grid-cols-3 lg:grid-cols-1">
                {stats.map(({ label, value, icon: Icon, tone }) => (
                  <div
                    key={label}
                    className="rounded-[1.35rem] border border-white/10 bg-black/20 p-3.5"
                  >
                    <div className="flex items-center gap-2">
                      <div className="flex size-7 items-center justify-center rounded-lg border border-white/10 bg-white/[0.05]">
                        <Icon className={`size-3.5 ${tone}`} />
                      </div>
                      <span className="text-[11px] uppercase tracking-[0.18em] text-white/38">
                        {label}
                      </span>
                    </div>
                    <p className="mt-3 text-xl font-semibold text-white">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          </motion.section>

          <motion.section variants={fadeInUp}>
            <ArchitectureView lastEditedGame={lastEditedGame} />
          </motion.section>
        </motion.main>
      </div>
    </div>
  );
}
