import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Public pages anyone can access
  const isPublicPage =
    pathname === "/" ||
    pathname === "/login" ||
    pathname.startsWith("/book") ||
    pathname.startsWith("/availability") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/robots.txt") ||
    pathname.startsWith("/sitemap.xml");

  // Public API endpoints
  const isLoginApi = pathname.startsWith("/api/login");

  // Bookings API
  const isBookingsApi = pathname.startsWith("/api/bookings");

  // Import API (owner only)
  const isImportApi = pathname.startsWith("/api/import");

  // Owner-only pages
  const isOwnerPage =
    pathname.startsWith("/import");

  const owner = req.cookies.get("owner")?.value === "1";

  // Always allow Next assets
  if (pathname.startsWith("/_next")) {
    return NextResponse.next();
  }

  // Allow login API
  if (isLoginApi) {
    return NextResponse.next();
  }

  // Allow public booking requests
  if (isBookingsApi) {
    return NextResponse.next();
  }

  // Protect import API
  if (isImportApi) {
    if (!owner) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    return NextResponse.next();
  }

  // Allow all public pages
  if (isPublicPage) {
    return NextResponse.next();
  }

  // Protect owner pages
  if (isOwnerPage && !owner) {
    const url = req.nextUrl.clone();

    url.pathname = "/login";
    url.searchParams.set("next", pathname);

    return NextResponse.redirect(url);
  }

  // Default allow
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};