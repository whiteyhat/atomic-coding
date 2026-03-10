import { DashboardShell } from "@/components/dashboard/dashboard-shell";

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
