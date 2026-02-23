"use client";

import React, { useEffect, useMemo, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { DateSelectArg, EventClickArg } from "@fullcalendar/core";

type Booking = {
  id: string;
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD (checkout day, NOT booked)
  status?: "provisional" | "confirmed" | null;

  guest_name: string | null;
  guest_email?: string | null;
  phone?: string | null;

  contact?: string | null;
  notes?: string | null;

  guests_count?: number | null;
  children_count?: number | null;
  dogs_count?: number | null;

  vehicle_reg?: string | null;
  special_requests?: string | null;

  created_at?: string;
};

type Rate = {
  id: string;
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD exclusive
  price: number;
  rate_type: "nightly" | "total";
  note?: string | null;
};

type Editor =
  | { type: "booking"; booking: Booking; draft: Partial<Booking>; saving?: boolean; err?: string }
  | { type: "rate"; rate: Rate; draft: Partial<Rate>; saving?: boolean; err?: string }
  | null;

function isoLocal(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function eachDay(startISO: string, endISO: string) {
  // days in [startISO, endISO) - end is exclusive
  const out: string[] = [];
  const start = new Date(`${startISO}T00:00:00Z`);
  const end = new Date(`${endISO}T00:00:00Z`);
  for (let d = new Date(start); d < end; d.setUTCDate(d.getUTCDate() + 1)) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

function fmtRange(start: string, end: string) {
  return `${start} → ${end}`;
}

function calcBookingPrice(startISO: string, endISO: string, rates: Rate[]) {
  // 1) exact TOTAL match
  const exactTotal = rates.find(
    (r) => r.rate_type === "total" && r.start_date === startISO && r.end_date === endISO
  );
  if (exactTotal) {
    return { ok: true as const, total: Number(exactTotal.price), method: "total" as const };
  }

  // 2) sum nightly across [start,end)
  const nights = eachDay(startISO, endISO);
  let total = 0;

  for (const day of nights) {
    const nightly = rates.find(
      (r) => r.rate_type === "nightly" && r.start_date <= day && day < r.end_date
    );
    if (!nightly) return { ok: false as const, total: null, method: "missing" as const };
    total += Number(nightly.price);
  }

  return { ok: true as const, total, method: "nightly" as const };
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "grid", gap: 6, marginTop: 10 }}>
      <span style={{ fontSize: 12, opacity: 0.75 }}>{label}</span>
      {children}
    </label>
  );
}

