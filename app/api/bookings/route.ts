import { NextResponse } from "next/server";
import { supabaseServer } from "../../../lib/supabaseServer";
import { overlaps } from "../../../lib/overlap";
import { sendOwnerNotification } from "../../../lib/email"; 

type BookingRow = {
  id: string;
  start_date: string;
  end_date: string; // checkout day
  status: "provisional" | "confirmed";
  guest_name: string | null;
  guest_email: string | null;
  phone: string | null;
  contact: string | null;
  notes: string | null;
  guests_count: number | null;
  children_count: number | null;
  dogs_count: number | null;
  vehicle_reg: string | null;
  special_requests: string | null;
  created_at: string;
};

function isAuthorized(req: Request) {
  const auth = req.headers.get("authorization");
  const bearer = process.env.OWNER_API_TOKEN;

  if (!bearer) return true; // avoids locking you out if token not set yet
  if (!auth) return false;

  return auth === `Bearer ${bearer}`;
}

export async function GET() {
  const supabase = supabaseServer();

  const { data, error } = await supabase
    .from("bookings")
    .select("*")
    .order("start_date", { ascending: true });

  if (error) {
  return NextResponse.json({ error: error.message }, { status: 500 });
}

await sendOwnerNotification(data);

return NextResponse.json({ booking: data });

export async function POST(req: Request) {
  const supabase = supabaseServer();
  const body = await req.json();

  const start_date = String(body.start_date || "");
  const end_date = String(body.end_date || "");
  const guest_name = body.guest_name ? String(body.guest_name) : null;
  const guest_email = body.guest_email ? String(body.guest_email) : null;
  const phone = body.phone ? String(body.phone) : null;
  const contact = body.contact ? String(body.contact) : null;
  const notes = body.notes ? String(body.notes) : null;
  const guests_count =
    body.guests_count === undefined || body.guests_count === null || body.guests_count === ""
      ? null
      : Number(body.guests_count);
  const children_count =
    body.children_count === undefined || body.children_count === null || body.children_count === ""
      ? null
      : Number(body.children_count);
  const dogs_count =
    body.dogs_count === undefined || body.dogs_count === null || body.dogs_count === ""
      ? null
      : Number(body.dogs_count);
  const vehicle_reg = body.vehicle_reg ? String(body.vehicle_reg) : null;
  const special_requests = body.special_requests ? String(body.special_requests) : null;

  // public booking form defaults to provisional
  const requestedStatus = body.status ? String(body.status) : "provisional";
  const status: "provisional" | "confirmed" =
    requestedStatus === "confirmed" && isAuthorized(req) ? "confirmed" : "provisional";

  if (!start_date || !end_date) {
    return NextResponse.json(
      { error: "start_date and end_date are required" },
      { status: 400 }
    );
  }

  const { data: existing, error: readErr } = await supabase
    .from("bookings")
    .select("id,start_date,end_date,status");

  if (readErr) {
    return NextResponse.json({ error: readErr.message }, { status: 500 });
  }

  const newBooking = { start_date, end_date };

  const conflict = (existing ?? []).some((b: any) =>
    overlaps(newBooking as any, {
      start_date: b.start_date,
      end_date: b.end_date,
    } as any)
  );

  if (conflict) {
    return NextResponse.json(
      {
        error:
          "Booking overlaps an existing booking (same-day checkout/check-in is allowed).",
      },
      { status: 409 }
    );
  }

  const { data, error } = await supabase
    .from("bookings")
    .insert([
      {
        start_date,
        end_date,
        status,
        guest_name,
        guest_email,
        phone,
        contact,
        notes,
        guests_count,
        children_count,
        dogs_count,
        vehicle_reg,
        special_requests,
      },
    ])
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ booking: data });
}

export async function PATCH(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = supabaseServer();
  const body = await req.json();

  const id = String(body.id || "");
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const patch: Record<string, any> = {
    start_date: body.start_date,
    end_date: body.end_date,
    status: body.status,
    guest_name: body.guest_name,
    guest_email: body.guest_email,
    phone: body.phone,
    contact: body.contact,
    notes: body.notes,
    guests_count: body.guests_count,
    children_count: body.children_count,
    dogs_count: body.dogs_count,
    vehicle_reg: body.vehicle_reg,
    special_requests: body.special_requests,
  };

  Object.keys(patch).forEach((key) => {
    if (patch[key] === undefined) delete patch[key];
  });

  const { data, error } = await supabase
    .from("bookings")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ booking: data });
}

export async function DELETE(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = supabaseServer();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const { error } = await supabase.from("bookings").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}