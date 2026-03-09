"use client";

import { useEffect, useRef, useCallback } from "react";
import { submitScore } from "@/lib/api";
import { useAppAuth } from "@/lib/privy-provider";

interface ScoreListenerProps {
  gameName: string;
  requireAuth?: boolean;
}

/**
 * Listens for postMessage SCORE_UPDATE events from the game iframe,
 * debounces them, and submits to the API.
 */
export function ScoreListener({
  gameName,
  requireAuth = true,
}: ScoreListenerProps) {
  const { user, authenticated, ready, isDevBypass } = useAppAuth();
  const lastSubmitRef = useRef(0);
  const pendingScoreRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(() => {
    const score = pendingScoreRef.current;
    if (score === null) return;

    if (requireAuth && !isDevBypass && (!ready || !authenticated || !user?.id)) {
      pendingScoreRef.current = null;
      return;
    }

    pendingScoreRef.current = null;
    lastSubmitRef.current = Date.now();

    submitScore(gameName, score).catch((err) => {
      console.warn("[score-listener] Failed to submit score:", err);
    });
  }, [authenticated, gameName, ready, requireAuth, user?.id]);

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
