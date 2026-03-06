import { getGame } from "@/lib/api";
import { notFound } from "next/navigation";
import { GameWorkspace } from "@/components/workspace/game-workspace";

interface GamePageProps {
  params: Promise<{ name: string }>;
}

export const dynamic = "force-dynamic";

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
      isPublished={game.is_published}
      publicSlug={game.public_slug}
    />
  );
}
