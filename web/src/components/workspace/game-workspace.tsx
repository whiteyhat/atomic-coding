"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChatPanel } from "@/components/chat/chat-panel";
import { GameFrame } from "@/components/playground/game-frame";
import { ActionsConsole } from "@/components/console/actions-console";
import { WarRoomPanel } from "@/components/warroom/war-room-panel";
import { WarRoomList } from "@/components/warroom/war-room-list";
import { ChatSessionList } from "@/components/chat/chat-session-list";
import Link from "next/link";
import { ArrowLeft, Coins, MessageSquare, Settings, Swords } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AgentStatusDropdown } from "./agent-status-dropdown";
import { PublishDialog } from "@/components/games/publish-dialog";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { TokenStatusBadge } from "@/components/token/token-status-badge";
import { BondProgressBar } from "@/components/token/bond-progress-bar";
import { useCurveData } from "@/lib/hooks";

interface GameWorkspaceProps {
  gameId: string;
  gameName: string;
  isPublished: boolean;
  publicSlug: string | null;
}

type SidebarTab = "chat" | "config" | "warroom" | "token";

export function GameWorkspace({ gameId, gameName, isPublished, publicSlug }: GameWorkspaceProps) {
  const router = useRouter();
  const [tab, setTab] = useState<SidebarTab>("chat");
  const [activeChatSessionId, setActiveChatSessionId] = useState<string | null>(null);
  const [activeWarRoomId, setActiveWarRoomId] = useState<string | null>(null);

  /** Called when a war room is created (from chat or future UI trigger). */
  function handleWarRoomCreated(warRoomId: string) {
    setActiveWarRoomId(warRoomId);
    setTab("warroom");
  }

  /** Called when a suggested prompt is selected from a completed war room. */
  function handleSuggestedPrompt(_prompt: string) {
    // Switch back to chat — the prompt can be used to create a new war room
    setTab("chat");
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Top bar */}
      <header className="flex items-center gap-3 h-10 px-3 border-b border-buu shrink-0 bg-buu-foreground">
        <Link href="/">
          <Button variant="ghost" size="icon" className="size-7">
            <ArrowLeft className="size-4" />
          </Button>
        </Link>
        <span className="text-sm font-medium">{gameName}</span>
        <div className="ml-auto flex items-center gap-2">
          <PublishDialog
            gameName={gameName}
            isPublished={isPublished}
            publicSlug={publicSlug}
            onPublished={() => router.refresh()}
          />
          <AgentStatusDropdown activeAgent={null} />
        </div>
      </header>

      {/* Sidebar + Game */}
      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <aside className="w-[420px] shrink-0 border-r border-buu flex flex-col bg-buu-50">
          {/* Tab bar */}
          <div className="flex items-stretch h-9 border-b shrink-0">
            <button
              onClick={() => setTab("chat")}
              className={cn(
                "relative flex items-center gap-1.5 px-4 text-xs font-medium transition-colors",
                tab === "chat"
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <MessageSquare className="size-3.5" />
              Chat
              {tab === "chat" && (
                <span className="absolute bottom-0 inset-x-2 h-0.5 rounded-full bg-foreground" />
              )}
            </button>
            <button
              onClick={() => setTab("warroom")}
              className={cn(
                "relative flex items-center gap-1.5 px-4 text-xs font-medium transition-colors",
                tab === "warroom"
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Swords className="size-3.5" />
              War Room
              {tab === "warroom" && (
                <span className="absolute bottom-0 inset-x-2 h-0.5 rounded-full bg-foreground" />
              )}
            </button>
            <button
              onClick={() => setTab("config")}
              className={cn(
                "relative flex items-center gap-1.5 px-4 text-xs font-medium transition-colors",
                tab === "config"
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Settings className="size-3.5" />
              Config
              {tab === "config" && (
                <span className="absolute bottom-0 inset-x-2 h-0.5 rounded-full bg-foreground" />
              )}
            </button>
            <button
              onClick={() => setTab("token")}
              className={cn(
                "relative flex items-center gap-1.5 px-4 text-xs font-medium transition-colors",
                tab === "token"
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Coins className="size-3.5" />
              Token
              {tab === "token" && (
                <span className="absolute bottom-0 inset-x-2 h-0.5 rounded-full bg-foreground" />
              )}
            </button>
          </div>

          {/* Panels — always mounted, toggled via CSS */}
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
          <div className={cn("flex-1 min-h-0", tab !== "config" && "hidden")}>
            <ErrorBoundary label="Config">
              <ActionsConsole gameName={gameName} />
            </ErrorBoundary>
          </div>
          <div className={cn("flex-1 min-h-0 overflow-y-auto", tab !== "token" && "hidden")}>
            <ErrorBoundary label="Token">
              <TokenSidebarPanel gameName={gameName} isPublished={isPublished} />
            </ErrorBoundary>
          </div>
        </aside>

        {/* Game */}
        <main className="flex-1 min-w-0">
          <ErrorBoundary label="Game Preview">
            <GameFrame gameName={gameName} />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}

// ── Token Sidebar Panel ─────────────────────────────────────────────────────

function TokenSidebarPanel({
  gameName,
  isPublished,
}: {
  gameName: string;
  isPublished: boolean;
}) {
  const { data: curveData, isLoading } = useCurveData(isPublished ? gameName : null);
  const launch = curveData?.launch ?? null;
  const state = curveData?.state ?? null;

  if (!isPublished) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-6 text-center gap-3">
        <Coins className="size-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Publish your game to launch a token.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white/60" />
      </div>
    );
  }

  if (!launch) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-6 text-center gap-4">
        <Coins className="size-8 text-muted-foreground" />
        <div className="space-y-1">
          <p className="text-sm font-medium">No token yet</p>
          <p className="text-xs text-muted-foreground">
            Create a bonding curve token for your game.
          </p>
        </div>
        <Link href={`/games/${encodeURIComponent(gameName)}/token/create`}>
          <Button size="sm" className="gap-1.5">
            <Coins className="size-3.5" />
            Launch Token
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Status + name */}
      <div className="flex items-center gap-2">
        <TokenStatusBadge status={launch.status} />
        <span className="text-sm font-medium truncate">{launch.token_name}</span>
        <span className="text-xs text-muted-foreground">${launch.token_symbol}</span>
      </div>

      {/* Bonding progress */}
      {state && (
        <BondProgressBar
          bondingPct={state.bonding_pct}
          currentMcap={state.current_mcap}
          migrationMcap={launch.migration_mcap ?? undefined}
        />
      )}

      {/* Key metric */}
      {state && (
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="rounded-lg border border-white/5 bg-white/[0.02] p-2.5">
            <span className="text-muted-foreground">Market Cap</span>
            <p className="font-semibold tabular-nums mt-0.5">
              ${state.current_mcap_usd >= 1000
                ? `${(state.current_mcap_usd / 1000).toFixed(1)}K`
                : state.current_mcap_usd.toFixed(2)}
            </p>
          </div>
          <div className="rounded-lg border border-white/5 bg-white/[0.02] p-2.5">
            <span className="text-muted-foreground">Holders</span>
            <p className="font-semibold tabular-nums mt-0.5">
              {state.holder_count.toLocaleString()}
            </p>
          </div>
        </div>
      )}

      {/* Dashboard link */}
      <Link href={`/games/${encodeURIComponent(gameName)}/token`}>
        <Button variant="outline" size="sm" className="w-full">
          View Dashboard
        </Button>
      </Link>
    </div>
  );
}
