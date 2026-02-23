import { NextResponse } from "next/server";
import { supabaseServer } from "../../../lib/supabaseServer";
import { overlaps } from "../../../lib/overlap";

function strOrNull(v: any) {
  const s = typeof v === "string" ? v.trim() : String(v ?? "").trim();
  return s ? s : null;
}

function numOrNull(v: any) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

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

  if (!start_date || !end_date) {
    return NextResponse.json({ error: "start_date and end_date are required" }, { status: 400 });
  }

  // overlap check
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

  // ✅ Store EVERYTHING (public form + owner-created)
  const payload: any = {
    start_date,
    end_date,
    guest_name: strOrNull(body.guest_name),
    contact: strOrNull(body.contact),
    notes: strOrNull(body.notes),

    status: strOrNull(body.status) ?? "provisional",

    guest_email: strOrNull(body.guest_email),
    phone: strOrNull(body.phone),
    guests_count: numOrNull(body.guests_count),
    children_count: numOrNull(body.children_count),
    dogs_count: numOrNull(body.dogs_count),
    vehicle_reg: strOrNull(body.vehicle_reg),
    special_requests: strOrNull(body.special_requests),
  };

  const { data, error } = await supabase
    .from("bookings")
    .insert([payload])
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ booking: data });
}

/**
 * ✅ Update any booking fields
 * Body: { id, ...fieldsToUpdate }
 */
export async function PATCH(req: Request) {
  const supabase = supabaseServer();
  const body = await req.json();

  const id = String(body.id || "");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const update: any = {};

  // Only update fields that are provided
  if (body.start_date !== undefined) update.start_date = String(body.start_date || "");
  if (body.end_date !== undefined) update.end_date = String(body.end_date || "");

  if (body.guest_name !== undefined) update.guest_name = strOrNull(body.guest_name);
  if (body.guest_email !== undefined) update.guest_email = strOrNull(body.guest_email);
  if (body.phone !== undefined) update.phone = strOrNull(body.phone);

  if (body.contact !== undefined) update.contact = strOrNull(body.contact);
  if (body.notes !== undefined) update.notes = strOrNull(body.notes);

  if (body.guests_count !== undefined) update.guests_count = numOrNull(body.guests_count);
  if (body.children_count !== undefined) update.children_count = numOrNull(body.children_count);
  if (body.dogs_count !== undefined) update.dogs_count = numOrNull(body.dogs_count);

  if (body.vehicle_reg !== undefined) update.vehicle_reg = strOrNull(body.vehicle_reg);
  if (body.special_requests !== undefined) update.special_requests = strOrNull(body.special_requests);

  if (body.status !== undefined) update.status = strOrNull(body.status);

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No fields provided to update" }, { status: 400 });
  }

  // If dates are changing, re-check overlap (excluding itself)
  if (update.start_date || update.end_date) {
    const { data: others, error: otherErr } = await supabase
      .from("bookings")
      .select("id,start_date,end_date")
      .neq("id", id);

    if (otherErr) return NextResponse.json({ error: otherErr.message }, { status: 500 });

    const checkB = {
      start_date: update.start_date ?? body._existing_start_date,
      end_date: update.end_date ?? body._existing_end_date,
    };

    if (!checkB.start_date || !checkB.end_date) {
      // If caller didn't send existing values, fetch them
      const { data: cur, error: curErr } = await supabase
        .from("bookings")
        .select("start_date,end_date")
        .eq("id", id)
        .single();

      if (curErr) return NextResponse.json({ error: curErr.message }, { status: 500 });
      checkB.start_date = update.start_date ?? cur.start_date;
      checkB.end_date = update.end_date ?? cur.end_date;
    }

    const conflict = (others ?? []).some((b: any) => overlaps(checkB as any, b as any));
    if (conflict) {
      return NextResponse.json(
        { error: "Updated dates overlap an existing booking (same-day checkout/checkin is allowed)." },
        { status: 409 }
      );
    }
  }

  const { data, error } = await supabase
    .from("bookings")
    .update(update)
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
