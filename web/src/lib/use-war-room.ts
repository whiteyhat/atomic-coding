"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { API_BASE } from "./constants";
import type {
  WarRoomWithTasks,
  WarRoomTask,
  WarRoomEvent,
  AgentHeartbeat,
  WarRoomStatus,
} from "./types";
import { getWarRoom as fetchWarRoom } from "./api";

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
 * Hook that connects to a war room's SSE event stream and maintains
 * live state for tasks, events, and agent heartbeats.
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

  const eventSourceRef = useRef<EventSource | null>(null);

  const isComplete =
    warRoom != null && TERMINAL_STATUSES.includes(warRoom.status);

  const suggestedPrompts = warRoom?.suggested_prompts ?? [];

  // Fetch initial war room state
  const refresh = useCallback(async () => {
    if (!gameName || !warRoomId) return;
    setIsLoading(true);
    setError(null);
    try {
      const room = await fetchWarRoom(gameName, warRoomId);
      setWarRoom(room);
      setTasks(room.tasks);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load war room");
    } finally {
      setIsLoading(false);
    }
  }, [gameName, warRoomId]);

  // Initial load
  useEffect(() => {
    refresh();
  }, [refresh]);

  // SSE connection
  useEffect(() => {
    if (!gameName || !warRoomId || isComplete) return;

    const url = `${API_BASE}/games/${encodeURIComponent(gameName)}/warrooms/${warRoomId}/events`;
    const es = new EventSource(url);
    eventSourceRef.current = es;

    // Handle typed events
    const handleTaskEvent = (e: MessageEvent) => {
      try {
        const evt: WarRoomEvent = JSON.parse(e.data);
        setEvents((prev) => [...prev, evt]);

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
              if (evt.event_type === "task_failed") updates.status = "failed";
              if (evt.event_type === "task_assigned") updates.status = "assigned";
              return { ...t, ...updates };
            })
          );
        }
      } catch {
        // Ignore parse errors
      }
    };

    // Listen for specific event types
    for (const type of [
      "task_assigned",
      "task_running",
      "task_completed",
      "task_failed",
      "war_room_created",
      "war_room_running",
      "war_room_completed",
      "war_room_failed",
      "retry_cycle",
      "pipeline_error",
      "pipeline_stuck",
    ]) {
      es.addEventListener(type, handleTaskEvent);
    }

    // Handle heartbeat events
    es.addEventListener("heartbeats", (e: MessageEvent) => {
      try {
        const hbs: AgentHeartbeat[] = JSON.parse(e.data);
        setHeartbeats(hbs);
      } catch {
        // Ignore
      }
    });

    // Handle completion
    es.addEventListener("done", (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        setWarRoom((prev) =>
          prev ? { ...prev, status: data.status } : prev
        );
      } catch {
        // Ignore
      }
      es.close();
      // Refresh to get final state
      refresh();
    });

    es.onerror = () => {
      // EventSource reconnects automatically
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [gameName, warRoomId, isComplete, refresh]);

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
