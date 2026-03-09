"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Swords } from "lucide-react";
import { StatusBadge } from "./status-badge";
import { useWarRooms } from "@/lib/hooks";

interface WarRoomListProps {
  gameName: string;
  onSelect: (warRoomId: string) => void;
}

export function WarRoomList({ gameName, onSelect }: WarRoomListProps) {
  const { data: rooms, isLoading, error } = useWarRooms(gameName);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full text-white/40">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-rose-400 text-sm px-4 text-center">
        {error instanceof Error ? error.message : "Failed to load war rooms"}
      </div>
    );
  }

  const items = rooms ?? [];

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 text-white/40 px-6 text-center">
        <Swords className="size-8 text-white/20" />
        <p className="text-sm">No war rooms yet</p>
        <p className="text-xs text-white/30">
          Start one from the chat to coordinate AI agents on a task.
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="py-1">
        {items.map((room) => (
          <button
            key={room.id}
            onClick={() => onSelect(room.id)}
            className="w-full text-left px-3 py-2.5 hover:bg-white/[0.06] transition-colors border-b border-white/[0.06] last:border-b-0"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs text-white/70 line-clamp-2 flex-1">
                {room.prompt}
              </p>
              <StatusBadge status={room.status} />
            </div>
            <p className="text-[11px] text-white/30 mt-1">
              {new Date(room.created_at).toLocaleString()}
            </p>
          </button>
        ))}
      </div>
    </ScrollArea>
  );
}
