"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import { Expand, Minimize, RotateCcw, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GameFrame } from "@/components/playground/game-frame";
import { gamePanelReveal } from "./workspace-animations";
import { cn } from "@/lib/utils";

interface WorkspaceGamePanelProps {
  gameName: string;
  gameFormat: "2d" | "3d" | null;
}

export function WorkspaceGamePanel({
  gameName,
  gameFormat,
}: WorkspaceGamePanelProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [shouldLoadIframe, setShouldLoadIframe] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeKey = useRef(0);
  const [refreshKey, setRefreshKey] = useState(0);

  // Defer iframe loading until workspace shell is interactive
  useEffect(() => {
    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      const id = requestIdleCallback(() => setShouldLoadIframe(true), { timeout: 500 });
      return () => cancelIdleCallback(id);
    }
    // Fallback for Safari
    const timer = setTimeout(() => setShouldLoadIframe(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const handleIframeLoad = useCallback(() => {
    setIsLoading(false);
  }, []);

  const handleRefresh = useCallback(() => {
    setIsLoading(true);
    iframeKey.current += 1;
    setRefreshKey(iframeKey.current);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  const runtimeLabel = gameFormat === "2d" ? "Phaser" : "Three.js";

  return (
    <motion.div
      ref={containerRef}
      variants={gamePanelReveal}
      initial="hidden"
      animate="visible"
      className="flex-1 min-w-0 relative rounded-br-[1.25rem] bg-black/60 overflow-hidden"
    >
      {/* Top overlay bar */}
      <div className="absolute top-0 inset-x-0 z-10 flex items-center justify-between px-3 py-2 bg-gradient-to-b from-black/60 to-transparent pointer-events-none">
        <span className="text-[11px] text-white/30 font-medium truncate">
          {gameName}
        </span>
        <div className="flex items-center gap-1 pointer-events-auto">
          <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 rounded-lg bg-white/8 text-white/50 hover:bg-white/15 hover:text-white"
              onClick={handleRefresh}
            >
              <RotateCcw className="size-3" />
            </Button>
          </motion.div>
          <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 rounded-lg bg-white/8 text-white/50 hover:bg-white/15 hover:text-white"
              onClick={toggleFullscreen}
            >
              {isFullscreen ? (
                <Minimize className="size-3" />
              ) : (
                <Expand className="size-3" />
              )}
            </Button>
          </motion.div>
        </div>
      </div>

      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#1b0b0f]/90">
          <div className="flex flex-col items-center gap-3">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            >
              <Loader2 className="size-6 text-rose-400" />
            </motion.div>
            <span className="text-xs text-white/40">
              Loading {runtimeLabel} game...
            </span>
          </div>
        </div>
      )}

      {/* Game iframe — deferred until shell is interactive */}
      {shouldLoadIframe && (
        <GameFrame
          key={refreshKey}
          gameName={gameName}
          gameFormat={gameFormat}
          onLoad={handleIframeLoad}
        />
      )}

      {/* Bottom gradient with link */}
      <div className="absolute bottom-0 inset-x-0 z-10 flex items-end justify-end px-3 py-2 bg-gradient-to-t from-black/40 to-transparent pointer-events-none">
        <a
          href={`/play/${gameName.toLowerCase().replace(/[^a-z0-9-]/g, "-")}`}
          target="_blank"
          rel="noopener noreferrer"
          className="pointer-events-auto flex items-center gap-1 text-[10px] text-white/25 hover:text-white/50 transition-colors"
        >
          <ExternalLink className="size-3" />
          Open in new tab
        </a>
      </div>
    </motion.div>
  );
}
