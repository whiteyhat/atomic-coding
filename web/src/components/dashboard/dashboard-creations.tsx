"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Play } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getGenreGradient, formatRelativeTime } from "@/lib/dashboard";
import { getGameGenre } from "@/lib/game-genres";
import type { DashboardGameSummary, DashboardTokenStatus } from "@/lib/types";
import { fadeInUp, staggerContainer, cardHover, cardTap } from "./dashboard-animations";

function getTokenProgress(creation: DashboardGameSummary): number {
  if (creation.tokenStatus === "launched") return 100;
  if (creation.tokenStatus === "pending") return 65;
  if (creation.tokenStatus === "draft") return 30;
  if (creation.currentWarRoom) return creation.currentWarRoom.progress;
  return 0;
}

const tokenLabelKeys: Record<string, string> = {
  launched: "tokenLaunched",
  pending: "tokenPending",
  draft: "tokenDraft",
  failed: "tokenFailed",
};
const defaultTokenLabelKey = "tokenNotStarted";

function getTokenBarColor(status: DashboardTokenStatus): string {
  switch (status) {
    case "launched":
      return "bg-emerald-400";
    case "pending":
      return "bg-blue-400";
    case "draft":
      return "bg-amber-400";
    case "failed":
      return "bg-red-400";
    default:
      return "bg-white/20";
  }
}

function getGenreBadgeColor(genre: string | null): string {
  const genreInfo = getGameGenre(genre);
  if (genreInfo) return genreInfo.pillClass;
  return "bg-white/15 text-white";
}

function getGameFormatBadgeColor(gameFormat: DashboardGameSummary["gameFormat"]): string {
  return gameFormat === "2d"
    ? "border-cyan-300/30 bg-cyan-400/15 text-cyan-50"
    : "border-fuchsia-300/30 bg-fuchsia-400/15 text-fuchsia-50";
}

function CreationCard({ creation }: { creation: DashboardGameSummary }) {
  const t = useTranslations("dashboard");
  const progress = getTokenProgress(creation);
  const workspaceHref = `/games/${encodeURIComponent(creation.name)}`;
  const genreInfo = getGameGenre(creation.genre);
  const emoji = genreInfo?.emoji ?? "🎮";
  const genreDisplayName = genreInfo?.displayName ?? creation.genre?.replace(/-/g, " ") ?? "Game";
  const gameFormatLabel = creation.gameFormat === "2d" ? "2D" : "3D";

  return (
    <motion.div
      variants={fadeInUp}
      whileHover={cardHover}
      whileTap={cardTap}
      className="group relative w-[300px] shrink-0 snap-start overflow-hidden rounded-[1.75rem] border border-white/8 bg-[#311519]/95 shadow-[0_18px_60px_rgba(24,8,10,0.25)] md:w-[340px]"
    >
      <Link href={workspaceHref} className="block">
        <div className="relative h-[200px] overflow-hidden">
          <div className={cn("absolute inset-0 bg-gradient-to-br", getGenreGradient(creation.genre))} />
          <div className="absolute inset-0 bg-[linear-gradient(165deg,rgba(14,4,6,0.05)_0%,rgba(14,4,6,0.75)_72%)]" />

          {/* Genre emoji as card image */}
          <div className="absolute inset-0 flex items-center justify-center">
            <span
              className="select-none text-7xl drop-shadow-[0_4px_24px_rgba(0,0,0,0.4)] transition-transform duration-300 group-hover:scale-110"
              role="img"
              aria-label={genreDisplayName}
            >
              {emoji}
            </span>
          </div>

          <div className="absolute left-4 right-4 top-4 flex items-start justify-between gap-2">
            <Badge className={cn("rounded-md border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider", getGenreBadgeColor(creation.genre))}>
              {genreDisplayName}
            </Badge>
            <Badge className={cn("rounded-md border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider", getGameFormatBadgeColor(creation.gameFormat))}>
              {gameFormatLabel}
            </Badge>
          </div>

          {/* Play button — visible only on hover */}
          <AnimatePresence>
            <motion.div
              className="absolute bottom-4 right-4 flex size-11 items-center justify-center rounded-full bg-white/20 text-white opacity-0 backdrop-blur-md transition-all duration-300 group-hover:opacity-100 group-hover:bg-white/30"
              whileHover={{ scale: 1.15 }}
              whileTap={{ scale: 0.9 }}
            >
              <Play className="ml-0.5 size-4 fill-current" />
            </motion.div>
          </AnimatePresence>
        </div>
      </Link>

      <div className="p-5">
        <Link href={workspaceHref}>
          <h3 className="truncate text-lg font-semibold tracking-tight text-white transition-colors group-hover:text-rose-300">
            {creation.name}
          </h3>
        </Link>

        {creation.description ? (
          <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-white/45">
            {creation.description}
          </p>
        ) : null}

        {/* Token launch progress */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs">
            <span className="text-white/45">{t("tokenLaunch")}</span>
            <span className={cn(
              "font-medium",
              creation.tokenStatus === "launched" ? "text-emerald-400" :
              creation.tokenStatus === "pending" ? "text-blue-400" :
              creation.tokenStatus === "draft" ? "text-amber-400" :
              "text-white/40",
            )}>
              {t((tokenLabelKeys[creation.tokenStatus] ?? defaultTokenLabelKey) as Parameters<typeof t>[0])}
              {progress > 0 ? ` \u00B7 ${progress}%` : ""}
            </span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/8">
            <motion.div
              className={cn("h-full rounded-full", getTokenBarColor(creation.tokenStatus))}
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 1, delay: 0.3, ease: "easeOut" }}
            />
          </div>
        </div>

        {/* Footer: relative time */}
        <div className="mt-3 text-[11px] text-white/30">
          Updated {formatRelativeTime(creation.updatedAt)}
        </div>
      </div>
    </motion.div>
  );
}

