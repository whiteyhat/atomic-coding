"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "./supabase";
import type {
  AgentHeartbeat,
  WarRoomEvent,
  WarRoomStatus,
  WarRoomWithFeed,
} from "./types";
import { getWarRoom as fetchWarRoom } from "./api";
import {
  applyWarRoomEvent,
  hydrateWarRoomFeed,
  type WarRoomTaskState,
  upsertHeartbeatState,
} from "./war-room-state";

interface UseWarRoomReturn {
  warRoom: WarRoomWithFeed | null;
  tasks: WarRoomTaskState[];
  events: WarRoomEvent[];
  heartbeats: AgentHeartbeat[];
  suggestedPrompts: string[];
  isComplete: boolean;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const TERMINAL_STATUSES: WarRoomStatus[] = ["completed", "failed", "cancelled"];

export function useWarRoom(
  gameName: string | null,
  warRoomId: string | null
): UseWarRoomReturn {
  const [warRoom, setWarRoom] = useState<WarRoomWithFeed | null>(null);
  const [tasks, setTasks] = useState<WarRoomTaskState[]>([]);
  const [events, setEvents] = useState<WarRoomEvent[]>([]);
  const [heartbeats, setHeartbeats] = useState<AgentHeartbeat[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const channelRef = useRef<RealtimeChannel | null>(null);

  const isComplete =
    warRoom != null && TERMINAL_STATUSES.includes(warRoom.status);

  const suggestedPrompts = warRoom?.suggested_prompts ?? [];

  const refresh = useCallback(async () => {
    if (!gameName || !warRoomId) return;

    setIsLoading(true);
    setError(null);

    try {
      const room = await fetchWarRoom(gameName, warRoomId);
      const hydrated = hydrateWarRoomFeed(room);
      setWarRoom({
        ...room,
        tasks: Array.isArray(room.tasks) ? room.tasks : [],
        events: hydrated.events,
        heartbeats: hydrated.heartbeats,
      });
      setTasks(hydrated.tasks);
      setEvents(hydrated.events);
      setHeartbeats(hydrated.heartbeats);
    } catch (err) {
      console.error("[useWarRoom] fetch error:", err);
      setError(err instanceof Error ? err.message : "Failed to load war room");
    } finally {
      setIsLoading(false);
    }
  }, [gameName, warRoomId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const processEvent = useCallback((event: WarRoomEvent) => {
    setEvents((prev) => [...prev, event]);
    setTasks((prev) => applyWarRoomEvent(prev, event));

    if (event.event_type === "war_room_cancelled") {
      setWarRoom((prev) => (prev ? { ...prev, status: "cancelled" } : prev));
      return;
    }
    if (event.event_type === "war_room_completed") {
      setWarRoom((prev) => (prev ? { ...prev, status: "completed" } : prev));
      return;
    }
    if (event.event_type === "war_room_failed") {
      setWarRoom((prev) => (prev ? { ...prev, status: "failed" } : prev));
    }
  }, []);

  // Stable ref for refresh so the realtime effect doesn't re-run when refresh identity changes
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  useEffect(() => {
    if (!warRoomId || isComplete) return;

    const supabase = getSupabaseBrowserClient();
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;
    let reconnecting = false;
    let subscribeAttempt = 0;

    function subscribe() {
      if (cancelled) return;

      // Unique channel name per attempt to avoid Supabase binding collisions
      subscribeAttempt++;
      const channelName = `war-room:${warRoomId}:${subscribeAttempt}`;

      const channel = supabase
        .channel(channelName)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "war_room_events",
            filter: `war_room_id=eq.${warRoomId}`,
          },
          (payload) => {
            processEvent(payload.new as WarRoomEvent);
          }
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "agent_heartbeats",
            filter: `war_room_id=eq.${warRoomId}`,
          },
          (payload) => {
            const heartbeat = payload.new as AgentHeartbeat;
            setHeartbeats((prev) => upsertHeartbeatState(prev, heartbeat));
          }
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "war_rooms",
            filter: `id=eq.${warRoomId}`,
          },
          (payload) => {
            const updated = payload.new as {
              status: WarRoomStatus;
              suggested_prompts?: string[];
            };

            setWarRoom((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                status: updated.status,
                suggested_prompts:
                  updated.suggested_prompts ?? prev.suggested_prompts,
              };
            });

            if (TERMINAL_STATUSES.includes(updated.status)) {
              refreshRef.current();
            }
          }
        )
        .subscribe((status, subscribeError) => {
          if (subscribeError) {
            console.error("[useWarRoom] subscription error:", subscribeError);
          }
          console.log("[useWarRoom] subscription status:", status, warRoomId);

          // Reconnect on CLOSED or TIMED_OUT — guarded to prevent re-entrance
          // (removeChannel can synchronously fire this callback with CLOSED,
          // which would cause infinite recursion without the guard)
          if (
            !cancelled &&
            !reconnecting &&
            (status === "TIMED_OUT" || status === "CLOSED")
          ) {
            reconnecting = true;
            console.warn("[useWarRoom] reconnecting after", status);
            // Defer removal to break out of synchronous callback stack
            retryTimer = setTimeout(() => {
              supabase.removeChannel(channel);
              reconnecting = false;
              subscribe();
            }, 2000);
          }
        });

      channelRef.current = channel;
    }

    subscribe();

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [isComplete, processEvent, warRoomId]);

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
