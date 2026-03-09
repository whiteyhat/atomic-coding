"use client";

import type { AgentHeartbeat, AgentName } from "@/lib/types";

const AGENTS: { name: AgentName; label: string; color: string }[] = [
  { name: "jarvis", label: "Jarvis", color: "bg-purple-400 shadow-purple-500/50" },
  { name: "forge", label: "Forge", color: "bg-blue-400 shadow-blue-500/50" },
  { name: "pixel", label: "Pixel", color: "bg-green-400 shadow-green-500/50" },
  { name: "checker", label: "Checker", color: "bg-amber-400 shadow-amber-500/50" },
];

const STATUS_STYLES: Record<string, string> = {
  working: "shadow-sm",
  idle: "!bg-white/15 !shadow-none",
  error: "!bg-rose-500 !shadow-rose-500/50 shadow-sm",
  timeout: "!bg-amber-500 !shadow-amber-500/50 shadow-sm",
};

interface AgentHealthBarProps {
  heartbeats: AgentHeartbeat[];
}

export function AgentHealthBar({ heartbeats }: AgentHealthBarProps) {
  const heartbeatMap = new Map(heartbeats.map((h) => [h.agent, h]));

  return (
    <div className="flex items-center gap-3 px-3 py-2">
      {AGENTS.map(({ name, label, color }) => {
        const hb = heartbeatMap.get(name);
        const status = hb?.status ?? "idle";
        const statusStyle = STATUS_STYLES[status] ?? STATUS_STYLES.idle;

        return (
          <div key={name} className="flex items-center gap-1.5">
            <div
              className={`size-2 rounded-full ${color} ${statusStyle} ${
                status === "working" ? "animate-pulse" : ""
              }`}
            />
            <span className="text-[11px] text-white/40">{label}</span>
          </div>
        );
      })}
    </div>
  );
}
