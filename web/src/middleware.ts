import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";
import { isDevAuthBypassEnabled } from "@/lib/dev-auth";

const intlMiddleware = createMiddleware(routing);

const isPublicRoute = createRouteMatcher([
  "/",
  "/:locale",
  "/:locale/login(.*)",
  "/login(.*)",
  "/api/(.*)",
  "/:locale/play/(.*)",
  "/play/(.*)",
  "/game-player.html",
  "/:locale/games/:name/board",
  "/games/:name/board",
]);

export default clerkMiddleware(async (auth, request) => {
  // Run next-intl middleware for all non-API routes
  if (!request.nextUrl.pathname.startsWith("/api")) {
    const intlResponse = intlMiddleware(request);

    // If next-intl wants to redirect (locale detection/prefix), return immediately
    if (intlResponse.status === 307 || intlResponse.status === 308) {
      return intlResponse;
    }

    // For non-redirect responses, continue with auth checks but preserve
    // the intl response (carries locale rewrite headers and cookies)
    if (isDevAuthBypassEnabled(request.nextUrl.hostname)) {
      return intlResponse;
    }

    if (!isPublicRoute(request)) {
      const { userId } = await auth();
      if (!userId) {
        const segments = request.nextUrl.pathname.split("/");
        const pathLocale = segments[1];
        const isLocale = routing.locales.includes(
          pathLocale as (typeof routing.locales)[number],
        );
        const prefix = isLocale ? `/${pathLocale}` : "";

        const loginUrl = new URL(`${prefix}/login`, request.url);
        loginUrl.searchParams.set("redirect_url", request.nextUrl.pathname);
        return NextResponse.redirect(loginUrl);
      }
    }

    // Authenticated or public route — return the intl response
    return intlResponse;
  }

  if (isDevAuthBypassEnabled(request.nextUrl.hostname)) {
    return NextResponse.next();
  }

  if (!isPublicRoute(request)) {
    const { userId } = await auth();
    if (!userId) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect_url", request.nextUrl.pathname);
      return NextResponse.redirect(loginUrl);
    }
  }
});

export const config = {
  matcher: [
    // Match all paths except static files
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
