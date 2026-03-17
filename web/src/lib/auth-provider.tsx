"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";
import { registerAuthTokenGetter } from "./auth-token-registry";
import {
  AppAuthProvider,
  defaultAuthValue,
  type AppAuthUser,
  useAppAuth,
} from "./app-auth-context";
import { ensureUserProfile } from "./user-profile";

const ClerkAuthProvider = dynamic(
  () =>
    import("./clerk-auth-provider").then((module) => ({
      default: module.ClerkAuthProvider,
    })),
  {
    ssr: false,
    loading: () => null,
  },
);

const CLERK_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";
const DEV_AUTH_BYPASS = process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS === "true";
const DEV_AUTH_BYPASS_USER_ID =
  process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS_USER_ID ?? "did:dev:local-user";
const DEV_AUTH_BYPASS_TOKEN =
  process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS_TOKEN ?? "dev-bypass";
const noop = () => {};

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

export function AuthProvider({ children }: { children: React.ReactNode }) {
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

  // During static generation the key may not be set; render children without auth
  if (!CLERK_PUBLISHABLE_KEY) {
    return (
      <AppAuthProvider value={defaultAuthValue}>{children}</AppAuthProvider>
    );
  }

  return (
    <ClerkAuthProvider publishableKey={CLERK_PUBLISHABLE_KEY}>
      {children}
    </ClerkAuthProvider>
  );
}

export { useAppAuth } from "./app-auth-context";
