"use client";

import { useState } from "react";
import { useWarRoom } from "@/lib/use-war-room";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Loader2, Swords, ArrowLeft, Ban, AlertTriangle } from "lucide-react";
import { TaskCard } from "./task-card";
import { AgentHealthBar } from "./agent-health-bar";
import { SuggestedPrompts } from "./suggested-prompts";
import { StatusBadge } from "./status-badge";
import { cancelWarRoom } from "@/lib/api";

interface WarRoomPanelProps {
  gameName: string;
  warRoomId: string;
  onBack?: () => void;
  onSuggestedPrompt?: (prompt: string) => void;
}

export function WarRoomPanel({
  gameName,
  warRoomId,
  onBack,
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
    refresh,
  } = useWarRoom(gameName, warRoomId);
  const [isCancelling, setIsCancelling] = useState(false);

  if (isLoading && !warRoom) {
    return (
      <div className="flex items-center justify-center h-full text-white/40">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-rose-400 text-sm px-4 text-center">
        {error}
      </div>
    );
  }

  if (!warRoom) return null;

  const completedCount = tasks.filter((t) => t.status === "completed").length;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-3 border-b border-white/[0.06] space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {onBack && (
              <Button variant="ghost" size="icon" className="size-6" onClick={onBack}>
                <ArrowLeft className="size-3.5" />
              </Button>
            )}
            <Swords className="size-4 text-white/50" />
            <span className="text-sm font-medium text-white/80">
              War Room
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {(warRoom.status === "running" || warRoom.status === "planning") && (
              <Button
                variant="ghost"
                size="icon"
                className="size-6 text-white/50 hover:text-rose-400"
                disabled={isCancelling}
                onClick={async () => {
                  setIsCancelling(true);
                  try {
                    await cancelWarRoom(gameName, warRoom.id);
                    await refresh();
                  } catch (err) {
                    console.error("[warroom] cancel failed:", err);
                  } finally {
                    setIsCancelling(false);
                  }
                }}
              >
                {isCancelling ? <Loader2 className="size-3.5 animate-spin" /> : <Ban className="size-3.5" />}
              </Button>
            )}
            <StatusBadge status={warRoom.status} />
          </div>
        </div>

        {/* Progress */}
        <div className="space-y-1">
          <div className="flex justify-between text-[11px] text-white/40">
            <span>Pipeline progress</span>
            <span>
              {completedCount}/{tasks.length}
            </span>
          </div>
          <div className="h-1.5 bg-white/8 rounded-full overflow-hidden">
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

        {/* Error summary for failed pipelines */}
        {warRoom.status === "failed" && (() => {
          const failedTasks = tasks.filter((t) => t.status === "failed");
          if (failedTasks.length === 0) return null;
          return (
            <div className="mt-2 p-2 rounded border border-red-500/20 bg-red-500/10 space-y-1">
              <div className="flex items-center gap-1.5 text-rose-400 text-xs font-medium">
                <AlertTriangle className="size-3" />
                <span>{failedTasks.length} task{failedTasks.length > 1 ? "s" : ""} failed</span>
              </div>
              {failedTasks.map((t) => (
                <p key={t.id} className="text-[11px] text-red-300/80 pl-4.5">
                  #{t.task_number} {t.title}
                  {t.output && (t.output as Record<string, unknown>).error
                    ? `: ${String((t.output as Record<string, unknown>).error).slice(0, 120)}`
                    : ""}
                </p>
              ))}
            </div>
          );
        })()}
      </div>

      {/* Prompt */}
      <div className="px-3 py-2 border-b border-white/[0.06]">
        <p className="text-xs text-white/40 line-clamp-2">
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
