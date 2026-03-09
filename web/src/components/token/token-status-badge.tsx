"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { TokenLaunch } from "@/lib/types";

const statusConfig: Record<
  TokenLaunch["status"],
  { label: string; className: string; icon?: string }
> = {
  draft: {
    label: "Draft",
    className: "bg-gray-500/15 text-gray-400 border-gray-500/25",
  },
  configuring: {
    label: "Configuring",
    className: "bg-blue-500/15 text-blue-400 border-blue-500/25",
  },
  deploying: {
    label: "Deploying",
    className:
      "bg-yellow-500/15 text-yellow-400 border-yellow-500/25 animate-pulse",
  },
  live: {
    label: "Live",
    className:
      "bg-green-500/15 text-green-400 border-green-500/25 animate-pulse",
  },
  graduating: {
    label: "Graduating",
    className: "bg-amber-500/15 text-amber-400 border-amber-500/25",
  },
  graduated: {
    label: "Graduated",
    className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
    icon: "\u2713",
  },
  failed: {
    label: "Failed",
    className: "bg-red-500/15 text-red-400 border-red-500/25",
  },
};

interface TokenStatusBadgeProps {
  status: TokenLaunch["status"];
  className?: string;
}

export function TokenStatusBadge({ status, className }: TokenStatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <Badge
      variant="outline"
      className={cn(config.className, className)}
    >
      {config.icon && <span className="mr-0.5">{config.icon}</span>}
      {config.label}
    </Badge>
  );
}
