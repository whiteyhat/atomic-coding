"use client";

import { memo, useState } from "react";
import type { NodeProps } from "@xyflow/react";
import { Bot, Hammer, Paintbrush, ShieldCheck } from "lucide-react";
import { DirectionalHandles } from "./node-handles";
import type { AgentNodeData } from "../hooks/useArchitectureState";

const ICONS = {
  jarvis: Bot,
  forge: Hammer,
  pixel: Paintbrush,
  checker: ShieldCheck,
} as const;

function AgentNodeComponent({ data }: NodeProps) {
  const nodeData = data as AgentNodeData;
  const [hovered, setHovered] = useState(false);
  const Icon = ICONS[nodeData.id];

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative w-[178px] cursor-pointer rounded-[1.45rem] border bg-[linear-gradient(180deg,rgba(255,255,255,0.1),rgba(255,255,255,0.05))] px-4 py-3.5 shadow-[0_14px_44px_rgba(0,0,0,0.28)] backdrop-blur-xl transition duration-300"
      style={{
        borderColor: hovered ? `${nodeData.accentColor}80` : "rgba(255,255,255,0.1)",
        boxShadow: hovered
          ? `0 16px 48px rgba(0,0,0,0.32), 0 0 28px ${nodeData.accentColor}30`
          : "0 14px 44px rgba(0,0,0,0.28)",
        transform: hovered ? "translateY(-3px) scale(1.02)" : "translateY(0) scale(1)",
      }}
    >
      <div
        className="absolute inset-y-3 left-0 w-1 rounded-r-full"
        style={{ background: nodeData.accentColor }}
      />

      <div className="flex items-start gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-black/20"
          style={{ color: nodeData.accentColor }}
        >
          <Icon className="size-[18px]" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold text-white">
              {nodeData.label}
            </span>
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ background: nodeData.accentColor }}
            />
          </div>
          <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-white/48">
            {nodeData.role}
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-[0.18em] text-white/32">
          Skills
        </span>
        <span className="font-mono text-[10px] text-white/55">
          {nodeData.skills.length}
        </span>
      </div>

      <div className="mt-2">
        <span className="inline-flex items-center gap-1 rounded-full border border-[#4285F4]/20 bg-[#4285F4]/10 px-2 py-0.5 text-[9px] font-medium text-[#8AB4F8]/80">
          <span className="size-1.5 rounded-full bg-[#4285F4]" />
          Gemini {nodeData.model.includes("pro") ? "Pro" : nodeData.model.includes("flash-lite") ? "Flash Lite" : "Flash"}
        </span>
      </div>

      <DirectionalHandles
        sourceColor={nodeData.accentColor}
        targetColor={`${nodeData.accentColor}99`}
      />
    </div>
  );
}

export const AgentNode = memo(AgentNodeComponent);
