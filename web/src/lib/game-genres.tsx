import type { LucideIcon } from "lucide-react";
import {
  Building,
  Code,
  Grid3X3,
  Layers,
  Plane,
  Swords,
} from "lucide-react";

export interface GameGenreOption {
  slug: string;
  displayName: string;
  description: string;
  emoji: string;
  icon: LucideIcon;
  gradientClass: string;
  pillClass: string;
  iconClass: string;
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
  },
  {
    slug: "custom",
    displayName: "Custom",
    description: "Blank Three.js canvas - build anything",
    emoji: "✨",
    icon: Code,
    gradientClass: "from-white/20 via-violet-300/15 to-transparent",
    pillClass: "border-white/20 bg-white/10 text-white",
    iconClass: "text-white",
  },
];

export function getGameGenre(slug: string | null | undefined): GameGenreOption | null {
  if (!slug) return null;
  return GAME_GENRES.find((genre) => genre.slug === slug) ?? null;
}
