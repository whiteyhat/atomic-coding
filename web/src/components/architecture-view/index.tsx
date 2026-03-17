"use client";

import { ReactFlowProvider } from "@xyflow/react";
import { cn } from "@/lib/utils";
import type { LastEditedGame } from "@/lib/analytics";
import { ArchitectureCanvas } from "./ArchitectureCanvas";
import "@xyflow/react/dist/style.css";

interface ArchitectureViewProps {
  lastEditedGame: LastEditedGame | null;
  className?: string;
}

export function ArchitectureView({ lastEditedGame, className }: ArchitectureViewProps) {
  return (
    <div className={cn("h-[calc(100vh-15rem)] min-h-[620px] overflow-hidden rounded-[2.2rem] border border-white/8 bg-[#18080d]/80 shadow-[0_26px_100px_rgba(10,3,6,0.32)]", className)}>
      <ReactFlowProvider>
        <ArchitectureCanvas lastEditedGame={lastEditedGame} />
      </ReactFlowProvider>
    </div>
  );
}
