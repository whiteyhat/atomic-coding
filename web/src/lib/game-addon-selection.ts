import type { BoilerplateSummary } from "./types";
import type { GameFormat } from "./game-genres";
import { getExtensionsForFormat } from "./extension-categories";

export function getBoilerplateExternals(
  boilerplates: Pick<BoilerplateSummary, "slug" | "game_format" | "externals">[],
  genre: string | null,
  gameFormat: GameFormat | null,
): string[] {
  if (!genre || !gameFormat) {
    return [];
  }

  const boilerplate = boilerplates.find(
    (entry) => entry.slug === genre && entry.game_format === gameFormat,
  );

  return boilerplate?.externals ?? [];
}

export function pruneOptionalAddons(
  optionalAddons: Iterable<string>,
  gameFormat: GameFormat | null,
): Set<string> {
  if (!gameFormat) {
    return new Set();
  }

  const allowed = new Set(getExtensionsForFormat(gameFormat));

  return new Set(
    Array.from(optionalAddons).filter((addon) => allowed.has(addon)),
  );
}

export function getInstallableOptionalAddons(
  optionalAddons: Iterable<string>,
): string[] {
  return Array.from(new Set(optionalAddons)).sort((left, right) =>
    left.localeCompare(right),
  );
}
