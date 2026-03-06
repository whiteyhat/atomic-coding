import { getPublishedGame } from "@/lib/api";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/constants";
import { notFound } from "next/navigation";
import { Trophy } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface PlayPageProps {
  params: Promise<{ slug: string }>;
}

export default async function PlayPage({ params }: PlayPageProps) {
  const { slug } = await params;

  let game;
  try {
    game = await getPublishedGame(slug);
  } catch {
    notFound();
  }

  if (!game) notFound();

  const iframeSrc = `/game-player.html?game=${encodeURIComponent(game.name)}&supabaseUrl=${encodeURIComponent(SUPABASE_URL)}&supabaseKey=${encodeURIComponent(SUPABASE_ANON_KEY)}`;

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Minimal header */}
      <header className="flex items-center justify-between h-10 px-4 bg-background/80 backdrop-blur border-b shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold">Buu</span>
          <span className="text-sm text-muted-foreground">/</span>
          <span className="text-sm font-medium">{game.name}</span>
          {game.genre && (
            <span className="text-xs text-muted-foreground">
              ({game.genre.replace(/-/g, " ")})
            </span>
          )}
        </div>
        <Link href={`/games/${encodeURIComponent(game.name)}/board`}>
          <Button variant="ghost" size="sm" className="h-7 text-xs">
            <Trophy className="size-3 mr-1" />
            Leaderboard
          </Button>
        </Link>
      </header>

      {/* Full-screen game */}
      <main className="flex-1 min-h-0">
        <iframe
          src={iframeSrc}
          className="w-full h-full border-0"
          title={`Play: ${game.name}`}
          allow="autoplay; fullscreen"
        />
      </main>
    </div>
  );
}
