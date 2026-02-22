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
  guests_count?: any;
  children_count?: any;
  dogs_count?: any;
  vehicle_reg?: string;
  price?: any;
  special_requests?: string;
};

function isOwner() {
  return cookies().get("owner")?.value === "1";
}

// Removes invisible unicode chars that iOS/Safari often injects
function cleanStr(v: any) {
  if (v == null) return "";
  return String(v)
    .replace(/[\u200B-\u200D\uFEFF]/g, "") // zero-width chars
    .replace(/\u00A0/g, " ") // NBSP
    .replace(/[^\S\r\n]+/g, " ") // collapse weird spaces (keep newlines)
    .trim();
}

// Keep only digits and '-' for dates
function cleanDate(v: any) {
  const s = cleanStr(v);
  // remove anything except digits and hyphen
  const t = s.replace(/[^\d-]/g, "");
  // must match YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return "";
  return t;
}

function toNumOrNull(v: any) {
  const s = cleanStr(v);
  if (!s) return null;
  // remove commas and currency symbols
  const t = s.replace(/[,£$]/g, "");
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export async function POST(req: Request) {
  if (!isOwner()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = supabaseServer();
  const body = await req.json().catch(() => ({}));

  const mode: "skip" | "strict" = body.mode === "strict" ? "strict" : "skip";
  const rows: ImportRow[] = Array.isArray(body.rows) ? body.rows : [];

  if (!rows.length) return NextResponse.json({ error: "No rows provided" }, { status: 400 });

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

    const start_date = cleanDate(r.start_date);
    const end_date = cleanDate(r.end_date);
    const status: Status = cleanStr(r.status) === "provisional" ? "provisional" : "confirmed";

    if (!start_date || !end_date) {
      const msg = `Row ${i + 1}: invalid date(s). start_date="${cleanStr(r.start_date)}" end_date="${cleanStr(
        r.end_date
      )}"`;
      if (mode === "strict") return NextResponse.json({ error: msg }, { status: 400 });
      errors.push(msg);
      skipped++;
      continue;
    }

    if (end_date <= start_date) {
      const msg = `Row ${i + 1}: end_date must be after start_date (${start_date} → ${end_date})`;
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
      guest_name: cleanStr(r.guest_name) || null,
      guest_email: cleanStr((r as any).guest_email) || null,
      phone: cleanStr((r as any).phone) || null,
      guests_count: toNumOrNull((r as any).guests_count),
      children_count: toNumOrNull((r as any).children_count),
      dogs_count: toNumOrNull((r as any).dogs_count),
      vehicle_reg: cleanStr((r as any).vehicle_reg) || null,
      price: toNumOrNull((r as any).price),
      special_requests: cleanStr((r as any).special_requests) || null,
    });
  }

  const CHUNK = 200;
  for (let i = 0; i < inserts.length; i += CHUNK) {
    const chunk = inserts.slice(i, i + CHUNK);
    const { error } = await supabase.from("bookings").insert(chunk);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    imported += chunk.length;
  }

  return NextResponse.json({ ok: true, mode, imported, skipped, errors });
}