import type { Metadata } from "next";
import { HomeLandingPage } from "@/components/home/home-landing-page";

export const metadata: Metadata = {
  title: "Atomic Game Maker | Create Games with AI — No Code Required",
  description:
    "Turn your game ideas into playable browser games in minutes. Describe what you want, AI builds it, and publish it for the world — no coding needed.",
};

export default function LandingPage() {
  return <HomeLandingPage />;
}
