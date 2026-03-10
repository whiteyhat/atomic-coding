"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import dynamic from "next/dynamic";
import { Plus, Sparkles, Swords } from "lucide-react";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { deleteChatSession } from "@/lib/api";
import { useChatSessions } from "@/lib/hooks/use-chat-sessions";
import { useWarRooms } from "@/lib/hooks/use-war-rooms";
import {
  buildWorkstreamItems,
  createFeatureDraftTarget,
  createWarRoomDraftTarget,
  createWarRoomTarget,
  getActiveWorkspaceTargetKey,
  getDefaultWorkspaceTarget,
  isFeatureTarget,
  isWarRoomTarget,
  isWorkspaceTargetAvailable,
  type ActiveWorkspaceTarget,
} from "@/lib/workstreams";
import { staggerContainer } from "./workspace-animations";
import { WorkspaceHeader } from "./workspace-header";
import { WorkspaceSidebar } from "./workspace-sidebar";
import { AppNavSidebar } from "./app-nav-sidebar";
import { SidebarPanelSkeleton, GamePanelSkeleton } from "./workspace-skeleton";

const ChatPanel = dynamic(
  () => import("@/components/chat/chat-panel").then((module) => ({ default: module.ChatPanel })),
  { loading: () => <SidebarPanelSkeleton />, ssr: false },
);

const WorkstreamList = dynamic(
  () => import("@/components/chat/workstream-list").then((module) => ({ default: module.WorkstreamList })),
  { loading: () => <SidebarPanelSkeleton />, ssr: false },
);

const WarRoomChatPanel = dynamic(
  () => import("@/components/warroom/war-room-chat-panel").then((module) => ({ default: module.WarRoomChatPanel })),
  { loading: () => <SidebarPanelSkeleton />, ssr: false },
);

const ActionsConsole = dynamic(
  () => import("@/components/console/actions-console").then((module) => ({ default: module.ActionsConsole })),
  { loading: () => <SidebarPanelSkeleton />, ssr: false },
);

const WorkspaceGamePanel = dynamic(
  () => import("./workspace-game-panel").then((module) => ({ default: module.WorkspaceGamePanel })),
  { loading: () => <GamePanelSkeleton />, ssr: false },
);

interface GameWorkspaceProps {
  gameId: string;
  gameName: string;
  genre: string | null;
  gameFormat: "2d" | "3d" | null;
  description: string | null;
  isPublished: boolean;
  publicSlug: string | null;
}

export type SidebarTab = "chat" | "config";

