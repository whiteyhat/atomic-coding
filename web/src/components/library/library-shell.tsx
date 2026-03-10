"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  ChevronDown,
  Eye,
  Filter,
  Gamepad2,
  Globe2,
  Grid3X3,
  Layers3,
  Loader2,
  type LucideIcon,
  RefreshCcw,
  Rocket,
  Search,
  Wrench,
} from "lucide-react";
import { listMyGames } from "@/lib/api";
import { formatRelativeTime, getDashboardDisplayName } from "@/lib/dashboard";
import { GAME_GENRES, getGameGenre } from "@/lib/game-genres";
import {
  DEFAULT_LIBRARY_FILTERS,
  type LibraryBuildFilter,
  type LibraryCreation,
  type LibraryFilters,
  type LibraryFormatFilter,
  type LibrarySort,
  type LibraryVisibilityFilter,
  LIBRARY_PAGE_SIZE,
  getActiveLibraryFilterCount,
  getLibraryFilteredCreations,
  getLibraryFiltersFromSearchParams,
  getLibraryPaginationResetKey,
  getLibrarySearchParams,
  getLibrarySummary,
  getLibraryVisibleCountAfterFilterChange,
  getNextLibraryVisibleCount,
  mapGamesToLibraryCreations,
  splitLibrarySpotlight,
} from "@/lib/library";
import { useAppAuth } from "@/lib/auth-provider";
import { cn } from "@/lib/utils";
import { CreateGameWizard } from "@/components/games/create-game-wizard";
import { PublishDialog } from "@/components/games/publish-dialog";
import { fadeInUp, cardHover, cardTap, staggerContainer } from "@/components/dashboard/dashboard-animations";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const BUILD_FILTER_OPTIONS: Array<{
  value: LibraryBuildFilter;
  label: string;
}> = [
  { value: "all", label: "All builds" },
  { value: "ready", label: "Ready" },
  { value: "building", label: "Building" },
  { value: "error", label: "Error" },
  { value: "none", label: "No build" },
];

const FORMAT_FILTER_OPTIONS: Array<{
  value: LibraryFormatFilter;
  label: string;
}> = [
  { value: "all", label: "All formats" },
  { value: "2d", label: "2D only" },
  { value: "3d", label: "3D only" },
];

const VISIBILITY_FILTER_OPTIONS: Array<{
  value: LibraryVisibilityFilter;
  label: string;
}> = [
  { value: "all", label: "All visibility" },
  { value: "published", label: "Published" },
  { value: "private", label: "Private" },
];

const SORT_OPTIONS: Array<{
  value: LibrarySort;
  label: string;
}> = [
  { value: "updated", label: "Recently updated" },
  { value: "created", label: "Recently created" },
  { value: "name", label: "Name (A-Z)" },
];

function getBuildMeta(status: LibraryCreation["activeBuildStatus"]) {
  switch (status) {
    case "success":
      return {
        label: "Ready build",
        shortLabel: "Ready",
        className:
          "border-emerald-300/30 bg-emerald-400/15 text-emerald-50",
        detailClassName: "text-emerald-300",
      };
    case "building":
      return {
        label: "Build running",
        shortLabel: "Building",
        className: "border-sky-300/30 bg-sky-400/15 text-sky-50",
        detailClassName: "text-sky-300",
      };
    case "error":
      return {
        label: "Build failed",
        shortLabel: "Error",
        className: "border-red-300/30 bg-red-400/15 text-red-50",
        detailClassName: "text-red-300",
      };
    default:
      return {
        label: "No build yet",
        shortLabel: "No build",
        className: "border-white/12 bg-white/8 text-white/70",
        detailClassName: "text-white/45",
      };
  }
}

function getFormatBadgeClass(gameFormat: LibraryCreation["gameFormat"]) {
  return gameFormat === "2d"
    ? "border-cyan-300/30 bg-cyan-400/15 text-cyan-50"
    : "border-fuchsia-300/30 bg-fuchsia-400/15 text-fuchsia-50";
}

function getVisibilityBadgeClass(isPublished: boolean) {
  return isPublished
    ? "border-amber-300/30 bg-amber-400/15 text-amber-50"
    : "border-white/12 bg-white/8 text-white/75";
}

function getGenreBadgeClass(creation: LibraryCreation) {
  return (
    getGameGenre(creation.genre)?.pillClass ??
    "border-white/15 bg-white/8 text-white/80"
  );
}

