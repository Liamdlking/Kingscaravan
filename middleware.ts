import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Public pages
  const isPublicPage =
    pathname === "/" ||
    pathname === "/login" ||
    pathname.startsWith("/book") ||
    pathname.startsWith("/availability") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/robots.txt") ||
    pathname.startsWith("/sitemap.xml");

  // Public APIs
  const isLoginApi = pathname.startsWith("/api/login");

  // Owner-only APIs
  const isImportApi = pathname.startsWith("/api/import");

  // Owner-only pages
  const isOwnerPage =
    pathname.startsWith("/import");

  const owner = req.cookies.get("owner")?.value === "1";

  // Always allow Next.js internals
  if (pathname.startsWith("/_next")) {
    return NextResponse.next();
  }

  // Allow login API
  if (isLoginApi) {
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

  // Allow public pages
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

  // Allow everything else
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};