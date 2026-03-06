"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChatPanel } from "@/components/chat/chat-panel";
import { GameFrame } from "@/components/playground/game-frame";
import { ActionsConsole } from "@/components/console/actions-console";
import { WarRoomPanel } from "@/components/warroom/war-room-panel";
import Link from "next/link";
import { ArrowLeft, MessageSquare, Settings, Swords } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AgentStatusDropdown } from "./agent-status-dropdown";
import { PublishDialog } from "@/components/games/publish-dialog";

interface GameWorkspaceProps {
  gameId: string;
  gameName: string;
  isPublished: boolean;
  publicSlug: string | null;
}

type SidebarTab = "chat" | "config" | "warroom";

export function GameWorkspace({ gameId, gameName, isPublished, publicSlug }: GameWorkspaceProps) {
  const router = useRouter();
  const [tab, setTab] = useState<SidebarTab>("chat");
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
            {activeWarRoomId && (
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
            )}
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
          </div>

          {/* Panels — always mounted, toggled via CSS */}
          <div className={cn("flex-1 min-h-0", tab !== "chat" && "hidden")}>
            <ChatPanel
              gameId={gameId}
              gameName={gameName}
              onWarRoomCreated={handleWarRoomCreated}
            />
          </div>
          {activeWarRoomId && (
            <div className={cn("flex-1 min-h-0", tab !== "warroom" && "hidden")}>
              <WarRoomPanel
                gameName={gameName}
                warRoomId={activeWarRoomId}
                onSuggestedPrompt={handleSuggestedPrompt}
              />
            </div>
          )}
          <div className={cn("flex-1 min-h-0", tab !== "config" && "hidden")}>
            <ActionsConsole gameName={gameName} />
          </div>
        </aside>

        {/* Game */}
        <main className="flex-1 min-w-0">
          <GameFrame gameName={gameName} />
        </main>
      </div>
    </div>
  );
}
