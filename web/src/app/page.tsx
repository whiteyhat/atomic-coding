import type { Metadata } from "next";
import { HomeLandingPage } from "@/components/home/home-landing-page";

export const metadata: Metadata = {
  title: "Buu AI Game Maker | Build Playable Games Fast",
  description:
    "Build browser games fast with Buu AI Game Maker. Direct the agent swarm, keep builds moving, and line up public play from one command center.",
};

export default function LandingPage() {
  return <HomeLandingPage />;
}
