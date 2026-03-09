"use client";

import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/constants";
import { ScoreListener } from "./score-listener";
import { Button } from "@/components/ui/button";
import { useAppAuth } from "@/lib/privy-provider";

interface GameFrameProps {
  gameName: string;
  showScoreLoginPrompt?: boolean;
}

export function GameFrame({
  gameName,
  showScoreLoginPrompt = false,
}: GameFrameProps) {
  const { authenticated, ready, login, isDevBypass } = useAppAuth();
  const iframeSrc = `/game-player.html?game=${encodeURIComponent(gameName)}&supabaseUrl=${encodeURIComponent(SUPABASE_URL)}&supabaseKey=${encodeURIComponent(SUPABASE_ANON_KEY)}`;

  return (
    <div className="relative h-full w-full bg-black">
      <ScoreListener gameName={gameName} />
      {showScoreLoginPrompt && ready && !authenticated && !isDevBypass ? (
        <div className="absolute left-3 top-3 z-10 flex items-center gap-3 rounded-full border border-white/10 bg-black/70 px-3 py-2 text-xs text-white/80 backdrop-blur">
          <span>Sign in to save scores</span>
          <Button size="xs" onClick={login}>
            Sign In
          </Button>
        </div>
      ) : null}
      <iframe
        src={iframeSrc}
        className="h-full w-full border-0"
        title={`Game: ${gameName}`}
        allow="autoplay; fullscreen"
      />
    </div>
  );
}
