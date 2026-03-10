"use client";

import { useEffect, useState } from "react";
import { Bot, Hammer, Paintbrush, ShieldCheck, WifiOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { AgentHeartbeat, AgentName } from "@/lib/types";
import type { WarRoomTaskState } from "@/lib/war-room-state";
import { cn } from "@/lib/utils";
import { ElapsedTimer } from "./elapsed-timer";

const AGENTS: {
  name: AgentName;
  label: string;
  icon: typeof Bot;
  accent: string;
  surface: string;
  border: string;
}[] = [
  {
    name: "jarvis",
    label: "Jarvis",
    icon: Bot,
    accent: "text-fuchsia-300",
    surface: "from-fuchsia-500/18 via-fuchsia-500/8 to-transparent",
    border: "border-fuchsia-400/25",
  },
  {
    name: "forge",
    label: "Forge",
    icon: Hammer,
    accent: "text-sky-300",
    surface: "from-sky-500/18 via-sky-500/8 to-transparent",
    border: "border-sky-400/25",
  },
  {
    name: "pixel",
    label: "Pixel",
    icon: Paintbrush,
    accent: "text-emerald-300",
    surface: "from-emerald-500/18 via-emerald-500/8 to-transparent",
    border: "border-emerald-400/25",
  },
  {
    name: "checker",
    label: "Checker",
    icon: ShieldCheck,
    accent: "text-amber-300",
    surface: "from-amber-500/18 via-amber-500/8 to-transparent",
    border: "border-amber-400/25",
  },
];


function formatLastPing(ageSeconds: number | null): string {
  if (ageSeconds == null) return "No heartbeat";
  if (ageSeconds < 2) return "Live now";
  return `${ageSeconds}s ago`;
}

function getMetadataNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function getMetadataString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

interface AgentHealthBarProps {
  heartbeats: AgentHeartbeat[];
  tasks: WarRoomTaskState[];
}

export function AgentHealthBar({ heartbeats, tasks }: AgentHealthBarProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="grid grid-cols-2 gap-2">
      {AGENTS.map(({ name, label, icon: Icon, accent, surface, border }) => {
        const heartbeat = heartbeats.find((entry) => entry.agent === name);
        const taskNumber = getMetadataNumber(heartbeat?.metadata?.task_number);
        const activeTask =
          (taskNumber != null
            ? tasks.find((task) => task.task_number === taskNumber)
            : null) ??
          tasks.find(
            (task) =>
              task.assigned_agent === name &&
              (task.status === "running" || task.status === "assigned")
          ) ??
          null;

        const lastPingAge =
          heartbeat != null
            ? Math.max(0, Math.round((now - new Date(heartbeat.last_ping).getTime()) / 1000))
            : null;
        const isStale =
          heartbeat?.status === "working" &&
          lastPingAge != null &&
          lastPingAge > 20;
        const status = isStale ? "stale" : heartbeat?.status ?? "idle";
        const phase =
          getMetadataString(heartbeat?.metadata?.phase) ??
          activeTask?.active_phase ??
          null;
        const elapsedSeconds =
          getMetadataNumber(heartbeat?.metadata?.elapsed_seconds) ??
          (activeTask?.started_at
            ? Math.max(
                0,
                Math.round((now - new Date(activeTask.started_at).getTime()) / 1000)
              )
            : null);

        return (
          <div
            key={name}
            className={cn(
              "relative overflow-hidden rounded-[1rem] border bg-black/20 p-3",
              "shadow-[0_10px_30px_rgba(10,5,6,0.2)]",
              border
            )}
          >
            <div
              className={cn(
                "absolute inset-0 bg-gradient-to-br opacity-100",
                surface
              )}
            />
            <div className="relative space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      "flex size-8 items-center justify-center rounded-xl border border-white/10 bg-white/6 backdrop-blur-sm",
                      accent
                    )}
                  >
                    <Icon className="size-4" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-white">{label}</p>
                    <p className="text-[10px] uppercase tracking-[0.18em] text-white/35">
                      {status === "working"
                        ? "Active"
                        : status === "error"
                          ? "Error"
                          : status === "timeout"
                            ? "Timeout"
                            : status === "stale"
                              ? "Stale"
                              : "Standby"}
                    </p>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-[10px]",
                    status === "working" &&
                      "border-emerald-400/30 bg-emerald-500/10 text-emerald-300",
                    status === "error" &&
                      "border-rose-400/30 bg-rose-500/10 text-rose-300",
                    status === "timeout" &&
                      "border-amber-400/30 bg-amber-500/10 text-amber-300",
                    status === "stale" &&
                      "border-orange-400/30 bg-orange-500/10 text-orange-300",
                    status === "idle" &&
                      "border-white/12 bg-white/6 text-white/60"
                  )}
                >
                  {status === "stale" ? (
                    <>
                      <WifiOff className="size-3" />
                      Stale
                    </>
                  ) : status}
                </Badge>
              </div>

              <div className="space-y-1 rounded-2xl border border-white/8 bg-black/20 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] uppercase tracking-[0.16em] text-white/35">
                    Current task
                  </span>
                  <ElapsedTimer seconds={elapsedSeconds} isLive={status === "working"} variant="compact" />
                </div>
                <p className="line-clamp-2 text-xs font-medium text-white/80">
                  {activeTask
                    ? `#${activeTask.task_number} ${activeTask.title}`
                    : "Awaiting dispatch"}
                </p>
                <div className="flex items-center justify-between gap-2 text-[11px] text-white/45">
                  <span className="min-w-0 truncate capitalize">{phase ?? "idle"}</span>
                  <span className="shrink-0">{formatLastPing(lastPingAge)}</span>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