function getGenreGlowClass(creation: LibraryCreation) {
  return (
    getGameGenre(creation.genre)?.gradientClass ??
    "from-rose-500/30 via-orange-300/15 to-transparent"
  );
}

function getCreationGenreOptions(creations: LibraryCreation[]) {
  const options = GAME_GENRES.map((genre) => ({
    value: genre.slug,
    label: genre.displayName,
  }));
  const knownGenres = new Set(options.map((option) => option.value));
  const extraGenres: Array<{ value: string; label: string }> = [];

  for (const creation of creations) {
    if (!creation.genre || knownGenres.has(creation.genre)) continue;
    knownGenres.add(creation.genre);
    extraGenres.push({
      value: creation.genre,
      label: creation.genreLabel,
    });
  }

  return [{ value: "all", label: "All genres" }, ...options, ...extraGenres];
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  accentClassName,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  accentClassName: string;
}) {
  return (
    <div className="rounded-[1.5rem] border border-white/8 bg-[#240d10]/80 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-white/55">{label}</span>
        <div
          className={cn(
            "flex size-10 items-center justify-center rounded-2xl border",
            accentClassName,
          )}
        >
          <Icon className="size-4" />
        </div>
      </div>
      <div className="mt-4 text-3xl font-semibold tracking-tight text-white">
        {value}
      </div>
    </div>
  );
}

function LibraryArtwork({
  creation,
  className,
  emojiClassName,
}: {
  creation: LibraryCreation;
  className?: string;
  emojiClassName?: string;
}) {
  return (
    <div className={cn("relative overflow-hidden", className)}>
      {creation.thumbnailUrl ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- thumbnails can come from arbitrary creator-provided remote URLs. */}
          <img
            src={creation.thumbnailUrl}
            alt={creation.name}
            className="size-full object-cover"
          />
        </>
      ) : (
        <>
          <div
            className={cn(
              "absolute inset-0 bg-gradient-to-br",
              getGenreGlowClass(creation),
            )}
          />
          <div className="absolute inset-0 bg-[linear-gradient(155deg,rgba(20,8,10,0.1)_0%,rgba(20,8,10,0.82)_88%)]" />
          <div className="absolute inset-0 flex items-center justify-center">
            <span
              className={cn(
                "text-7xl drop-shadow-[0_18px_45px_rgba(0,0,0,0.35)]",
                emojiClassName,
              )}
              role="img"
              aria-label={creation.genreLabel}
            >
              {creation.genreEmoji}
            </span>
          </div>
        </>
      )}
    </div>
  );
}

function CreationActions({
  creation,
  onPublished,
  compact = false,
}: {
  creation: LibraryCreation;
  onPublished: () => void;
  compact?: boolean;
}) {
  const actionSize = compact ? "sm" : "default";

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        asChild
        size={actionSize}
        className="rounded-full bg-rose-500 text-white shadow-[0_8px_24px_rgba(244,63,94,0.22)] hover:bg-rose-400"
      >
        <Link href={`/games/${encodeURIComponent(creation.name)}`}>
          Open Studio
          <ArrowRight className="size-4" />
        </Link>
      </Button>

      {creation.isPublished && creation.publicSlug ? (
        <>
          <Button
            asChild
            variant="outline"
            size={actionSize}
            className="rounded-full border-white/12 bg-white/6 text-white hover:bg-white/10"
          >
            <Link href={`/play/${encodeURIComponent(creation.publicSlug)}`}>
              <Eye className="size-4" />
              Play Live
            </Link>
          </Button>

          <Button
            asChild
            variant="ghost"
            size={actionSize}
            className="rounded-full text-white/75 hover:bg-white/8 hover:text-white"
          >
            <Link href={`/games/${encodeURIComponent(creation.name)}/board`}>
              <Grid3X3 className="size-4" />
              Leaderboard
            </Link>
          </Button>
        </>
      ) : (
        <PublishDialog
          gameName={creation.name}
          isPublished={creation.isPublished}
          publicSlug={creation.publicSlug}
          onPublished={onPublished}
          triggerVariant="ghost"
          triggerSize={actionSize}
          triggerClassName="rounded-full bg-white/10 text-white hover:bg-white/14"
        />
      )}
    </div>
  );
}

