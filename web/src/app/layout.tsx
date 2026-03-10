import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PlatformAidProvider } from "@/components/platform-aid/platform-aid-provider";
import { AuthProvider } from "@/lib/auth-provider";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { SWRProvider } from "@/lib/swr-provider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Atomic Game Maker",
  description: "Build Phaser and Three.js games with AI agents",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}
      >
        <AuthProvider>
          <SWRProvider>
            <TooltipProvider delayDuration={200}>
              <PlatformAidProvider>
                <ErrorBoundary>{children}</ErrorBoundary>
              </PlatformAidProvider>
            </TooltipProvider>
          </SWRProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
