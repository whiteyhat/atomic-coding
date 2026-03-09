"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, User, Wallet } from "lucide-react";
import { useAppAuth } from "@/lib/privy-provider";

export function UserMenu() {
  const { user, logout, ready, authenticated, isDevBypass } = useAppAuth();

  if (!ready || !authenticated || !user) {
    return null;
  }

  const email = user.email?.address;
  const walletAddress = user.wallet?.address;
  const displayName =
    email ?? (walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : "User");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          <User className="size-4" />
          <span className="max-w-[120px] truncate text-sm">{displayName}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {email && (
          <DropdownMenuItem disabled className="text-xs text-muted-foreground">
            {email}
          </DropdownMenuItem>
        )}
        {walletAddress && (
          <DropdownMenuItem disabled className="text-xs text-muted-foreground gap-2">
            <Wallet className="size-3" />
            {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
          </DropdownMenuItem>
        )}
        {isDevBypass && (
          <DropdownMenuItem disabled className="text-xs text-muted-foreground">
            Local dev auth bypass
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        {!isDevBypass && (
          <DropdownMenuItem onClick={logout} className="text-destructive">
            <LogOut className="size-4 mr-2" />
            Sign Out
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
