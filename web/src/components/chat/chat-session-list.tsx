"use client";

import { useState } from "react";
import { createChatSession, deleteChatSession } from "@/lib/api";
import { useChatSessions } from "@/lib/hooks";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Loader2, MessageSquare, Plus, Trash2 } from "lucide-react";
import { MODELS } from "@/lib/constants";

interface ChatSessionListProps {
  gameName: string;
  onSelect: (sessionId: string) => void;
}

function modelName(modelId: string | null): string | null {
  if (!modelId) return null;
  return MODELS.find((m) => m.id === modelId)?.name ?? modelId.split("/").pop() ?? modelId;
}

export function ChatSessionList({ gameName, onSelect }: ChatSessionListProps) {
  const { data: sessions, isLoading, error, mutate } = useChatSessions(gameName);
  const [isCreating, setIsCreating] = useState(false);

  async function handleCreate() {
    setIsCreating(true);
    try {
      const session = await createChatSession(gameName);
      onSelect(session.id);
    } catch (err) {
      console.error("[chat] Failed to create session:", err);
    } finally {
      setIsCreating(false);
    }
  }

  async function handleDelete(e: React.MouseEvent, sessionId: string) {
    e.stopPropagation();
    try {
      await deleteChatSession(gameName, sessionId);
      await mutate();
    } catch (err) {
      console.error("[chat] Failed to delete session:", err);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-500">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-red-400 text-sm px-4 text-center">
        {error instanceof Error ? error.message : "Failed to load sessions"}
      </div>
    );
  }

  const items = sessions ?? [];

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800/50 shrink-0">
        <span className="text-xs font-medium text-zinc-400">Chat Sessions</span>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 text-xs"
          onClick={handleCreate}
          disabled={isCreating}
        >
          {isCreating ? <Loader2 className="size-3 animate-spin" /> : <Plus className="size-3" />}
          New Chat
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 gap-2 text-zinc-500 px-6 text-center">
          <MessageSquare className="size-8 text-zinc-700" />
          <p className="text-sm">No conversations yet</p>
          <p className="text-xs text-zinc-600">
            Start a new chat session to begin building with AI.
          </p>
        </div>
      ) : (
        <ScrollArea className="flex-1">
          <div className="py-1">
            {items.map((session) => (
              <button
                key={session.id}
                onClick={() => onSelect(session.id)}
                className="group w-full text-left px-3 py-2.5 hover:bg-zinc-800/50 transition-colors border-b border-zinc-800/50 last:border-b-0"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs text-zinc-300 line-clamp-1 flex-1">
                    {session.title ?? "Untitled session"}
                  </p>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={(e) => handleDelete(e, session.id)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleDelete(e, session.id); }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-zinc-600 hover:text-red-400 shrink-0 cursor-pointer"
                  >
                    <Trash2 className="size-3.5" />
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  {session.model && (
                    <span className="text-[11px] text-zinc-500">
                      {modelName(session.model)}
                    </span>
                  )}
                  <span className="text-[11px] text-zinc-600">
                    {new Date(session.created_at).toLocaleString()}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
