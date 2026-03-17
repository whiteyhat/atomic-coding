import dynamic from "next/dynamic";

const AnalyticsPageClient = dynamic(
  () =>
    import("@/components/architecture-view/analytics-page-client").then((module) => ({
      default: module.AnalyticsPageClient,
    })),
  {
    ssr: process.env.NODE_ENV === "production",
    loading: () => (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,#3a1a1f_0%,#1b0b0f_48%,#0f0508_100%)]" />
    ),
  },
);

export default function AnalyticsPage() {
  return <AnalyticsPageClient />;
}
