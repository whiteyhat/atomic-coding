import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { LibraryShell } from "@/components/library/library-shell";

function LibraryPageFallback() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#3a1a1f_0%,#1b0b0f_48%,#0f0508_100%)] px-3 py-4 text-stone-50 md:px-5 md:py-5">
      <div className="mx-auto flex min-h-[70vh] max-w-[1920px] items-center justify-center rounded-[2rem] border border-white/8 bg-[#311519]/70">
        <div className="flex items-center gap-3 text-sm text-white/55">
          <Loader2 className="size-4 animate-spin" />
          <span>Loading your library...</span>
        </div>
      </div>
    </div>
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "metadata" });

  return {
    title: t("libraryTitle"),
  };
}

export default async function LibraryPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <Suspense fallback={<LibraryPageFallback />}>
      <LibraryShell />
    </Suspense>
  );
}
