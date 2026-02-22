import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isPublic =
    pathname.startsWith("/book") ||
    pathname.startsWith("/availability") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/login") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon");

  // Allow public GETs to /api/bookings (for availability),
  // but block write methods unless logged in.
  const isBookingsApi = pathname.startsWith("/api/bookings");

  const owner = req.cookies.get("owner")?.value === "1";

  if (isBookingsApi) {
    if (req.method === "GET") return NextResponse.next();
    if (!owner) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.next();
  }

  if (isPublic) return NextResponse.next();

  // Protect admin pages: / and /import etc
  if (!owner) {
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