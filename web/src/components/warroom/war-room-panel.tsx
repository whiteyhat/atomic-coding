"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  Ban,
  Bot,
  CheckCircle2,
  Hammer,
  Loader2,
  Paintbrush,
  ShieldCheck,
  Sparkles,
  WifiOff,
} from "lucide-react";
import { useWarRoom } from "@/lib/use-war-room";
import { buildWarRoomAgentViewModels } from "@/lib/war-room-console";
import { cancelWarRoom } from "@/lib/api";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ElapsedTimer } from "./elapsed-timer";
import { LiveEventFeed } from "./live-event-feed";
import { SuggestedPrompts } from "./suggested-prompts";
import { StatusBadge } from "./status-badge";
import { TaskCard } from "./task-card";
import { cn } from "@/lib/utils";
import type { AgentName } from "@/lib/types";

interface WarRoomPanelProps {
  gameName: string;
  warRoomId: string;
  onSuggestedPrompt?: (prompt: string) => void;
}

const AGENT_THEME: Record<
  AgentName,
  {
    accent: string;
    border: string;
    icon: typeof Bot;
    surface: string;
  }
> = {
  jarvis: {
    accent: "text-fuchsia-200",
    border: "border-fuchsia-300/18",
    icon: Bot,
    surface: "from-fuchsia-500/16 via-fuchsia-500/6 to-transparent",
  },
  forge: {
    accent: "text-sky-200",
    border: "border-sky-300/18",
    icon: Hammer,
    surface: "from-sky-500/16 via-sky-500/6 to-transparent",
  },
  pixel: {
    accent: "text-emerald-200",
    border: "border-emerald-300/18",
    icon: Paintbrush,
    surface: "from-emerald-500/16 via-emerald-500/6 to-transparent",
  },
  checker: {
    accent: "text-amber-200",
    border: "border-amber-300/18",
    icon: ShieldCheck,
    surface: "from-amber-500/16 via-amber-500/6 to-transparent",
  },
};

function computeElapsedSeconds(startedAt: string, completedAt: string | null, now: number): number {
  const startMs = new Date(startedAt).getTime();
  const endMs = completedAt ? new Date(completedAt).getTime() : now;
  return Math.max(0, Math.round((endMs - startMs) / 1000));
}

function formatHeartbeat(seconds: number | null): string {
  if (seconds == null) return "No heartbeat";
  if (seconds < 2) return "Live now";
  return `${seconds}s ago`;
}

