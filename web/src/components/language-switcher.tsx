"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";

const localeLabels: Record<Locale, string> = {
  en: "English",
  es: "Español",
  fr: "Français",
  de: "Deutsch",
};

export function LanguageSwitcher() {
  const t = useTranslations("auth");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  function onLocaleChange(newLocale: string) {
    router.replace(pathname, { locale: newLocale as Locale });
  }

  return (
    <select
      value={locale}
      onChange={(e) => onLocaleChange(e.target.value)}
      aria-label={t("selectLanguage")}
      className="bg-background text-foreground border border-border rounded-md px-2 py-1 text-sm cursor-pointer"
    >
      {routing.locales.map((loc) => (
        <option key={loc} value={loc}>
          {localeLabels[loc]}
        </option>
      ))}
    </select>
  );
}
