"use client";

import { memo, useState } from "react";
import type { NodeProps } from "@xyflow/react";
import { DirectionalHandles } from "./node-handles";
import type { ServiceNodeData } from "../hooks/useArchitectureState";

function ServiceNodeComponent({ data }: NodeProps) {
  const nodeData = data as ServiceNodeData;
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative w-[148px] cursor-pointer rounded-[1rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] px-3 py-2.5 shadow-[0_10px_30px_rgba(0,0,0,0.24)] backdrop-blur-lg transition duration-200"
      style={{
        background: hovered
          ? "linear-gradient(180deg, rgba(255,255,255,0.12), rgba(255,255,255,0.05))"
          : undefined,
        transform: hovered ? "scale(1.03)" : "scale(1)",
      }}
    >
      <div className="flex items-start gap-2">
        <div className="flex min-h-8 min-w-8 items-center justify-center rounded-xl border border-white/10 bg-black/20 px-2 text-[10px] font-semibold text-white/78">
          {nodeData.icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-[11px] font-semibold leading-[1.15rem] text-white/78">
            {nodeData.label}
          </p>
          <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-white/30">
            {nodeData.category}
          </p>
        </div>
      </div>

      <DirectionalHandles
        includeSource={false}
        sourceColor="rgba(255,255,255,0.2)"
        targetColor="rgba(255,255,255,0.22)"
        targetSize={5}
      />
    </div>
  );
}

export const ServiceNode = memo(ServiceNodeComponent);
