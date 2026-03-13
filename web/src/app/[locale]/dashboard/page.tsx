import { getTranslations, setRequestLocale } from "next-intl/server";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "metadata" });

  return {
    title: t("dashboardTitle"),
  };
}

interface DashboardPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ aid?: string }>;
}

export default async function DashboardPage({
  params,
  searchParams,
}: DashboardPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const resolvedSearchParams = await searchParams;
  const openCreateFromAid = resolvedSearchParams.aid === "create";

  return (
    <DashboardShell
      key={openCreateFromAid ? "dashboard-aid-create" : "dashboard"}
      openCreateFromAid={openCreateFromAid}
    />
  );
}
