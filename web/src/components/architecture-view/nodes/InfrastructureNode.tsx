"use client";

import { memo, useState } from "react";
import type { NodeProps } from "@xyflow/react";
import { DirectionalHandles } from "./node-handles";
import type { InfrastructureNodeData } from "../hooks/useArchitectureState";

function HubNodeContent({ data }: { data: InfrastructureNodeData }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative w-[200px] cursor-pointer rounded-[1.6rem] border px-4 py-4 shadow-[0_16px_52px_rgba(0,0,0,0.32)] backdrop-blur-xl transition duration-300"
      style={{
        borderColor: hovered ? "#4285F480" : "#4285F440",
        background: hovered
          ? "linear-gradient(180deg, rgba(66,133,244,0.18), rgba(66,133,244,0.06))"
          : "linear-gradient(180deg, rgba(66,133,244,0.12), rgba(66,133,244,0.04))",
        boxShadow: hovered
          ? "0 18px 56px rgba(0,0,0,0.36), 0 0 36px rgba(66,133,244,0.22)"
          : "0 16px 52px rgba(0,0,0,0.32), 0 0 24px rgba(66,133,244,0.12)",
        transform: hovered ? "translateY(-2px) scale(1.02)" : "translateY(0) scale(1)",
      }}
    >
      <div className="absolute -inset-[1px] -z-10 animate-[gemini-glow-pulse_3s_ease-in-out_infinite] rounded-[1.6rem]" />

      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#4285F4]/30 bg-[#4285F4]/15 text-lg">
          {data.icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-white">{data.label}</p>
          <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-[#8AB4F8]/80">
            AI Backbone
          </p>
        </div>
      </div>

      {data.capabilities && data.capabilities.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {data.capabilities.map((cap) => (
            <span
              key={cap}
              className="inline-flex rounded-full border border-[#4285F4]/20 bg-[#4285F4]/10 px-2 py-0.5 text-[8px] font-medium text-[#8AB4F8]/90"
            >
              {cap}
            </span>
          ))}
        </div>
      )}

      <DirectionalHandles
        sourceColor="#4285F4"
        targetColor="#4285F499"
      />
    </div>
  );
}

function ModelNodeContent({ data }: { data: InfrastructureNodeData }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative w-[160px] cursor-pointer rounded-[1.2rem] border px-3 py-2.5 shadow-[0_12px_36px_rgba(0,0,0,0.26)] backdrop-blur-lg transition duration-200"
      style={{
        borderColor: hovered ? "#8AB4F860" : "#8AB4F830",
        background: hovered
          ? "linear-gradient(180deg, rgba(138,180,248,0.14), rgba(138,180,248,0.05))"
          : "linear-gradient(180deg, rgba(138,180,248,0.08), rgba(138,180,248,0.02))",
        transform: hovered ? "scale(1.03)" : "scale(1)",
      }}
    >
      <div className="flex items-start gap-2">
        <div className="flex min-h-8 min-w-8 items-center justify-center rounded-xl border border-[#4285F4]/25 bg-[#4285F4]/10 px-2 text-[10px] font-bold text-[#8AB4F8]">
          {data.icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold leading-[1.15rem] text-white/85">
            {data.label}
          </p>
          <p className="mt-0.5 text-[9px] uppercase tracking-[0.16em] text-[#8AB4F8]/50">
            model
          </p>
        </div>
      </div>

      {data.connectedNodes.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {data.connectedNodes.map((node) => (
            <span
              key={node.id}
              className="inline-flex rounded-full border border-white/10 bg-white/[0.05] px-1.5 py-0.5 text-[8px] font-medium text-white/60"
            >
              {node.label}
            </span>
          ))}
        </div>
      )}

      <DirectionalHandles
        sourceColor="#8AB4F8"
        targetColor="#8AB4F899"
      />
    </div>
  );
}

function InfrastructureNodeComponent({ data }: NodeProps) {
  const nodeData = data as InfrastructureNodeData;

  if (nodeData.variant === "hub") {
    return <HubNodeContent data={nodeData} />;
  }

  return <ModelNodeContent data={nodeData} />;
}

export const InfrastructureNode = memo(InfrastructureNodeComponent);
