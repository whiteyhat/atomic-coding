"use client";

import { type KeyboardEvent, type MouseEvent, useState } from "react";
import { motion } from "framer-motion";
import {
  ChevronsLeft,
  ChevronsRight,
  Loader2,
  MessageSquareMore,
  Plus,
  Sparkles,
  Swords,
  Trash2,
  WandSparkles,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAppAuth } from "@/lib/privy-provider";
import {
  getWorkstreamRelativeTimestamp,
  type ActiveWorkspaceTarget,
  type WorkstreamItem,
} from "@/lib/workstreams";
import { cn } from "@/lib/utils";

interface WorkstreamListProps {
  chatSessionCount: number;
  error: string | null;
  isCollapsed: boolean;
  isLoading: boolean;
  items: WorkstreamItem[];
  onCreateFeature: () => void;
  onCreateWarRoom: () => void;
  onDeleteSession: (sessionId: string) => Promise<void>;
  onSelect: (target: ActiveWorkspaceTarget) => void;
  onToggleCollapse: () => void;
}

function WorkstreamIcon({ item }: { item: WorkstreamItem }) {
  if (item.kind === "war-room-draft") {
    return (
      <div className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-amber-300/20 bg-amber-500/10 text-amber-100">
        <WandSparkles className="size-3.5" />
      </div>
    );
  }

  if (item.kind === "war-room") {
    return (
      <div
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-lg border",
          item.isPipelineActive
            ? "border-rose-400/25 bg-[linear-gradient(135deg,rgba(251,113,133,0.24),rgba(190,24,93,0.16))] text-rose-100"
            : "border-white/10 bg-white/[0.05] text-white/70",
        )}
      >
        <Swords className="size-3.5" />
      </div>
    );
  }

  return (
    <div className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.05] text-white/80">
      <MessageSquareMore className="size-3.5" />
    </div>
  );
}

