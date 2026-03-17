import type { Metadata } from "next";
import dynamic from "next/dynamic";

const HomeLandingPage = dynamic(
  () =>
    import("@/components/home/home-landing-page").then((module) => ({
      default: module.HomeLandingPage,
    })),
  {
    ssr: process.env.NODE_ENV === "production",
    loading: () => (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,#45131d_0%,#18070c_42%,#070204_100%)]" />
    ),
  },
);

export const metadata: Metadata = {
  title: "Atomic Game Maker | Create Games with AI — No Code Required",
  description:
    "Turn your game ideas into playable browser games in minutes. Describe what you want, AI builds it, and publish it for the world — no coding needed.",
};

export default function LandingPage() {
  return <HomeLandingPage />;
}
