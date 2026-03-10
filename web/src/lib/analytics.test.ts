import { describe, expect, it } from "vitest";
import { deriveLastEditedGame } from "./analytics";
import type { GameWithBuild } from "./types";

function makeGame(
  overrides: Partial<GameWithBuild> & {
    id: string;
    name: string;
    updated_at: string;
  },
): GameWithBuild {
  const { id, name, updated_at, ...rest } = overrides;
  return {
    id,
    name,
    description: null,
    active_build_id: null,
    user_id: "user-1",
    genre: null,
    game_format: "3d",
    thumbnail_url: null,
    is_published: false,
    published_at: null,
    public_slug: null,
    published_bundle_url: null,
    created_at: "2026-03-01T00:00:00.000Z",
    updated_at,
    ...rest,
  };
}

describe("deriveLastEditedGame", () => {
  it("returns null when there are no games", () => {
    expect(deriveLastEditedGame([])).toBeNull();
  });

  it("selects the most recently updated game", () => {
    const result = deriveLastEditedGame([
      makeGame({
        id: "game-1",
        name: "alpha",
        genre: "fps-arena",
        updated_at: "2026-03-09T10:00:00.000Z",
      }),
      makeGame({
        id: "game-2",
        name: "omega",
        genre: "side-scroller",
        updated_at: "2026-03-10T08:30:00.000Z",
      }),
    ]);

    expect(result).toEqual({
      id: "game-2",
      name: "omega",
      genre: "side-scroller",
      updatedAt: "2026-03-10T08:30:00.000Z",
    });
  });

  it("does not mutate the incoming game array order", () => {
    const games = [
      makeGame({
        id: "game-1",
        name: "first",
        updated_at: "2026-03-09T10:00:00.000Z",
      }),
      makeGame({
        id: "game-2",
        name: "second",
        updated_at: "2026-03-10T08:30:00.000Z",
      }),
    ];

    deriveLastEditedGame(games);

    expect(games.map((game) => game.id)).toEqual(["game-1", "game-2"]);
  });
});
