"use client";

import { ChevronRight, Check, X, Loader2, Clock, Pause, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useState, useEffect } from "react";
import type { WarRoomTask, AgentName } from "@/lib/types";

const AGENT_COLORS: Record<AgentName, string> = {
  jarvis: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  forge: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  pixel: "bg-green-500/15 text-green-400 border-green-500/30",
  checker: "bg-amber-500/15 text-amber-400 border-amber-500/30",
};

const AGENT_SHORT: Record<AgentName, string> = {
  jarvis: "JAR",
  forge: "FRG",
  pixel: "PIX",
  checker: "CHK",
};

function ElapsedTime({ startedAt }: { startedAt: string }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const start = new Date(startedAt).getTime();
    setElapsed(Math.round((Date.now() - start) / 1000));
    const interval = setInterval(() => {
      setElapsed(Math.round((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  return (
    <span className="text-[10px] text-white/30 font-mono shrink-0">
      {mins}:{secs.toString().padStart(2, "0")}
    </span>
  );
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case "completed":
      return <Check className="size-3.5 text-emerald-400" />;
    case "running":
      return <Loader2 className="size-3.5 text-blue-400 animate-spin" />;
    case "failed":
      return <X className="size-3.5 text-rose-400" />;
    case "blocked":
      return <Pause className="size-3.5 text-white/40" />;
    default:
      return <Clock className="size-3.5 text-white/30" />;
  }
}

interface TaskCardProps {
  task: WarRoomTask;
}

export function TaskCard({ task }: TaskCardProps) {
  const [open, setOpen] = useState(false);
  const agent = task.assigned_agent;
  const isActive = task.status === "running";

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button
          className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm rounded-xl transition-colors hover:bg-white/[0.06] ${
            isActive ? "bg-white/[0.05] ring-1 ring-white/10" : ""
          }`}
        >
          {/* Task number */}
          <span className="text-xs text-white/40 w-5 shrink-0 text-right font-mono">
            {task.task_number}
          </span>

          {/* Status icon */}
          <StatusIcon status={task.status} />

          {/* Title */}
          <span
            className={`flex-1 truncate ${
              task.status === "completed"
                ? "text-white/40 line-through"
                : task.status === "failed"
                  ? "text-rose-400"
                  : "text-white/80"
            }`}
          >
            {task.title}
          </span>

          {/* Elapsed time for running tasks */}
          {isActive && task.started_at && (
            <ElapsedTime startedAt={task.started_at} />
          )}

          {/* Agent badge */}
          {agent && (
            <Badge
              variant="outline"
              className={`text-[10px] px-1.5 py-0 h-4 font-mono ${AGENT_COLORS[agent]}`}
            >
              {AGENT_SHORT[agent]}
            </Badge>
          )}

          {/* Expand arrow */}
          <ChevronRight
            className={`size-3 text-white/30 transition-transform ${
              open ? "rotate-90" : ""
            }`}
          />
        </button>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="ml-10 mr-3 mb-2 text-xs text-white/40 space-y-1">
          {task.description && <p>{task.description}</p>}
          {task.started_at && (
            <p>
              Started:{" "}
              {new Date(task.started_at).toLocaleTimeString()}
            </p>
          )}
          {task.completed_at && (
            <p>
              Completed:{" "}
              {new Date(task.completed_at).toLocaleTimeString()}
            </p>
          )}
          {task.status === "failed" && task.output && (task.output as Record<string, unknown>).error ? (
            <div className="flex items-start gap-2 p-2 rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-400">
              <AlertTriangle className="size-3.5 mt-0.5 shrink-0" />
              <span className="text-[11px] leading-relaxed break-all">
                {String((task.output as Record<string, unknown>).error)}
              </span>
            </div>
          ) : null}
          {task.output && (
            <pre className="text-[10px] bg-white/[0.03] rounded-xl p-2 overflow-auto max-h-32 text-white/50 border border-white/[0.05]">
              {JSON.stringify(task.output, null, 2)}
            </pre>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
