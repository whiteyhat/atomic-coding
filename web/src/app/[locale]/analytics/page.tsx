import { getTranslations, setRequestLocale } from "next-intl/server";
import { AnalyticsPageClient } from "@/components/architecture-view/analytics-page-client";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "metadata" });

  return {
    title: t("analyticsTitle"),
  };
}

export default async function AnalyticsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <AnalyticsPageClient />;
}
