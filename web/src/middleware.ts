import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isDevAuthBypassEnabled } from "@/lib/dev-auth";

const isPublicRoute = createRouteMatcher([
  "/",
  "/login(.*)",
  "/api/(.*)",
  "/play/(.*)",
  "/game-player.html",
  "/games/:name/board",
]);

export default clerkMiddleware(async (auth, request) => {
  if (isDevAuthBypassEnabled(request.nextUrl.hostname)) {
    return NextResponse.next();
  }

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

export const config = {
  matcher: [
    // Match all paths except static files
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
