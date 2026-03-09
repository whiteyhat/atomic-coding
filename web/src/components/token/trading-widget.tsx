"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useSwapQuote } from "@/lib/hooks/use-swap-quote";
import { useSolanaWallet } from "@/lib/hooks/use-solana-wallet";
import { recordTrade } from "@/lib/api";
import { useAppAuth } from "@/lib/privy-provider";
import { ArrowDownUp, Loader2, Wallet } from "lucide-react";

interface TradingWidgetProps {
  gameName: string;
  tokenSymbol: string;
  tokenPrice?: number;
  disabled?: boolean;
}

export function TradingWidget({
  gameName,
  tokenSymbol,
  tokenPrice,
  disabled,
}: TradingWidgetProps) {
  const [direction, setDirection] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("");
  const [slippage, setSlippage] = useState(1);
  const [txStatus, setTxStatus] = useState<"idle" | "signing" | "confirming" | "success" | "error">("idle");
  const [txError, setTxError] = useState<string | null>(null);
  const [txSignature, setTxSignature] = useState<string | null>(null);

  const { authenticated, login } = useAppAuth();
  const { connected, address, signAndSendTransaction } = useSolanaWallet();
  const parsedAmount = parseFloat(amount) || 0;

  const { data: quote, isLoading: quoteLoading } = useSwapQuote(
    gameName,
    direction,
    parsedAmount,
  );

  const handleSwap = useCallback(async () => {
    if (!connected || !address || parsedAmount <= 0) return;

    setTxStatus("signing");
    setTxError(null);
    setTxSignature(null);

    try {
      // TODO: Build actual swap transaction using DBC SDK
      // For now, show a message that on-chain trading requires SDK integration
      throw new Error(
        "On-chain trading requires the Meteora DBC SDK integration. Coming soon!",
      );

      // const tx = await buildSwapTransaction(gameName, direction, parsedAmount, slippage);
      // setTxStatus("confirming");
      // const sig = await signAndSendTransaction(tx);
      // setTxSignature(sig);
      //
      // await recordTrade(gameName, {
      //   tx_signature: sig,
      //   tx_type: direction,
      //   wallet_address: address,
      //   amount_in: parsedAmount,
      //   amount_out: quote?.amountOut ?? 0,
      //   price_per_token: tokenPrice ?? 0,
      //   block_time: new Date().toISOString(),
      // });
      //
      // setTxStatus("success");
      // setAmount("");
    } catch (err) {
      setTxStatus("error");
      setTxError((err as Error).message);
    }
  }, [connected, address, parsedAmount, direction, gameName, signAndSendTransaction]);

  const isBuy = direction === "buy";

  return (
    <div className="rounded-lg border bg-card p-4 space-y-4">
      {/* Buy / Sell toggle */}
      <div className="flex gap-1 p-1 rounded-md bg-muted">
        <button
          onClick={() => setDirection("buy")}
          className={cn(
            "flex-1 py-1.5 text-sm font-medium rounded transition-colors",
            isBuy
              ? "bg-emerald-600 text-white"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          Buy
        </button>
        <button
          onClick={() => setDirection("sell")}
          className={cn(
            "flex-1 py-1.5 text-sm font-medium rounded transition-colors",
            !isBuy
              ? "bg-red-600 text-white"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          Sell
        </button>
      </div>

      {/* Amount input */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">
          {isBuy ? "You pay (SOL)" : `You sell (${tokenSymbol})`}
        </Label>
        <Input
          type="number"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          min={0}
          step="any"
          disabled={disabled || txStatus === "signing" || txStatus === "confirming"}
        />
      </div>

      {/* Arrow separator */}
      <div className="flex justify-center">
        <ArrowDownUp className="size-4 text-muted-foreground" />
      </div>

      {/* Quote output */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">
          {isBuy ? `You receive (${tokenSymbol})` : "You receive (SOL)"}
        </Label>
        <div className="h-10 flex items-center px-3 rounded-md border bg-muted/50 text-sm">
          {quoteLoading ? (
            <Loader2 className="size-3 animate-spin text-muted-foreground" />
          ) : quote ? (
            <span>{quote.amountOut.toLocaleString(undefined, { maximumFractionDigits: 6 })}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </div>
      </div>

      {/* Slippage */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Slippage:</span>
        {[0.5, 1, 2, 5].map((s) => (
          <button
            key={s}
            onClick={() => setSlippage(s)}
            className={cn(
              "text-xs px-2 py-0.5 rounded",
              slippage === s
                ? "bg-foreground text-background"
                : "bg-muted text-muted-foreground hover:text-foreground",
            )}
          >
            {s}%
          </button>
        ))}
      </div>

      {/* Price info */}
      {tokenPrice != null && tokenPrice > 0 && (
        <p className="text-xs text-muted-foreground">
          1 {tokenSymbol} = ${tokenPrice.toFixed(6)}
        </p>
      )}

      {/* Action button */}
      {!authenticated ? (
        <Button className="w-full" onClick={login}>
          <Wallet className="size-4 mr-2" />
          Connect Wallet
        </Button>
      ) : !connected ? (
        <Button className="w-full" variant="secondary" disabled>
          <Wallet className="size-4 mr-2" />
          No Solana Wallet
        </Button>
      ) : (
        <Button
          className={cn(
            "w-full",
            isBuy
              ? "bg-emerald-600 hover:bg-emerald-700"
              : "bg-red-600 hover:bg-red-700",
          )}
          disabled={
            disabled ||
            parsedAmount <= 0 ||
            txStatus === "signing" ||
            txStatus === "confirming"
          }
          onClick={handleSwap}
        >
          {txStatus === "signing" || txStatus === "confirming" ? (
            <>
              <Loader2 className="size-4 mr-2 animate-spin" />
              {txStatus === "signing" ? "Signing..." : "Confirming..."}
            </>
          ) : (
            `${isBuy ? "Buy" : "Sell"} ${tokenSymbol}`
          )}
        </Button>
      )}

      {/* Status messages */}
      {txStatus === "success" && txSignature && (
        <div className="text-xs text-emerald-500 space-y-1">
          <p>Transaction confirmed!</p>
          <a
            href={`https://solscan.io/tx/${txSignature}`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            View on Solscan
          </a>
        </div>
      )}

      {txStatus === "error" && txError && (
        <p className="text-xs text-red-500">{txError}</p>
      )}
    </div>
  );
}
