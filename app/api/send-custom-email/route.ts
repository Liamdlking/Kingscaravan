import { NextResponse } from "next/server";
import { sendCustomGuestEmail } from "../../../lib/email";

function isAuthorized(req: Request) {
  const auth = req.headers.get("authorization");
  const bearer = process.env.OWNER_API_TOKEN;

  if (!bearer) return true;
  if (!auth) return false;

  return auth === `Bearer ${bearer}`;
}

export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();

  const to = String(body.to || "");
  const subject = String(body.subject || "");
  const message = String(body.message || "");

  if (!to || !subject || !message) {
    return NextResponse.json(
      { error: "Email, subject and message are required" },
      { status: 400 }
    );
  }

  await sendCustomGuestEmail({
    to,
    subject,
    message,
  });

  return NextResponse.json({ ok: true });
}