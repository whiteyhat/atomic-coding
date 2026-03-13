"use client";

import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import { Link } from "@/i18n/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getGameGenre } from "@/lib/game-genres";
import { PublishDialog } from "@/components/games/publish-dialog";
import { headerSlideDown } from "./workspace-animations";

interface WorkspaceHeaderProps {
  gameName: string;
  genre: string | null;
  gameFormat: "2d" | "3d" | null;
  isPublished: boolean;
  publicSlug: string | null;
  onRefresh: () => void;
}

export function WorkspaceHeader({
  gameName,
  genre,
  gameFormat,
  isPublished,
  publicSlug,
  onRefresh,
}: WorkspaceHeaderProps) {
  const t = useTranslations("workspace");
  const genreInfo = getGameGenre(genre);

  return (
    <motion.header
      variants={headerSlideDown}
      initial="hidden"
      animate="visible"
      className="flex items-center gap-3 h-12 px-4 rounded-t-[1.25rem] border-b border-white/8 shrink-0 bg-[#2a1014]/80 backdrop-blur-xl"
    >
      {/* Back button */}
      <Link href="/library">
        <motion.div whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.95 }}>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 rounded-xl bg-white/8 text-white/70 hover:bg-white/12 hover:text-white"
          >
            <ArrowLeft className="size-4" />
          </Button>
        </motion.div>
      </Link>

      {/* Game name */}
      <span className="text-sm font-semibold text-white truncate max-w-[200px] lg:max-w-[300px]">
        {gameName}
      </span>

      {/* Genre badge */}
      {genreInfo && (
        <span
          className={`hidden sm:inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-medium ${genreInfo.pillClass}`}
        >
          <span>{genreInfo.emoji}</span>
          {genreInfo.displayName}
        </span>
      )}

      {gameFormat && (
        <span className="hidden sm:inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-medium text-white/65">
          {gameFormat === "2d" ? t("format2d") : t("format3d")}
        </span>
      )}

      {/* Right section */}
      <div className="ml-auto flex items-center gap-2">
        {/* Publish button - rose accent */}
        <PublishDialog
          gameName={gameName}
          isPublished={isPublished}
          publicSlug={publicSlug}
          onPublished={onRefresh}
        />
      </div>
    </motion.header>
  );
}
