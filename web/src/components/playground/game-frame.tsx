"use client";

import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/constants";
import { ScoreListener } from "./score-listener";
import { Button } from "@/components/ui/button";
import { useAppAuth } from "@/lib/privy-provider";

interface GameFrameProps {
  gameName: string;
  showScoreLoginPrompt?: boolean;
  onLoad?: () => void;
}

export function GameFrame({
  gameName,
  showScoreLoginPrompt = false,
  onLoad,
}: GameFrameProps) {
  const { authenticated, ready, login, isDevBypass } = useAppAuth();
  const iframeSrc = `/game-player.html?game=${encodeURIComponent(gameName)}&supabaseUrl=${encodeURIComponent(SUPABASE_URL)}&supabaseKey=${encodeURIComponent(SUPABASE_ANON_KEY)}`;

  return (
    <div className="relative h-full w-full bg-black">
      <ScoreListener gameName={gameName} />
      {showScoreLoginPrompt && ready && !authenticated && !isDevBypass ? (
        <div className="absolute left-3 top-3 z-10 flex items-center gap-3 rounded-2xl border border-white/10 bg-[#2a1014]/90 px-4 py-2.5 text-xs text-white/70 backdrop-blur-xl shadow-[0_8px_30px_rgba(0,0,0,0.5)]">
          <span>Sign in to save scores</span>
          <Button
            size="xs"
            className="rounded-lg bg-rose-500 text-white hover:bg-rose-400"
            onClick={login}
          >
            Sign In
          </Button>
        </div>
      ) : null}
      <iframe
        src={iframeSrc}
        className="h-full w-full border-0"
        title={`Game: ${gameName}`}
        allow="autoplay; fullscreen"
        onLoad={onLoad}
      />
    </div>
  );
}
