import { NextResponse } from "next/server";
import { supabaseServer } from "../../../lib/supabaseServer";
import { overlaps } from "../../../lib/overlap";

type BookingRow = {
  id: string;
  start_date: string; // YYYY-MM-DD
  end_date: string;   // YYYY-MM-DD (exclusive)
  guest_name: string | null;
  contact: string | null;
  notes: string | null;
  status?: string | null; // optional if your table has it
  created_at: string;
};

export async function GET() {
  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("bookings")
    .select("*")
    .order("start_date", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ bookings: data ?? [] });
}

export async function POST(req: Request) {
  const supabase = supabaseServer();
  const body = await req.json();

  const start_date = String(body.start_date || "");
  const end_date = String(body.end_date || "");
  const guest_name = body.guest_name ?? null;
  const contact = body.contact ?? null;
  const notes = body.notes ?? null;
  const status = body.status ?? null;

  if (!start_date || !end_date) {
    return NextResponse.json({ error: "start_date and end_date are required" }, { status: 400 });
  }

  // Fetch existing bookings to check overlap
  const { data: existing, error: readErr } = await supabase
    .from("bookings")
    .select("id,start_date,end_date");

  if (readErr) return NextResponse.json({ error: readErr.message }, { status: 500 });

  const newB = { start_date, end_date };
  const conflict = (existing ?? []).some((b: any) => overlaps(newB as any, b as any));

  if (conflict) {
    return NextResponse.json(
      { error: "Booking overlaps an existing booking (same-day checkout/checkin is allowed)." },
      { status: 409 }
    );
  }

  const insertPayload: any = { start_date, end_date, guest_name, contact, notes };
  // only include status if provided (and your table has the column)
  if (status !== null && status !== undefined) insertPayload.status = status;

  const { data, error } = await supabase
    .from("bookings")
    .insert([insertPayload])
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ booking: data });
}

/**
 * ✅ NEW: Update a booking (used by the sidebar editor)
 * Request body: { id, guest_name?, contact?, notes?, status? }
 */
export async function PATCH(req: Request) {
  const supabase = supabaseServer();
  const body = await req.json();

  const id = String(body.id || "");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  // Build update payload only from provided fields
  const updatePayload: any = {};
  if (body.guest_name !== undefined) updatePayload.guest_name = body.guest_name;
  if (body.contact !== undefined) updatePayload.contact = body.contact;
  if (body.notes !== undefined) updatePayload.notes = body.notes;
  if (body.status !== undefined) updatePayload.status = body.status;

  if (Object.keys(updatePayload).length === 0) {
    return NextResponse.json({ error: "No fields provided to update" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("bookings")
    .update(updatePayload)
    .eq("id", id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ booking: data, ok: true });
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
