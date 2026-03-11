"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  PlayCircle,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { WarRoomEvent } from "@/lib/types";
import { cn } from "@/lib/utils";

function formatEventTime(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function describeEvent(event: WarRoomEvent): string {
  const taskPrefix =
    event.task_number != null ? `Task #${event.task_number}` : "Pipeline";

  switch (event.event_type) {
    case "task_blocked":
      return `${taskPrefix} waiting on ${(event.payload.waiting_on as number[] | undefined)?.map((value) => `#${value}`).join(", ") ?? "dependencies"}`;
    case "task_assigned":
      return `${taskPrefix} queued for ${event.agent ?? "agent"}`;
    case "task_running":
      return `${taskPrefix} started on ${event.agent ?? "agent"}`;
    case "task_completed":
      return `${taskPrefix} completed`;
    case "task_failed":
      return `${taskPrefix} failed`;
    case "task_retry":
      return `${taskPrefix} retry ${(event.payload.attempt as number | undefined) ?? "?"}/${(event.payload.max as number | undefined) ?? "?"}`;
    case "agent_thinking":
      return `${event.agent ?? "Agent"} ${String(event.payload.phase ?? "processing")}`;
    case "pipeline_started":
      return "Pipeline dispatched";
    case "war_room_completed":
      return "War room completed";
    case "war_room_failed":
      return "War room failed";
    default:
      return event.event_type.replaceAll("_", " ");
  }
}

function eventTone(eventType: string): {
  icon: typeof Bot;
  badge: string;
  iconClass: string;
} {
  switch (eventType) {
    case "task_completed":
    case "war_room_completed":
      return {
        icon: CheckCircle2,
        badge: "border-emerald-400/25 bg-emerald-500/10 text-emerald-200",
        iconClass: "text-emerald-300",
      };
    case "task_failed":
    case "war_room_failed":
      return {
        icon: AlertTriangle,
        badge: "border-rose-400/25 bg-rose-500/10 text-rose-200",
        iconClass: "text-rose-300",
      };
    case "task_running":
    case "task_assigned":
    case "pipeline_started":
      return {
        icon: PlayCircle,
        badge: "border-sky-400/25 bg-sky-500/10 text-sky-200",
        iconClass: "text-sky-300",
      };
    case "agent_thinking":
      return {
        icon: Sparkles,
        badge: "border-violet-400/25 bg-violet-500/10 text-violet-200",
        iconClass: "text-violet-300",
      };
    default:
      return {
        icon: Clock3,
        badge: "border-white/12 bg-white/6 text-white/60",
        iconClass: "text-white/45",
      };
  }
}

function PayloadLog({ payload }: { payload: Record<string, unknown> }) {
  const entries = Object.entries(payload).filter(
    ([, v]) => v !== null && v !== undefined && v !== "",
  );
  if (entries.length === 0) return null;

  return (
    <div className="mt-2 rounded-lg border border-white/8 bg-black/40 px-3 py-2 font-mono text-[10px] leading-relaxed">
      {entries.map(([key, value]) => {
        let display: string;
        if (typeof value === "object") {
          try {
            display = JSON.stringify(value, null, 2);
          } catch {
            display = String(value);
          }
        } else {
          display = String(value);
        }
        const isMultiline = display.includes("\n");
        return (
          <div key={key} className={cn("flex gap-2", isMultiline && "flex-col")}>
            <span className="shrink-0 text-white/35">{key}:</span>
            <span
              className={cn(
                "text-white/70",
                isMultiline && "whitespace-pre-wrap pl-2",
              )}
            >
              {display}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function EventItem({ event }: { event: WarRoomEvent }) {
  const [expanded, setExpanded] = useState(false);
  const tone = eventTone(event.event_type);
  const Icon = tone.icon;
  const hasPayload = Object.keys(event.payload ?? {}).length > 0;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, marginTop: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className={cn(
        "rounded-[1rem] border border-white/8 bg-white/[0.03] px-3 py-2 transition-colors",
        hasPayload && "cursor-pointer hover:bg-white/[0.055]",
      )}
      onClick={() => hasPayload && setExpanded((v) => !v)}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-xl border border-white/8 bg-black/20">
          <Icon className={cn("size-3.5", tone.iconClass)} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-xs font-medium text-white/82">
              {describeEvent(event)}
            </p>
            <div className="flex shrink-0 items-center gap-1.5">
              <span className="font-mono text-[10px] text-white/35">
                {formatEventTime(event.created_at)}
              </span>
              {hasPayload && (
                <ChevronRight
                  className={cn(
                    "size-3 text-white/25 transition-transform",
                    expanded && "rotate-90",
                  )}
                />
              )}
            </div>
          </div>
          <div className="mt-1 flex items-center gap-2">
            {event.agent && (
              <Badge
                variant="outline"
                className={cn("rounded-full px-2 py-0.5 text-[10px] capitalize", tone.badge)}
              >
                {event.agent}
              </Badge>
            )}
            {event.task_number != null && (
              <Badge
                variant="outline"
                className="rounded-full border-white/12 bg-black/20 px-2 py-0.5 text-[10px] text-white/60"
              >
                #{event.task_number}
              </Badge>
            )}
          </div>
          {expanded && hasPayload && (
            <PayloadLog payload={event.payload as Record<string, unknown>} />
          )}
        </div>
      </div>
    </motion.div>
  );
}

interface LiveEventFeedProps {
  events: WarRoomEvent[];
}

export function LiveEventFeed({ events }: LiveEventFeedProps) {
  const [showAll, setShowAll] = useState(false);
  const safeEvents = Array.isArray(events) ? events : [];

  if (safeEvents.length === 0) return null;

  const sorted = [...safeEvents].reverse();
  const visible = showAll ? sorted : sorted.slice(0, 3);
  const hiddenCount = sorted.length - 3;

  return (
    <div className="rounded-[1.15rem] border border-white/8 bg-black/20 p-3 shadow-[0_10px_30px_rgba(10,5,6,0.18)]">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-white">Live feed</p>
          <p className="text-[11px] text-white/40">
            Recent pipeline and agent events
          </p>
        </div>
        <Badge
          variant="outline"
          className="rounded-full border-white/12 bg-white/6 px-2 py-0.5 text-[10px] text-white/60"
        >
          {safeEvents.length} events
        </Badge>
      </div>

      <div className="space-y-2">
        <AnimatePresence initial={false}>
          {visible.map((event) => (
            <EventItem key={event.id} event={event} />
          ))}
        </AnimatePresence>
      </div>

      {hiddenCount > 0 && (
        <Collapsible open={showAll} onOpenChange={setShowAll}>
          <CollapsibleTrigger asChild>
            <button className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-white/8 bg-white/[0.03] py-1.5 text-[11px] text-white/45 transition-colors hover:bg-white/[0.07] hover:text-white/70">
              <ChevronDown
                className={cn(
                  "size-3 transition-transform",
                  showAll && "rotate-180",
                )}
              />
              {showAll ? "Show less" : `Show ${hiddenCount} more event${hiddenCount !== 1 ? "s" : ""}`}
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent />
        </Collapsible>
      )}
    </div>
  );
}
