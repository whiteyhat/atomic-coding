import { describe, expect, it } from "vitest";
import type { GameWithBuild } from "./types";
import {
  DEFAULT_LIBRARY_FILTERS,
  getLibraryFilteredCreations,
  getLibraryPaginationResetKey,
  getLibraryVisibleCountAfterFilterChange,
  mapGamesToLibraryCreations,
  splitLibrarySpotlight,
} from "./library";

function makeGame(
  overrides: Partial<GameWithBuild> & Pick<GameWithBuild, "id" | "name">,
): GameWithBuild {
  return {
    id: overrides.id,
    name: overrides.name,
    description: overrides.description ?? null,
    active_build_id: overrides.active_build_id ?? null,
    user_id: overrides.user_id ?? "user-1",
    genre: overrides.genre ?? "arena-dogfighter",
    game_format: overrides.game_format ?? "3d",
    thumbnail_url: overrides.thumbnail_url ?? null,
    is_published: overrides.is_published ?? false,
    published_at: overrides.published_at ?? null,
    public_slug: overrides.public_slug ?? null,
    published_bundle_url: overrides.published_bundle_url ?? null,
    created_at: overrides.created_at ?? "2026-03-10T10:00:00.000Z",
    updated_at: overrides.updated_at ?? "2026-03-10T10:00:00.000Z",
    active_build: overrides.active_build ?? null,
  };
}

const libraryCreations = mapGamesToLibraryCreations([
  makeGame({
    id: "game-1",
    name: "Meteor Rush",
    description: "Fast arcade racing loop",
    genre: "arena-dogfighter",
    game_format: "3d",
    is_published: true,
    public_slug: "meteor-rush",
    created_at: "2026-03-08T10:00:00.000Z",
    updated_at: "2026-03-10T11:00:00.000Z",
    active_build: {
      id: "build-1",
      status: "success",
      bundle_url: null,
      atom_count: 48,
      error_message: null,
      created_at: "2026-03-10T10:50:00.000Z",
    },
  }),
  makeGame({
    id: "game-2",
    name: "Builder Bay",
    description: "Grid placement and resource loops",
    genre: "base-builder",
    game_format: "3d",
    created_at: "2026-03-07T10:00:00.000Z",
    updated_at: "2026-03-09T11:00:00.000Z",
    active_build: {
      id: "build-2",
      status: "error",
      bundle_url: null,
      atom_count: 12,
      error_message: "Failed build",
      created_at: "2026-03-09T10:50:00.000Z",
    },
  }),
  makeGame({
    id: "game-3",
    name: "Shadow Sprint",
    description: "2D challenge rooms",
    genre: "side-scroller-2d-3d",
    game_format: "2d",
    created_at: "2026-03-10T08:00:00.000Z",
    updated_at: "2026-03-10T09:00:00.000Z",
    active_build: null,
  }),
  makeGame({
    id: "game-4",
    name: "Hex Legends",
    description: "Turn-based hex tactics",
    genre: "hex-grid-tbs",
    game_format: "3d",
    created_at: "2026-03-06T10:00:00.000Z",
    updated_at: "2026-03-10T08:00:00.000Z",
    active_build: {
      id: "build-4",
      status: "building",
      bundle_url: null,
      atom_count: 22,
      error_message: null,
      created_at: "2026-03-10T07:50:00.000Z",
    },
  }),
]);

describe("library filters and sorting", () => {
  it("sorts by updated_at descending by default", () => {
    const results = getLibraryFilteredCreations(
      libraryCreations,
      DEFAULT_LIBRARY_FILTERS,
    );

    expect(results.map((creation) => creation.name)).toEqual([
      "Meteor Rush",
      "Shadow Sprint",
      "Hex Legends",
      "Builder Bay",
    ]);
  });

  it("filters by query against name and description", () => {
    const results = getLibraryFilteredCreations(libraryCreations, {
      ...DEFAULT_LIBRARY_FILTERS,
      q: "resource",
    });

    expect(results.map((creation) => creation.name)).toEqual(["Builder Bay"]);
  });

  it("filters by genre, format, visibility, and build state", () => {
    expect(
      getLibraryFilteredCreations(libraryCreations, {
        ...DEFAULT_LIBRARY_FILTERS,
        genre: "side-scroller-2d-3d",
      }).map((creation) => creation.name),
    ).toEqual(["Shadow Sprint"]);

    expect(
      getLibraryFilteredCreations(libraryCreations, {
        ...DEFAULT_LIBRARY_FILTERS,
        format: "2d",
      }).map((creation) => creation.name),
    ).toEqual(["Shadow Sprint"]);

    expect(
      getLibraryFilteredCreations(libraryCreations, {
        ...DEFAULT_LIBRARY_FILTERS,
        visibility: "published",
      }).map((creation) => creation.name),
    ).toEqual(["Meteor Rush"]);

    expect(
      getLibraryFilteredCreations(libraryCreations, {
        ...DEFAULT_LIBRARY_FILTERS,
        build: "ready",
      }).map((creation) => creation.name),
    ).toEqual(["Meteor Rush"]);

    expect(
      getLibraryFilteredCreations(libraryCreations, {
        ...DEFAULT_LIBRARY_FILTERS,
        build: "building",
      }).map((creation) => creation.name),
    ).toEqual(["Hex Legends"]);

    expect(
      getLibraryFilteredCreations(libraryCreations, {
        ...DEFAULT_LIBRARY_FILTERS,
        build: "error",
      }).map((creation) => creation.name),
    ).toEqual(["Builder Bay"]);

    expect(
      getLibraryFilteredCreations(libraryCreations, {
        ...DEFAULT_LIBRARY_FILTERS,
        build: "none",
      }).map((creation) => creation.name),
    ).toEqual(["Shadow Sprint"]);
  });
});

describe("library spotlight", () => {
  it("promotes the first filtered result and excludes it from the grid", () => {
    const sortedResults = getLibraryFilteredCreations(
      libraryCreations,
      DEFAULT_LIBRARY_FILTERS,
    );
    const { spotlight, gridItems } = splitLibrarySpotlight(sortedResults);

    expect(spotlight?.name).toBe("Meteor Rush");
    expect(gridItems.map((creation) => creation.name)).toEqual([
      "Shadow Sprint",
      "Hex Legends",
      "Builder Bay",
    ]);
  });
});

describe("library pagination reset", () => {
  it("resets visible count to the first page when filters change", () => {
    const previousResetKey = getLibraryPaginationResetKey(
      DEFAULT_LIBRARY_FILTERS,
    );
    const nextResetKey = getLibraryPaginationResetKey({
      ...DEFAULT_LIBRARY_FILTERS,
      build: "error",
    });

    expect(
      getLibraryVisibleCountAfterFilterChange({
        currentVisibleCount: 18,
        totalCount: 4,
        previousResetKey,
        nextResetKey,
      }),
    ).toBe(4);
  });

  it("preserves the current visible count when filters stay the same", () => {
    const resetKey = getLibraryPaginationResetKey(DEFAULT_LIBRARY_FILTERS);

    expect(
      getLibraryVisibleCountAfterFilterChange({
        currentVisibleCount: 18,
        totalCount: 40,
        previousResetKey: resetKey,
        nextResetKey: resetKey,
      }),
    ).toBe(18);
  });
});