function formatTimestamp(value: string | null): string {
  if (!value) return "--";
  return new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function agentStatusCopy(status: string): string {
  switch (status) {
    case "working":
      return "Active";
    case "error":
      return "Blocked";
    case "timeout":
      return "Timeout";
    case "stale":
      return "Stale";
    default:
      return "Standby";
  }
}

function statusTone(status: string): string {
  switch (status) {
    case "working":
      return "border-emerald-300/25 bg-emerald-500/10 text-emerald-100";
    case "error":
      return "border-rose-300/25 bg-rose-500/10 text-rose-100";
    case "timeout":
      return "border-amber-300/25 bg-amber-500/10 text-amber-100";
    case "stale":
      return "border-orange-300/25 bg-orange-500/10 text-orange-100";
    default:
      return "border-white/12 bg-white/[0.05] text-white/60";
  }
}

export function WarRoomPanel({
  gameName,
  warRoomId,
  onSuggestedPrompt,
}: WarRoomPanelProps) {
  const {
    warRoom,
    tasks,
    events,
    heartbeats,
    suggestedPrompts,
    isComplete,
    isLoading,
    error,
    refresh,
  } = useWarRoom(gameName, warRoomId);
  const [isCancelling, setIsCancelling] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const counts = useMemo(
    () =>
      tasks.reduce(
        (acc, task) => {
          acc[task.status] = (acc[task.status] ?? 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      ),
    [tasks],
  );

  const agentViews = useMemo(
    () =>
      buildWarRoomAgentViewModels({
        tasks,
        events,
        heartbeats,
        now,
      }),
    [events, heartbeats, now, tasks],
  );

  if (isLoading && !warRoom) {
    return (
      <div className="flex h-full items-center justify-center text-white/40">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center px-5 text-center text-sm text-rose-300">
        {error}
      </div>
    );
  }

  if (!warRoom) return null;

  const completedCount = counts.completed ?? 0;
  const failedCount = counts.failed ?? 0;
  const activeCount = counts.running ?? 0;
  const blockedCount = counts.blocked ?? 0;
  const assignedCount = counts.assigned ?? 0;
  const progress = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;
  const pipelineElapsedSeconds = computeElapsedSeconds(warRoom.created_at, warRoom.completed_at, now);
  const isPipelineLive = !warRoom.completed_at;

  return (
    <div className="flex h-full flex-col bg-[radial-gradient(circle_at_top,#45131d_0%,#1a090d_52%,#0d0406_100%)]">
      <div className="shrink-0 border-b border-white/8 px-5 py-4">
        <div className="overflow-hidden rounded-[1.8rem] border border-white/10 bg-[linear-gradient(155deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-5 shadow-[0_22px_60px_rgba(0,0,0,0.32)]">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <div className="flex size-11 items-center justify-center rounded-[1.1rem] border border-rose-300/18 bg-rose-500/10 text-rose-50">
                  <Sparkles className="size-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">War Room Console</p>
                  <p className="text-[11px] text-white/42">Inline operator view for the live pipeline</p>
                </div>
              </div>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-white/78">
                {warRoom.prompt}
              </p>
            </div>

            <div className="flex items-center gap-2">
              {(warRoom.status === "planning" || warRoom.status === "running") && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="rounded-xl border border-white/10 bg-white/[0.04] text-white/65 hover:bg-white/[0.08] hover:text-rose-200"
                  disabled={isCancelling}
                  onClick={async () => {
                    setIsCancelling(true);
                    try {
                      await cancelWarRoom(gameName, warRoom.id);
                      await refresh();
                    } catch (cancelError) {
                      console.error("[warroom] cancel failed:", cancelError);
                    } finally {
                      setIsCancelling(false);
                    }
                  }}
                >
                  {isCancelling ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Ban className="size-4" />
                  )}
                </Button>
              )}
              <StatusBadge status={warRoom.status} />
            </div>
          </div>

          <div className="mt-5 grid gap-3 grid-cols-4">
            <div className="rounded-[1.15rem] border border-white/10 bg-black/20 px-4 py-3">
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/35">Elapsed</p>
              <ElapsedTimer seconds={pipelineElapsedSeconds} isLive={isPipelineLive} variant="card" className="mt-2" />
            </div>
            {[
              { label: "Running", value: String(activeCount) },
              { label: "Queued", value: String(assignedCount) },
              { label: "Failed", value: String(failedCount) },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-[1.15rem] border border-white/10 bg-black/20 px-4 py-3"
              >
                <p className="text-[10px] uppercase tracking-[0.2em] text-white/35">
                  {item.label}
                </p>
                <p className="mt-2 text-lg font-semibold text-white">{item.value}</p>
              </div>
            ))}
          </div>

          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between text-[11px] text-white/45">
              <span>Pipeline progress</span>
              <span>{completedCount}/{tasks.length} complete</span>
            </div>
            <div className="relative h-2 overflow-hidden rounded-full bg-white/[0.08]">
              <motion.div
                className={cn(
                  "absolute inset-y-0 left-0 rounded-full",
                  warRoom.status === "failed"
                    ? "bg-rose-400"
                    : isComplete
                      ? "bg-emerald-400"
                      : "bg-[linear-gradient(90deg,#fb7185_0%,#f472b6_38%,#60a5fa_100%)]",
                )}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.4, ease: "easeOut" }}
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {blockedCount > 0 && (
                <Badge variant="outline" className="rounded-full border-amber-300/20 bg-amber-500/10 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-amber-100">
                  {blockedCount} blocked
                </Badge>
              )}
              {failedCount > 0 && (
                <Badge variant="outline" className="rounded-full border-rose-300/20 bg-rose-500/10 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-rose-100">
                  {failedCount} failed
                </Badge>
              )}
              {warRoom.completed_at && (
                <Badge variant="outline" className="rounded-full border-white/12 bg-white/[0.05] px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-white/60">
                  Ended {formatTimestamp(warRoom.completed_at)}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="space-y-4 px-5 py-5">
          <div className="rounded-[1.7rem] border border-white/8 bg-black/20 p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-white">Agent states</p>
                <p className="text-[11px] text-white/40">
                  Open each agent lane for diagnostics, retries, validation notes, and recent events
                </p>
              </div>
              <Badge variant="outline" className="rounded-full border-white/12 bg-white/[0.05] px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-white/60">
                4 agents
              </Badge>
            </div>

            <Accordion
              type="multiple"
              defaultValue={agentViews
                .filter((view) => view.status === "working" || view.status === "error")
                .map((view) => view.agent)}
              className="space-y-3"
            >
              {agentViews.map((view) => {
                const theme = AGENT_THEME[view.agent];
                const Icon = theme.icon;
                const isActive = view.status === "working";

                return (
                  <AccordionItem
                    key={view.agent}
                    value={view.agent}
                    className={cn(
                      "relative overflow-hidden rounded-[1.5rem] border bg-black/20 px-4",
                      theme.border,
                    )}
                  >
                    <div className={cn("absolute inset-x-0 top-0 h-px bg-gradient-to-r opacity-80", theme.surface)} />
                    <AccordionTrigger className="gap-4 py-4 hover:no-underline">
                      <div className="flex min-w-0 flex-1 items-start gap-3">
                        <motion.div
                          className={cn(
                            "relative flex size-11 shrink-0 items-center justify-center rounded-[1rem] border border-white/10 bg-white/[0.04]",
                            theme.accent,
                          )}
                          animate={
                            isActive
                              ? { boxShadow: ["0 0 0 rgba(244,63,94,0)", "0 0 20px rgba(244,63,94,0.18)", "0 0 0 rgba(244,63,94,0)"] }
                              : undefined
                          }
                          transition={{ duration: 1.8, repeat: Infinity }}
                        >
                          <Icon className="size-5" />
                          {isActive && (
                            <motion.span
                              className="absolute inset-0 rounded-[1rem] border border-white/18"
                              animate={{ scale: [1, 1.08, 1], opacity: [0.35, 0, 0.35] }}
                              transition={{ duration: 1.8, repeat: Infinity }}
                            />
                          )}
                        </motion.div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-white">{view.label}</p>
                            <Badge variant="outline" className={cn("rounded-full px-2.5 py-1 text-[10px] uppercase tracking-[0.18em]", statusTone(view.status))}>
                              {view.status === "stale" && <WifiOff className="size-3" />}
                              {agentStatusCopy(view.status)}
                            </Badge>
                            {view.retry && (
                              <Badge variant="outline" className="rounded-full border-amber-300/20 bg-amber-500/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-amber-100">
                                Retry {view.retry.attempt}/{view.retry.max}
                              </Badge>
                            )}
                          </div>
                          <p className="mt-2 line-clamp-2 text-sm leading-6 text-white/70">
                            {view.currentTask
                              ? `#${view.currentTask.task_number} ${view.currentTask.title}`
                              : "No current task assigned."}
                          </p>
                          <div className="mt-3 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] text-white/42">
                            <span className="max-w-[120px] truncate">{view.phase ?? "idle phase"}</span>
                            <span className="text-white/15">·</span>
                            <ElapsedTimer seconds={view.elapsedSeconds} isLive={isActive} variant="inline" className="shrink-0 text-[11px] text-white/42" />
                            <span className="text-white/15">·</span>
                            <span className="shrink-0">{formatHeartbeat(view.lastPingAgeSeconds)}</span>
                            <span className="text-white/15">·</span>
                            <span className="shrink-0">Latest {formatTimestamp(view.latestEventAt)}</span>
                          </div>
                        </div>
                      </div>
                    </AccordionTrigger>

                    <AccordionContent className="pb-4">
                      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
                        <div className="space-y-4">
                          <div className="grid gap-3 grid-cols-2">
                            <div className="rounded-[1.2rem] border border-white/10 bg-white/[0.03] px-3 py-3">
                              <p className="text-[10px] uppercase tracking-[0.18em] text-white/35">Timer</p>
                              <ElapsedTimer seconds={view.elapsedSeconds} isLive={isActive} variant="compact" className="mt-2 text-sm text-white" />
                            </div>
                            <div className="rounded-[1.2rem] border border-white/10 bg-white/[0.03] px-3 py-3">
                              <p className="text-[10px] uppercase tracking-[0.18em] text-white/35">Heartbeat</p>
                              <p className="mt-2 text-sm font-semibold text-white">{formatHeartbeat(view.lastPingAgeSeconds)}</p>
                            </div>
                            <div className="rounded-[1.2rem] border border-white/10 bg-white/[0.03] px-3 py-3">
                              <p className="text-[10px] uppercase tracking-[0.18em] text-white/35">Tasks handled</p>
                              <p className="mt-2 text-sm font-semibold text-white">{view.tasksHandled}</p>
                            </div>
                            <div className="rounded-[1.2rem] border border-white/10 bg-white/[0.03] px-3 py-3">
                              <p className="text-[10px] uppercase tracking-[0.18em] text-white/35">Last event</p>
                              <p className="mt-2 truncate text-sm font-semibold text-white">{view.latestEventLabel ?? "No events yet"}</p>
                            </div>
                          </div>

                          <div className="rounded-[1.3rem] border border-white/10 bg-black/20 p-4">
                            <p className="text-[11px] uppercase tracking-[0.18em] text-white/35">Current focus</p>
                            <p className="mt-2 text-sm font-medium text-white/88">
                              {view.currentTask
                                ? `#${view.currentTask.task_number} ${view.currentTask.title}`
                                : "Awaiting dispatch"}
                            </p>

                            <div className="mt-3 flex flex-wrap gap-2">
                              {view.dependencies.length > 0 && (
                                <Badge variant="outline" className="max-w-full truncate rounded-full border-white/12 bg-white/[0.04] px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-white/60">
                                  Depends on {view.dependencies.map((entry) => `#${entry}`).join(", ")}
                                </Badge>
                              )}
                              {view.waitingOn.length > 0 && (
                                <Badge variant="outline" className="max-w-full truncate rounded-full border-amber-300/20 bg-amber-500/10 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-amber-100">
                                  Waiting on {view.waitingOn.map((entry) => `#${entry}`).join(", ")}
                                </Badge>
                              )}
                              {view.outputKeys.length > 0 && (
                                <Badge variant="outline" className="max-w-full truncate rounded-full border-white/12 bg-black/20 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-white/60">
                                  Outputs {view.outputKeys.join(", ")}
                                </Badge>
                              )}
                            </div>
                          </div>

                          {view.validationSummaries.length > 0 && (
                            <div className="rounded-[1.3rem] border border-white/10 bg-black/20 p-4">
                              <p className="text-[11px] uppercase tracking-[0.18em] text-white/35">Validation</p>
                              <div className="mt-3 space-y-2">
                                {view.validationSummaries.map((entry) => (
                                  <div key={entry} className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2 text-sm text-white/68">
                                    {entry}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {view.warnings.length > 0 && (
                            <div className="rounded-[1.3rem] border border-amber-300/18 bg-amber-500/[0.08] p-4">
                              <p className="text-[11px] uppercase tracking-[0.18em] text-amber-100/80">Warnings</p>
                              <div className="mt-3 space-y-2">
                                {view.warnings.map((warning) => (
                                  <div key={warning} className="rounded-xl border border-amber-300/12 bg-black/15 px-3 py-2 text-sm text-amber-50/82">
                                    {warning}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {view.errors.length > 0 && (
                            <div className="rounded-[1.3rem] border border-rose-300/18 bg-rose-500/[0.08] p-4">
                              <p className="text-[11px] uppercase tracking-[0.18em] text-rose-100/82">Errors</p>
                              <div className="mt-3 space-y-2">
                                {view.errors.map((entry) => (
                                  <div key={entry} className="rounded-xl border border-rose-300/12 bg-black/15 px-3 py-2 text-sm text-rose-50/82">
                                    {entry}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="rounded-[1.35rem] border border-white/10 bg-black/20 p-4">
                          <p className="text-[11px] uppercase tracking-[0.18em] text-white/35">Recent events</p>
                          <div className="mt-3 space-y-2">
                            {view.recentEvents.length === 0 ? (
                              <div className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-3 text-sm text-white/42">
                                No agent-specific events yet.
                              </div>
                            ) : (
                              view.recentEvents.map((event) => (
                                <div
                                  key={event.id}
                                  className={cn(
                                    "rounded-xl border px-3 py-3",
                                    event.tone === "success" && "border-emerald-300/18 bg-emerald-500/[0.08]",
                                    event.tone === "warning" && "border-amber-300/18 bg-amber-500/[0.08]",
                                    event.tone === "error" && "border-rose-300/18 bg-rose-500/[0.08]",
                                    event.tone === "info" && "border-white/8 bg-white/[0.03]",
                                  )}
                                >
                                  <div className="flex items-center justify-between gap-3">
                                    <p className="min-w-0 truncate text-sm font-medium text-white/88">{event.title}</p>
                                    <span className="shrink-0 text-[10px] uppercase tracking-[0.16em] text-white/35">
                                      {formatTimestamp(event.createdAt)}
                                    </span>
                                  </div>
                                  {event.detail && (
                                    <p className="mt-2 text-sm leading-6 text-white/60">{event.detail}</p>
                                  )}
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </div>

          <LiveEventFeed events={events} />

          <div className="rounded-[1.7rem] border border-white/8 bg-black/20 p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-white">Pipeline steps</p>
                <p className="text-[11px] text-white/40">
                  Task-level diagnostics and dependency state across the full run
                </p>
              </div>
              <Badge variant="outline" className="rounded-full border-white/12 bg-white/[0.05] px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-white/60">
                {tasks.length} steps
              </Badge>
            </div>
            <div className="space-y-2">
              {tasks.map((task) => (
                <TaskCard key={task.id} task={task} />
              ))}
            </div>
          </div>

          {warRoom.status === "failed" && (
            <div className="rounded-[1.5rem] border border-rose-300/18 bg-rose-500/[0.08] px-4 py-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-rose-100">
                <AlertTriangle className="size-4" />
                War room failed
              </div>
              <p className="mt-2 text-sm leading-6 text-rose-50/70">
                Open the agent accordions and step cards above for retry context, validation reports, and the latest failure messages.
              </p>
            </div>
          )}

          {isComplete && suggestedPrompts.length > 0 && onSuggestedPrompt && (
            <div className="rounded-[1.7rem] border border-white/8 bg-black/20 p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
                <CheckCircle2 className="size-4 text-emerald-300" />
                Spin a new feature thread from this run
              </div>
              <SuggestedPrompts prompts={suggestedPrompts} onSelect={onSuggestedPrompt} />
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
