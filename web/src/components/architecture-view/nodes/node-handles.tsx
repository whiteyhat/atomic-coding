"use client";

import { Fragment } from "react";
import { Handle, Position } from "@xyflow/react";

const SIDES = [
  { id: "top", position: Position.Top },
  { id: "right", position: Position.Right },
  { id: "bottom", position: Position.Bottom },
  { id: "left", position: Position.Left },
] as const;

interface DirectionalHandlesProps {
  sourceColor: string;
  targetColor?: string;
  sourceSize?: number;
  targetSize?: number;
  includeSource?: boolean;
  includeTarget?: boolean;
}

export function DirectionalHandles({
  sourceColor,
  targetColor = "rgba(255,255,255,0.18)",
  sourceSize = 6,
  targetSize = 6,
  includeSource = true,
  includeTarget = true,
}: DirectionalHandlesProps) {
  return (
    <>
      {SIDES.map((side) => (
        <Fragment key={side.id}>
          {includeTarget ? (
            <Handle
              id={`target-${side.id}`}
              type="target"
              position={side.position}
              style={{
                width: targetSize,
                height: targetSize,
                border: "none",
                background: targetColor,
                opacity: 0.8,
              }}
            />
          ) : null}
          {includeSource ? (
            <Handle
              id={`source-${side.id}`}
              type="source"
              position={side.position}
              style={{
                width: sourceSize,
                height: sourceSize,
                border: "none",
                background: sourceColor,
                opacity: 0.9,
              }}
            />
          ) : null}
        </Fragment>
      ))}
    </>
  );
}
