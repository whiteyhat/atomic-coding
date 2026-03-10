import type { Metadata } from "next";
import { SettingsShell } from "@/components/settings/settings-shell";

export const metadata: Metadata = {
  title: "Settings | Atomic Game Maker",
  description: "Manage your creator profile and review platform runtime details.",
};

export default function SettingsPage() {
  return <SettingsShell />;
}
