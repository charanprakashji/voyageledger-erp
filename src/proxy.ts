import { NextRequest, NextResponse } from "next/server";
import { parseSessionCookie, SESSION_COOKIE_NAME, sanitizeRedirectUrl } from "@/lib/auth";

// Public route prefixes/paths that do not require authentication
const PUBLIC_PATHS = ["/login", "/api/health"];

export async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // 1. Skip static assets, Next.js internals, and public resources
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/static") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.match(/\.(png|jpg|jpeg|gif|svg|ico|webp|css|js|map)$/i)
  ) {
    return NextResponse.next();
  }

  // 2. Read session cookie
  const sessionCookie = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = parseSessionCookie(sessionCookie);
  const isAuthenticated = !!(session && session.id);

  // 3. Handle Login page
  if (pathname === "/login") {
    // If already logged in, redirect to dashboard or original redirect destination
    if (isAuthenticated) {
      const redirectTo = req.nextUrl.searchParams.get("redirect");
      if (redirectTo && redirectTo !== "/login") {
        const targetUrl = sanitizeRedirectUrl(redirectTo);
        return NextResponse.redirect(new URL(targetUrl, req.nextUrl));
      }
      return NextResponse.redirect(new URL("/", req.nextUrl));
    }
    return NextResponse.next();
  }

  // 4. Handle other public paths (e.g. /api/health)
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }

  // 5. Protected routes: if not authenticated, block or redirect
  if (!isAuthenticated) {
    // For API endpoints, return JSON 401
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "UNAUTHORIZED: Authentication required." },
        { status: 401 }
      );
    }

    // For web pages, redirect to login with original target path
    const originalDestination = `${pathname}${search}`;
    const loginUrl = new URL("/login", req.nextUrl);
    loginUrl.searchParams.set("redirect", originalDestination);

    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

// Ensure proxy runs across ERP routes and API endpoints
export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt
     */
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};

export default proxy;
