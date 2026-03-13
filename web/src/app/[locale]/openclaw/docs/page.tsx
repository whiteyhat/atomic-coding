import { getTranslations, setRequestLocale } from "next-intl/server";
import { OpenClawDocsPage } from "@/components/openclaw/openclaw-docs-page";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "metadata" });

  return {
    title: t("openclawDocsTitle"),
  };
}

export default async function OpenClawDocsRoute({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <OpenClawDocsPage />;
}
