"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Coins, Loader2 } from "lucide-react";
import { upsertTokenLaunch } from "@/lib/api";
import type { TokenLaunch } from "@/lib/types";

interface LaunchTokenDialogProps {
  gameName: string;
  creatorId: string;
  existingLaunch: TokenLaunch | null;
  onSaved?: () => void;
}

export function LaunchTokenDialog({
  gameName,
  creatorId,
  existingLaunch,
  onSaved,
}: LaunchTokenDialogProps) {
  const [open, setOpen] = useState(false);
  const [tokenName, setTokenName] = useState(existingLaunch?.token_name ?? "");
  const [tokenSymbol, setTokenSymbol] = useState(existingLaunch?.token_symbol ?? "");
  const [totalSupply, setTotalSupply] = useState(
    existingLaunch?.total_supply?.toString() ?? "1000000000"
  );
  const [allocationPct, setAllocationPct] = useState(
    existingLaunch?.leaderboard_allocation_pct?.toString() ?? "2"
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!tokenName.trim() || !tokenSymbol.trim()) return;
    setLoading(true);
    setError(null);

    try {
      await upsertTokenLaunch(gameName, creatorId, tokenName.trim(), tokenSymbol.trim(), {
        total_supply: parseInt(totalSupply, 10) || undefined,
        leaderboard_allocation_pct: parseInt(allocationPct, 10) || 2,
      });
      onSaved?.();
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save token config");
    } finally {
      setLoading(false);
    }
  }

  const statusLabel = existingLaunch?.status ?? "not configured";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Coins className="size-3.5 mr-1.5" />
          {existingLaunch ? "Token" : "Launch Token"}
          {existingLaunch && (
            <Badge variant="secondary" className="ml-1.5 text-[10px]">
              {statusLabel}
            </Badge>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {existingLaunch ? "Token Configuration" : "Launch a Token"}
          </DialogTitle>
          <DialogDescription>
            {existingLaunch
              ? "Update your game token settings. Blockchain deployment coming soon."
              : "Configure a token for your game. This saves a draft — blockchain deployment is coming soon."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="token-name">Token Name</Label>
              <Input
                id="token-name"
                value={tokenName}
                onChange={(e) => setTokenName(e.target.value)}
                placeholder="My Game Token"
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="token-symbol">Symbol</Label>
              <Input
                id="token-symbol"
                value={tokenSymbol}
                onChange={(e) => setTokenSymbol(e.target.value.toUpperCase())}
                placeholder="MGT"
                maxLength={10}
                disabled={loading}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="total-supply">Total Supply</Label>
              <Input
                id="total-supply"
                type="number"
                value={totalSupply}
                onChange={(e) => setTotalSupply(e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="alloc-pct">Leaderboard Allocation %</Label>
              <Input
                id="alloc-pct"
                type="number"
                min={1}
                max={50}
                value={allocationPct}
                onChange={(e) => setAllocationPct(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Top leaderboard players will receive {allocationPct}% of the total supply when the token launches.
          </p>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button
              onClick={handleSave}
              disabled={loading || !tokenName.trim() || !tokenSymbol.trim()}
            >
              {loading && <Loader2 className="size-3.5 mr-1.5 animate-spin" />}
              {existingLaunch ? "Update" : "Save Draft"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
