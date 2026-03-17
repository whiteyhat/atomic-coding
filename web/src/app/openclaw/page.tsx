import type { Metadata } from "next";
import dynamic from "next/dynamic";

const OpenClawShell = dynamic(
  () =>
    import("@/components/openclaw/openclaw-shell").then((module) => ({
      default: module.OpenClawShell,
    })),
  {
    ssr: process.env.NODE_ENV === "production",
    loading: () => (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,#3a1a1f_0%,#1b0b0f_48%,#0f0508_100%)]" />
    ),
  },
);

export const metadata: Metadata = {
  title: "OpenClaw | Atomic Game Maker",
  description: "Import and manage your OpenClaw agent across Atomic Coding platform controls.",
};

export default function OpenClawPage() {
  return <OpenClawShell />;
}
