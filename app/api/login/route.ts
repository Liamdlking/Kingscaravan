import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const password = String(body.password || "");
  const next = String(body.next || "/");

  const expected = process.env.ADMIN_PASSWORD || "";
  if (!expected) {
    return NextResponse.json({ error: "Server missing ADMIN_PASSWORD" }, { status: 500 });
  }

  if (password !== expected) {
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true, next });
  res.cookies.set("owner", "1", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
  return res;
}