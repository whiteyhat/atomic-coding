import { setRequestLocale } from "next-intl/server";
import { getGame } from "@/lib/api";
import { notFound } from "next/navigation";
import { GameWorkspace } from "@/components/workspace/game-workspace";

interface GamePageProps {
  params: Promise<{ locale: string; name: string }>;
}

export const revalidate = 60;

export default async function GamePage({ params }: GamePageProps) {
  const { locale, name } = await params;
  setRequestLocale(locale);
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
