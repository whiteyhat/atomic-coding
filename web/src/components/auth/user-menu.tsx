"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Globe, LogOut, Settings, User } from "lucide-react";
import { useAppAuth } from "@/lib/auth-provider";
import { routing, type Locale } from "@/i18n/routing";

const localeLabels: Record<Locale, string> = {
  en: "English",
  es: "Español",
  fr: "Français",
  de: "Deutsch",
};

export function UserMenu() {
  const { user, logout, ready, authenticated, isDevBypass } = useAppAuth();
  const t = useTranslations("common");
  const tNav = useTranslations("nav");
  const tAuth = useTranslations("auth");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  if (!ready || !authenticated || !user) {
    return null;
  }

  const email = user.email?.address;
  const displayName = email ?? "User";

  function switchLocale(newLocale: Locale) {
    router.replace(pathname, { locale: newLocale });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          <User className="size-4" />
          <span className="max-w-[120px] truncate text-sm">{displayName}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {email && (
          <DropdownMenuItem disabled className="text-xs text-muted-foreground">
            {email}
          </DropdownMenuItem>
        )}
        {isDevBypass && (
          <DropdownMenuItem disabled className="text-xs text-muted-foreground">
            {tAuth("localDevAuthBypass")}
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/settings">
            <Settings className="size-4 mr-2" />
            {tNav("settings")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Globe className="size-4 mr-2" />
            {localeLabels[locale as Locale] ?? t("language")}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {routing.locales.map((loc) => (
              <DropdownMenuItem
                key={loc}
                onClick={() => switchLocale(loc)}
                className={loc === locale ? "font-semibold" : ""}
              >
                {localeLabels[loc]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        {!isDevBypass && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout} className="text-destructive">
              <LogOut className="size-4 mr-2" />
              {t("signOutCaps")}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