export default function Dashboard() {
  const [mode, setMode] = useState<"bookings" | "pricing">("bookings");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [rates, setRates] = useState<Rate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editor, setEditor] = useState<Editor>(null);

  async function loadAll() {
    setLoading(true);
    const [bRes, rRes] = await Promise.all([fetch("/api/bookings"), fetch("/api/rates")]);
    const [bJson, rJson] = await Promise.all([bRes.json(), rRes.json()]);
    setBookings(bJson.bookings ?? []);
    setRates(rJson.rates ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function onSelect(sel: DateSelectArg) {
    const start_date = isoLocal(sel.start);
    const end_date = isoLocal(sel.end); // FullCalendar select end is exclusive

    if (mode === "bookings") {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          start_date,
          end_date,
          status: "confirmed",
          guest_name: "New booking",
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        alert(json?.error || "Could not create booking");
        return;
      }
      await loadAll();
      const created: Booking | undefined = json.booking;
      if (created?.id) setEditor({ type: "booking", booking: created, draft: { ...created } });
      return;
    }

    // Pricing mode - creates a draft rate block
    setEditor({
      type: "rate",
      rate: { id: "", start_date, end_date, price: 0, rate_type: "total", note: null },
      draft: { start_date, end_date, price: 0, rate_type: "total", note: "" },
    });
  }

  function onEventClick(arg: EventClickArg) {
    const ext = arg.event.extendedProps as any;

    if (ext.kind === "booking") {
      const b: Booking = ext.booking;
      setEditor({ type: "booking", booking: b, draft: { ...b } });
      return;
    }
    if (ext.kind === "rate") {
      const r: Rate = ext.rate;
      setEditor({ type: "rate", rate: r, draft: { ...r } });
      return;
    }
  }

  async function saveBooking() {
    if (!editor || editor.type !== "booking") return;
    const d = editor.draft;

    if (!String(d.guest_name ?? "").trim()) {
      setEditor({ ...editor, err: "Guest name is required." });
      return;
    }

    setEditor({ ...editor, saving: true, err: "" });

    const res = await fetch("/api/bookings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: editor.booking.id,
        start_date: d.start_date,
        end_date: d.end_date,
        status: d.status ?? "provisional",

        guest_name: d.guest_name,
        guest_email: d.guest_email,
        phone: d.phone,

        contact: d.contact,
        notes: d.notes,

        guests_count: d.guests_count,
        children_count: d.children_count,
        dogs_count: d.dogs_count,

        vehicle_reg: d.vehicle_reg,
        special_requests: d.special_requests,
      }),
    });

    const json = await res.json();
    if (!res.ok) {
      setEditor({ ...editor, saving: false, err: json?.error || "Could not save booking" });
      return;
    }

    setEditor(null);
    await loadAll();
  }

  async function deleteBooking(id: string) {
    if (!confirm("Delete this booking?")) return;
    await fetch(`/api/bookings?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    setEditor(null);
    await loadAll();
  }

  async function saveRate() {
    if (!editor || editor.type !== "rate") return;

    const start_date = String(editor.draft.start_date ?? editor.rate.start_date ?? "");
    const end_date = String(editor.draft.end_date ?? editor.rate.end_date ?? "");
    const price = Number(editor.draft.price ?? 0);
    const rate_type = (editor.draft.rate_type ?? "total") as "nightly" | "total";
    const note = String(editor.draft.note ?? "");

    if (!start_date || !end_date) {
      setEditor({ ...editor, err: "Start and end dates are required." });
      return;
    }
    if (!Number.isFinite(price) || price < 0) {
      setEditor({ ...editor, err: "Enter a valid price." });
      return;
    }

    setEditor({ ...editor, saving: true, err: "" });

    // If editing an existing rate, delete it and re-insert
    if (editor.rate.id) {
      await fetch(`/api/rates?id=${encodeURIComponent(editor.rate.id)}`, { method: "DELETE" });
    }

    const res = await fetch("/api/rates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ start_date, end_date, price, rate_type, note: note || null }),
    });

    const json = await res.json();
    if (!res.ok) {
      setEditor({ ...editor, saving: false, err: json?.error || "Could not save rate" });
      return;
    }

    setEditor(null);
    await loadAll();
  }

  async function deleteRate(id: string) {
    if (!confirm("Delete this price block?")) return;
    await fetch(`/api/rates?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    setEditor(null);
    await loadAll();
  }

  // --- HALF-DAY MARKERS (check-in / checkout) ---
  const markers = useMemo(() => {
    const confirmedFull = new Set<string>();
    const provisionalFull = new Set<string>();

    const inConfirmed = new Set<string>();
    const inProvisional = new Set<string>();

    const outConfirmed = new Set<string>();
    const outProvisional = new Set<string>();

    for (const b of bookings) {
      const days = eachDay(b.start_date, b.end_date); // booked nights
      const status = (b.status ?? "confirmed") as "confirmed" | "provisional";

      if (status === "confirmed") {
        days.forEach((d) => confirmedFull.add(d));
        inConfirmed.add(b.start_date);
        outConfirmed.add(b.end_date); // checkout day
      } else {
        days.forEach((d) => provisionalFull.add(d));
        inProvisional.add(b.start_date);
        outProvisional.add(b.end_date);
      }
    }

    return { confirmedFull, provisionalFull, inConfirmed, inProvisional, outConfirmed, outProvisional };
  }, [bookings]);

  const dayCellClassNames = (info: any) => {
    const d = info.date.toISOString().slice(0, 10);
    const classes: string[] = [];

    if (markers.confirmedFull.has(d)) classes.push("day-confirmed");
    else if (markers.provisionalFull.has(d)) classes.push("day-provisional");
    else classes.push("day-available");

    if (markers.inConfirmed.has(d)) classes.push("in-confirmed");
    if (markers.inProvisional.has(d)) classes.push("in-provisional");
    if (markers.outConfirmed.has(d)) classes.push("out-confirmed");
    if (markers.outProvisional.has(d)) classes.push("out-provisional");

    return classes;
  };

  const events = useMemo(() => {
    const rateEvents = rates.map((r) => ({
      id: `rate-${r.id}`,
      title: r.rate_type === "nightly" ? `£${r.price}/night` : `£${r.price} total`,
      start: r.start_date,
      end: r.end_date,
      backgroundColor: "rgba(34,197,94,0.18)",
      borderColor: "rgba(34,197,94,0.45)",
      textColor: "#0f5132",
      extendedProps: { kind: "rate", rate: r },
    }));

    const bookingEvents = bookings.map((b) => {
      const status = (b.status ?? "confirmed") as "confirmed" | "provisional";
      const color = status === "confirmed" ? "#ef4444" : "#f59e0b";
      return {
        id: `booking-${b.id}`,
        title: b.guest_name ?? "Booking",
        start: b.start_date,
        end: b.end_date,
        backgroundColor: color,
        borderColor: color,
        textColor: "#111",
        extendedProps: { kind: "booking", booking: b },
      };
    });

    return [...rateEvents, ...bookingEvents];
  }, [rates, bookings]);

  const upcoming = useMemo(() => {
    const copy = [...bookings];
    copy.sort((a, b) => (a.start_date > b.start_date ? 1 : -1));
    return copy;
  }, [bookings]);

  const bookingPriceMap = useMemo(() => {
    const map = new Map<string, { ok: boolean; total: number | null; method: string }>();
    for (const b of bookings) {
      const p = calcBookingPrice(b.start_date, b.end_date, rates);
      map.set(b.id, { ok: p.ok, total: p.total, method: p.method });
    }
    return map;
  }, [bookings, rates]);

  return (
    <div style={styles.page}>
      <style>{`
        .fc .fc-daygrid-day.day-available .fc-daygrid-day-frame { background: rgba(34,197,94,0.10); }
        .fc .fc-daygrid-day.day-confirmed .fc-daygrid-day-frame { background: rgba(239,68,68,0.12); }
        .fc .fc-daygrid-day.day-provisional .fc-daygrid-day-frame { background: rgba(245,158,11,0.14); }

        .fc .fc-daygrid-day-frame {
          border-radius: 10px;
          overflow: hidden;
          position: relative;
        }

        .fc .fc-daygrid-day-frame::after {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          border-radius: 10px;
          background: linear-gradient(
            90deg,
            var(--leftOverlay, transparent) 0%,
            var(--leftOverlay, transparent) 50%,
            var(--rightOverlay, transparent) 50%,
            var(--rightOverlay, transparent) 100%
          );
        }

        .fc .fc-daygrid-day.out-confirmed { --leftOverlay: rgba(239,68,68,0.26); }
        .fc .fc-daygrid-day.in-confirmed  { --rightOverlay: rgba(239,68,68,0.26); }

        .fc .fc-daygrid-day.out-provisional { --leftOverlay: rgba(245,158,11,0.28); }
        .fc .fc-daygrid-day.in-provisional  { --rightOverlay: rgba(245,158,11,0.28); }

        .fc .fc-daygrid-day-top,
        .fc .fc-daygrid-day-events { position: relative; z-index: 1; }
      `}</style>

      <div style={styles.header}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22 }}>Caravan Dashboard</h1>
          <div style={{ opacity: 0.75, marginTop: 6 }}>
            {mode === "bookings"
              ? "Bookings mode: drag to add booking • click booking to edit."
              : "Pricing mode: drag to add price block • click price to edit/delete."}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setMode("bookings")} style={{ ...styles.tab, ...(mode === "bookings" ? styles.tabOn : {}) }}>
            Bookings
          </button>
          <button onClick={() => setMode("pricing")} style={{ ...styles.tab, ...(mode === "pricing" ? styles.tabOn : {}) }}>
            Pricing
          </button>
          <button onClick={loadAll} style={styles.tab}>
            Refresh
          </button>
        </div>
      </div>

      <div style={styles.layout}>
        <div style={{ display: "grid", gap: 14 }}>
          <div style={styles.card}>
            {loading ? (
              <div style={{ padding: 18 }}>Loading…</div>
            ) : (
              <FullCalendar
                plugins={[dayGridPlugin, interactionPlugin]}
                initialView="dayGridMonth"
                selectable
                selectMirror
                unselectAuto
                select={onSelect}
                eventClick={onEventClick}
                events={events}
                height="auto"
                dayCellClassNames={dayCellClassNames}
              />
            )}
          </div>

          <div style={styles.card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <h2 style={{ margin: 0, fontSize: 16 }}>Bookings (quick view)</h2>
              <div style={{ fontSize: 12, opacity: 0.7 }}>{upcoming.length} total</div>
            </div>

            {upcoming.length === 0 ? (
              <div style={{ marginTop: 10, opacity: 0.75 }}>No bookings yet.</div>
            ) : (
              <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                {upcoming.map((b) => {
                  const status = (b.status ?? "confirmed") as "confirmed" | "provisional";
                  const pill =
                    status === "confirmed"
                      ? { bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.35)", text: "#b91c1c", label: "Confirmed" }
                      : { bg: "rgba(245,158,11,0.14)", border: "rgba(245,158,11,0.4)", text: "#92400e", label: "Provisional" };

                  const price = bookingPriceMap.get(b.id);
                  const priceBadge =
                    price?.ok && typeof price.total === "number"
                      ? { label: `£${price.total}`, ok: true }
                      : { label: "Price not set", ok: false };

                  return (
                    <button
                      key={b.id}
                      onClick={() => setEditor({ type: "booking", booking: b, draft: { ...b } })}
                      style={{
                        textAlign: "left",
                        width: "100%",
                        border: "1px solid #eee",
                        background: "white",
                        borderRadius: 12,
                        padding: 12,
                        cursor: "pointer",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                        <div>
                          <div style={{ fontWeight: 900, marginBottom: 2 }}>{b.guest_name || "Booking"}</div>
                          <div style={{ fontSize: 13, opacity: 0.75 }}>{fmtRange(b.start_date, b.end_date)}</div>
                        </div>

                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <div
                            style={{
                              fontSize: 12,
                              fontWeight: 900,
                              padding: "6px 10px",
                              borderRadius: 999,
                              border: `1px solid ${priceBadge.ok ? "rgba(34,197,94,0.45)" : "rgba(0,0,0,0.12)"}`,
                              background: priceBadge.ok ? "rgba(34,197,94,0.12)" : "rgba(0,0,0,0.04)",
                              color: priceBadge.ok ? "#14532d" : "rgba(0,0,0,0.55)",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {priceBadge.label}
                          </div>

                          <div
                            style={{
                              fontSize: 12,
                              fontWeight: 800,
                              padding: "6px 10px",
                              borderRadius: 999,
                              border: `1px solid ${pill.border}`,
                              background: pill.bg,
                              color: pill.text,
                              whiteSpace: "nowrap",
                            }}
                          >
                            {pill.label}
                          </div>
                        </div>
                      </div>

                      <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap", fontSize: 12, opacity: 0.8 }}>
                        {typeof b.guests_count === "number" && <span>👤 Guests: {b.guests_count}</span>}
                        {typeof b.dogs_count === "number" && <span>🐶 Dogs: {b.dogs_count}</span>}
                        {b.phone && <span>📞 {b.phone}</span>}
                        {b.guest_email && <span>✉️ {b.guest_email}</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div style={styles.sideCard}>
          <div style={{ fontWeight: 900, marginBottom: 10 }}>
            {editor?.type === "rate" ? "Price editor" : "Booking editor"}
          </div>

          {!editor && <div style={{ opacity: 0.75, fontSize: 13 }}>Click a booking or price block to edit it.</div>}

          {editor?.type === "rate" && (
            <>
              <Field label="Start date">
                <input
                  style={styles.input}
                  type="date"
                  value={String(editor.draft.start_date ?? editor.rate.start_date ?? "")}
                  onChange={(e) => setEditor({ ...editor, draft: { ...editor.draft, start_date: e.target.value } })}
                />
              </Field>

              <Field label="End date (exclusive)">
                <input
                  style={styles.input}
                  type="date"
                  value={String(editor.draft.end_date ?? editor.rate.end_date ?? "")}
                  onChange={(e) => setEditor({ ...editor, draft: { ...editor.draft, end_date: e.target.value } })}
                />
              </Field>

              <Field label="Rate type">
                <select
                  style={styles.input}
                  value={String(editor.draft.rate_type ?? editor.rate.rate_type ?? "total")}
                  onChange={(e) => setEditor({ ...editor, draft: { ...editor.draft, rate_type: e.target.value as any } })}
                >
                  <option value="total">Total</option>
                  <option value="nightly">Nightly</option>
                </select>
              </Field>

              <Field label="Price (£)">
                <input
                  style={styles.input}
                  type="number"
                  min={0}
                  value={Number(editor.draft.price ?? editor.rate.price ?? 0)}
                  onChange={(e) => setEditor({ ...editor, draft: { ...editor.draft, price: Number(e.target.value) } })}
                />
              </Field>

              <Field label="Note (optional)">
                <input
                  style={styles.input}
                  value={String(editor.draft.note ?? editor.rate.note ?? "")}
                  onChange={(e) => setEditor({ ...editor, draft: { ...editor.draft, note: e.target.value } })}
                />
              </Field>

              {editor.err && <div style={styles.err}>{editor.err}</div>}

              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button style={styles.primaryBtn} onClick={saveRate} disabled={editor.saving}>
                  {editor.saving ? "Saving…" : "Save price"}
                </button>

                {editor.rate.id ? (
                  <button style={styles.dangerBtn} onClick={() => deleteRate(editor.rate.id)} disabled={editor.saving}>
                    Delete
                  </button>
                ) : (
                  <button style={styles.subBtn} onClick={() => setEditor(null)} disabled={editor.saving}>
                    Cancel
                  </button>
                )}
              </div>
            </>
          )}

          {editor?.type === "booking" && (
            <>
              <div style={styles.grid2}>
                <Field label="Arrival">
                  <input
                    style={styles.input}
                    type="date"
                    value={String(editor.draft.start_date ?? "")}
                    onChange={(e) => setEditor({ ...editor, draft: { ...editor.draft, start_date: e.target.value } })}
                  />
                </Field>
                <Field label="Checkout">
                  <input
                    style={styles.input}
                    type="date"
                    value={String(editor.draft.end_date ?? "")}
                    onChange={(e) => setEditor({ ...editor, draft: { ...editor.draft, end_date: e.target.value } })}
                  />
                </Field>
              </div>

              <Field label="Status">
                <select
                  style={styles.input}
                  value={String(editor.draft.status ?? "provisional")}
                  onChange={(e) => setEditor({ ...editor, draft: { ...editor.draft, status: e.target.value as any } })}
                >
                  <option value="provisional">Provisional</option>
                  <option value="confirmed">Confirmed</option>
                </select>
              </Field>

              <div style={styles.hr} />

              <Field label="Guest name">
                <input
                  style={styles.input}
                  value={String(editor.draft.guest_name ?? "")}
                  onChange={(e) => setEditor({ ...editor, draft: { ...editor.draft, guest_name: e.target.value } })}
                />
              </Field>

              <div style={styles.grid2}>
                <Field label="Email">
                  <input
                    style={styles.input}
                    value={String(editor.draft.guest_email ?? "")}
                    onChange={(e) => setEditor({ ...editor, draft: { ...editor.draft, guest_email: e.target.value } })}
                  />
                </Field>
                <Field label="Phone">
                  <input
                    style={styles.input}
                    value={String(editor.draft.phone ?? "")}
                    onChange={(e) => setEditor({ ...editor, draft: { ...editor.draft, phone: e.target.value } })}
                  />
                </Field>
              </div>

              <div style={styles.grid2}>
                <Field label="Guests">
                  <input
                    style={styles.input}
                    type="number"
                    min={1}
                    max={8}
                    value={Number(editor.draft.guests_count ?? 0)}
                    onChange={(e) => setEditor({ ...editor, draft: { ...editor.draft, guests_count: Number(e.target.value) } })}
                  />
                </Field>
                <Field label="Children">
                  <input
                    style={styles.input}
                    type="number"
                    min={0}
                    max={8}
                    value={Number(editor.draft.children_count ?? 0)}
                    onChange={(e) =>
                      setEditor({ ...editor, draft: { ...editor.draft, children_count: Number(e.target.value) } })
                    }
                  />
                </Field>
              </div>

              <div style={styles.grid2}>
                <Field label="Dogs">
                  <input
                    style={styles.input}
                    type="number"
                    min={0}
                    max={5}
                    value={Number(editor.draft.dogs_count ?? 0)}
                    onChange={(e) => setEditor({ ...editor, draft: { ...editor.draft, dogs_count: Number(e.target.value) } })}
                  />
                </Field>
                <Field label="Vehicle reg">
                  <input
                    style={styles.input}
                    value={String(editor.draft.vehicle_reg ?? "")}
                    onChange={(e) => setEditor({ ...editor, draft: { ...editor.draft, vehicle_reg: e.target.value } })}
                  />
                </Field>
              </div>

              <Field label="Special requests">
                <textarea
                  style={{ ...styles.input, minHeight: 80, resize: "vertical" }}
                  value={String(editor.draft.special_requests ?? "")}
                  onChange={(e) =>
                    setEditor({ ...editor, draft: { ...editor.draft, special_requests: e.target.value } })
                  }
                />
              </Field>

              <Field label="Owner notes">
                <textarea
                  style={{ ...styles.input, minHeight: 70, resize: "vertical" }}
                  value={String(editor.draft.notes ?? "")}
                  onChange={(e) => setEditor({ ...editor, draft: { ...editor.draft, notes: e.target.value } })}
                />
              </Field>

              {editor.err && <div style={styles.err}>{editor.err}</div>}

              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button style={styles.primaryBtn} onClick={saveBooking} disabled={editor.saving}>
                  {editor.saving ? "Saving…" : "Save changes"}
                </button>
                <button style={styles.dangerBtn} onClick={() => deleteBooking(editor.booking.id)} disabled={editor.saving}>
                  Delete
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    padding: 18,
    maxWidth: 1200,
    margin: "0 auto",
    fontFamily:
      "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, Apple Color Emoji, Segoe UI Emoji",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 12,
  },
  layout: {
    display: "grid",
    gridTemplateColumns: "1fr 380px",
    gap: 14,
    alignItems: "start",
  },
  card: {
    background: "white",
    border: "1px solid #e6e6e6",
    borderRadius: 14,
    padding: 12,
  },
  sideCard: {
    background: "white",
    border: "1px solid #e6e6e6",
    borderRadius: 14,
    padding: 14,
  },
  tab: {
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #ddd",
    background: "white",
    cursor: "pointer",
    fontWeight: 700,
  },
  tabOn: {
    background: "#111",
    color: "white",
    borderColor: "#111",
  },
  input: {
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #ddd",
    fontSize: 14,
    outline: "none",
  },
  grid2: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
  },
  hr: {
    height: 1,
    background: "#eee",
    margin: "14px 0 4px",
  },
  primaryBtn: {
    padding: "11px 12px",
    borderRadius: 12,
    border: "1px solid #111",
    background: "#111",
    color: "white",
    cursor: "pointer",
    fontWeight: 800,
    flex: 1,
  },
  dangerBtn: {
    padding: "11px 12px",
    borderRadius: 12,
    border: "1px solid #ef4444",
    background: "white",
    color: "#ef4444",
    cursor: "pointer",
    fontWeight: 800,
  },
  subBtn: {
    padding: "11px 12px",
    borderRadius: 12,
    border: "1px solid #ddd",
    background: "white",
    cursor: "pointer",
    fontWeight: 800,
  },
  err: {
    marginTop: 10,
    padding: 10,
    borderRadius: 10,
    border: "1px solid #ffd0d0",
    background: "#fff3f3",
    color: "#b91c1c",
    fontWeight: 700,
  },
};