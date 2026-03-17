import dynamic from "next/dynamic";

const DashboardShell = dynamic(
  () =>
    import("@/components/dashboard/dashboard-shell").then((module) => ({
      default: module.DashboardShell,
    })),
  {
    ssr: process.env.NODE_ENV === "production",
    loading: () => (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,#3a1a1f_0%,#1b0b0f_48%,#0f0508_100%)]" />
    ),
  },
);

interface DashboardPageProps {
  searchParams: Promise<{ aid?: string }>;
}

export default async function DashboardPage({
  searchParams,
}: DashboardPageProps) {
  const params = await searchParams;
  const openCreateFromAid = params.aid === "create";

  return (
    <DashboardShell
      key={openCreateFromAid ? "dashboard-aid-create" : "dashboard"}
      openCreateFromAid={openCreateFromAid}
    />
  );
}
