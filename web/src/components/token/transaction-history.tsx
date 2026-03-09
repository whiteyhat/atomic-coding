"use client";

import { cn } from "@/lib/utils";
import type { TokenTransaction } from "@/lib/types";

interface TransactionHistoryProps {
  transactions: TokenTransaction[];
  className?: string;
}

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;

  if (diffMs < 0) return "just now";

  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return `${seconds}s ago`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function truncateAddress(address: string): string {
  if (address.length <= 8) return address;
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

function truncateSig(sig: string): string {
  if (sig.length <= 12) return sig;
  return `${sig.slice(0, 6)}...${sig.slice(-6)}`;
}

function formatAmount(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(2)}K`;
  if (value >= 1) return value.toFixed(4);
  return value.toFixed(6);
}

export function TransactionHistory({
  transactions,
  className,
}: TransactionHistoryProps) {
  if (transactions.length === 0) {
    return (
      <div
        className={cn(
          "rounded-lg border border-white/5 bg-white/[0.02] p-6 text-center text-sm text-muted-foreground",
          className
        )}
      >
        No transactions yet.
      </div>
    );
  }

  return (
    <div
      className={cn(
        "overflow-x-auto rounded-lg border border-white/5 bg-white/[0.02]",
        className
      )}
    >
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/5 text-xs text-muted-foreground">
            <th className="whitespace-nowrap px-3 py-2 text-left font-medium">
              Type
            </th>
            <th className="whitespace-nowrap px-3 py-2 text-right font-medium">
              Amount In
            </th>
            <th className="whitespace-nowrap px-3 py-2 text-right font-medium">
              Amount Out
            </th>
            <th className="whitespace-nowrap px-3 py-2 text-left font-medium">
              Wallet
            </th>
            <th className="whitespace-nowrap px-3 py-2 text-left font-medium">
              Tx
            </th>
            <th className="whitespace-nowrap px-3 py-2 text-right font-medium">
              Time
            </th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((tx) => {
            const isBuy = tx.tx_type === "buy";

            return (
              <tr
                key={tx.tx_signature}
                className="border-b border-white/[0.03] last:border-0 hover:bg-white/[0.02] transition-colors"
              >
                <td className="whitespace-nowrap px-3 py-2">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-semibold",
                      isBuy
                        ? "bg-green-500/15 text-green-400"
                        : "bg-red-500/15 text-red-400"
                    )}
                  >
                    {isBuy ? "Buy" : "Sell"}
                  </span>
                </td>
                <td
                  className={cn(
                    "whitespace-nowrap px-3 py-2 text-right tabular-nums",
                    isBuy ? "text-green-400" : "text-red-400"
                  )}
                >
                  {formatAmount(tx.amount_in)}
                </td>
                <td
                  className={cn(
                    "whitespace-nowrap px-3 py-2 text-right tabular-nums",
                    isBuy ? "text-green-400" : "text-red-400"
                  )}
                >
                  {formatAmount(tx.amount_out)}
                </td>
                <td className="whitespace-nowrap px-3 py-2">
                  <a
                    href={`https://solscan.io/account/${tx.wallet_address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-xs text-blue-400 hover:text-blue-300 hover:underline transition-colors"
                  >
                    {truncateAddress(tx.wallet_address)}
                  </a>
                </td>
                <td className="whitespace-nowrap px-3 py-2">
                  <a
                    href={`https://solscan.io/tx/${tx.tx_signature}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-xs text-muted-foreground hover:text-foreground hover:underline transition-colors"
                  >
                    {truncateSig(tx.tx_signature)}
                  </a>
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right text-xs text-muted-foreground tabular-nums">
                  {formatRelativeTime(tx.block_time)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
