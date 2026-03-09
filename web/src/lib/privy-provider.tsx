"use client";

import { useEffect } from "react";
import { PrivyProvider as BasePrivyProvider, usePrivy } from "@privy-io/react-auth";
import { registerAuthTokenGetter } from "./api";
import { ensureUserProfile } from "./user-profile";

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "";

function AuthTokenRegistrar({ children }: { children: React.ReactNode }) {
  const { getAccessToken, authenticated, user } = usePrivy();

  useEffect(() => {
    registerAuthTokenGetter(getAccessToken);
  }, [getAccessToken]);

  useEffect(() => {
    if (!authenticated || !user?.id) return;

    const email = user.email?.address;
    const walletAddress = user.wallet?.address;
    const displayName =
      email ??
      (walletAddress
        ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
        : undefined);

    ensureUserProfile(
      user.id,
      email,
      displayName,
      undefined,
      walletAddress
    ).catch(() => {
      // Profile sync is best-effort and should not block auth.
    });
  }, [authenticated, user]);

  return <>{children}</>;
}

export function PrivyProvider({ children }: { children: React.ReactNode }) {
  // During static generation PRIVY_APP_ID may not be set; render children without auth
  if (!PRIVY_APP_ID) {
    return <>{children}</>;
  }

  return (
    <BasePrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        appearance: {
          theme: "dark",
          accentColor: "#fff",
        },
        loginMethods: ["email", "google", "github", "wallet"],
        embeddedWallets: {
          ethereum: { createOnLogin: "users-without-wallets" },
          solana: { createOnLogin: "users-without-wallets" },
        },
      }}
    >
      <AuthTokenRegistrar>{children}</AuthTokenRegistrar>
    </BasePrivyProvider>
  );
}
