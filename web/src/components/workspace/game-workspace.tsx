"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import dynamic from "next/dynamic";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { cn } from "@/lib/utils";
import { staggerContainer } from "./workspace-animations";
import { WorkspaceHeader } from "./workspace-header";
import { WorkspaceSidebar } from "./workspace-sidebar";
import { AppNavSidebar } from "./app-nav-sidebar";
import { SidebarPanelSkeleton, GamePanelSkeleton } from "./workspace-skeleton";

const ChatPanel = dynamic(
  () => import("@/components/chat/chat-panel").then((m) => ({ default: m.ChatPanel })),
  { loading: () => <SidebarPanelSkeleton />, ssr: false }
);

const ChatSessionList = dynamic(
  () => import("@/components/chat/chat-session-list").then((m) => ({ default: m.ChatSessionList })),
  { loading: () => <SidebarPanelSkeleton />, ssr: false }
);

const WarRoomPanel = dynamic(
  () => import("@/components/warroom/war-room-panel").then((m) => ({ default: m.WarRoomPanel })),
  { loading: () => <SidebarPanelSkeleton />, ssr: false }
);

const WarRoomList = dynamic(
  () => import("@/components/warroom/war-room-list").then((m) => ({ default: m.WarRoomList })),
  { loading: () => <SidebarPanelSkeleton />, ssr: false }
);

const ActionsConsole = dynamic(
  () => import("@/components/console/actions-console").then((m) => ({ default: m.ActionsConsole })),
  { loading: () => <SidebarPanelSkeleton />, ssr: false }
);

const WorkspaceGamePanel = dynamic(
  () => import("./workspace-game-panel").then((m) => ({ default: m.WorkspaceGamePanel })),
  { loading: () => <GamePanelSkeleton />, ssr: false }
);

interface GameWorkspaceProps {
  gameId: string;
  gameName: string;
  genre: string | null;
  description: string | null;
  isPublished: boolean;
  publicSlug: string | null;
}

export type SidebarTab = "chat" | "config" | "warroom";

export function GameWorkspace({
  gameId,
  gameName,
  genre,
  description,
  isPublished,
  publicSlug,
}: GameWorkspaceProps) {
  const router = useRouter();
  const [tab, setTab] = useState<SidebarTab>("chat");
  const [visitedTabs, setVisitedTabs] = useState<Set<SidebarTab>>(new Set(["chat"]));
  const [activeChatSessionId, setActiveChatSessionId] = useState<string | null>(null);
  const [activeWarRoomId, setActiveWarRoomId] = useState<string | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("workspace-sidebar-width");
      return saved ? Math.min(Math.max(Number(saved), 280), 600) : 400;
    }
    return 400;
  });
  const [isResizing, setIsResizing] = useState(false);

  // Persist sidebar width
  useEffect(() => {
    localStorage.setItem("workspace-sidebar-width", String(sidebarWidth));
  }, [sidebarWidth]);

  // Keyboard shortcuts: Cmd/Ctrl + 1/2/3 for tab switching
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key === "1") { e.preventDefault(); setTab("chat"); }
      else if (e.key === "2") { e.preventDefault(); setTab("warroom"); }
      else if (e.key === "3") { e.preventDefault(); setTab("config"); }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Track which tabs have been visited (lazy mount)
  useEffect(() => {
    setVisitedTabs((prev) => {
      if (prev.has(tab)) return prev;
      return new Set([...prev, tab]);
    });
  }, [tab]);

  // Drag-to-resize sidebar
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    const startX = e.clientX;
    const startWidth = sidebarWidth;

    function onMouseMove(ev: MouseEvent) {
      const delta = ev.clientX - startX;
      const newWidth = Math.min(Math.max(startWidth + delta, 280), 600);
      setSidebarWidth(newWidth);
    }

    function onMouseUp() {
      setIsResizing(false);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    }

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }, [sidebarWidth]);

  function handleWarRoomCreated(warRoomId: string) {
    setActiveWarRoomId(warRoomId);
    setTab("warroom");
  }

  function handleSuggestedPrompt() {
    setTab("chat");
  }

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className="flex h-screen bg-[radial-gradient(circle_at_top,#3a1a1f_0%,#1b0b0f_50%,#0f0508_100%)] text-stone-50 px-3 py-3"
    >
      {/* Global nav sidebar */}
      <AppNavSidebar activeId="library" />

      {/* Main workspace area */}
      <div className="flex flex-col flex-1 min-w-0 lg:ml-3 rounded-[1.25rem] border border-white/8 bg-[#2a1014]/50 overflow-hidden shadow-[0_18px_60px_rgba(24,8,10,0.25)]">
        {/* Header */}
        <WorkspaceHeader
          gameName={gameName}
          genre={genre}
          isPublished={isPublished}
          publicSlug={publicSlug}
          onRefresh={() => router.refresh()}
        />

        {/* Sidebar + Game */}
        <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <WorkspaceSidebar tab={tab} setTab={setTab} sidebarWidth={sidebarWidth}>
          {/* Chat panel — always in visitedTabs (default tab) */}
          {visitedTabs.has("chat") && (
            <div className={cn("flex-1 min-h-0", tab !== "chat" && "hidden")}>
              <ErrorBoundary label="Chat">
                {activeChatSessionId ? (
                  <ChatPanel
                    key={activeChatSessionId}
                    gameId={gameId}
                    gameName={gameName}
                    sessionId={activeChatSessionId}
                    onBack={() => setActiveChatSessionId(null)}
                    onWarRoomCreated={handleWarRoomCreated}
                  />
                ) : (
                  <ChatSessionList
                    gameName={gameName}
                    onSelect={(id) => setActiveChatSessionId(id)}
                  />
                )}
              </ErrorBoundary>
            </div>
          )}

          {/* War Room panel — lazy mounted on first visit */}
          {visitedTabs.has("warroom") && (
            <div className={cn("flex-1 min-h-0", tab !== "warroom" && "hidden")}>
              <ErrorBoundary label="War Room">
                {activeWarRoomId ? (
                  <WarRoomPanel
                    gameName={gameName}
                    warRoomId={activeWarRoomId}
                    onBack={() => setActiveWarRoomId(null)}
                    onSuggestedPrompt={handleSuggestedPrompt}
                  />
                ) : (
                  <WarRoomList
                    gameName={gameName}
                    onSelect={(id) => setActiveWarRoomId(id)}
                  />
                )}
              </ErrorBoundary>
            </div>
          )}

          {/* Config panel — lazy mounted on first visit */}
          {visitedTabs.has("config") && (
            <div className={cn("flex-1 min-h-0", tab !== "config" && "hidden")}>
              <ErrorBoundary label="Config">
                <ActionsConsole gameName={gameName} />
              </ErrorBoundary>
            </div>
          )}
        </WorkspaceSidebar>

        {/* Resize handle */}
        <div
          className={cn(
            "w-1 shrink-0 cursor-col-resize transition-colors hover:bg-rose-500/30",
            isResizing ? "bg-rose-500/40" : "bg-transparent"
          )}
          onMouseDown={handleResizeStart}
        />

        {/* Game */}
        <ErrorBoundary label="Game Preview">
          <WorkspaceGamePanel gameName={gameName} />
        </ErrorBoundary>
        </div>
      </div>
    </motion.div>
  );
}
