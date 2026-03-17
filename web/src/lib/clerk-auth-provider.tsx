"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { ClerkProvider, useAuth, useClerk, useUser } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import {
  AppAuthProvider,
  type AppAuthUser,
} from "./app-auth-context";
import { registerAuthTokenGetter } from "./auth-token-registry";
import { ensureUserProfile } from "./user-profile";

function AuthTokenRegistrar({ children }: { children: ReactNode }) {
  const { getToken, isSignedIn, userId } = useAuth();
  const { user } = useUser();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  registerAuthTokenGetter(() => getTokenRef.current());

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

function ClerkAuthBridge({ children }: { children: ReactNode }) {
  const { isSignedIn, isLoaded, getToken } = useAuth();
  const { user } = useUser();
  const clerk = useClerk();

  const appUser: AppAuthUser | null = user
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

export function ClerkAuthProvider({
  children,
  publishableKey,
}: {
  children: ReactNode;
  publishableKey: string;
}) {
  return (
    <ClerkProvider
      publishableKey={publishableKey}
      appearance={{
        baseTheme: dark,
        variables: { colorPrimary: "#fff", colorTextOnPrimaryBackground: "#000" },
        elements: {
          formButtonPrimary: { color: "#000" },
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
