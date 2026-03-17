import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import type { NextFetchEvent, NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { isDevAuthBypassEnabled } from "@/lib/dev-auth";

const isPublicRoute = createRouteMatcher([
  "/",
  "/login(.*)",
  "/api/(.*)",
  "/play/(.*)",
  "/game-player.html",
  "/games/:name/board",
  "/architecture",
]);

const clerkProxy = clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    const { userId } = await auth();
    if (!userId) {
      // Redirect to our own /login page instead of Clerk's hosted sign-in.
      // auth.protect() redirects to accounts.atomic.fun which causes CORS
      // errors when the browser follows the redirect from RSC fetch requests.
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect_url", request.nextUrl.pathname);
      return NextResponse.redirect(loginUrl);
    }
  }
});

export default function proxy(request: NextRequest, event: NextFetchEvent) {
  if (isDevAuthBypassEnabled(request.nextUrl.hostname)) {
    return NextResponse.next();
  }

  return clerkProxy(request, event);
}

export const config = {
  matcher: [
    // Match all paths except static files
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
