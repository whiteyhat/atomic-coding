"use client";

import { cn } from "@/lib/utils";
import {
  Grid3X3,
  Swords,
  Plane,
  Building,
  Layers,
  Code,
} from "lucide-react";

export interface GenreOption {
  slug: string;
  display_name: string;
  description: string;
  icon: React.ReactNode;
}

const GENRES: GenreOption[] = [
  {
    slug: "hex-grid-tbs",
    display_name: "Hex Grid Strategy",
    description: "Turn-based hex grid with units and combat",
    icon: <Grid3X3 className="size-6" />,
  },
  {
    slug: "side-scroller-2d-3d",
    display_name: "Side-Scroller",
    description: "2D platformer with jumping and collectibles",
    icon: <Layers className="size-6" />,
  },
  {
    slug: "3d-roguelike-deckbuilder",
    display_name: "Roguelike Deckbuilder",
    description: "Card combat with procedural rooms",
    icon: <Swords className="size-6" />,
  },
  {
    slug: "arena-dogfighter",
    display_name: "Arena Dogfighter",
    description: "Aerial combat with flight physics",
    icon: <Plane className="size-6" />,
  },
  {
    slug: "base-builder",
    display_name: "Base Builder",
    description: "Grid placement with resource management",
    icon: <Building className="size-6" />,
  },
  {
    slug: "custom",
    display_name: "Custom",
    description: "Blank Three.js canvas — build anything",
    icon: <Code className="size-6" />,
  },
];

interface GenreSelectorProps {
  value: string | null;
  onChange: (slug: string) => void;
}

export function GenreSelector({ value, onChange }: GenreSelectorProps) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {GENRES.map((genre) => (
        <button
          key={genre.slug}
          type="button"
          onClick={() => onChange(genre.slug)}
          className={cn(
            "flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors",
            "hover:bg-accent hover:border-primary/30",
            value === genre.slug
              ? "border-primary bg-primary/5"
              : "border-border"
          )}
        >
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">{genre.icon}</span>
            <span className="text-sm font-medium">{genre.display_name}</span>
          </div>
          <p className="text-xs text-muted-foreground">{genre.description}</p>
        </button>
      ))}
    </div>
  );
}

export { GENRES };
