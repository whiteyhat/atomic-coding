import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import type { WarRoomStatus } from "@/lib/types";

export function StatusBadge({ status }: { status: WarRoomStatus }) {
  switch (status) {
    case "running":
    case "planning":
      return (
        <Badge variant="secondary" className="gap-1 text-xs animate-pulse">
          <Loader2 className="size-3 animate-spin" />
          {status === "planning" ? "Planning" : "Running"}
        </Badge>
      );
    case "completed":
      return (
        <Badge className="gap-1 text-xs bg-green-500/15 text-green-400 border-green-500/30">
          <CheckCircle2 className="size-3" />
          Completed
        </Badge>
      );
    case "failed":
      return (
        <Badge variant="destructive" className="gap-1 text-xs">
          <XCircle className="size-3" />
          Failed
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="text-xs">
          {status}
        </Badge>
      );
  }
}
