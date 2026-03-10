"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useAppAuth } from "@/lib/privy-provider";

export function LoginPageClient({ redirectTo }: { redirectTo: string }) {
  const router = useRouter();
  const { login, authenticated, ready, isDevBypass } = useAppAuth();

  useEffect(() => {
    if (ready && authenticated) {
      router.replace(redirectTo);
    }
  }, [ready, authenticated, redirectTo, router]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (authenticated || isDevBypass) {
    return null;
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="mx-auto max-w-sm space-y-8 text-center">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">
            Buu AI Game Maker
          </h1>
          <p className="text-muted-foreground">
            Build Phaser and Three.js games with AI agents
          </p>
        </div>
        <Button size="lg" className="w-full" onClick={login}>
          Sign In
        </Button>
        <p className="text-muted-foreground text-xs">
          Sign in with email, Google, GitHub, or connect a wallet
        </p>
      </div>
    </div>
  );
}
