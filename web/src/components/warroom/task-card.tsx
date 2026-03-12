"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Loader2,
  PauseCircle,
  PlayCircle,
  RotateCcw,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { AgentName } from "@/lib/types";
import type { WarRoomTaskState } from "@/lib/war-room-state";
import { cn } from "@/lib/utils";
import { ElapsedTimer } from "./elapsed-timer";

const AGENT_STYLES: Record<AgentName, string> = {
  jarvis: "border-fuchsia-400/25 bg-fuchsia-500/12 text-fuchsia-200",
  forge: "border-sky-400/25 bg-sky-500/12 text-sky-200",
  pixel: "border-emerald-400/25 bg-emerald-500/12 text-emerald-200",
  checker: "border-amber-400/25 bg-amber-500/12 text-amber-200",
};


function formatTimestamp(value: string | null): string | null {
  if (!value) return null;
  return new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function StatusIcon({ status }: { status: WarRoomTaskState["status"] }) {
  switch (status) {
    case "completed":
      return <CheckCircle2 className="size-4 text-emerald-300" />;
    case "running":
      return <Loader2 className="size-4 animate-spin text-sky-300" />;
    case "failed":
      return <XCircle className="size-4 text-rose-300" />;
    case "blocked":
      return <PauseCircle className="size-4 text-amber-300" />;
    case "assigned":
      return <PlayCircle className="size-4 text-violet-300" />;
    default:
      return <Clock3 className="size-4 text-white/35" />;
  }
}

function RunningTimer({
  startedAt,
  completedAt,
}: {
  startedAt: string | null;
  completedAt: string | null;
}) {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!startedAt) return;

    const startMs = new Date(startedAt).getTime();
    const stopMs = completedAt ? new Date(completedAt).getTime() : null;

    const update = () => {
      const endMs = stopMs ?? Date.now();
      setSeconds(Math.max(0, Math.round((endMs - startMs) / 1000)));
    };

    update();

    if (stopMs != null) return;

    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [completedAt, startedAt]);

  return (
    <ElapsedTimer seconds={seconds} isLive={!completedAt} variant="compact" />
  );
}

function StatusTone({ task }: { task: WarRoomTaskState }) {
  switch (task.status) {
    case "running":
      return "border-sky-400/20 bg-sky-500/[0.08] shadow-[0_10px_30px_rgba(45,100,180,0.12)]";
    case "assigned":
      return "border-violet-400/18 bg-violet-500/[0.07]";
    case "blocked":
      return "border-amber-400/18 bg-amber-500/[0.06]";
    case "failed":
      return "border-rose-400/18 bg-rose-500/[0.08]";
    case "completed":
      return "border-emerald-400/16 bg-emerald-500/[0.05]";
    default:
      return "border-white/8 bg-white/[0.03]";
  }
}

interface TaskCardProps {
  task: WarRoomTaskState;
  onRetry?: () => Promise<void>;
}

