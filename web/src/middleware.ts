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
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Match all paths except static files
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
