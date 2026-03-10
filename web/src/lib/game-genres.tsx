import type { LucideIcon } from "lucide-react";
import {
  Building,
  Code,
  Crosshair,
  Grid2X2,
  Grid3X3,
  Layers,
  Map,
  Plane,
  Shield,
  Swords,
  Zap,
} from "lucide-react";

export type GameFormat = "2d" | "3d";

export interface GameGenreOption {
  slug: string;
  displayName: string;
  description: string;
  emoji: string;
  icon: LucideIcon;
  gradientClass: string;
  pillClass: string;
  iconClass: string;
  supportedFormats: GameFormat[];
}

export const GAME_GENRES: GameGenreOption[] = [
  {
    slug: "hex-grid-tbs",
    displayName: "Hex Grid Strategy",
    description: "Turn-based hex grid with units and combat",
    emoji: "♟️",
    icon: Grid3X3,
    gradientClass: "from-rose-500/30 via-orange-300/15 to-transparent",
    pillClass: "border-rose-300/30 bg-rose-400/15 text-rose-100",
    iconClass: "text-rose-200",
    supportedFormats: ["3d"],
  },
  {
    slug: "side-scroller-2d-3d",
    displayName: "Side-Scroller",
    description: "2D platformer with jumping and collectibles",
    emoji: "🪂",
    icon: Layers,
    gradientClass: "from-cyan-400/30 via-sky-300/15 to-transparent",
    pillClass: "border-cyan-300/30 bg-cyan-400/15 text-cyan-50",
    iconClass: "text-cyan-100",
    supportedFormats: ["2d"],
  },
  {
    slug: "3d-roguelike-deckbuilder",
    displayName: "Roguelike Deckbuilder",
    description: "Card combat with procedural rooms",
    emoji: "🃏",
    icon: Swords,
    gradientClass: "from-fuchsia-400/30 via-violet-300/15 to-transparent",
    pillClass: "border-fuchsia-300/30 bg-fuchsia-400/15 text-fuchsia-50",
    iconClass: "text-fuchsia-100",
    supportedFormats: ["3d"],
  },
  {
    slug: "top-down-shooter",
    displayName: "Top-Down Shooter",
    description: "Aim-and-shoot arena with waves of enemies",
    emoji: "🎯",
    icon: Crosshair,
    gradientClass: "from-red-500/30 via-pink-300/15 to-transparent",
    pillClass: "border-red-300/30 bg-red-400/15 text-red-100",
    iconClass: "text-red-200",
    supportedFormats: ["2d"],
  },
  {
    slug: "arena-dogfighter",
    displayName: "Arena Dogfighter",
    description: "Aerial combat with flight physics",
    emoji: "✈️",
    icon: Plane,
    gradientClass: "from-amber-400/30 via-orange-300/15 to-transparent",
    pillClass: "border-amber-300/30 bg-amber-400/15 text-amber-50",
    iconClass: "text-amber-100",
    supportedFormats: ["3d"],
  },
  {
    slug: "base-builder",
    displayName: "Base Builder",
    description: "Grid placement with resource management",
    emoji: "🏗️",
    icon: Building,
    gradientClass: "from-emerald-400/30 via-lime-300/15 to-transparent",
    pillClass: "border-emerald-300/30 bg-emerald-400/15 text-emerald-50",
    iconClass: "text-emerald-100",
    supportedFormats: ["3d"],
  },
  {
    slug: "puzzle-match",
    displayName: "Puzzle Match",
    description: "Grid-based tile matching with combos and cascades",
    emoji: "🧩",
    icon: Grid2X2,
    gradientClass: "from-yellow-400/30 via-amber-300/15 to-transparent",
    pillClass: "border-yellow-300/30 bg-yellow-400/15 text-yellow-50",
    iconClass: "text-yellow-100",
    supportedFormats: ["2d"],
  },
  {
    slug: "tower-defense-2d",
    displayName: "Tower Defense",
    description: "Place towers along a path to stop enemy waves",
    emoji: "🏰",
    icon: Shield,
    gradientClass: "from-teal-400/30 via-green-300/15 to-transparent",
    pillClass: "border-teal-300/30 bg-teal-400/15 text-teal-50",
    iconClass: "text-teal-100",
    supportedFormats: ["2d"],
  },
  {
    slug: "endless-runner",
    displayName: "Endless Runner",
    description: "Auto-scrolling obstacle course with increasing speed",
    emoji: "🏃",
    icon: Zap,
    gradientClass: "from-orange-400/30 via-yellow-300/15 to-transparent",
    pillClass: "border-orange-300/30 bg-orange-400/15 text-orange-50",
    iconClass: "text-orange-100",
    supportedFormats: ["2d"],
  },
  {
    slug: "top-down-rpg",
    displayName: "Top-Down RPG",
    description: "Tile-based exploration with NPCs and turn-based encounters",
    emoji: "🗡️",
    icon: Map,
    gradientClass: "from-indigo-400/30 via-blue-300/15 to-transparent",
    pillClass: "border-indigo-300/30 bg-indigo-400/15 text-indigo-50",
    iconClass: "text-indigo-100",
    supportedFormats: ["2d"],
  },
  {
    slug: "custom",
    displayName: "Custom",
    description: "Blank Phaser or Three.js canvas - build anything",
    emoji: "✨",
    icon: Code,
    gradientClass: "from-white/20 via-violet-300/15 to-transparent",
    pillClass: "border-white/20 bg-white/10 text-white",
    iconClass: "text-white",
    supportedFormats: ["2d", "3d"],
  },
];

export function getGameGenre(slug: string | null | undefined): GameGenreOption | null {
  if (!slug) return null;
  return GAME_GENRES.find((genre) => genre.slug === slug) ?? null;
}

export function getGameGenresForFormat(gameFormat: GameFormat | null | undefined): GameGenreOption[] {
  if (!gameFormat) {
    return GAME_GENRES;
  }

  return GAME_GENRES.filter((genre) => genre.supportedFormats.includes(gameFormat));
}

export function getDefaultGameFormatForGenre(
  slug: string | null | undefined,
): GameFormat | null {
  const genre = getGameGenre(slug);
  if (!genre || genre.supportedFormats.length !== 1) {
    return null;
  }

  return genre.supportedFormats[0];
}

export function isGenreSupportedInFormat(
  slug: string | null | undefined,
  gameFormat: GameFormat | null | undefined,
): boolean {
  const genre = getGameGenre(slug);
  if (!genre) return false;
  if (!gameFormat) return true;
  return genre.supportedFormats.includes(gameFormat);
}
