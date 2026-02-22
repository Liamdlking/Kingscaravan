import { NextResponse } from "next/server";
import { supabaseServer } from "../../../lib/supabaseServer";
import { overlaps } from "../../../lib/overlap";

type Status = "provisional" | "confirmed" | "declined";

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

  const start_date = String(body.start_date || "");
  const end_date = String(body.end_date || "");

  const status: Status = body.status === "provisional" ? "provisional" : "confirmed";

  // Guest details (all optional except name/email for public form)
  const guest_name = body.guest_name ?? null;
  const guest_email = body.guest_email ?? null;
  const phone = body.phone ?? null;

  const guests_count = body.guests_count === "" || body.guests_count == null ? null : Number(body.guests_count);
  const children_count = body.children_count === "" || body.children_count == null ? null : Number(body.children_count);
  const dogs_count = body.dogs_count === "" || body.dogs_count == null ? null : Number(body.dogs_count);

  const vehicle_reg = body.vehicle_reg ?? null;
  const arrival_time = body.arrival_time ?? null;
  const departure_time = body.departure_time ?? null;

  const price = body.price === "" || body.price == null ? null : Number(body.price);
  const special_requests = body.special_requests ?? null;

  const contact = body.contact ?? null; // keep compatibility
  const notes = body.notes ?? null;     // keep compatibility

  if (!start_date || !end_date) {
    return NextResponse.json({ error: "start_date and end_date are required" }, { status: 400 });
  }

  if (end_date <= start_date) {
    return NextResponse.json({ error: "end_date must be after start_date" }, { status: 400 });
  }

  // If someone is creating a CONFIRMED booking, it must not overlap existing CONFIRMED bookings
  if (status === "confirmed") {
    const { data: existing, error: readErr } = await supabase
      .from("bookings")
      .select("id,start_date,end_date")
      .eq("status", "confirmed");

    if (readErr) return NextResponse.json({ error: readErr.message }, { status: 500 });

    const newB = { start_date, end_date };
    const conflict = (existing ?? []).some((b: any) => overlaps(newB as any, b as any));

    if (conflict) {
      return NextResponse.json(
        { error: "Those dates overlap an existing confirmed booking (same-day turnover is allowed)." },
        { status: 409 }
      );
    }
  }

  const insertRow: any = {
    start_date,
    end_date,
    status,
    guest_name,
    guest_email,
    phone,
    guests_count: Number.isFinite(guests_count) ? guests_count : null,
    children_count: Number.isFinite(children_count) ? children_count : null,
    dogs_count: Number.isFinite(dogs_count) ? dogs_count : null,
    vehicle_reg,
    arrival_time,
    departure_time,
    price: Number.isFinite(price) ? price : null,
    special_requests,
    contact,
    notes,
  };

  const { data, error } = await supabase.from("bookings").insert([insertRow]).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ booking: data });
}

export async function PATCH(req: Request) {
  const supabase = supabaseServer();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const action = String(body.action || "").toLowerCase(); // approve | decline | update

  // update allows changing price/notes/etc from admin panel later
  if (action === "update") {
    const updates: any = {};
    const allow = [
      "guest_name",
      "guest_email",
      "phone",
      "guests_count",
      "children_count",
      "dogs_count",
      "vehicle_reg",
      "arrival_time",
      "departure_time",
      "price",
      "special_requests",
      "notes",
      "contact",
    ];
    for (const k of allow) if (k in body) updates[k] = body[k];

    const { data, error } = await supabase
      .from("bookings")
      .update(updates)
      .eq("id", id)
      .select("*")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ booking: data });
  }

  if (action !== "approve" && action !== "decline") {
    return NextResponse.json({ error: "action must be 'approve', 'decline', or 'update'" }, { status: 400 });
  }

  if (action === "decline") {
    const { data, error } = await supabase
      .from("bookings")
      .update({ status: "declined", decided_at: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ booking: data });
  }

  // Approve: ensure it doesn't overlap CONFIRMED bookings
  const { data: pending, error: readOneErr } = await supabase
    .from("bookings")
    .select("id,start_date,end_date,status")
    .eq("id", id)
    .single();

  if (readOneErr) return NextResponse.json({ error: readOneErr.message }, { status: 500 });
  if (!pending) return NextResponse.json({ error: "Booking not found" }, { status: 404 });

  const { data: existing, error: readErr } = await supabase
    .from("bookings")
    .select("id,start_date,end_date")
    .eq("status", "confirmed")
    .neq("id", id);

  if (readErr) return NextResponse.json({ error: readErr.message }, { status: 500 });

  const newB = { start_date: pending.start_date, end_date: pending.end_date };
  const conflict = (existing ?? []).some((b: any) => overlaps(newB as any, b as any));

  if (conflict) {
    return NextResponse.json({ error: "Cannot approve: dates overlap an existing confirmed booking." }, { status: 409 });
  }

  const { data, error } = await supabase
    .from("bookings")
    .update({ status: "confirmed", decided_at: new Date().toISOString() })
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
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const { error } = await supabase.from("bookings").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
