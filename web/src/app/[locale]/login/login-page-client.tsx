"use client";

import { useRouter } from "@/i18n/navigation";
import { useEffect } from "react";
import { SignIn } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import { useAppAuth } from "@/lib/auth-provider";

export function LoginPageClient({ redirectTo }: { redirectTo: string }) {
  const router = useRouter();
  const { authenticated, ready, isDevBypass } = useAppAuth();

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
      <SignIn
        routing="hash"
        forceRedirectUrl={redirectTo}
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
      />
    </div>
  );
}
