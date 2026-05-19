import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isPublicPage =
    pathname === "/" ||
    pathname === "/login" ||
    pathname.startsWith("/book") ||
    pathname.startsWith("/availability") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/robots.txt") ||
    pathname.startsWith("/sitemap.xml");

  const isLoginApi = pathname.startsWith("/api/login");
  const isImportApi = pathname.startsWith("/api/import");

  const isOwnerPage = pathname.startsWith("/import");

  const owner = req.cookies.get("owner")?.value === "1";

  if (pathname.startsWith("/_next")) return NextResponse.next();

  if (isLoginApi) return NextResponse.next();

  if (isImportApi) {
    if (!owner) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.next();
  }

  if (isPublicPage) return NextResponse.next();

  if (isOwnerPage && !owner) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api/bookings|api/rates|_next/static|_next/image).*)",
  ],
};