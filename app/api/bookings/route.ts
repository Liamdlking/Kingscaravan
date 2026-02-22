
import { NextResponse } from "next/server";
import { supabaseServer } from "../../../lib/supabaseServer";
import { overlaps } from "../../../lib/overlap";

export async function GET() {
  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("bookings")
    .select("*")
    .in("status", ["provisional", "confirmed"])
    .order("start_date", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ bookings: data ?? [] });
}

export async function POST(req: Request) {
  const supabase = supabaseServer();
  const body = await req.json();

  const { start_date, end_date, guest_name, contact, notes } = body;
  const status = body.status === "provisional" ? "provisional" : "confirmed";

  const { data: existing } = await supabase
    .from("bookings")
    .select("start_date,end_date")
    .eq("status", "confirmed");

  const conflict = (existing ?? []).some((b: any) => overlaps({ start_date, end_date }, b));
  if (conflict && status === "confirmed") {
    return NextResponse.json({ error: "Overlap with confirmed booking" }, { status: 409 });
  }

  const { data, error } = await supabase
    .from("bookings")
    .insert([{ start_date, end_date, guest_name, contact, notes, status }])
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ booking: data });
}

export async function PATCH(req: Request) {
  const supabase = supabaseServer();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const { action } = await req.json();

  const status = action === "approve" ? "confirmed" : "declined";

  const { data, error } = await supabase
    .from("bookings")
    .update({ status })
    .eq("id", id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ booking: data });
}

export async function DELETE(req: Request) {
  const supabase = supabaseServer();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  await supabase.from("bookings").delete().eq("id", id);
  return NextResponse.json({ ok: true });
}
