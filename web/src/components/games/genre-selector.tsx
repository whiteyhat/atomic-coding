"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { type GameFormat, getGameGenresForFormat } from "@/lib/game-genres";
import { cn } from "@/lib/utils";

interface GenreSelectorProps {
  value: string | null;
  onChange: (slug: string) => void;
  gameFormat?: GameFormat | null;
}

export function GenreSelector({ value, onChange, gameFormat = null }: GenreSelectorProps) {
  const t = useTranslations("wizard");
  const tCommon = useTranslations("common");
  const genres = getGameGenresForFormat(gameFormat);

  return (
    <div className="grid gap-2.5 sm:grid-cols-2">
      {genres.map((genre) => {
        const Icon = genre.icon;
        const isSelected = value === genre.slug;

        return (
          <motion.button
            key={genre.slug}
            type="button"
            onClick={() => onChange(genre.slug)}
            whileHover={{ y: -3, scale: 1.01 }}
            whileTap={{ scale: 0.985 }}
            className={cn(
              "group relative overflow-hidden rounded-[1.35rem] border p-3.5 text-left transition-all",
              isSelected
                ? "border-white/20 bg-white/[0.08] shadow-[0_0_36px_rgba(244,63,94,0.12)]"
                : "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.05]",
            )}
          >
            <div className={cn("absolute inset-0 bg-gradient-to-br opacity-80", genre.gradientClass)} />
            <div className="absolute inset-0 bg-[linear-gradient(165deg,rgba(11,4,6,0.0)_0%,rgba(11,4,6,0.82)_85%)]" />

            <div className="relative flex items-start justify-between gap-2.5">
              <div className="space-y-2.5">
                <div className="flex size-9 items-center justify-center rounded-[1rem] border border-white/10 bg-white/5 text-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                  <span aria-hidden="true">{genre.emoji}</span>
                </div>
                <div>
                  <p className="text-sm font-semibold tracking-tight text-white sm:text-[15px]">
                    {genre.displayName}
                  </p>
                  <p className="mt-1.5 line-clamp-2 text-xs leading-5 text-white/60">
                    {genre.description}
                  </p>
                </div>
              </div>

              <div className="flex flex-col items-end gap-2.5">
                <Badge
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-[9px] uppercase tracking-[0.22em]",
                    isSelected
                      ? genre.pillClass
                      : "border-white/10 bg-white/5 text-white/45",
                  )}
                >
                  {isSelected ? tCommon("selected") : t("template")}
                </Badge>
                <div className="flex size-8 items-center justify-center rounded-full border border-white/10 bg-black/20">
                  <Icon className={cn("size-3.5", isSelected ? genre.iconClass : "text-white/45")} />
                </div>
              </div>
            </div>
          </motion.button>
        );
      })}
    </div>
  );
}
