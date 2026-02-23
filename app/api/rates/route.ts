import { NextResponse } from "next/server";
import { supabaseServer } from "../../../lib/supabaseServer";

export async function GET() {
  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("rates")
    .select("*")
    .order("start_date", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rates: data ?? [] });
}

export async function POST(req: Request) {
  const supabase = supabaseServer();
  const body = await req.json();

  const start_date = String(body.start_date || "");
  const end_date = String(body.end_date || "");
  const price = Number(body.price);
  const rate_type = body.rate_type === "nightly" ? "nightly" : "total"; // default total
  const note = body.note ?? null;

  if (!start_date || !end_date) {
    return NextResponse.json({ error: "start_date and end_date are required" }, { status: 400 });
  }
  if (end_date <= start_date) {
    return NextResponse.json({ error: "end_date must be after start_date" }, { status: 400 });
  }
  if (!Number.isFinite(price) || price <= 0) {
    return NextResponse.json({ error: "price must be a positive number" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("rates")
    .insert([{ start_date, end_date, price, rate_type, note }])
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rate: data });
}

export async function DELETE(req: Request) {
  const supabase = supabaseServer();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const { error } = await supabase.from("rates").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
