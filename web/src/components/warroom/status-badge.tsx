import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, XCircle, Ban } from "lucide-react";
import type { WarRoomStatus } from "@/lib/types";

export function StatusBadge({ status }: { status: WarRoomStatus }) {
  switch (status) {
    case "running":
    case "planning":
      return (
        <Badge variant="secondary" className="gap-1 text-xs animate-pulse bg-rose-500/10 text-rose-400 border-rose-500/30">
          <Loader2 className="size-3 animate-spin" />
          {status === "planning" ? "Planning" : "Running"}
        </Badge>
      );
    case "completed":
      return (
        <Badge className="gap-1 text-xs bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
          <CheckCircle2 className="size-3" />
          Completed
        </Badge>
      );
    case "failed":
      return (
        <Badge variant="destructive" className="gap-1 text-xs bg-rose-500/15 text-rose-400 border-rose-500/30">
          <XCircle className="size-3" />
          Failed
        </Badge>
      );
    case "cancelled":
      return (
        <Badge variant="outline" className="gap-1 text-xs text-white/50 border-white/15">
          <Ban className="size-3" />
          Cancelled
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="text-xs text-white/50 border-white/15">
          {status}
        </Badge>
      );
  }
}
