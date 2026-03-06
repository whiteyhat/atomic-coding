"use client";

import { useEffect, useRef, useCallback } from "react";
import { submitScore } from "@/lib/api";
import { usePrivy } from "@privy-io/react-auth";

interface ScoreListenerProps {
  gameName: string;
}

/**
 * Listens for postMessage SCORE_UPDATE events from the game iframe,
 * debounces them, and submits to the API.
 */
export function ScoreListener({ gameName }: ScoreListenerProps) {
  const { user } = usePrivy();
  const lastSubmitRef = useRef(0);
  const pendingScoreRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(() => {
    const score = pendingScoreRef.current;
    if (score === null) return;

    pendingScoreRef.current = null;
    lastSubmitRef.current = Date.now();

    submitScore(gameName, score, user?.id).catch((err) => {
      console.warn("[score-listener] Failed to submit score:", err);
    });
  }, [gameName, user?.id]);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      const data = event.data;
      if (!data || data.type !== "SCORE_UPDATE" || typeof data.score !== "number") {
        return;
      }

      pendingScoreRef.current = data.score;

      // Debounce: submit at most once per second
      if (timerRef.current) clearTimeout(timerRef.current);

      const elapsed = Date.now() - lastSubmitRef.current;
      const delay = Math.max(0, 1000 - elapsed);

      timerRef.current = setTimeout(flush, delay);
    }

    window.addEventListener("message", handleMessage);
    return () => {
      window.removeEventListener("message", handleMessage);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [flush]);

  // This component renders nothing — it's purely a side-effect listener
  return null;
}
