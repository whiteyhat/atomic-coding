"use client";

import { createContext, useContext, useEffect } from "react";
import { ClerkProvider, useUser, useAuth, useClerk } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import { registerAuthTokenGetter } from "./api";
import { ensureUserProfile } from "./user-profile";

const CLERK_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";
const DEV_AUTH_BYPASS = process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS === "true";
const DEV_AUTH_BYPASS_USER_ID =
  process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS_USER_ID ?? "did:dev:local-user";
const DEV_AUTH_BYPASS_TOKEN =
  process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS_TOKEN ?? "dev-bypass";

type AppAuthUser = {
  id: string;
  email?: { address: string };
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
  const { getToken, isSignedIn, userId } = useAuth();
  const { user } = useUser();

  useEffect(() => {
    registerAuthTokenGetter(() => getToken());
  }, [getToken]);

  useEffect(() => {
    if (!isSignedIn || !userId || !user) return;

    const email = user.primaryEmailAddress?.emailAddress;
    const displayName = email ?? user.fullName ?? undefined;

    ensureUserProfile(userId, email ?? undefined, displayName).catch(() => {
      // Profile sync is best-effort and should not block auth.
    });
  }, [isSignedIn, userId, user]);

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

function ClerkAuthBridge({ children }: { children: React.ReactNode }) {
  const { isSignedIn, isLoaded, getToken } = useAuth();
  const { user } = useUser();
  const clerk = useClerk();

  const appUser: AppAuthUser | null =
    user
      ? {
          id: user.id,
          email: user.primaryEmailAddress
            ? { address: user.primaryEmailAddress.emailAddress }
            : undefined,
        }
      : null;

  return (
    <AppAuthProvider
      value={{
        authenticated: !!isSignedIn,
        ready: isLoaded,
        user: appUser,
        login: () => clerk.openSignIn({ forceRedirectUrl: "/dashboard" }),
        logout: () => clerk.signOut(),
        getAccessToken: () => getToken(),
        isDevBypass: false,
      }}
    >
      <AuthTokenRegistrar>{children}</AuthTokenRegistrar>
    </AppAuthProvider>
  );
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
    <ClerkProvider
      publishableKey={CLERK_PUBLISHABLE_KEY}
      appearance={{
        baseTheme: dark,
        variables: { colorPrimary: "#fff", colorTextOnPrimaryBackground: "#000" },
        elements: {
          footerActionLink: { color: "#a5b4fc" },
          formFieldAction: { color: "#a5b4fc" },
          identityPreviewEditButton: { color: "#a5b4fc" },
          alternativeMethodsBlockButton: { color: "#a5b4fc" },
        },
      }}
    >
      <ClerkAuthBridge>{children}</ClerkAuthBridge>
    </ClerkProvider>
  );
}

export function useAppAuth() {
  return useContext(AppAuthContext);
}
