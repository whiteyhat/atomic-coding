import type { GameWithBuild } from "./types";

export interface LastEditedGame {
  id: string;
  name: string;
  genre: string | null;
  updatedAt: string;
}

function toTimestamp(value: string): number {
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export function deriveLastEditedGame(
  games: GameWithBuild[],
): LastEditedGame | null {
  if (games.length === 0) return null;

  const [latest] = [...games].sort(
    (a, b) => toTimestamp(b.updated_at) - toTimestamp(a.updated_at),
  );

  if (!latest) return null;

  return {
    id: latest.id,
    name: latest.name,
    genre: latest.genre,
    updatedAt: latest.updated_at,
  };
}
