"use client";

import { createContext, useContext, useEffect } from "react";
import { PrivyProvider as BasePrivyProvider, usePrivy } from "@privy-io/react-auth";
import { registerAuthTokenGetter } from "./api";
import { ensureUserProfile } from "./user-profile";

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "";
const DEV_AUTH_BYPASS = process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS === "true";
const DEV_AUTH_BYPASS_USER_ID =
  process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS_USER_ID ?? "did:dev:local-user";
const DEV_AUTH_BYPASS_TOKEN =
  process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS_TOKEN ?? "dev-bypass";

type AppAuthUser = {
  id: string;
  email?: { address: string };
  wallet?: { address: string };
};

type AppAuthContextValue = {
  authenticated: boolean;
  ready: boolean;
  user: AppAuthUser | null;
  login: () => void | Promise<void>;
  logout: () => void | Promise<void>;
  getAccessToken: () => Promise<string | null>;
  isDevBypass: boolean;
};

const noop = () => {};
const defaultAuthValue: AppAuthContextValue = {
  authenticated: false,
  ready: true,
  user: null,
  login: noop,
  logout: noop,
  getAccessToken: async () => null,
  isDevBypass: false,
};

const AppAuthContext = createContext<AppAuthContextValue>(defaultAuthValue);

function AppAuthProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value: AppAuthContextValue;
}) {
  return (
    <AppAuthContext.Provider value={value}>{children}</AppAuthContext.Provider>
  );
}

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

function DevAuthBootstrap({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    registerAuthTokenGetter(async () => DEV_AUTH_BYPASS_TOKEN);
  }, []);

  useEffect(() => {
    ensureUserProfile(
      DEV_AUTH_BYPASS_USER_ID,
      "dev@local.test",
      "Local Dev",
    ).catch(() => {
      // Profile sync is best-effort and should not block auth.
    });
  }, []);

  return <>{children}</>;
}

function PrivyAuthBridge({ children }: { children: React.ReactNode }) {
  const { getAccessToken, authenticated, user, login, logout, ready } =
    usePrivy();

  return (
    <AppAuthProvider
      value={{
        authenticated,
        ready,
        user: (user as AppAuthUser | null) ?? null,
        login,
        logout,
        getAccessToken,
        isDevBypass: false,
      }}
    >
      <AuthTokenRegistrar>{children}</AuthTokenRegistrar>
    </AppAuthProvider>
  );
}

export function PrivyProvider({ children }: { children: React.ReactNode }) {
  if (DEV_AUTH_BYPASS) {
    const devUser: AppAuthUser = {
      id: DEV_AUTH_BYPASS_USER_ID,
      email: { address: "dev@local.test" },
    };

    return (
      <AppAuthProvider
        value={{
          authenticated: true,
          ready: true,
          user: devUser,
          login: noop,
          logout: noop,
          getAccessToken: async () => DEV_AUTH_BYPASS_TOKEN,
          isDevBypass: true,
        }}
      >
        <DevAuthBootstrap>{children}</DevAuthBootstrap>
      </AppAuthProvider>
    );
  }

  // During static generation PRIVY_APP_ID may not be set; render children without auth
  if (!PRIVY_APP_ID) {
    return <AppAuthProvider value={defaultAuthValue}>{children}</AppAuthProvider>;
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
      <PrivyAuthBridge>{children}</PrivyAuthBridge>
    </BasePrivyProvider>
  );
}

export function useAppAuth() {
  return useContext(AppAuthContext);
}
