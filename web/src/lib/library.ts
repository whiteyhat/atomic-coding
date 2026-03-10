import { getDefaultGameFormatForGenre, getGameGenre } from "./game-genres";
import type { BuildStatus, GameWithBuild } from "./types";

type SearchParamsReader = Pick<URLSearchParams, "get">;

export const LIBRARY_PAGE_SIZE = 9;

export type LibraryFormatFilter = "all" | "2d" | "3d";
export type LibraryVisibilityFilter = "all" | "published" | "private";
export type LibraryBuildFilter = "all" | "ready" | "building" | "error" | "none";
export type LibrarySort = "updated" | "created" | "name";

export interface LibraryFilters {
  q: string;
  genre: string;
  format: LibraryFormatFilter;
  visibility: LibraryVisibilityFilter;
  build: LibraryBuildFilter;
  sort: LibrarySort;
}

export interface LibraryCreation {
  id: string;
  name: string;
  description: string | null;
  genre: string | null;
  genreLabel: string;
  genreEmoji: string;
  gameFormat: "2d" | "3d";
  thumbnailUrl: string | null;
  isPublished: boolean;
  publicSlug: string | null;
  activeBuildStatus: BuildStatus | null;
  atomCount: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface LibrarySummary {
  total: number;
  published: number;
  readyBuilds: number;
  brokenBuilds: number;
}

export const DEFAULT_LIBRARY_FILTERS: LibraryFilters = {
  q: "",
  genre: "all",
  format: "all",
  visibility: "all",
  build: "all",
  sort: "updated",
};

function formatGenreLabel(genre: string | null): string {
  if (!genre) return "Custom";
  return genre
    .split("-")
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

export function mapGamesToLibraryCreations(
  games: GameWithBuild[],
): LibraryCreation[] {
  return games.map((game) => {
    const genreInfo = getGameGenre(game.genre);

    return {
      id: game.id,
      name: game.name,
      description: game.description,
      genre: game.genre,
      genreLabel: genreInfo?.displayName ?? formatGenreLabel(game.genre),
      genreEmoji: genreInfo?.emoji ?? "🎮",
      gameFormat:
        game.game_format ??
        getDefaultGameFormatForGenre(game.genre) ??
        "3d",
      thumbnailUrl: game.thumbnail_url,
      isPublished: game.is_published,
      publicSlug: game.public_slug,
      activeBuildStatus: game.active_build?.status ?? null,
      atomCount: game.active_build?.atom_count ?? null,
      createdAt: game.created_at,
      updatedAt: game.updated_at,
    };
  });
}

export function getLibraryFiltersFromSearchParams(
  searchParams: SearchParamsReader,
): LibraryFilters {
  const format = searchParams.get("format");
  const visibility = searchParams.get("visibility");
  const build = searchParams.get("build");
  const sort = searchParams.get("sort");

  return {
    q: searchParams.get("q") ?? DEFAULT_LIBRARY_FILTERS.q,
    genre: searchParams.get("genre") ?? DEFAULT_LIBRARY_FILTERS.genre,
    format:
      format === "2d" || format === "3d"
        ? format
        : DEFAULT_LIBRARY_FILTERS.format,
    visibility:
      visibility === "published" || visibility === "private"
        ? visibility
        : DEFAULT_LIBRARY_FILTERS.visibility,
    build:
      build === "ready" ||
      build === "building" ||
      build === "error" ||
      build === "none"
        ? build
        : DEFAULT_LIBRARY_FILTERS.build,
    sort:
      sort === "created" || sort === "name"
        ? sort
        : DEFAULT_LIBRARY_FILTERS.sort,
  };
}

export function getLibrarySearchParams(filters: LibraryFilters): URLSearchParams {
  const params = new URLSearchParams();
  const q = filters.q.trim();

  if (q) params.set("q", q);
  if (filters.genre !== "all") params.set("genre", filters.genre);
  if (filters.format !== "all") params.set("format", filters.format);
  if (filters.visibility !== "all") {
    params.set("visibility", filters.visibility);
  }
  if (filters.build !== "all") params.set("build", filters.build);
  if (filters.sort !== "updated") params.set("sort", filters.sort);

  return params;
}

export function sortLibraryCreations(
  creations: LibraryCreation[],
  sort: LibrarySort = "updated",
): LibraryCreation[] {
  const nextItems = [...creations];

  switch (sort) {
    case "created":
      return nextItems.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    case "name":
      return nextItems.sort((a, b) => a.name.localeCompare(b.name));
    case "updated":
    default:
      return nextItems.sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      );
  }
}

export function filterLibraryCreations(
  creations: LibraryCreation[],
  filters: LibraryFilters,
): LibraryCreation[] {
  const query = filters.q.trim().toLowerCase();

  return creations.filter((creation) => {
    if (query) {
      const matchesQuery =
        creation.name.toLowerCase().includes(query) ||
        creation.description?.toLowerCase().includes(query);

      if (!matchesQuery) return false;
    }

    if (filters.genre !== "all" && creation.genre !== filters.genre) {
      return false;
    }

    if (filters.format !== "all" && creation.gameFormat !== filters.format) {
      return false;
    }

    if (
      filters.visibility === "published" &&
      !creation.isPublished
    ) {
      return false;
    }

    if (
      filters.visibility === "private" &&
      creation.isPublished
    ) {
      return false;
    }

    if (filters.build === "ready" && creation.activeBuildStatus !== "success") {
      return false;
    }

    if (
      filters.build === "building" &&
      creation.activeBuildStatus !== "building"
    ) {
      return false;
    }

    if (filters.build === "error" && creation.activeBuildStatus !== "error") {
      return false;
    }

    if (filters.build === "none" && creation.activeBuildStatus !== null) {
      return false;
    }

    return true;
  });
}

export function getLibraryFilteredCreations(
  creations: LibraryCreation[],
  filters: LibraryFilters,
): LibraryCreation[] {
  return sortLibraryCreations(
    filterLibraryCreations(creations, filters),
    filters.sort,
  );
}

export function splitLibrarySpotlight(creations: LibraryCreation[]): {
  spotlight: LibraryCreation | null;
  gridItems: LibraryCreation[];
} {
  if (creations.length === 0) {
    return { spotlight: null, gridItems: [] };
  }

  const [spotlight, ...gridItems] = creations;
  return { spotlight, gridItems };
}

export function getLibrarySummary(
  creations: LibraryCreation[],
): LibrarySummary {
  return {
    total: creations.length,
    published: creations.filter((creation) => creation.isPublished).length,
    readyBuilds: creations.filter(
      (creation) => creation.activeBuildStatus === "success",
    ).length,
    brokenBuilds: creations.filter(
      (creation) => creation.activeBuildStatus === "error",
    ).length,
  };
}

export function getLibraryPaginationResetKey(
  filters: LibraryFilters,
): string {
  return JSON.stringify([
    filters.q.trim().toLowerCase(),
    filters.genre,
    filters.format,
    filters.visibility,
    filters.build,
    filters.sort,
  ]);
}

export function getLibraryVisibleCountAfterFilterChange({
  currentVisibleCount,
  totalCount,
  previousResetKey,
  nextResetKey,
  pageSize = LIBRARY_PAGE_SIZE,
}: {
  currentVisibleCount: number;
  totalCount: number;
  previousResetKey: string;
  nextResetKey: string;
  pageSize?: number;
}): number {
  if (previousResetKey !== nextResetKey) {
    return Math.min(pageSize, totalCount);
  }

  return Math.min(currentVisibleCount, totalCount);
}

export function getNextLibraryVisibleCount({
  currentVisibleCount,
  totalCount,
  pageSize = LIBRARY_PAGE_SIZE,
}: {
  currentVisibleCount: number;
  totalCount: number;
  pageSize?: number;
}): number {
  return Math.min(currentVisibleCount + pageSize, totalCount);
}

export function getActiveLibraryFilterCount(
  filters: LibraryFilters,
): number {
  let count = 0;

  if (filters.q.trim()) count += 1;
  if (filters.genre !== "all") count += 1;
  if (filters.format !== "all") count += 1;
  if (filters.visibility !== "all") count += 1;
  if (filters.build !== "all") count += 1;
  if (filters.sort !== "updated") count += 1;

  return count;
}
