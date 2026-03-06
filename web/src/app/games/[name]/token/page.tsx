import { getGame, getTokenLaunch } from "@/lib/api";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Coins } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

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

  const launch = await getTokenLaunch(decodedName);

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center gap-3 h-12 px-4 border-b">
        <Link href={`/games/${encodeURIComponent(game.name)}`}>
          <Button variant="ghost" size="icon" className="size-8">
            <ArrowLeft className="size-4" />
          </Button>
        </Link>
        <Coins className="size-4" />
        <span className="text-sm font-medium">{game.name} — Token</span>
      </header>

      <main className="max-w-lg mx-auto p-6 space-y-6">
        {launch ? (
          <>
            <div className="space-y-1">
              <h1 className="text-xl font-semibold">{launch.token_name}</h1>
              <p className="text-sm text-muted-foreground">${launch.token_symbol}</p>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Status</p>
                <Badge variant={launch.status === "launched" ? "default" : "secondary"}>
                  {launch.status}
                </Badge>
              </div>
              <div>
                <p className="text-muted-foreground">Chain</p>
                <p>{launch.chain_id ?? "Not selected"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Total Supply</p>
                <p>{launch.total_supply?.toLocaleString() ?? "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Leaderboard Allocation</p>
                <p>{launch.leaderboard_allocation_pct}%</p>
              </div>
            </div>

            {launch.contract_address && (
              <div className="text-sm">
                <p className="text-muted-foreground">Contract Address</p>
                <p className="font-mono text-xs break-all">{launch.contract_address}</p>
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              Blockchain deployment and token distribution are coming soon. Your configuration is saved as a draft.
            </p>
          </>
        ) : (
          <div className="text-center py-12 space-y-3">
            <Coins className="size-8 mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No token configured for this game yet.
            </p>
            <p className="text-xs text-muted-foreground">
              Use the &quot;Launch Token&quot; button in the game workspace to set one up.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
