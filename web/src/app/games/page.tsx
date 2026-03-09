import { listGames } from "@/lib/api";
import { GameCard } from "@/components/games/game-card";
import { GamesHeader } from "@/components/games/games-header";

export const dynamic = "force-dynamic";

export default async function GamesPage() {
  let games: Awaited<ReturnType<typeof listGames>> = [];
  try {
    games = await listGames();
  } catch {
    // keep empty array
  }

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-5xl px-6 py-12">
        <GamesHeader />

        {games.length === 0 ? (
          <div className="mt-24 text-center">
            <p className="text-muted-foreground text-lg">
              No games yet. Create one to get started.
            </p>
          </div>
        ) : (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {games.map((game) => (
              <GameCard key={game.id} game={game} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