function SpotlightPanel({
  creation,
  onPublished,
}: {
  creation: LibraryCreation;
  onPublished: () => void;
}) {
  const buildMeta = getBuildMeta(creation.activeBuildStatus);

  return (
    <motion.section
      variants={fadeInUp}
      initial="hidden"
      animate="visible"
      className="overflow-hidden rounded-[2rem] border border-white/8 bg-[#2b1115]/95 shadow-[0_24px_90px_rgba(17,5,8,0.34)]"
    >
      <div className="grid lg:grid-cols-[minmax(0,1.1fr)_0.9fr]">
        <div className="relative min-h-[320px]">
          <LibraryArtwork
            creation={creation}
            className="absolute inset-0"
            emojiClassName="text-8xl"
          />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.18),transparent_35%),linear-gradient(180deg,transparent_0%,rgba(15,5,7,0.85)_100%)]" />

          <div className="absolute left-5 right-5 top-5 flex flex-wrap items-center gap-2">
            <Badge
              className={cn(
                "rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]",
                getGenreBadgeClass(creation),
              )}
            >
              {creation.genreLabel}
            </Badge>
            <Badge
              className={cn(
                "rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]",
                getFormatBadgeClass(creation.gameFormat),
              )}
            >
              {creation.gameFormat.toUpperCase()}
            </Badge>
          </div>

          <div className="absolute inset-x-5 bottom-5 rounded-[1.5rem] border border-white/8 bg-black/25 p-4 backdrop-blur-md">
            <div className="text-sm text-white/55">Featured creation</div>
            <div className="mt-1 text-2xl font-semibold text-white">
              {creation.name}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-white/55">
              <span>Updated {formatRelativeTime(creation.updatedAt)}</span>
              <span className="text-white/25">•</span>
              <span className={buildMeta.detailClassName}>{buildMeta.label}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col justify-between p-6 md:p-8">
          <div>
            <Badge className="rounded-full border border-rose-300/20 bg-rose-500/12 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-rose-200">
              Spotlight
            </Badge>

            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white">
              {creation.name}
            </h2>

            <p className="mt-3 max-w-xl text-sm leading-7 text-white/60">
              {creation.description ??
                "No description yet. Open Studio to shape the mechanics, writing, and world details."}
            </p>

            <div className="mt-6 flex flex-wrap gap-2">
              <Badge
                className={cn(
                  "rounded-full border px-3 py-1 text-[11px] font-medium",
                  getVisibilityBadgeClass(creation.isPublished),
                )}
              >
                {creation.isPublished ? "Published" : "Private draft"}
              </Badge>
              <Badge
                className={cn(
                  "rounded-full border px-3 py-1 text-[11px] font-medium",
                  buildMeta.className,
                )}
              >
                {buildMeta.shortLabel}
              </Badge>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-[1.25rem] border border-white/8 bg-white/[0.03] p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-white/35">
                  Updated
                </div>
                <div className="mt-2 text-lg font-semibold text-white">
                  {formatRelativeTime(creation.updatedAt)}
                </div>
              </div>
              <div className="rounded-[1.25rem] border border-white/8 bg-white/[0.03] p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-white/35">
                  Atoms
                </div>
                <div className="mt-2 text-lg font-semibold text-white">
                  {creation.atomCount ?? 0}
                </div>
              </div>
              <div className="rounded-[1.25rem] border border-white/8 bg-white/[0.03] p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-white/35">
                  Build state
                </div>
                <div className={cn("mt-2 text-lg font-semibold", buildMeta.detailClassName)}>
                  {buildMeta.label}
                </div>
              </div>
              <div className="rounded-[1.25rem] border border-white/8 bg-white/[0.03] p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-white/35">
                  Visibility
                </div>
                <div className="mt-2 text-lg font-semibold text-white">
                  {creation.isPublished ? "Live on /play" : "Private"}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8">
            <CreationActions creation={creation} onPublished={onPublished} />
          </div>
        </div>
      </div>
    </motion.section>
  );
}

