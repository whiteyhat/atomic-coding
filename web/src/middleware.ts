import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isDevAuthBypassEnabled } from "@/lib/dev-auth";

// Routes that don't require authentication
const PUBLIC_ROUTES = [
  "/login",
  "/api/", // API routes handle their own auth
  "/play/", // Public game player pages (Phase 5)
  "/_next/", // Next.js internals
  "/favicon", // Static assets
  "/game-player.html", // Game iframe
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isDevAuthBypassEnabled(request.nextUrl.hostname)) {
    return NextResponse.next();
  }

  if (pathname === "/") {
    return NextResponse.next();
  }

  // Allow public routes
  if (PUBLIC_ROUTES.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Public leaderboard pages: /games/[name]/board
  if (pathname.match(/^\/games\/[^/]+\/board$/)) {
    return NextResponse.next();
  }

  // Check for Privy auth token in cookies
  // Privy stores the auth token in a cookie named "privy-token"
  const privyToken = request.cookies.get("privy-token");

  if (!privyToken?.value) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all paths except static files
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
