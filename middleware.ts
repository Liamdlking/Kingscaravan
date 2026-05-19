import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Public pages
  const isPublicPage =
    pathname === "/login" ||
    pathname.startsWith("/book") ||
    pathname.startsWith("/availability") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/robots.txt") ||
    pathname.startsWith("/sitemap.xml");

  // Public APIs
  const isPublicApi =
    pathname.startsWith("/api/bookings") ||
    pathname.startsWith("/api/login");

  // Owner-only pages
  const isOwnerPage =
    pathname === "/" ||
    pathname.startsWith("/import");

  const owner = req.cookies.get("owner")?.value === "1";

  // Allow public pages/apis
  if (isPublicPage || isPublicApi) {
    return NextResponse.next();
  }

  // Protect admin pages
  if (isOwnerPage && !owner) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};