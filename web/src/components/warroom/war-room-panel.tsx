"use client";

import { useWarRoom } from "@/lib/use-war-room";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, XCircle, Swords } from "lucide-react";
import { TaskCard } from "./task-card";
import { AgentHealthBar } from "./agent-health-bar";
import { SuggestedPrompts } from "./suggested-prompts";
import type { WarRoomStatus } from "@/lib/types";

function StatusBadge({ status }: { status: WarRoomStatus }) {
  switch (status) {
    case "running":
    case "planning":
      return (
        <Badge variant="secondary" className="gap-1 text-xs animate-pulse">
          <Loader2 className="size-3 animate-spin" />
          {status === "planning" ? "Planning" : "Running"}
        </Badge>
      );
    case "completed":
      return (
        <Badge className="gap-1 text-xs bg-green-500/15 text-green-400 border-green-500/30">
          <CheckCircle2 className="size-3" />
          Completed
        </Badge>
      );
    case "failed":
      return (
        <Badge variant="destructive" className="gap-1 text-xs">
          <XCircle className="size-3" />
          Failed
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="text-xs">
          {status}
        </Badge>
      );
  }
}

interface WarRoomPanelProps {
  gameName: string;
  warRoomId: string;
  onSuggestedPrompt?: (prompt: string) => void;
}

export function WarRoomPanel({
  gameName,
  warRoomId,
  onSuggestedPrompt,
}: WarRoomPanelProps) {
  const {
    warRoom,
    tasks,
    heartbeats,
    suggestedPrompts,
    isComplete,
    isLoading,
    error,
  } = useWarRoom(gameName, warRoomId);

  if (isLoading && !warRoom) {
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

  if (!warRoom) return null;

  const completedCount = tasks.filter((t) => t.status === "completed").length;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-3 border-b border-zinc-800 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Swords className="size-4 text-zinc-400" />
            <span className="text-sm font-medium text-zinc-200">
              War Room
            </span>
          </div>
          <StatusBadge status={warRoom.status} />
        </div>

        {/* Progress */}
        <div className="space-y-1">
          <div className="flex justify-between text-[11px] text-zinc-500">
            <span>Pipeline progress</span>
            <span>
              {completedCount}/{tasks.length}
            </span>
          </div>
          <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                warRoom.status === "failed"
                  ? "bg-red-500"
                  : isComplete
                    ? "bg-green-500"
                    : "bg-blue-500"
              }`}
              style={{
                width: `${tasks.length > 0 ? (completedCount / tasks.length) * 100 : 0}%`,
              }}
            />
          </div>
        </div>

        {/* Agent health */}
        <AgentHealthBar heartbeats={heartbeats} />
      </div>

      {/* Prompt */}
      <div className="px-3 py-2 border-b border-zinc-800">
        <p className="text-xs text-zinc-500 line-clamp-2">
          {warRoom.prompt}
        </p>
      </div>

      {/* Task list */}
      <ScrollArea className="flex-1">
        <div className="py-1">
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
        </div>

        {/* Suggested prompts on completion */}
        {isComplete && suggestedPrompts.length > 0 && onSuggestedPrompt && (
          <SuggestedPrompts
            prompts={suggestedPrompts}
            onSelect={onSuggestedPrompt}
          />
        )}
      </ScrollArea>
    </div>
  );
}