export function WorkstreamList({
  chatSessionCount,
  error,
  isCollapsed,
  isLoading,
  items,
  onCreateFeature,
  onCreateWarRoom,
  onDeleteSession,
  onSelect,
  onToggleCollapse,
}: WorkstreamListProps) {
  const { authenticated, login } = useAppAuth();
  const [launcherOpen, setLauncherOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function handleNewChat() {
    if (!authenticated) {
      login();
      return;
    }

    if (chatSessionCount === 0) {
      onCreateWarRoom();
      return;
    }

    setLauncherOpen(true);
  }

  async function handleDeleteSession(
    event: MouseEvent<HTMLElement>,
    sessionId: string,
  ) {
    event.stopPropagation();

    try {
      setDeletingId(sessionId);
      await onDeleteSession(sessionId);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <>
      <div
        className={cn(
          "flex h-full shrink-0 flex-col border-r border-white/8 bg-[linear-gradient(180deg,rgba(16,7,10,0.92),rgba(28,10,14,0.86))] transition-[width] duration-200",
          isCollapsed ? "w-12" : "w-56",
        )}
      >
        {/* ── Header ──────────────────────────────────────────── */}
        {isCollapsed ? (
          <div className="flex flex-col items-center gap-2 border-b border-white/8 py-2.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 rounded-lg border border-white/10 bg-white/[0.04] text-white/60 hover:bg-white/[0.08] hover:text-white"
                  onClick={onToggleCollapse}
                >
                  <ChevronsRight className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Expand workstreams</TooltipContent>
            </Tooltip>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-1 border-b border-white/8 px-2.5 py-2.5">
            <Button
              variant="ghost"
              size="icon"
              className="size-6 shrink-0 rounded-md text-white/30 hover:bg-white/[0.06] hover:text-white/60"
              onClick={onToggleCollapse}
            >
              <ChevronsLeft className="size-3.5" />
            </Button>
            <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-white/35">
              Workstreams
            </p>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6 shrink-0 rounded-md border border-white/10 bg-white/[0.04] text-white/60 hover:bg-white/[0.08] hover:text-white"
                  onClick={handleNewChat}
                >
                  <Plus className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>New chat</TooltipContent>
            </Tooltip>
          </div>
        )}

        {/* ── Collapsed icon rail ─────────────────────────────── */}
        {isCollapsed ? (
          <ScrollArea className="flex-1 min-h-0">
            <div className="flex flex-col items-center gap-1.5 py-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 rounded-lg border border-white/10 bg-white/[0.04] text-white/60 hover:bg-white/[0.08] hover:text-white"
                    onClick={handleNewChat}
                  >
                    <Plus className="size-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">New chat</TooltipContent>
              </Tooltip>

              {isLoading ? (
                <Loader2 className="mt-3 size-4 animate-spin text-white/30" />
              ) : (
                items.map((item) => (
                  <Tooltip key={item.id}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => onSelect(item.target)}
                        className={cn(
                          "rounded-lg p-0.5 transition-all",
                          item.isActive
                            ? "ring-1 ring-rose-400/30 bg-rose-500/10"
                            : "hover:bg-white/[0.06]",
                        )}
                      >
                        <WorkstreamIcon item={item} />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-48">
                      <p className="font-medium">{item.label}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {item.kind === "war-room"
                          ? item.warRoom.status
                          : item.kind === "war-room-draft"
                            ? "draft"
                            : "feature"}{" "}
                        · {getWorkstreamRelativeTimestamp(item.timestamp)}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                ))
              )}
            </div>
          </ScrollArea>
        ) : (
          /* ── Expanded list ────────────────────────────────── */
          <>
            {isLoading ? (
              <div className="flex flex-1 items-center justify-center text-white/40">
                <Loader2 className="size-5 animate-spin" />
              </div>
            ) : error ? (
              <div className="flex flex-1 items-center justify-center px-4 text-center text-sm text-rose-300">
                {error}
              </div>
            ) : items.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-2.5 px-4 text-center">
                <div className="flex size-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/55">
                  <Sparkles className="size-5" />
                </div>
                <div>
                  <p className="text-[13px] font-medium text-white/70">No workstreams yet</p>
                  <p className="mt-1 text-[11px] leading-4 text-white/35">
                    Start a chat to build features or launch a war room.
                  </p>
                </div>
                <Button
                  size="sm"
                  className="rounded-lg bg-white text-black hover:bg-white/90"
                  onClick={handleNewChat}
                >
                  <Plus className="size-3.5" />
                  New Chat
                </Button>
              </div>
            ) : (
              <ScrollArea className="flex-1 min-h-0">
                <div className="space-y-1 px-2 py-2">
                  {items.map((item, index) => (
                    <motion.div
                      key={item.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => onSelect(item.target)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          onSelect(item.target);
                        }
                      }}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.025 }}
                      className={cn(
                        "group relative w-full overflow-hidden rounded-xl border px-2.5 py-2 text-left transition-all",
                        item.isActive
                          ? "border-rose-300/25 bg-[linear-gradient(160deg,rgba(251,113,133,0.18),rgba(255,255,255,0.04))] shadow-[0_8px_24px_rgba(32,8,14,0.22)]"
                          : "border-transparent bg-transparent hover:border-white/10 hover:bg-white/[0.04]",
                      )}
                    >
                      {item.kind === "war-room" && item.isPipelineActive && (
                        <motion.div
                          aria-hidden="true"
                          className="absolute inset-0 bg-[linear-gradient(120deg,transparent,rgba(255,255,255,0.08),transparent)]"
                          animate={{ x: ["-140%", "140%"] }}
                          transition={{ duration: 2.8, repeat: Infinity, ease: "linear" }}
                        />
                      )}

                      <div className="relative flex items-start gap-2.5">
                        <WorkstreamIcon item={item} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-1">
                            <p className="truncate text-[13px] font-medium text-white">
                              {item.label}
                            </p>
                            {item.kind === "feature-session" && (
                              <div
                                role="button"
                                tabIndex={0}
                                className="shrink-0 rounded-md p-0.5 text-white/20 opacity-0 transition-opacity hover:bg-white/[0.08] hover:text-rose-300 group-hover:opacity-100"
                                onClick={(event) => void handleDeleteSession(event, item.session.id)}
                                onKeyDown={(event: KeyboardEvent<HTMLElement>) => {
                                  if (event.key === "Enter" || event.key === " ") {
                                    event.preventDefault();
                                    void handleDeleteSession(event as unknown as MouseEvent<HTMLElement>, item.session.id);
                                  }
                                }}
                              >
                                {deletingId === item.session.id ? (
                                  <Loader2 className="size-3 animate-spin" />
                                ) : (
                                  <Trash2 className="size-3" />
                                )}
                              </div>
                            )}
                          </div>

                          <div className="mt-1 flex items-center gap-1.5">
                            <Badge
                              variant="outline"
                              className={cn(
                                "rounded-full border px-1.5 py-0 text-[9px]",
                                item.kind === "war-room" && item.isPipelineActive
                                  ? "border-rose-300/30 bg-rose-500/10 text-rose-100"
                                  : item.kind === "war-room-draft"
                                    ? "border-amber-300/25 bg-amber-500/10 text-amber-100"
                                    : "border-white/10 bg-black/20 text-white/50",
                              )}
                            >
                              {item.kind === "war-room"
                                ? item.warRoom.status
                                : item.kind === "war-room-draft"
                                  ? "draft"
                                  : "feature"}
                            </Badge>
                            <span className="text-[9px] text-white/25">
                              {getWorkstreamRelativeTimestamp(item.timestamp)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </>
        )}
      </div>

      <Dialog open={launcherOpen} onOpenChange={setLauncherOpen}>
        <DialogContent
          showCloseButton={false}
          className="max-w-[720px] overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(60,19,29,0.98),rgba(18,7,10,0.98))] p-0 text-white shadow-[0_28px_90px_rgba(0,0,0,0.45)]"
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(244,63,94,0.24),transparent_40%),radial-gradient(circle_at_bottom_right,rgba(96,165,250,0.16),transparent_35%)]" />
          <div className="relative">
            <DialogHeader className="border-b border-white/8 px-6 py-6 text-left">
              <DialogTitle className="text-2xl text-white">Start a new chat</DialogTitle>
              <DialogDescription className="max-w-xl text-sm leading-6 text-white/55">
                Choose a direct feature thread or launch the multi-agent war room flow with a scoped intake.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 px-6 py-6 md:grid-cols-2">
              <button
                type="button"
                onClick={() => {
                  setLauncherOpen(false);
                  onCreateFeature();
                }}
                className="group relative overflow-hidden rounded-[1.6rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))] p-5 text-left transition-all hover:-translate-y-0.5 hover:border-white/18 hover:bg-white/[0.08]"
              >
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(96,165,250,0.2),transparent_36%)] opacity-80" />
                <div className="relative">
                  <div className="flex size-11 items-center justify-center rounded-[1rem] border border-sky-300/20 bg-sky-500/10 text-sky-100">
                    <MessageSquareMore className="size-5" />
                  </div>
                  <p className="mt-5 text-lg font-semibold text-white">New Feature</p>
                  <p className="mt-2 text-sm leading-6 text-white/58">
                    Open a direct builder chat for targeted features, fixes, and fast iteration.
                  </p>
                  <div className="mt-5 text-[11px] uppercase tracking-[0.22em] text-sky-200/65">
                    BEST FOR SIMPLE FEATURES OR FIXES
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setLauncherOpen(false);
                  onCreateWarRoom();
                }}
                className="group relative overflow-hidden rounded-[1.6rem] border border-rose-300/15 bg-[linear-gradient(180deg,rgba(251,113,133,0.12),rgba(255,255,255,0.03))] p-5 text-left transition-all hover:-translate-y-0.5 hover:border-rose-300/28 hover:bg-[linear-gradient(180deg,rgba(251,113,133,0.16),rgba(255,255,255,0.04))]"
              >
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(251,113,133,0.28),transparent_34%)] opacity-90" />
                <div className="relative">
                  <div className="flex size-11 items-center justify-center rounded-[1rem] border border-rose-300/20 bg-rose-500/10 text-rose-50">
                    <Swords className="size-5" />
                  </div>
                  <p className="mt-5 text-lg font-semibold text-white">War Room</p>
                  <p className="mt-2 text-sm leading-6 text-white/58">
                    Run the staged Jarvis → Forge → Pixel → Checker pipeline with adaptive planning questions first.
                  </p>
                  <div className="mt-5 text-[11px] uppercase tracking-[0.22em] text-rose-100/70">
                    BEST FOR COMPLEX & LONG FEATURES
                  </div>
                </div>
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
