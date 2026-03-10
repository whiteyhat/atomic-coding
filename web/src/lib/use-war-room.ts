"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "./supabase";
import type {
  WarRoomWithTasks,
  WarRoomTask,
  WarRoomEvent,
  AgentHeartbeat,
  WarRoomStatus,
} from "./types";
import { getWarRoom as fetchWarRoom } from "./api";
import type { RealtimeChannel } from "@supabase/supabase-js";

interface UseWarRoomReturn {
  warRoom: WarRoomWithTasks | null;
  tasks: WarRoomTask[];
  events: WarRoomEvent[];
  heartbeats: AgentHeartbeat[];
  suggestedPrompts: string[];
  isComplete: boolean;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const TERMINAL_STATUSES: WarRoomStatus[] = ["completed", "failed", "cancelled"];

/**
 * Hook that subscribes to Supabase Realtime for war room updates
 * and maintains live state for tasks, events, and agent heartbeats.
 */
export function useWarRoom(
  gameName: string | null,
  warRoomId: string | null
): UseWarRoomReturn {
  const [warRoom, setWarRoom] = useState<WarRoomWithTasks | null>(null);
  const [tasks, setTasks] = useState<WarRoomTask[]>([]);
  const [events, setEvents] = useState<WarRoomEvent[]>([]);
  const [heartbeats, setHeartbeats] = useState<AgentHeartbeat[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const channelRef = useRef<RealtimeChannel | null>(null);

  const isComplete =
    warRoom != null && TERMINAL_STATUSES.includes(warRoom.status);

  const suggestedPrompts = warRoom?.suggested_prompts ?? [];

  // Fetch initial war room state
  const refresh = useCallback(async () => {
    if (!gameName || !warRoomId) return;
    console.log("[useWarRoom] fetching war room:", { gameName, warRoomId });
    setIsLoading(true);
    setError(null);
    try {
      const room = await fetchWarRoom(gameName, warRoomId);
      console.log("[useWarRoom] fetched:", room.status, "tasks:", room.tasks.length,
        "statuses:", room.tasks.map((t) => `#${t.task_number}:${t.status}`).join(", "));
      setWarRoom(room);
      setTasks(room.tasks);
    } catch (err) {
      console.error("[useWarRoom] fetch error:", err);
      setError(err instanceof Error ? err.message : "Failed to load war room");
    } finally {
      setIsLoading(false);
    }
  }, [gameName, warRoomId]);

  // Initial load
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Process a war room event and update local state
  const processEvent = useCallback((evt: WarRoomEvent) => {
    console.log("[useWarRoom] event:", evt.event_type, {
      taskNumber: evt.task_number,
      agent: evt.agent,
      payloadKeys: evt.payload ? Object.keys(evt.payload) : [],
    });

    setEvents((prev) => [...prev, evt]);

    if (evt.event_type === "war_room_cancelled") {
      setWarRoom((prev) => prev ? { ...prev, status: "cancelled" } : prev);
    }
    if (evt.event_type === "war_room_completed") {
      setWarRoom((prev) => prev ? { ...prev, status: "completed" } : prev);
    }
    if (evt.event_type === "war_room_failed") {
      setWarRoom((prev) => prev ? { ...prev, status: "failed" } : prev);
    }

    // Update task state from events
    if (evt.task_number != null) {
      setTasks((prev) =>
        prev.map((t) => {
          if (t.task_number !== evt.task_number) return t;
          const updates: Partial<WarRoomTask> = {};
          if (evt.event_type === "task_running") updates.status = "running";
          if (evt.event_type === "task_completed") {
            updates.status = "completed";
            if (evt.payload?.output_summary) {
              updates.output = evt.payload as Record<string, unknown>;
            }
          }
          if (evt.event_type === "task_failed") {
            updates.status = "failed";
            if (evt.payload) {
              updates.output = evt.payload as Record<string, unknown>;
            }
          }
          if (evt.event_type === "task_assigned") updates.status = "assigned";
          if (evt.event_type === "task_retry") updates.status = "pending";
          // agent_thinking confirms the task is still running (no status change needed)
          return { ...t, ...updates };
        })
      );
    }
  }, []);

  // Supabase Realtime subscription
  useEffect(() => {
    if (!warRoomId || isComplete) return;

    console.log("[useWarRoom] subscribing to realtime:", warRoomId);
    const supabase = getSupabaseBrowserClient();

    const channel = supabase
      .channel(`war-room:${warRoomId}`)
      // Subscribe to new war room events
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "war_room_events",
          filter: `war_room_id=eq.${warRoomId}`,
        },
        (payload) => {
          const evt = payload.new as WarRoomEvent;
          processEvent(evt);
        }
      )
      // Subscribe to heartbeat updates
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "agent_heartbeats",
          filter: `war_room_id=eq.${warRoomId}`,
        },
        (payload) => {
          const hb = payload.new as AgentHeartbeat;
          console.log("[useWarRoom] heartbeat:", hb.agent, hb.status, hb.metadata);
          setHeartbeats((prev) => {
            const existing = prev.findIndex((h) => h.agent === hb.agent);
            if (existing >= 0) {
              const updated = [...prev];
              updated[existing] = hb;
              return updated;
            }
            return [...prev, hb];
          });
        }
      )
      // Subscribe to war room status changes
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "war_rooms",
          filter: `id=eq.${warRoomId}`,
        },
        (payload) => {
          const updated = payload.new as { status: WarRoomStatus; suggested_prompts?: string[] };
          console.log("[useWarRoom] war room status changed:", updated.status);
          setWarRoom((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              status: updated.status,
              suggested_prompts: updated.suggested_prompts ?? prev.suggested_prompts,
            };
          });
          // On terminal status, refresh to get full final state
          if (TERMINAL_STATUSES.includes(updated.status)) {
            refresh();
          }
        }
      )
      .subscribe((status, err) => {
        console.log("[useWarRoom] subscription status:", status, warRoomId);
        if (err) console.error("[useWarRoom] subscription error:", err);
      });

    channelRef.current = channel;

    return () => {
      console.log("[useWarRoom] unsubscribing from", warRoomId);
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [warRoomId, isComplete, processEvent, refresh]);

  return {
    warRoom,
    tasks,
    events,
    heartbeats,
    suggestedPrompts,
    isComplete,
    isLoading,
    error,
    refresh,
  };
}
