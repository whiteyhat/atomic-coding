"use client";

import { useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { TokenHolder } from "@/lib/types";

interface HoldersTableProps {
  holders: TokenHolder[];
  creatorWallet?: string | null;
  className?: string;
}

function truncateAddress(address: string): string {
  if (address.length <= 8) return address;
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

function formatBalance(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(2)}K`;
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function CopyableAddress({ address }: { address: string }) {
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(address);
  }, [address]);

  return (
    <button
      onClick={handleCopy}
      className="group inline-flex items-center gap-1 font-mono text-xs text-blue-400 hover:text-blue-300 transition-colors"
      title={address}
    >
      <a
        href={`https://solscan.io/account/${address}`}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="hover:underline"
      >
        {truncateAddress(address)}
      </a>
      <svg
        className="size-3 opacity-0 group-hover:opacity-60 transition-opacity"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
      </svg>
    </button>
  );
}

export function HoldersTable({
  holders,
  creatorWallet,
  className,
}: HoldersTableProps) {
  if (holders.length === 0) {
    return (
      <div className={cn("rounded-lg border border-white/5 bg-white/[0.02] p-6 text-center text-sm text-muted-foreground", className)}>
        No holder data available yet.
      </div>
    );
  }

  return (
    <div className={cn("overflow-x-auto rounded-lg border border-white/5 bg-white/[0.02]", className)}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/5 text-xs text-muted-foreground">
            <th className="whitespace-nowrap px-3 py-2 text-left font-medium">#</th>
            <th className="whitespace-nowrap px-3 py-2 text-left font-medium">Address</th>
            <th className="whitespace-nowrap px-3 py-2 text-right font-medium">Balance</th>
            <th className="whitespace-nowrap px-3 py-2 text-right font-medium">%</th>
            <th className="whitespace-nowrap px-3 py-2 text-left font-medium">Tags</th>
          </tr>
        </thead>
        <tbody>
          {holders.map((holder, index) => {
            const isCreator =
              holder.is_creator ||
              (creatorWallet != null &&
                holder.wallet_address === creatorWallet);

            return (
              <tr
                key={holder.wallet_address}
                className="border-b border-white/[0.03] last:border-0 hover:bg-white/[0.02] transition-colors"
              >
                <td className="whitespace-nowrap px-3 py-2 tabular-nums text-muted-foreground">
                  {index + 1}
                </td>
                <td className="whitespace-nowrap px-3 py-2">
                  <CopyableAddress address={holder.wallet_address} />
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                  {formatBalance(holder.balance)}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                  {holder.percentage.toFixed(2)}%
                </td>
                <td className="whitespace-nowrap px-3 py-2">
                  <div className="flex gap-1">
                    {isCreator && (
                      <Badge
                        variant="outline"
                        className="bg-amber-500/15 text-amber-400 border-amber-500/25 text-[10px] px-1.5 py-0"
                      >
                        Creator
                      </Badge>
                    )}
                    {holder.is_contract && (
                      <Badge
                        variant="outline"
                        className="bg-purple-500/15 text-purple-400 border-purple-500/25 text-[10px] px-1.5 py-0"
                      >
                        Pool
                      </Badge>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
