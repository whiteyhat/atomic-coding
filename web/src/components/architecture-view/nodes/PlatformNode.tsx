"use client";

import { memo, useState } from "react";
import Image from "next/image";
import type { NodeProps } from "@xyflow/react";
import { DirectionalHandles } from "./node-handles";
import type { PlatformNodeData } from "../hooks/useArchitectureState";

function PlatformNodeComponent({ data }: NodeProps) {
  const nodeData = data as PlatformNodeData;
  const [hovered, setHovered] = useState(false);

  return (
    <div className="relative">
      <div
        className="pointer-events-none absolute inset-[-10px] rounded-full border border-rose-400/20"
        style={{ animation: "architecture-pulse-ring 2.6s ease-out infinite" }}
      />

      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className="relative flex h-[220px] w-[220px] cursor-pointer flex-col items-center justify-center rounded-full border border-rose-300/30 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.16)_0%,rgba(255,255,255,0.06)_45%,rgba(255,255,255,0.03)_100%)] px-5 text-center shadow-[0_20px_70px_rgba(0,0,0,0.34),0_0_60px_rgba(251,113,133,0.16)] backdrop-blur-2xl transition duration-300"
        style={{
          animation: "architecture-float 6s ease-in-out infinite",
          transform: hovered ? "scale(1.03)" : "scale(1)",
        }}
      >
        <div className="flex h-[72px] w-[72px] items-center justify-center rounded-[1.7rem] border border-white/14 bg-black/20 p-3 shadow-[0_18px_34px_rgba(0,0,0,0.28)]">
          <Image
            src={nodeData.iconSrc}
            alt={`${nodeData.label} icon`}
            width={48}
            height={48}
            className="h-full w-full rounded-[1.1rem] object-cover"
          />
        </div>

        <span className="mt-4 text-[15px] font-semibold tracking-[0.02em] text-white">
          {nodeData.label}
        </span>
        <span className="mt-1 rounded-full border border-rose-300/20 bg-rose-500/10 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.2em] text-rose-100/90">
          Platform core
        </span>

        {nodeData.lastEditedGameLabel ? (
          <span className="mt-3 max-w-[170px] truncate rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[10px] text-white/65">
            {nodeData.lastEditedGameLabel}
          </span>
        ) : null}

        <DirectionalHandles
          sourceColor="rgba(251,113,133,0.8)"
          targetColor="rgba(255,255,255,0.18)"
          sourceSize={7}
          targetSize={6}
        />
      </div>
    </div>
  );
}

export const PlatformNode = memo(PlatformNodeComponent);
