import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PrivyProvider } from "@/lib/privy-provider";
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
  title: "Buu AI Game Maker",
  description: "Build Three.js games with AI agents",
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
        <PrivyProvider>
          <SWRProvider>
            <TooltipProvider delayDuration={200}>
              <ErrorBoundary>{children}</ErrorBoundary>
            </TooltipProvider>
          </SWRProvider>
        </PrivyProvider>
      </body>
    </html>
  );
}
