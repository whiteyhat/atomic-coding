import { getGame } from "@/lib/api";
import { notFound } from "next/navigation";
import { TokenCreateClient } from "./token-create-client";

interface TokenCreatePageProps {
  params: Promise<{ name: string }>;
}

export const dynamic = "force-dynamic";

export default async function TokenCreatePage({ params }: TokenCreatePageProps) {
  const { name } = await params;
  const decodedName = decodeURIComponent(name);

  let game;
  try {
    game = await getGame(decodedName);
  } catch {
    notFound();
  }

  if (!game.is_published) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-3 max-w-md px-6">
          <h1 className="text-lg font-semibold">Publish Your Game First</h1>
          <p className="text-sm text-muted-foreground">
            Your game must be published before you can launch a token. Go back to
            the workspace and publish it from the header bar.
          </p>
          <a
            href={`/games/${encodeURIComponent(game.name)}`}
            className="inline-block text-sm text-blue-400 hover:underline mt-2"
          >
            Back to workspace
          </a>
        </div>
      </div>
    );
  }

  return <TokenCreateClient gameName={game.name} gameId={game.id} />;
}
