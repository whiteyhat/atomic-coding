"use client";

import Link from "next/link";
import { ArrowLeft, Coins, ExternalLink, Loader2, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { TokenStatusBadge } from "@/components/token/token-status-badge";
import { BondProgressBar } from "@/components/token/bond-progress-bar";
import { TokenMetrics } from "@/components/token/token-metrics";
import { HoldersTable } from "@/components/token/holders-table";
import { TransactionHistory } from "@/components/token/transaction-history";
import { CurveChart } from "@/components/token/curve-chart";
import { useCurveData, useHolders, useTransactions } from "@/lib/hooks";

interface TokenDashboardClientProps {
  gameName: string;
  gameId: string;
  isPublished: boolean;
}

export function TokenDashboardClient({
  gameName,
  gameId,
  isPublished,
}: TokenDashboardClientProps) {
  const { data: curveData, isLoading, error } = useCurveData(gameName);
  const launch = curveData?.launch ?? null;
  const state = curveData?.state ?? null;

  const { data: holders } = useHolders(
    launch && (launch.status === "live" || launch.status === "graduating" || launch.status === "graduated")
      ? gameName
      : null,
    20
  );

  const { data: transactions } = useTransactions(
    launch && (launch.status === "live" || launch.status === "graduating" || launch.status === "graduated")
      ? gameName
      : null,
    50
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="flex items-center gap-3 h-12 px-4 border-b border-white/5">
        <Link href={`/games/${encodeURIComponent(gameName)}`}>
          <Button variant="ghost" size="icon" className="size-8">
            <ArrowLeft className="size-4" />
          </Button>
        </Link>
        <Coins className="size-4" />
        <span className="text-sm font-medium">{gameName} — Token</span>
      </header>

      <main className="max-w-5xl mx-auto p-6">
        {/* Loading state */}
        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Error state — no launch found */}
        {!isLoading && (error || !launch) && (
          <NoLaunchState gameName={gameName} isPublished={isPublished} />
        )}

        {/* Draft or configuring — incomplete setup */}
        {!isLoading && launch && (launch.status === "draft" || launch.status === "configuring") && (
          <Card className="border-white/5 bg-white/[0.02] max-w-lg mx-auto">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <TokenStatusBadge status={launch.status} />
                {launch.token_name} (${launch.token_symbol})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Your token setup is incomplete. Continue the wizard to configure
                the bonding curve and deploy.
              </p>
              <Link href={`/games/${encodeURIComponent(gameName)}/token/create`}>
                <Button className="gap-2">
                  <Rocket className="size-4" />
                  Continue Setup
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Deploying state */}
        {!isLoading && launch && launch.status === "deploying" && (
          <Card className="border-white/5 bg-white/[0.02] max-w-lg mx-auto">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <TokenStatusBadge status={launch.status} />
                {launch.token_name} (${launch.token_symbol})
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-4 py-8">
              <Loader2 className="size-8 animate-spin text-yellow-400" />
              <p className="text-sm text-muted-foreground text-center">
                Your token is being deployed on-chain. This may take a few minutes.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Live / Graduating — full dashboard */}
        {!isLoading && launch && (launch.status === "live" || launch.status === "graduating") && (
          <LiveDashboard
            launch={launch}
            state={state}
            holders={holders ?? []}
            transactions={transactions ?? []}
          />
        )}

        {/* Graduated — full dashboard + graduation info */}
        {!isLoading && launch && launch.status === "graduated" && (
          <div className="space-y-6">
            <LiveDashboard
              launch={launch}
              state={state}
              holders={holders ?? []}
              transactions={transactions ?? []}
            />
            {launch.graduated_pool && (
              <Card className="border-emerald-500/20 bg-emerald-500/5">
                <CardContent className="flex items-center justify-between py-4">
                  <div>
                    <p className="text-sm font-medium text-emerald-400">
                      Token has graduated to DEX
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Graduated on {launch.graduated_at ? new Date(launch.graduated_at).toLocaleDateString() : "N/A"}
                    </p>
                  </div>
                  <a
                    href={`https://solscan.io/account/${launch.graduated_pool}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button variant="outline" size="sm" className="gap-1">
                      View on DEX
                      <ExternalLink className="size-3" />
                    </Button>
                  </a>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Failed state */}
        {!isLoading && launch && launch.status === "failed" && (
          <Card className="border-red-500/20 bg-red-500/5 max-w-lg mx-auto">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <TokenStatusBadge status={launch.status} />
                {launch.token_name} (${launch.token_symbol})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Token deployment failed. You can try creating a new token launch.
              </p>
              <Link href={`/games/${encodeURIComponent(gameName)}/token/create`}>
                <Button variant="outline" className="gap-2">
                  <Rocket className="size-4" />
                  Try Again
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function NoLaunchState({
  gameName,
  isPublished,
}: {
  gameName: string;
  isPublished: boolean;
}) {
  if (!isPublished) {
    return (
      <div className="text-center py-20 space-y-3">
        <Coins className="size-10 mx-auto text-muted-foreground" />
        <h2 className="text-lg font-semibold">Publish Your Game First</h2>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Your game must be published before you can launch a token. Go back to
          the workspace and use the Publish button in the header.
        </p>
        <Link href={`/games/${encodeURIComponent(gameName)}`}>
          <Button variant="outline" className="mt-2">
            Back to Workspace
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="text-center py-20 space-y-3">
      <Coins className="size-10 mx-auto text-muted-foreground" />
      <h2 className="text-lg font-semibold">Launch a Token</h2>
      <p className="text-sm text-muted-foreground max-w-md mx-auto">
        Create a bonding curve token for your game. Players can buy and sell
        tokens that reflect the value and popularity of your game.
      </p>
      <Link href={`/games/${encodeURIComponent(gameName)}/token/create`}>
        <Button className="mt-2 gap-2">
          <Rocket className="size-4" />
          Launch Token
        </Button>
      </Link>
    </div>
  );
}

function LiveDashboard({
  launch,
  state,
  holders,
  transactions,
}: {
  launch: NonNullable<ReturnType<typeof useCurveData>["data"]>["launch"];
  state: NonNullable<ReturnType<typeof useCurveData>["data"]>["state"];
  holders: Awaited<ReturnType<typeof useHolders>["data"]> extends infer T ? NonNullable<T> : never;
  transactions: Awaited<ReturnType<typeof useTransactions>["data"]> extends infer T ? NonNullable<T> : never;
}) {
  return (
    <div className="space-y-6">
      {/* Top section: status + name + progress */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <TokenStatusBadge status={launch.status} />
            <h1 className="text-xl font-semibold">{launch.token_name}</h1>
            <span className="text-sm text-muted-foreground">${launch.token_symbol}</span>
          </div>
          {launch.token_description && (
            <p className="text-sm text-muted-foreground max-w-md">
              {launch.token_description}
            </p>
          )}
        </div>
      </div>

      {/* Bonding progress */}
      {state && (
        <BondProgressBar
          bondingPct={state.bonding_pct}
          currentMcap={state.current_mcap}
          migrationMcap={launch.migration_mcap ?? undefined}
        />
      )}

      {/* Chart + Metrics */}
      <div className="space-y-4">
        {launch.pool_address && (
          <CurveChart poolAddress={launch.pool_address} />
        )}
        {state && <TokenMetrics state={state} launch={launch} />}
      </div>

      {/* Tabs: Holders / Transactions */}
      <Tabs defaultValue="holders" className="w-full">
        <TabsList className="bg-white/[0.02] border border-white/5">
          <TabsTrigger value="holders">Holders</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
        </TabsList>
        <TabsContent value="holders" className="mt-4">
          <HoldersTable
            holders={holders}
            creatorWallet={launch.creator_wallet}
          />
        </TabsContent>
        <TabsContent value="transactions" className="mt-4">
          <TransactionHistory transactions={transactions} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
