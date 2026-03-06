"use client";

import type { AgentHeartbeat, AgentName } from "@/lib/types";

const AGENTS: { name: AgentName; label: string }[] = [
  { name: "jarvis", label: "Jarvis" },
  { name: "forge", label: "Forge" },
  { name: "pixel", label: "Pixel" },
  { name: "checker", label: "Checker" },
];

const STATUS_STYLES: Record<string, string> = {
  working: "bg-green-500 shadow-green-500/50 shadow-sm",
  idle: "bg-zinc-600",
  error: "bg-red-500 shadow-red-500/50 shadow-sm",
  timeout: "bg-amber-500 shadow-amber-500/50 shadow-sm",
};

interface AgentHealthBarProps {
  heartbeats: AgentHeartbeat[];
}

export function AgentHealthBar({ heartbeats }: AgentHealthBarProps) {
  const heartbeatMap = new Map(heartbeats.map((h) => [h.agent, h]));

  return (
    <div className="flex items-center gap-3 px-3 py-2">
      {AGENTS.map(({ name, label }) => {
        const hb = heartbeatMap.get(name);
        const status = hb?.status ?? "idle";
        const dotStyle = STATUS_STYLES[status] ?? STATUS_STYLES.idle;

        return (
          <div key={name} className="flex items-center gap-1.5">
            <div
              className={`size-2 rounded-full ${dotStyle} ${
                status === "working" ? "animate-pulse" : ""
              }`}
            />
            <span className="text-[11px] text-zinc-500">{label}</span>
          </div>
        );
      })}
    </div>
  );
}
