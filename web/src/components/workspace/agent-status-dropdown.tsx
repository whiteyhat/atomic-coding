"use client";

import { Bot, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { AgentStatus } from "@/lib/agent-status";

interface AgentStatusDropdownProps {
  activeAgent: AgentStatus | null;
}

export function AgentStatusDropdown({
  activeAgent,
}: AgentStatusDropdownProps) {
  if (!activeAgent || activeAgent.state === "done") {
    return (
      <Badge variant="outline" className="gap-1.5 text-xs font-normal">
        <Bot className="size-3" />
        Ready
      </Badge>
    );
  }

  return (
    <Badge variant="secondary" className="gap-1.5 text-xs font-normal animate-pulse">
      <Bot className="size-3" />
      {activeAgent.label}
      <ChevronDown className="size-3 opacity-50" />
    </Badge>
  );
}