export function GameWorkspace({
  gameId,
  gameName,
  genre,
  gameFormat,
  isPublished,
  publicSlug,
}: GameWorkspaceProps) {
  const router = useRouter();
  const [tab, setTab] = useState<SidebarTab>("chat");
  const [visitedTabs, setVisitedTabs] = useState<Set<SidebarTab>>(new Set(["chat"]));
  const [activeTarget, setActiveTarget] = useState<ActiveWorkspaceTarget | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("workspace-sidebar-width");
      return saved ? Math.min(Math.max(Number(saved), 420), 780) : 520;
    }
    return 520;
  });
  const [isResizing, setIsResizing] = useState(false);
  const [isWorkstreamCollapsed, setIsWorkstreamCollapsed] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("workspace-workstream-collapsed") === "true";
    }
    return true;
  });

  const {
    data: chatSessions = [],
    error: chatError,
    isLoading: areChatsLoading,
    mutate: mutateChatSessions,
  } = useChatSessions(gameName);
  const {
    data: warRooms = [],
    error: warRoomError,
    isLoading: areWarRoomsLoading,
  } = useWarRooms(gameName);

  const workstreamItems = useMemo(
    () =>
      buildWorkstreamItems({
        activeTarget,
        chatSessions,
        warRooms,
      }),
    [activeTarget, chatSessions, warRooms],
  );

  useEffect(() => {
    localStorage.setItem("workspace-sidebar-width", String(sidebarWidth));
  }, [sidebarWidth]);

  useEffect(() => {
    localStorage.setItem("workspace-workstream-collapsed", String(isWorkstreamCollapsed));
  }, [isWorkstreamCollapsed]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey)) return;
      if (event.key === "1") {
        event.preventDefault();
        setTab("chat");
      } else if (event.key === "2") {
        event.preventDefault();
        setTab("config");
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    setVisitedTabs((current) => {
      if (current.has(tab)) return current;
      return new Set([...current, tab]);
    });
  }, [tab]);

  useEffect(() => {
    if (areChatsLoading || areWarRoomsLoading) return;

    setActiveTarget((current) => {
      if (current && isWorkspaceTargetAvailable(current, chatSessions, warRooms)) {
        return current;
      }

      return getDefaultWorkspaceTarget(chatSessions, warRooms);
    });
  }, [areChatsLoading, areWarRoomsLoading, chatSessions, warRooms]);

  const handleResizeStart = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      setIsResizing(true);
      const startX = event.clientX;
      const startWidth = sidebarWidth;

      function onMouseMove(moveEvent: MouseEvent) {
        const delta = moveEvent.clientX - startX;
        const nextWidth = Math.min(Math.max(startWidth + delta, 420), 780);
        setSidebarWidth(nextWidth);
      }

      function onMouseUp() {
        setIsResizing(false);
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
      }

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [sidebarWidth],
  );

  const handleCreateFeature = useCallback((initialPrompt?: string | null) => {
    setTab("chat");
    setActiveTarget(createFeatureDraftTarget(initialPrompt));
  }, []);

  const handleCreateWarRoom = useCallback(() => {
    setTab("chat");
    setActiveTarget(createWarRoomDraftTarget());
  }, []);

  const handleToggleWorkstream = useCallback(() => {
    setIsWorkstreamCollapsed((current) => !current);
  }, []);

  const handleWarRoomCreated = useCallback((warRoomId: string) => {
    setTab("chat");
    setActiveTarget(createWarRoomTarget(warRoomId));
  }, []);

  const handleDeleteSession = useCallback(
    async (sessionId: string) => {
      await deleteChatSession(gameName, sessionId);
      await mutateChatSessions();
    },
    [gameName, mutateChatSessions],
  );

  const combinedError =
    (chatError instanceof Error ? chatError.message : null) ??
    (warRoomError instanceof Error ? warRoomError.message : null);
  const activeTargetKey = getActiveWorkspaceTargetKey(activeTarget);

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className="flex h-screen bg-[radial-gradient(circle_at_top,#3a1a1f_0%,#1b0b0f_50%,#0f0508_100%)] px-3 py-3 text-stone-50"
    >
      <AppNavSidebar activeId="library" />

      <div className="lg:ml-3 flex min-w-0 flex-1 flex-col overflow-hidden rounded-[1.25rem] border border-white/8 bg-[#2a1014]/50 shadow-[0_18px_60px_rgba(24,8,10,0.25)]">
        <WorkspaceHeader
          gameName={gameName}
          genre={genre}
          gameFormat={gameFormat}
          isPublished={isPublished}
          publicSlug={publicSlug}
          onRefresh={() => router.refresh()}
        />

        <div className="flex min-h-0 flex-1">
          <WorkspaceSidebar tab={tab} setTab={setTab} sidebarWidth={sidebarWidth}>
            {visitedTabs.has("chat") && (
              <div className={cn("flex-1 min-h-0", tab !== "chat" && "hidden")}>
                <ErrorBoundary label="Chat">
                  <div className="flex h-full min-w-0">
                    <WorkstreamList
                      chatSessionCount={chatSessions.length}
                      error={combinedError}
                      isCollapsed={isWorkstreamCollapsed}
                      isLoading={areChatsLoading || areWarRoomsLoading}
                      items={workstreamItems}
                      onCreateFeature={() => handleCreateFeature()}
                      onCreateWarRoom={handleCreateWarRoom}
                      onDeleteSession={handleDeleteSession}
                      onSelect={setActiveTarget}
                      onToggleCollapse={handleToggleWorkstream}
                    />

                    <div className="min-w-0 flex-1 h-full bg-[linear-gradient(180deg,rgba(20,7,10,0.78),rgba(31,10,14,0.92))]">
                      {activeTarget && activeTargetKey ? (
                        isFeatureTarget(activeTarget) ? (
                          <ChatPanel
                            key={activeTargetKey}
                            gameId={gameId}
                            gameName={gameName}
                            gameFormat={gameFormat}
                            genre={genre}
                            initialPrompt={activeTarget.initialPrompt ?? null}
                            onSessionReady={(sessionId) =>
                              setActiveTarget((current) => {
                                if (!current || !isFeatureTarget(current)) return current;
                                if (current.session.clientId !== activeTarget.session.clientId) {
                                  return current;
                                }
                                if (current.session.persistedId === sessionId) return current;
                                return {
                                  ...current,
                                  session: {
                                    ...current.session,
                                    persistedId: sessionId,
                                  },
                                };
                              })
                            }
                            sessionClientId={activeTarget.session.clientId}
                            sessionId={activeTarget.session.persistedId}
                          />
                        ) : (
                          <WarRoomChatPanel
                            key={activeTargetKey}
                            gameName={gameName}
                            gameFormat={gameFormat}
                            genre={genre}
                            onSuggestedPrompt={(prompt) => handleCreateFeature(prompt)}
                            onWarRoomCreated={handleWarRoomCreated}
                            warRoomId={isWarRoomTarget(activeTarget) ? activeTarget.warRoomId : null}
                          />
                        )
                      ) : (
                        <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
                          <div className="flex size-16 items-center justify-center rounded-[1.6rem] border border-white/10 bg-white/[0.04] text-white/65">
                            <Sparkles className="size-7" />
                          </div>
                          <div>
                            <p className="text-lg font-semibold text-white">Choose a workstream</p>
                            <p className="mt-2 max-w-md text-sm leading-6 text-white/48">
                              Open a feature thread, revisit a war room run, or start a new chat from the workstream rail.
                            </p>
                          </div>
                          <div className="flex gap-3">
                            <Button
                              type="button"
                              variant="ghost"
                              className="rounded-xl border border-white/10 bg-white/[0.04] text-white/75 hover:bg-white/[0.08] hover:text-white"
                              onClick={() => handleCreateFeature()}
                            >
                              <Plus className="size-4" />
                              New Feature
                            </Button>
                            <Button
                              type="button"
                              className="rounded-xl bg-[linear-gradient(135deg,rgba(251,113,133,0.96),rgba(244,63,94,0.84))] text-rose-50 hover:opacity-95"
                              onClick={handleCreateWarRoom}
                            >
                              <Swords className="size-4" />
                              War Room
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </ErrorBoundary>
              </div>
            )}

            {visitedTabs.has("config") && (
              <div className={cn("flex-1 min-h-0", tab !== "config" && "hidden")}>
                <ErrorBoundary label="Config">
                  <ActionsConsole gameName={gameName} />
                </ErrorBoundary>
              </div>
            )}
          </WorkspaceSidebar>

          <div
            className={cn(
              "w-1 shrink-0 cursor-col-resize transition-colors hover:bg-rose-500/30",
              isResizing ? "bg-rose-500/40" : "bg-transparent",
            )}
            onMouseDown={handleResizeStart}
          />

          <ErrorBoundary label="Game Preview">
            <WorkspaceGamePanel
              gameName={gameName}
              gameFormat={gameFormat}
            />
          </ErrorBoundary>
        </div>
      </div>
    </motion.div>
  );
}