interface DashboardCreationsProps {
  creations: DashboardGameSummary[];
  isLoading?: boolean;
  errorMessage?: string | null;
}

function CreationSkeleton({ keyId }: { keyId: string }) {
  return (
    <div
      key={keyId}
      className="w-[300px] shrink-0 snap-start overflow-hidden rounded-[1.75rem] border border-white/8 bg-[#311519]/95 shadow-[0_18px_60px_rgba(24,8,10,0.25)] md:w-[340px]"
    >
      <div className="relative h-[200px] animate-pulse bg-white/8">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="size-16 animate-pulse rounded-full bg-white/10" />
        </div>
      </div>
      <div className="space-y-3 p-5">
        <div className="h-5 w-2/3 animate-pulse rounded-full bg-white/10" />
        <div className="h-3 w-full animate-pulse rounded-full bg-white/6" />
        <div className="space-y-2 pt-1">
          <div className="h-2 w-full animate-pulse rounded-full bg-white/8" />
          <div className="h-1.5 w-full animate-pulse rounded-full bg-white/6" />
        </div>
      </div>
    </div>
  );
}

export function DashboardCreations({
  creations,
  isLoading = false,
  errorMessage = null,
}: DashboardCreationsProps) {
  const showEmptyState = !isLoading && !errorMessage && creations.length === 0;

  return (
    <motion.section variants={fadeInUp} initial="hidden" animate="visible">
      <div className="mb-4 flex items-center justify-between px-1">
        <h2 className="text-xl font-semibold text-white">My Creations</h2>
        <Link href="/library" className="text-sm text-white/50 transition hover:text-white/80">
          Open Library
        </Link>
      </div>

      <div className="relative">
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="-mx-1 flex gap-4 overflow-x-auto px-1 pb-4 scrollbar-hide"
          style={{ scrollSnapType: "x mandatory" }}
        >
          {isLoading
            ? ["creation-skeleton-1", "creation-skeleton-2"].map((keyId) => (
                <CreationSkeleton key={keyId} keyId={keyId} />
              ))
            : null}

          {!isLoading && errorMessage ? (
            <div className="w-full rounded-[1.75rem] border border-white/8 bg-[#311519]/95 p-6 text-sm text-white/70">
              {errorMessage}
            </div>
          ) : null}

          {showEmptyState ? (
            <div className="w-full rounded-[1.75rem] border border-dashed border-white/12 bg-[#311519]/70 p-6 text-sm text-white/65">
              No creations yet. Start a game from the dashboard to see it here.
            </div>
          ) : null}

          {!isLoading && !errorMessage
            ? creations.map((creation) => (
                <CreationCard key={creation.id} creation={creation} />
              ))
            : null}
        </motion.div>

        {/* Right fade gradient for carousel scroll hint */}
        <div className="pointer-events-none absolute -right-1 top-0 h-full w-20 bg-gradient-to-l from-[#0e0406] to-transparent" />
      </div>
    </motion.section>
  );
}