function LibraryCard({
  creation,
  onPublished,
}: {
  creation: LibraryCreation;
  onPublished: () => void;
}) {
  const buildMeta = getBuildMeta(creation.activeBuildStatus);

  return (
    <motion.article
      variants={fadeInUp}
      whileHover={cardHover}
      whileTap={cardTap}
      className="group overflow-hidden rounded-[1.75rem] border border-white/8 bg-[#261014]/95 shadow-[0_18px_55px_rgba(14,4,6,0.28)]"
    >
      <Link href={`/games/${encodeURIComponent(creation.name)}`} className="block">
        <div className="relative h-52 overflow-hidden">
          <LibraryArtwork creation={creation} className="absolute inset-0" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(14,4,6,0.05)_0%,rgba(14,4,6,0.86)_100%)]" />

          <div className="absolute left-4 right-4 top-4 flex items-start justify-between gap-2">
            <Badge
              className={cn(
                "rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]",
                getGenreBadgeClass(creation),
              )}
            >
              {creation.genreLabel}
            </Badge>
            <Badge
              className={cn(
                "rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]",
                getFormatBadgeClass(creation.gameFormat),
              )}
            >
              {creation.gameFormat.toUpperCase()}
            </Badge>
          </div>

          <div className="absolute inset-x-4 bottom-4 flex items-end justify-between gap-3">
            <div>
              <div className="text-[11px] uppercase tracking-[0.22em] text-white/35">
                Updated
              </div>
              <div className="mt-1 text-sm text-white/80">
                {formatRelativeTime(creation.updatedAt)}
              </div>
            </div>
            <Badge
              className={cn(
                "rounded-full border px-2.5 py-1 text-[10px] font-medium",
                buildMeta.className,
              )}
            >
              {buildMeta.shortLabel}
            </Badge>
          </div>
        </div>
      </Link>

      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link href={`/games/${encodeURIComponent(creation.name)}`}>
              <h3 className="truncate text-xl font-semibold tracking-tight text-white transition-colors group-hover:text-rose-300">
                {creation.name}
              </h3>
            </Link>
            <p className="mt-2 line-clamp-2 text-sm leading-6 text-white/55">
              {creation.description ?? "No description yet."}
            </p>
          </div>

          <Badge
            className={cn(
              "rounded-full border px-2.5 py-1 text-[10px] font-medium",
              getVisibilityBadgeClass(creation.isPublished),
            )}
          >
            {creation.isPublished ? "Published" : "Private"}
          </Badge>
        </div>

        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-white/45">
            {creation.atomCount ?? 0} atoms
          </span>
          <span className={buildMeta.detailClassName}>{buildMeta.label}</span>
        </div>

        <div className="mt-5 translate-y-0 opacity-100 transition duration-200 lg:translate-y-2 lg:opacity-0 lg:group-hover:translate-y-0 lg:group-hover:opacity-100 lg:group-focus-within:translate-y-0 lg:group-focus-within:opacity-100">
          <CreationActions
            creation={creation}
            onPublished={onPublished}
            compact
          />
        </div>
      </div>
    </motion.article>
  );
}

