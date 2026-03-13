import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PlatformAidProvider } from "@/components/platform-aid/platform-aid-provider";
import { AuthProvider } from "@/lib/auth-provider";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { SWRProvider } from "@/lib/swr-provider";
import { routing } from "@/i18n/routing";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <AuthProvider>
        <SWRProvider>
          <TooltipProvider delayDuration={200}>
            <PlatformAidProvider>
              <ErrorBoundary>{children}</ErrorBoundary>
            </PlatformAidProvider>
          </TooltipProvider>
        </SWRProvider>
      </AuthProvider>
      <Toaster
        position="bottom-right"
        theme="dark"
        toastOptions={{
          style: {
            background: "#1b0b0f",
            border: "1px solid rgba(255,255,255,0.08)",
            color: "rgba(255,255,255,0.88)",
          },
        }}
      />
    </NextIntlClientProvider>
  );
}
