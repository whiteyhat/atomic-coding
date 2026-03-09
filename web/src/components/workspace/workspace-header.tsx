"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowLeft, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getGameGenre } from "@/lib/game-genres";
import { PublishDialog } from "@/components/games/publish-dialog";
import { AgentStatusDropdown } from "./agent-status-dropdown";
import { headerSlideDown } from "./workspace-animations";

interface WorkspaceHeaderProps {
  gameName: string;
  genre: string | null;
  isPublished: boolean;
  publicSlug: string | null;
  onRefresh: () => void;
}

export function WorkspaceHeader({
  gameName,
  genre,
  isPublished,
  publicSlug,
  onRefresh,
}: WorkspaceHeaderProps) {
  const genreInfo = getGameGenre(genre);

  return (
    <motion.header
      variants={headerSlideDown}
      initial="hidden"
      animate="visible"
      className="flex items-center gap-3 h-12 px-4 rounded-t-[1.25rem] border-b border-white/8 shrink-0 bg-[#2a1014]/80 backdrop-blur-xl"
    >
      {/* Back button */}
      <Link href="/dashboard">
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

      {/* Right section */}
      <div className="ml-auto flex items-center gap-2">
        {/* Publish button - rose accent */}
        <PublishDialog
          gameName={gameName}
          isPublished={isPublished}
          publicSlug={publicSlug}
          onPublished={onRefresh}
        />

        {/* Agent status */}
        <AgentStatusDropdown activeAgent={null} />
      </div>
    </motion.header>
  );
}
