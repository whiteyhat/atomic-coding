import type { Metadata } from "next";
import { OpenClawDocsPage } from "@/components/openclaw/openclaw-docs-page";

export const metadata: Metadata = {
  title: "OpenClaw Docs | Buu AI Game Maker",
  description: "Atomic Coding import docs, control-plane contract, and runtime endpoints for OpenClaw.",
};

export default function OpenClawDocsRoute() {
  return <OpenClawDocsPage />;
}
