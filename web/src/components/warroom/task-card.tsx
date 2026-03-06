"use client";

import { ChevronRight, Check, X, Loader2, Clock, Pause } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useState } from "react";
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

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case "completed":
      return <Check className="size-3.5 text-green-400" />;
    case "running":
      return <Loader2 className="size-3.5 text-blue-400 animate-spin" />;
    case "failed":
      return <X className="size-3.5 text-red-400" />;
    case "blocked":
      return <Pause className="size-3.5 text-zinc-500" />;
    default:
      return <Clock className="size-3.5 text-zinc-600" />;
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
          className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm rounded-md transition-colors hover:bg-zinc-800/50 ${
            isActive ? "bg-zinc-800/70 ring-1 ring-zinc-700" : ""
          }`}
        >
          {/* Task number */}
          <span className="text-xs text-zinc-500 w-5 shrink-0 text-right font-mono">
            {task.task_number}
          </span>

          {/* Status icon */}
          <StatusIcon status={task.status} />

          {/* Title */}
          <span
            className={`flex-1 truncate ${
              task.status === "completed"
                ? "text-zinc-500 line-through"
                : task.status === "failed"
                  ? "text-red-400"
                  : "text-zinc-200"
            }`}
          >
            {task.title}
          </span>

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
            className={`size-3 text-zinc-600 transition-transform ${
              open ? "rotate-90" : ""
            }`}
          />
        </button>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="ml-10 mr-3 mb-2 text-xs text-zinc-500 space-y-1">
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
          {task.output && (
            <pre className="text-[10px] bg-zinc-900 rounded p-2 overflow-auto max-h-32 text-zinc-400">
              {JSON.stringify(task.output, null, 2)}
            </pre>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
