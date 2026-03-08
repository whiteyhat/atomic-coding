"use client";

import { useEffect, useState } from "react";
import { listChatSessions, createChatSession, deleteChatSession } from "@/lib/api";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Loader2, MessageSquare, Plus, Trash2 } from "lucide-react";
import { MODELS } from "@/lib/constants";
import type { ChatSession } from "@/lib/types";

interface ChatSessionListProps {
  gameName: string;
  onSelect: (sessionId: string) => void;
}

function modelName(modelId: string | null): string | null {
  if (!modelId) return null;
  return MODELS.find((m) => m.id === modelId)?.name ?? modelId.split("/").pop() ?? modelId;
}

export function ChatSessionList({ gameName, onSelect }: ChatSessionListProps) {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    listChatSessions(gameName)
      .then((data) => {
        if (!cancelled) setSessions(data);
      })
      .catch((err) => {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Failed to load sessions");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [gameName]);

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
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
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
        {error}
      </div>
    );
  }

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

      {sessions.length === 0 ? (
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
            {sessions.map((session) => (
              <button
                key={session.id}
                onClick={() => onSelect(session.id)}
                className="group w-full text-left px-3 py-2.5 hover:bg-zinc-800/50 transition-colors border-b border-zinc-800/50 last:border-b-0"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs text-zinc-300 line-clamp-1 flex-1">
                    {session.title ?? "Untitled session"}
                  </p>
                  <button
                    onClick={(e) => handleDelete(e, session.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-zinc-600 hover:text-red-400 shrink-0"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
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
