import type { Metadata } from "next";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DeferredPlatformAidProvider } from "@/components/platform-aid/deferred-platform-aid-provider";
import { AuthProvider } from "@/lib/auth-provider";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { SWRProvider } from "@/lib/swr-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Atomic Game Maker",
  description: "Build Phaser and Three.js games with AI agents",
  openGraph: {
    title: "Atomic Game Maker",
    description: "Build Phaser and Three.js games with AI agents",
    images: [
      {
        url: "https://i.imgur.com/6QhEvFj.jpeg",
        width: 1200,
        height: 630,
        alt: "Atomic Game Maker",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Atomic Game Maker",
    description: "Build Phaser and Three.js games with AI agents",
    images: ["https://i.imgur.com/6QhEvFj.jpeg"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="font-sans antialiased">
        <AuthProvider>
          <SWRProvider>
            <TooltipProvider delayDuration={200}>
              <DeferredPlatformAidProvider>
                <ErrorBoundary>{children}</ErrorBoundary>
              </DeferredPlatformAidProvider>
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
      </body>
    </html>
  );
}
