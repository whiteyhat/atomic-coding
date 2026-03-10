"use client";

import { motion } from "framer-motion";
import { Clock3 } from "lucide-react";
import { cn } from "@/lib/utils";

function formatTime(seconds: number): string {
  if (seconds >= 3600) {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

interface ElapsedTimerProps {
  seconds: number | null;
  isLive?: boolean;
  variant?: "compact" | "card" | "inline";
  className?: string;
}

function LiveDot({ className }: { className?: string }) {
  return (
    <span className={cn("relative flex size-1.5", className)}>
      <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" />
      <span className="relative inline-flex size-1.5 rounded-full bg-emerald-400" />
    </span>
  );
}

export function ElapsedTimer({
  seconds,
  isLive = false,
  variant = "compact",
  className,
}: ElapsedTimerProps) {
  const display = seconds != null ? formatTime(seconds) : "--:--";

  if (variant === "card") {
    return (
      <div className={className}>
        <motion.span
          className="text-lg font-semibold tabular-nums font-mono text-white"
          animate={isLive ? { opacity: [1, 0.65, 1] } : undefined}
          transition={isLive ? { duration: 2.4, repeat: Infinity, ease: "easeInOut" } : undefined}
        >
          {display}
        </motion.span>
        {isLive && <LiveDot className="ml-2 inline-flex align-middle" />}
      </div>
    );
  }

  if (variant === "inline") {
    return (
      <span className={cn("inline-flex items-center gap-1 font-mono tabular-nums", className)}>
        {display}
        {isLive && <LiveDot />}
      </span>
    );
  }

  // compact (default)
  return (
    <span className={cn("inline-flex items-center gap-1 font-mono tabular-nums text-[10px] text-white/45", className)}>
      <Clock3 className="size-3 text-white/30" />
      {display}
      {isLive && <LiveDot />}
    </span>
  );
}
