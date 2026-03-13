import { getTranslations, setRequestLocale } from "next-intl/server";
import { OpenClawShell } from "@/components/openclaw/openclaw-shell";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "metadata" });

  return {
    title: t("openclawTitle"),
  };
}

export default async function OpenClawPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <OpenClawShell />;
}
