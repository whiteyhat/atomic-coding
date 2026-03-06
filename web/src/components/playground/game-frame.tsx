"use client";

import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/constants";
import { ScoreListener } from "./score-listener";

interface GameFrameProps {
  gameName: string;
}

export function GameFrame({ gameName }: GameFrameProps) {
  const iframeSrc = `/game-player.html?game=${encodeURIComponent(gameName)}&supabaseUrl=${encodeURIComponent(SUPABASE_URL)}&supabaseKey=${encodeURIComponent(SUPABASE_ANON_KEY)}`;

  return (
    <div className="h-full w-full bg-black">
      <ScoreListener gameName={gameName} />
      <iframe
        src={iframeSrc}
        className="h-full w-full border-0"
        title={`Game: ${gameName}`}
        allow="autoplay; fullscreen"
      />
    </div>
  );
}
