import { getGame } from "@/lib/api";
import { notFound } from "next/navigation";
import { GameWorkspace } from "@/components/workspace/game-workspace";

interface GamePageProps {
  params: Promise<{ name: string }>;
}

export const revalidate = 60;

export default async function GamePage({ params }: GamePageProps) {
  const { name } = await params;
  const decodedName = decodeURIComponent(name);

  let game;
  try {
    game = await getGame(decodedName);
  } catch {
    notFound();
  }

  return (
    <GameWorkspace
      gameId={game.id}
      gameName={game.name}
      genre={game.genre}
      gameFormat={game.game_format}
      description={game.description}
      isPublished={game.is_published}
      publicSlug={game.public_slug}
    />
  );
}
