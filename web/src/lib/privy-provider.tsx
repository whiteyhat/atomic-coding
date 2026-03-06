"use client";

import { useEffect } from "react";
import { PrivyProvider as BasePrivyProvider, usePrivy } from "@privy-io/react-auth";
import { registerAuthTokenGetter } from "./api";

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "";

function AuthTokenRegistrar({ children }: { children: React.ReactNode }) {
  const { getAccessToken } = usePrivy();

  useEffect(() => {
    registerAuthTokenGetter(getAccessToken);
  }, [getAccessToken]);

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
