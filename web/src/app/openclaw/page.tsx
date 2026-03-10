import type { Metadata } from "next";
import { OpenClawShell } from "@/components/openclaw/openclaw-shell";

export const metadata: Metadata = {
  title: "OpenClaw | Atomic Game Maker",
  description: "Import and manage your OpenClaw agent across Atomic Coding platform controls.",
};

export default function OpenClawPage() {
  return <OpenClawShell />;
}
