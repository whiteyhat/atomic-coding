import { getGame } from "@/lib/api";
import { notFound } from "next/navigation";
import { TokenDashboardClient } from "./token-dashboard-client";

interface TokenPageProps {
  params: Promise<{ name: string }>;
}

export const dynamic = "force-dynamic";

export default async function TokenPage({ params }: TokenPageProps) {
  const { name } = await params;
  const decodedName = decodeURIComponent(name);

  let game;
  try {
    game = await getGame(decodedName);
  } catch {
    notFound();
  }

  return (
    <TokenDashboardClient
      gameName={game.name}
      gameId={game.id}
      isPublished={game.is_published}
    />
  );
}
