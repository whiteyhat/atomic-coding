import type { Metadata } from "next";
import {
  Geist,
  Geist_Mono,
  Space_Grotesk,
  Orbitron,
  JetBrains_Mono,
  Instrument_Serif,
} from "next/font/google";
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

const spaceGrotesk = Space_Grotesk({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const orbitron = Orbitron({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono-jb",
  subsets: ["latin"],
  weight: ["400", "500"],
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-loader",
  subsets: ["latin"],
  weight: "400",
  style: "italic",
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
        className={`${geistSans.variable} ${geistMono.variable} ${spaceGrotesk.variable} ${orbitron.variable} ${jetbrainsMono.variable} ${instrumentSerif.variable} font-sans antialiased`}
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
