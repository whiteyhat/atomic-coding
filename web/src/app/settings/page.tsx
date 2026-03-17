import type { Metadata } from "next";
import dynamic from "next/dynamic";

const SettingsShell = dynamic(
  () =>
    import("@/components/settings/settings-shell").then((module) => ({
      default: module.SettingsShell,
    })),
  {
    ssr: process.env.NODE_ENV === "production",
    loading: () => (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,#3a1a1f_0%,#1b0b0f_48%,#0f0508_100%)]" />
    ),
  },
);

export const metadata: Metadata = {
  title: "Settings | Atomic Game Maker",
  description: "Manage your creator profile and review platform runtime details.",
};

export default function SettingsPage() {
  return <SettingsShell />;
}
