import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseServer } from "../../../lib/supabaseServer";
import { overlaps } from "../../../lib/overlap";

type Status = "provisional" | "confirmed";

type ImportRow = {
  start_date: string;
  end_date: string;
  status?: Status;
  guest_name?: string;
  guest_email?: string;
  phone?: string;
  guests_count?: number | "";
  children_count?: number | "";
  dogs_count?: number | "";
  vehicle_reg?: string;
  price?: number | "";
  special_requests?: string;
};

function isOwner() {
  return cookies().get("owner")?.value === "1";
}

export async function POST(req: Request) {
  if (!isOwner()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = supabaseServer();
  const body = await req.json().catch(() => ({}));

  const mode: "skip" | "strict" = body.mode === "strict" ? "strict" : "skip";
  const rows: ImportRow[] = Array.isArray(body.rows) ? body.rows : [];

  if (!rows.length) {
    return NextResponse.json({ error: "No rows provided" }, { status: 400 });
  }

  // Existing confirmed bookings (only these block overlaps)
  const { data: existing, error: readErr } = await supabase
    .from("bookings")
    .select("id,start_date,end_date")
    .eq("status", "confirmed");

  if (readErr) return NextResponse.json({ error: readErr.message }, { status: 500 });

  const confirmedExisting = existing ?? [];
  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  const inserts: any[] = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];

    const start_date = String(r.start_date || "");
    const end_date = String(r.end_date || "");
    const status: Status = r.status === "provisional" ? "provisional" : "confirmed";

    if (!start_date || !end_date) {
      const msg = `Row ${i + 1}: start_date and end_date are required`;
      if (mode === "strict") return NextResponse.json({ error: msg }, { status: 400 });
      errors.push(msg);
      skipped++;
      continue;
    }
    if (end_date <= start_date) {
      const msg = `Row ${i + 1}: end_date must be after start_date`;
      if (mode === "strict") return NextResponse.json({ error: msg }, { status: 400 });
      errors.push(msg);
      skipped++;
      continue;
    }

    if (status === "confirmed") {
      const newB = { start_date, end_date };
      const conflict = confirmedExisting.some((b: any) => overlaps(newB as any, b as any));
      if (conflict) {
        const msg = `Row ${i + 1}: overlaps an existing confirmed booking (${start_date} → ${end_date})`;
        if (mode === "strict") return NextResponse.json({ error: msg }, { status: 409 });
        errors.push(msg);
        skipped++;
        continue;
      }
      confirmedExisting.push({ start_date, end_date });
    }

    inserts.push({
      start_date,
      end_date,
      status,
      guest_name: r.guest_name || null,
      guest_email: r.guest_email || null,
      phone: r.phone || null,
      guests_count: r.guests_count === "" || r.guests_count == null ? null : Number(r.guests_count),
      children_count: r.children_count === "" || r.children_count == null ? null : Number(r.children_count),
      dogs_count: r.dogs_count === "" || r.dogs_count == null ? null : Number(r.dogs_count),
      vehicle_reg: r.vehicle_reg || null,
      price: r.price === "" || r.price == null ? null : Number(r.price),
      special_requests: r.special_requests || null,
    });
  }

  // Chunk inserts
  const CHUNK = 200;
  for (let i = 0; i < inserts.length; i += CHUNK) {
    const chunk = inserts.slice(i, i + CHUNK);
    const { error } = await supabase.from("bookings").insert(chunk);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    imported += chunk.length;
  }

  return NextResponse.json({ ok: true, mode, imported, skipped, errors });
}