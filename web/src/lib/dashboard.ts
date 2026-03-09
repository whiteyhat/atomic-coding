import type {
  DashboardActivityItem,
  DashboardGameSummary,
  DashboardProfile,
  DashboardTokenStatus,
  GameWithBuild,
  TokenLaunch,
} from "./types";

export function computeDashboardStats(games: GameWithBuild[]) {
  return {
    totalGames: games.length,
    publishedGames: games.filter((g) => g.is_published).length,
    totalAtoms: games.reduce(
      (sum, g) => sum + (g.active_build?.atom_count ?? 0),
      0,
    ),
    successfulBuilds: games.filter(
      (g) => g.active_build?.status === "success",
    ).length,
  };
}

export function getTimeOfDayGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function getDashboardDisplayName(profile: DashboardProfile): string {
  if (profile.displayName) return profile.displayName;
  if (profile.email) return profile.email.split("@")[0];
  if (profile.walletAddress)
    return `${profile.walletAddress.slice(0, 6)}...${profile.walletAddress.slice(-4)}`;
  return "Creator";
}

export function getGenreGradient(genre: string | null | undefined): string {
  switch (genre) {
    case "fps-arena":
      return "from-rose-600 to-orange-400";
    case "hex-strategy":
      return "from-red-700 to-amber-500";
    case "side-scroller":
      return "from-sky-600 to-cyan-300";
    case "rpg":
      return "from-fuchsia-700 to-purple-400";
    case "tower-defense":
      return "from-emerald-600 to-lime-300";
    case "racing":
      return "from-yellow-500 to-red-500";
    default:
      return "from-stone-700 to-rose-900";
  }
}

export function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function filterDashboardCollections(
  creations: DashboardGameSummary[],
  activity: DashboardActivityItem[],
  query: string,
) {
  if (!query.trim()) return { creations, activity };
  const q = query.toLowerCase();
  return {
    creations: creations.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.genre?.toLowerCase().includes(q) ||
        c.description?.toLowerCase().includes(q),
    ),
    activity: activity.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        a.gameName.toLowerCase().includes(q) ||
        a.description?.toLowerCase().includes(q),
    ),
  };
}

export function mapGamesToDashboardCreations(
  games: GameWithBuild[],
  tokensByGame?: Record<string, TokenLaunch>,
): DashboardGameSummary[] {
  return [...games]
    .sort(
      (a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
    )
    .map((game) => {
      const token = tokensByGame?.[game.name];
      const tokenStatus: DashboardTokenStatus = token?.status ?? "none";

      return {
        id: game.id,
        name: game.name,
        description: game.description,
        genre: game.genre,
        thumbnailUrl: game.thumbnail_url,
        isPublished: game.is_published,
        publicSlug: game.public_slug,
        tokenStatus,
        externalCount: 0,
        topLeaderboardScore: null,
        lastChatAt: null,
        latestBuild: game.active_build
          ? {
              status: game.active_build.status,
              atomCount: game.active_build.atom_count,
            }
          : null,
        currentWarRoom: null,
        updatedAt: game.updated_at,
      };
    });
}
