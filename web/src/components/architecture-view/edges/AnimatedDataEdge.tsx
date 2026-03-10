"use client";

import { memo } from "react";
import { BaseEdge, getSmoothStepPath, type EdgeProps } from "@xyflow/react";

function AnimatedDataEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}: EdgeProps) {
  const intensity = (data?.intensity as string) || "low";
  const color = (data?.color as string) || "rgba(255,255,255,0.24)";

  const [edgePath] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 24,
  });

  const strokeWidth = intensity === "high" ? 1.7 : intensity === "medium" ? 1.25 : 1;
  const opacity = intensity === "high" ? 0.52 : intensity === "medium" ? 0.38 : 0.22;
  const particleRadius = intensity === "high" ? 3 : 2.2;
  const duration = intensity === "high" ? "2.2s" : intensity === "medium" ? "3s" : "4s";

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: color,
          strokeWidth,
          opacity,
          animation:
            intensity === "low"
              ? undefined
              : `architecture-edge-pulse ${intensity === "high" ? "2.4s" : "3.2s"} ease-in-out infinite`,
        }}
      />

      <circle
        r={particleRadius}
        fill={color}
        opacity={0.92}
        filter={intensity === "high" ? "url(#architecture-glow)" : undefined}
      >
        <animateMotion dur={duration} repeatCount="indefinite" path={edgePath} />
      </circle>

      {intensity === "high" ? (
        <circle r={2} fill={color} opacity={0.4}>
          <animateMotion
            dur={duration}
            repeatCount="indefinite"
            path={edgePath}
            begin="1.1s"
          />
        </circle>
      ) : null}
    </>
  );
}

export const AnimatedDataEdge = memo(AnimatedDataEdgeComponent);