function SpotlightSkeleton() {
  return (
    <div className="overflow-hidden rounded-[2rem] border border-white/8 bg-[#261014]/95">
      <div className="grid lg:grid-cols-[minmax(0,1.1fr)_0.9fr]">
        <div className="h-[340px] animate-pulse bg-white/8" />
        <div className="space-y-4 p-6 md:p-8">
          <div className="h-6 w-24 animate-pulse rounded-full bg-white/10" />
          <div className="h-10 w-3/4 animate-pulse rounded-full bg-white/10" />
          <div className="h-5 w-full animate-pulse rounded-full bg-white/7" />
          <div className="h-5 w-4/5 animate-pulse rounded-full bg-white/7" />
          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={`spotlight-skeleton-${index}`}
                className="h-24 animate-pulse rounded-[1.25rem] bg-white/6"
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function LibraryCardSkeleton({ index }: { index: number }) {
  return (
    <div
      key={`library-card-skeleton-${index}`}
      className="overflow-hidden rounded-[1.75rem] border border-white/8 bg-[#261014]/95"
    >
      <div className="h-52 animate-pulse bg-white/8" />
      <div className="space-y-3 p-5">
        <div className="h-6 w-2/3 animate-pulse rounded-full bg-white/10" />
        <div className="h-4 w-full animate-pulse rounded-full bg-white/7" />
        <div className="h-4 w-4/5 animate-pulse rounded-full bg-white/7" />
        <div className="h-10 animate-pulse rounded-[1rem] bg-white/6" />
      </div>
    </div>
  );
}

function FilterSelect({
  value,
  onValueChange,
  placeholder,
  options,
}: {
  value: string;
  onValueChange: (value: string) => void;
  placeholder: string;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className="h-11 w-full rounded-full border-white/10 bg-white/6 px-4 text-white/80 hover:bg-white/8">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="border-white/10 bg-[#1b0b0f] text-white">
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function EmptyLibraryState({ onCreate }: { onCreate: () => void }) {
  return (
    <motion.section
      variants={fadeInUp}
      initial="hidden"
      animate="visible"
      className="rounded-[2rem] border border-dashed border-white/12 bg-[#261014]/70 p-8 text-center shadow-[0_18px_55px_rgba(14,4,6,0.18)]"
    >
      <div className="mx-auto flex size-16 items-center justify-center rounded-3xl border border-rose-300/20 bg-rose-500/10 text-rose-200">
        <Gamepad2 className="size-7" />
      </div>
      <h2 className="mt-5 text-2xl font-semibold text-white">
        Your library is ready for its first world
      </h2>
      <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-white/60">
        Create a game to start building a polished catalog of prototypes,
        published launches, and experiments you can revisit in one glance.
      </p>
      <Button
        onClick={onCreate}
        className="mt-6 rounded-full bg-rose-500 px-6 text-white shadow-[0_8px_24px_rgba(244,63,94,0.22)] hover:bg-rose-400"
      >
        Create your first game
        <ArrowRight className="size-4" />
      </Button>
    </motion.section>
  );
}

export function LibraryShell() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(LIBRARY_PAGE_SIZE);
  const [isNavigatingFilters, startFilterTransition] = useTransition();
  const { user, ready, authenticated } = useAppAuth();
  const shouldLoadGames = ready && authenticated && !!user?.id;
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const previousResetKeyRef = useRef(
    getLibraryPaginationResetKey(DEFAULT_LIBRARY_FILTERS),
  );
  const intersectionLockRef = useRef(false);

  const { data: userGames, error, isLoading, mutate } = useSWR(
    shouldLoadGames ? "my-games" : null,
    listMyGames,
  );

  const creations = mapGamesToLibraryCreations(userGames ?? []);
  const filters = getLibraryFiltersFromSearchParams(searchParams);
  const filteredCreations = getLibraryFilteredCreations(creations, filters);
  const summary = getLibrarySummary(creations);
  const genreOptions = getCreationGenreOptions(creations);
  const activeFilterCount = getActiveLibraryFilterCount(filters);
  const paginationResetKey = getLibraryPaginationResetKey(filters);
  const { spotlight, gridItems } = splitLibrarySpotlight(filteredCreations);
  const visibleGridItems = gridItems.slice(0, visibleCount);
  const hasMoreGridItems = visibleCount < gridItems.length;
  const isLibraryLoading =
    !ready || (shouldLoadGames && isLoading && creations.length === 0);
  const showEmptyLibrary = !isLibraryLoading && !error && creations.length === 0;
  const showFilteredEmpty =
    !isLibraryLoading &&
    !error &&
    creations.length > 0 &&
    filteredCreations.length === 0;

  useEffect(() => {
    setVisibleCount((currentVisibleCount) =>
      getLibraryVisibleCountAfterFilterChange({
        currentVisibleCount,
        totalCount: gridItems.length,
        previousResetKey: previousResetKeyRef.current,
        nextResetKey: paginationResetKey,
      }),
    );
    previousResetKeyRef.current = paginationResetKey;
    intersectionLockRef.current = false;
  }, [gridItems.length, paginationResetKey]);

  useEffect(() => {
    if (!hasMoreGridItems || !sentinelRef.current) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;

        if (!entry.isIntersecting) {
          intersectionLockRef.current = false;
          return;
        }

        if (intersectionLockRef.current) return;

        intersectionLockRef.current = true;
        setVisibleCount((currentVisibleCount) =>
          getNextLibraryVisibleCount({
            currentVisibleCount,
            totalCount: gridItems.length,
          }),
        );
      },
      {
        rootMargin: "240px 0px 240px 0px",
      },
    );

    observer.observe(sentinelRef.current);

    return () => observer.disconnect();
  }, [gridItems.length, hasMoreGridItems]);

  const displayName = getDashboardDisplayName({
    id: user?.id ?? "",
    displayName: null,
    email: user?.email?.address ?? null,
    walletAddress: null,
    avatarUrl: null,
  });

  function updateFilters(nextFilters: LibraryFilters) {
    const nextParams = getLibrarySearchParams(nextFilters);
    const nextQuery = nextParams.toString();
    const nextHref = nextQuery ? `${pathname}?${nextQuery}` : pathname;

    startFilterTransition(() => {
      router.replace(nextHref, { scroll: false });
    });
  }

  function updateSingleFilter<Key extends keyof LibraryFilters>(
    key: Key,
    value: LibraryFilters[Key],
  ) {
    updateFilters({
      ...filters,
      [key]: value,
    });
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#3a1a1f_0%,#1b0b0f_48%,#0f0508_100%)] px-3 py-4 text-stone-50 md:px-5 md:py-5">
      <div className="mx-auto flex max-w-[1920px] gap-5">
        <DashboardSidebar activeId="library" />

        <motion.main
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="min-w-0 flex-1 space-y-5"
        >
          <DashboardHeader displayName={displayName} />

          <motion.section
            variants={fadeInUp}
            initial="hidden"
            animate="visible"
            className="overflow-hidden rounded-[2rem] border border-white/8 bg-[#311519]/95 shadow-[0_24px_90px_rgba(24,8,10,0.3)]"
          >
            <div className="grid gap-8 p-6 md:p-8 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)] xl:p-10">
              <div className="relative">
                <div className="absolute inset-0 rounded-[2rem] bg-[radial-gradient(circle_at_top_left,rgba(244,63,94,0.18),transparent_40%),radial-gradient(circle_at_bottom_left,rgba(59,130,246,0.14),transparent_30%)]" />
                <div className="relative">
                  <Badge className="rounded-full border border-rose-300/20 bg-rose-500/12 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-rose-200">
                    Creator Library
                  </Badge>

                  <h1 className="mt-5 max-w-3xl text-4xl font-semibold tracking-tight text-white md:text-5xl">
                    Every world you&apos;re building, in one polished glance.
                  </h1>

                  <p className="mt-4 max-w-2xl text-sm leading-7 text-white/62 md:text-base">
                    Browse private experiments, published launches, and broken
                    builds from one focused surface. Search fast, filter hard,
                    and jump back into the right game without digging.
                  </p>

                  <div className="mt-7 flex flex-wrap gap-3">
                    <Button
                      onClick={() => setIsCreateOpen(true)}
                      className="rounded-full bg-rose-500 px-6 text-white shadow-[0_8px_24px_rgba(244,63,94,0.22)] hover:bg-rose-400"
                    >
                      Create New Game
                      <ArrowRight className="size-4" />
                    </Button>

                    <Button
                      asChild
                      variant="ghost"
                      className="rounded-full border border-white/10 bg-white/6 text-white/80 hover:bg-white/10 hover:text-white"
                    >
                      <Link href="/dashboard">
                        Back to Dashboard
                        <ArrowRight className="size-4" />
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <SummaryCard
                  icon={Layers3}
                  label="Total creations"
                  value={summary.total}
                  accentClassName="border-rose-300/20 bg-rose-500/12 text-rose-200"
                />
                <SummaryCard
                  icon={Globe2}
                  label="Published"
                  value={summary.published}
                  accentClassName="border-amber-300/20 bg-amber-500/12 text-amber-200"
                />
                <SummaryCard
                  icon={Rocket}
                  label="Ready builds"
                  value={summary.readyBuilds}
                  accentClassName="border-emerald-300/20 bg-emerald-500/12 text-emerald-200"
                />
                <SummaryCard
                  icon={AlertTriangle}
                  label="Broken builds"
                  value={summary.brokenBuilds}
                  accentClassName="border-red-300/20 bg-red-500/12 text-red-200"
                />
              </div>
            </div>
          </motion.section>

          {showEmptyLibrary ? (
            <EmptyLibraryState onCreate={() => setIsCreateOpen(true)} />
          ) : (
            <>
              <motion.section
                variants={fadeInUp}
                initial="hidden"
                animate="visible"
                className="sticky top-4 z-20 rounded-[1.75rem] border border-white/8 bg-[#1c0b0f]/85 p-4 shadow-[0_20px_60px_rgba(14,4,6,0.22)] backdrop-blur-xl"
              >
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                    <div className="min-w-0 flex-1">
                      <InputGroup className="h-12 rounded-full border-white/10 bg-white/6">
                        <InputGroupAddon
                          align="inline-start"
                          className="text-white/35"
                        >
                          <Search className="size-4" />
                        </InputGroupAddon>
                        <InputGroupInput
                          value={filters.q}
                          onChange={(event) =>
                            updateSingleFilter("q", event.target.value)
                          }
                          placeholder="Search creations, mechanics, or ideas..."
                          className="text-white placeholder:text-white/30"
                        />
                      </InputGroup>
                    </div>

                    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 sm:grid-cols-[240px_auto] lg:min-w-[360px]">
                      <FilterSelect
                        value={filters.sort}
                        onValueChange={(value) =>
                          updateSingleFilter("sort", value as LibrarySort)
                        }
                        placeholder="Sort by"
                        options={SORT_OPTIONS}
                      />

                      <Collapsible
                        open={mobileFiltersOpen}
                        onOpenChange={setMobileFiltersOpen}
                        className="lg:hidden"
                      >
                        <CollapsibleTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            className="h-11 rounded-full border-white/10 bg-white/6 px-4 text-white/80 hover:bg-white/10"
                          >
                            <Filter className="size-4" />
                            Filters
                            {activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
                            <ChevronDown
                              className={cn(
                                "size-4 transition-transform",
                                mobileFiltersOpen && "rotate-180",
                              )}
                            />
                          </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="mt-3 space-y-3">
                          <div className="grid gap-3 sm:grid-cols-2">
                            <FilterSelect
                              value={filters.genre}
                              onValueChange={(value) =>
                                updateSingleFilter("genre", value)
                              }
                              placeholder="Genre"
                              options={genreOptions}
                            />
                            <FilterSelect
                              value={filters.format}
                              onValueChange={(value) =>
                                updateSingleFilter(
                                  "format",
                                  value as LibraryFormatFilter,
                                )
                              }
                              placeholder="Format"
                              options={FORMAT_FILTER_OPTIONS}
                            />
                            <FilterSelect
                              value={filters.visibility}
                              onValueChange={(value) =>
                                updateSingleFilter(
                                  "visibility",
                                  value as LibraryVisibilityFilter,
                                )
                              }
                              placeholder="Visibility"
                              options={VISIBILITY_FILTER_OPTIONS}
                            />
                            <FilterSelect
                              value={filters.build}
                              onValueChange={(value) =>
                                updateSingleFilter(
                                  "build",
                                  value as LibraryBuildFilter,
                                )
                              }
                              placeholder="Build state"
                              options={BUILD_FILTER_OPTIONS}
                            />
                          </div>
                        </CollapsibleContent>
                      </Collapsible>

                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => updateFilters(DEFAULT_LIBRARY_FILTERS)}
                        disabled={activeFilterCount === 0}
                        className="hidden rounded-full border border-white/10 bg-white/6 px-4 text-white/70 hover:bg-white/10 hover:text-white lg:inline-flex"
                      >
                        Clear
                      </Button>
                    </div>
                  </div>

                  <div className="hidden gap-3 lg:grid lg:grid-cols-4">
                    <FilterSelect
                      value={filters.genre}
                      onValueChange={(value) => updateSingleFilter("genre", value)}
                      placeholder="Genre"
                      options={genreOptions}
                    />
                    <FilterSelect
                      value={filters.format}
                      onValueChange={(value) =>
                        updateSingleFilter(
                          "format",
                          value as LibraryFormatFilter,
                        )
                      }
                      placeholder="Format"
                      options={FORMAT_FILTER_OPTIONS}
                    />
                    <FilterSelect
                      value={filters.visibility}
                      onValueChange={(value) =>
                        updateSingleFilter(
                          "visibility",
                          value as LibraryVisibilityFilter,
                        )
                      }
                      placeholder="Visibility"
                      options={VISIBILITY_FILTER_OPTIONS}
                    />
                    <FilterSelect
                      value={filters.build}
                      onValueChange={(value) =>
                        updateSingleFilter("build", value as LibraryBuildFilter)
                      }
                      placeholder="Build state"
                      options={BUILD_FILTER_OPTIONS}
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2 text-white/60">
                      <span>
                        {filteredCreations.length}{" "}
                        {filteredCreations.length === 1
                          ? "creation"
                          : "creations"}
                      </span>
                      <span className="text-white/20">•</span>
                      <span>{summary.total} total in library</span>
                    </div>

                    <div className="flex items-center gap-2 text-white/50">
                      {isNavigatingFilters ? (
                        <>
                          <Loader2 className="size-4 animate-spin" />
                          Updating filters
                        </>
                      ) : activeFilterCount > 0 ? (
                        `${activeFilterCount} active filter${activeFilterCount === 1 ? "" : "s"}`
                      ) : (
                        "Showing your full catalog"
                      )}
                    </div>
                  </div>

                  {activeFilterCount > 0 ? (
                    <div className="lg:hidden">
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => updateFilters(DEFAULT_LIBRARY_FILTERS)}
                        className="rounded-full border border-white/10 bg-white/6 px-4 text-white/70 hover:bg-white/10 hover:text-white"
                      >
                        Clear filters
                      </Button>
                    </div>
                  ) : null}
                </div>
              </motion.section>

              {error && creations.length === 0 ? (
                <motion.section
                  variants={fadeInUp}
                  initial="hidden"
                  animate="visible"
                  className="rounded-[1.75rem] border border-red-300/15 bg-red-500/8 p-6 shadow-[0_18px_55px_rgba(14,4,6,0.18)]"
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="text-lg font-semibold text-white">
                        Unable to load your library
                      </div>
                      <p className="mt-2 text-sm leading-6 text-white/60">
                        Try again to pull your latest creations and build status.
                      </p>
                    </div>

                    <Button
                      onClick={() => void mutate()}
                      className="rounded-full bg-white/10 text-white hover:bg-white/14"
                    >
                      <RefreshCcw className="size-4" />
                      Retry
                    </Button>
                  </div>
                </motion.section>
              ) : null}

              {isLibraryLoading ? (
                <div className="space-y-5">
                  <SpotlightSkeleton />
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {Array.from({ length: 6 }).map((_, index) => (
                      <LibraryCardSkeleton
                        key={`library-skeleton-${index}`}
                        index={index}
                      />
                    ))}
                  </div>
                </div>
              ) : null}

              {!isLibraryLoading && !error && spotlight ? (
                <SpotlightPanel
                  creation={spotlight}
                  onPublished={() => void mutate()}
                />
              ) : null}

              {showFilteredEmpty ? (
                <motion.section
                  variants={fadeInUp}
                  initial="hidden"
                  animate="visible"
                  className="rounded-[1.75rem] border border-dashed border-white/12 bg-[#261014]/70 p-8 text-center"
                >
                  <div className="mx-auto flex size-14 items-center justify-center rounded-3xl border border-white/10 bg-white/6 text-white/65">
                    <Wrench className="size-6" />
                  </div>
                  <h2 className="mt-5 text-2xl font-semibold text-white">
                    No creations match this filter set
                  </h2>
                  <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-white/60">
                    Reset the filters and search query to bring your full
                    creation catalog back into view.
                  </p>
                  <Button
                    onClick={() => updateFilters(DEFAULT_LIBRARY_FILTERS)}
                    className="mt-6 rounded-full bg-white/10 text-white hover:bg-white/14"
                  >
                    Clear filters
                  </Button>
                </motion.section>
              ) : null}

              {!isLibraryLoading && !error && visibleGridItems.length > 0 ? (
                <motion.section
                  variants={fadeInUp}
                  initial="hidden"
                  animate="visible"
                  className="space-y-4"
                >
                  <div className="flex flex-wrap items-end justify-between gap-3 px-1">
                    <div>
                      <h2 className="text-xl font-semibold text-white">
                        More creations
                      </h2>
                      <p className="mt-1 text-sm text-white/50">
                        Jump into the rest of your catalog, with quick actions
                        ready on hover.
                      </p>
                    </div>

                    <div className="text-sm text-white/45">
                      Showing {visibleGridItems.length} of {gridItems.length}
                    </div>
                  </div>

                  <motion.div
                    variants={staggerContainer}
                    initial="hidden"
                    animate="visible"
                    className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
                  >
                    {visibleGridItems.map((creation) => (
                      <LibraryCard
                        key={creation.id}
                        creation={creation}
                        onPublished={() => void mutate()}
                      />
                    ))}
                  </motion.div>

                  {hasMoreGridItems ? (
                    <div
                      ref={sentinelRef}
                      className="flex min-h-16 items-center justify-center rounded-full border border-dashed border-white/10 bg-white/[0.03] px-4 text-sm text-white/50"
                    >
                      <Loader2 className="mr-2 size-4 animate-spin" />
                      Keep scrolling to reveal more creations
                    </div>
                  ) : gridItems.length > 0 ? (
                    <div className="flex items-center justify-center rounded-full border border-white/8 bg-white/[0.03] px-4 py-4 text-sm text-white/45">
                      End of library results
                    </div>
                  ) : null}
                </motion.section>
              ) : null}
            </>
          )}
        </motion.main>
      </div>

      <CreateGameWizard
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
      />
    </div>
  );
}