export function TaskCard({ task, onRetry }: TaskCardProps) {
  const [open, setOpen] = useState(task.status === "running" || task.status === "failed");
  const [isRetrying, setIsRetrying] = useState(false);
  const startedAt = formatTimestamp(task.started_at);
  const completedAt = formatTimestamp(task.completed_at);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button
          className={cn(
            "w-full rounded-[1rem] border p-3 text-left transition-all duration-200 hover:border-white/14 hover:bg-white/[0.05]",
            StatusTone({ task })
          )}
        >
          <div className="flex items-start gap-3">
            <div className="mt-0.5 shrink-0">
              <StatusIcon status={task.status} />
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/35">
                      #{task.task_number}
                    </span>
                    {task.assigned_agent && (
                      <Badge
                        variant="outline"
                        className={cn(
                          "rounded-full border px-2 py-0.5 text-[10px] capitalize",
                          AGENT_STYLES[task.assigned_agent]
                        )}
                      >
                        {task.assigned_agent}
                      </Badge>
                    )}
                    {task.retry_attempt != null && (
                      <Badge
                        variant="outline"
                        className="rounded-full border-amber-400/25 bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-200"
                      >
                        <RotateCcw className="size-3" />
                        Retry {task.retry_attempt}/{task.retry_max ?? "?"}
                      </Badge>
                    )}
                  </div>
                  <p
                    className={cn(
                      "mt-2 line-clamp-2 text-sm font-medium",
                      task.status === "completed" ? "text-white/60" : "text-white/88"
                    )}
                  >
                    {task.title}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {task.started_at && (
                    <RunningTimer
                      startedAt={task.started_at}
                      completedAt={task.completed_at}
                    />
                  )}
                  <ChevronRight
                    className={cn(
                      "size-4 shrink-0 text-white/25 transition-transform",
                      open && "rotate-90"
                    )}
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <Badge
                  variant="outline"
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-[10px] capitalize",
                    task.status === "running" &&
                      "border-sky-400/30 bg-sky-500/10 text-sky-200",
                    task.status === "assigned" &&
                      "border-violet-400/30 bg-violet-500/10 text-violet-200",
                    task.status === "blocked" &&
                      "border-amber-400/30 bg-amber-500/10 text-amber-200",
                    task.status === "completed" &&
                      "border-emerald-400/30 bg-emerald-500/10 text-emerald-200",
                    task.status === "failed" &&
                      "border-rose-400/30 bg-rose-500/10 text-rose-200",
                    task.status === "pending" &&
                      "border-white/12 bg-white/8 text-white/55"
                  )}
                >
                  {task.status}
                </Badge>
                {task.active_phase && (
                  <Badge
                    variant="outline"
                    className="rounded-full border-white/12 bg-black/20 px-2 py-0.5 text-[10px] text-white/60"
                  >
                    {task.active_phase}
                  </Badge>
                )}
                {task.waiting_on.length > 0 && (
                  <Badge
                    variant="outline"
                    className="max-w-full truncate rounded-full border-amber-400/20 bg-amber-500/8 px-2 py-0.5 text-[10px] text-amber-100"
                  >
                    Waiting on {task.waiting_on.map((dependency) => `#${dependency}`).join(", ")}
                  </Badge>
                )}
                {task.output_keys.length > 0 && (
                  <Badge
                    variant="outline"
                    className="max-w-full truncate rounded-full border-white/12 bg-black/20 px-2 py-0.5 text-[10px] text-white/55"
                  >
                    {task.output_keys.join(", ")}
                  </Badge>
                )}
              </div>

              {task.description && (
                <p className="line-clamp-2 text-[12px] leading-5 text-white/50">
                  {task.description}
                </p>
              )}
            </div>
          </div>
        </button>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="mt-2 space-y-2 rounded-[1rem] border border-white/8 bg-black/20 p-3 text-xs text-white/60">
          {task.waiting_on.length > 0 && (
            <div className="rounded-xl border border-amber-400/18 bg-amber-500/[0.08] px-3 py-2">
              <p className="font-medium text-amber-100">
                Blocked by {task.waiting_on.map((dependency) => `#${dependency}`).join(", ")}
              </p>
              <p className="mt-1 text-[11px] text-amber-100/70">
                This step will queue automatically when its dependencies finish.
              </p>
            </div>
          )}

          {task.error_message && (
            <div className="flex items-start gap-2 rounded-xl border border-rose-400/18 bg-rose-500/[0.08] px-3 py-2 text-rose-100">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              <span className="min-w-0 flex-1 break-words text-[11px] leading-relaxed">
                {task.error_message}
              </span>
              {task.status === "failed" && onRetry && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 shrink-0 gap-1 rounded-lg border border-rose-300/20 bg-rose-500/15 px-2 text-[10px] font-medium text-rose-100 hover:bg-rose-500/25 hover:text-white"
                  disabled={isRetrying}
                  onClick={async (e) => {
                    e.stopPropagation();
                    setIsRetrying(true);
                    try {
                      await onRetry();
                    } finally {
                      setIsRetrying(false);
                    }
                  }}
                >
                  {isRetrying ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <RotateCcw className="size-3" />
                  )}
                  Retry
                </Button>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2">
              <p className="text-white/35">Started</p>
              <p className="mt-1 font-medium text-white/75">{startedAt ?? "--"}</p>
            </div>
            <div className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2">
              <p className="text-white/35">Completed</p>
              <p className="mt-1 font-medium text-white/75">{completedAt ?? "--"}</p>
            </div>
            <div className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2">
              <p className="text-white/35">Dependencies</p>
              <p className="mt-1 font-medium text-white/75">
                {task.depends_on.length > 0
                  ? task.depends_on.map((dependency) => `#${dependency}`).join(", ")
                  : "None"}
              </p>
            </div>
            <div className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2">
              <p className="text-white/35">Last update</p>
              <p className="mt-1 font-medium text-white/75">
                {formatTimestamp(task.last_event_at) ?? "--"}
              </p>
            </div>
          </div>

          {task.output && (
            <pre className="max-h-56 overflow-auto rounded-xl border border-white/8 bg-[#13070a]/80 p-3 text-[10px] leading-5 text-white/55">
              {JSON.stringify(task.output, null, 2)}
            </pre>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
