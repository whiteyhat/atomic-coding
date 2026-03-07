"use client";

import { useEffect, useState } from "react";
import { listWarRooms } from "@/lib/api";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Swords } from "lucide-react";
import { StatusBadge } from "./status-badge";
import type { WarRoom } from "@/lib/types";

interface WarRoomListProps {
  gameName: string;
  onSelect: (warRoomId: string) => void;
}

export function WarRoomList({ gameName, onSelect }: WarRoomListProps) {
  const [rooms, setRooms] = useState<WarRoom[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    listWarRooms(gameName)
      .then((data) => {
        if (!cancelled) setRooms(data);
      })
      .catch((err) => {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Failed to load war rooms");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [gameName]);

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

  if (rooms.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 text-zinc-500 px-6 text-center">
        <Swords className="size-8 text-zinc-700" />
        <p className="text-sm">No war rooms yet</p>
        <p className="text-xs text-zinc-600">
          Start one from the chat to coordinate AI agents on a task.
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="py-1">
        {rooms.map((room) => (
          <button
            key={room.id}
            onClick={() => onSelect(room.id)}
            className="w-full text-left px-3 py-2.5 hover:bg-zinc-800/50 transition-colors border-b border-zinc-800/50 last:border-b-0"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs text-zinc-300 line-clamp-2 flex-1">
                {room.prompt}
              </p>
              <StatusBadge status={room.status} />
            </div>
            <p className="text-[11px] text-zinc-600 mt-1">
              {new Date(room.created_at).toLocaleString()}
            </p>
          </button>
        ))}
      </div>
    </ScrollArea>
  );
}
