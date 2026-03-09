"use client";

import React, { useEffect, useMemo, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin, {
  DateClickArg,
} from "@fullcalendar/interaction";
import type { DateSelectArg } from "@fullcalendar/core";

type Booking = {
  id: string;
  start_date: string;
  end_date: string; // checkout day
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
  start_date: string;
  end_date: string; // exclusive
  price: number;
  rate_type: "nightly" | "total";
  note?: string | null;
};

type Editor =
  | {
      type: "booking";
      booking: Booking;
      draft: Partial<Booking>;
      saving?: boolean;
      err?: string;
    }
  | {
      type: "rate";
      rate: Rate;
      draft: Partial<Rate>;
      saving?: boolean;
      err?: string;
    }
  | null;

type TileState =
  | "empty"
  | "available"
  | "confirmed"
  | "provisional"
  | "confirmed-checkin"
  | "confirmed-checkout"
  | "provisional-checkin"
  | "provisional-checkout";

type TileMeta = {
  state: TileState;
  bookingName?: string;
  price?: string;
};

function isoLocal(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function eachDay(startISO: string, endISO: string) {
  const out: string[] = [];
  const start = new Date(`${startISO}T00:00:00`);
  const end = new Date(`${endISO}T00:00:00`);
  for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
    out.push(isoLocal(d));
  }
  return out;
}

function fmtRange(start: string, end: string) {
  return `${start} → ${end}`;
}

function calcBookingPrice(startISO: string, endISO: string, rates: Rate[]) {
  const exactTotal = rates.find(
    (r) =>
      r.rate_type === "total" &&
      r.start_date === startISO &&
      r.end_date === endISO
  );
  if (exactTotal) {
    return { ok: true as const, total: Number(exactTotal.price), method: "total" as const };
  }

  const nights = eachDay(startISO, endISO);
  let total = 0;

  for (const day of nights) {
    const nightly = rates.find(
      (r) =>
        r.rate_type === "nightly" &&
        r.start_date <= day &&
        day < r.end_date
    );
    if (!nightly) return { ok: false as const, total: null, method: "missing" as const };
    total += Number(nightly.price);
  }

  return { ok: true as const, total, method: "nightly" as const };
}

function getDailyDisplayPrice(day: string, rates: Rate[]) {
  const nightly = rates.find(
    (r) =>
      r.rate_type === "nightly" &&
      r.start_date <= day &&
      day < r.end_date
  );
  if (nightly) return `£${Number(nightly.price)}`;

  const total = rates.find(
    (r) =>
      r.rate_type === "total" &&
      r.start_date <= day &&
      day < r.end_date
  );
  if (total) return `£${Number(total.price)}`;

  return "";
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
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
    const [bRes, rRes] = await Promise.all([
      fetch("/api/bookings"),
      fetch("/api/rates"),
    ]);
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
    const end_date = isoLocal(sel.end);

    if (mode === "bookings") {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ start_date, end_date, status: "confirmed", guest_name: "New booking" }),
      });
      const json = await res.json();
      if (!res.ok) {
        alert(json?.error || "Could not create booking");
        return;
      }
      await loadAll();
      const created: Booking | undefined = json.booking;
      if (created?.id) {
        setEditor({ type: "booking", booking: created, draft: { ...created } });
      }
      return;
    }

    setEditor({
      type: "rate",
      rate: {
        id: "",
        start_date,
        end_date,
        price: 0,
        rate_type: "total",
        note: null,
      },
      draft: {
        start_date,
        end_date,
        price: 0,
        rate_type: "total",
        note: "",
      },
    });
  }

  function findBookingForDay(day: string) {
    return (
      bookings.find((b) => b.start_date === day) ||
      bookings.find((b) => day > b.start_date && day < b.end_date) ||
      bookings.find((b) => b.end_date === day)
    );
  }

  function findRateForDay(day: string) {
    return (
      rates.find((r) => r.start_date === day) ||
      rates.find((r) => day > r.start_date && day < r.end_date) ||
      rates.find((r) => r.end_date === day)
    );
  }

  function onDateClick(arg: DateClickArg) {
    const day = arg.dateStr;

    if (mode === "bookings") {
      const booking = findBookingForDay(day);
      if (booking) {
        setEditor({ type: "booking", booking, draft: { ...booking } });
      }
      return;
    }

    const rate = findRateForDay(day);
    if (rate) {
      setEditor({ type: "rate", rate, draft: { ...rate } });
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

  const tileMap = useMemo(() => {
    const map = new Map<string, TileMeta>();

    for (const r of rates) {
      eachDay(r.start_date, r.end_date).forEach((day) => {
        if (!map.has(day)) {
          map.set(day, {
            state: "available",
            price: getDailyDisplayPrice(day, rates),
          });
        }
      });
    }

    for (const b of bookings) {
      const bookedDays = eachDay(b.start_date, b.end_date);
      const bookingName = b.guest_name || (b.status === "confirmed" ? "Booked" : "Provisional");

      bookedDays.forEach((day, idx) => {
        const state =
          b.status === "confirmed"
            ? (idx === 0 ? "confirmed-checkin" : "confirmed")
            : (idx === 0 ? "provisional-checkin" : "provisional");

        map.set(day, {
          state,
          bookingName,
          price: getDailyDisplayPrice(day, rates),
        });
      });

      map.set(b.end_date, {
        state: b.status === "confirmed" ? "confirmed-checkout" : "provisional-checkout",
        bookingName,
        price: getDailyDisplayPrice(b.end_date, rates),
      });
    }

    return map;
  }, [bookings, rates]);

  function dayCellClassNames(arg: any) {
    const day = isoLocal(arg.date);
    const meta = tileMap.get(day);
    if (!meta) return ["tile-empty"];
    return [`tile-${meta.state}`];
  }

  function dayCellContent(arg: any) {
    const day = isoLocal(arg.date);
    const meta = tileMap.get(day);
    const dayNum = arg.dayNumberText.replace(/\D/g, "");

    return (
      <div className="tile-inner">
        <div className="tile-day">{dayNum}</div>
        {meta?.bookingName && <div className="tile-booking-name">{meta.bookingName}</div>}
        {meta?.price && <div className="tile-price">{meta.price}</div>}
      </div>
    );
  }

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
        .fc .fc-toolbar-title {
          font-size: 30px !important;
          font-weight: 800 !important;
        }

        .fc .fc-scrollgrid,
        .fc .fc-scrollgrid td,
        .fc .fc-scrollgrid th {
          border-color: #ffffff;
        }

        .fc .fc-col-header-cell {
          background: #ffffff;
        }

        .fc .fc-col-header-cell-cushion {
          text-decoration: none !important;
          font-size: 15px;
          font-weight: 700;
          color: #6b7280;
          padding: 10px 0;
        }

        .fc .fc-daygrid-day-top {
          display: none !important;
        }

        .fc .fc-daygrid-day-frame {
          min-height: 96px;
          padding: 0 !important;
          border-radius: 0 !important;
          overflow: hidden;
          box-sizing: border-box;
        }

        .fc .fc-daygrid-day.tile-empty { background: #ffffff !important; }
        .fc .fc-daygrid-day.tile-available { background: #5fa03e !important; }
        .fc .fc-daygrid-day.tile-confirmed { background: #d84848 !important; }
        .fc .fc-daygrid-day.tile-provisional { background: #d99a4b !important; }

        .fc .fc-daygrid-day.tile-confirmed-checkin {
          background: linear-gradient(135deg, #5fa03e 0 49%, #d84848 51% 100%) !important;
        }

        .fc .fc-daygrid-day.tile-confirmed-checkout {
          background: linear-gradient(135deg, #d84848 0 49%, #5fa03e 51% 100%) !important;
        }

        .fc .fc-daygrid-day.tile-provisional-checkin {
          background: linear-gradient(135deg, #5fa03e 0 49%, #d99a4b 51% 100%) !important;
        }

        .fc .fc-daygrid-day.tile-provisional-checkout {
          background: linear-gradient(135deg, #d99a4b 0 49%, #5fa03e 51% 100%) !important;
        }

        .tile-inner {
          position: relative;
          min-height: 96px;
          padding: 8px;
          box-sizing: border-box;
          color: #fff;
        }

        .tile-day {
          font-size: 18px;
          font-weight: 800;
          color: #fff;
          line-height: 1;
        }

        .fc .fc-day-other .tile-day {
          opacity: 0.4;
        }

        .tile-booking-name {
          position: absolute;
          top: 34px;
          left: 8px;
          right: 8px;
          font-size: 11px;
          font-weight: 700;
          color: #fff;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .tile-price {
          position: absolute;
          bottom: 8px;
          left: 8px;
          font-size: 12px;
          font-weight: 700;
          color: rgba(255,255,255,.88);
        }

        .fc .fc-daygrid-event-harness,
        .fc .fc-daygrid-event,
        .fc .fc-daygrid-event-harness-abs,
        .fc .fc-daygrid-more-link {
          display: none !important;
        }

        @media (max-width: 980px) {
          .owner-layout {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>

      <div style={styles.header}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22 }}>Caravan Dashboard</h1>
          <div style={{ opacity: 0.75, marginTop: 6 }}>
            {mode === "bookings"
              ? "Bookings mode: drag to add booking • tap a booked tile to edit."
              : "Pricing mode: drag to add price block • tap a priced tile to edit."}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => setMode("bookings")}
            style={{ ...styles.tab, ...(mode === "bookings" ? styles.tabOn : {}) }}
          >
            Bookings
          </button>
          <button
            onClick={() => setMode("pricing")}
            style={{ ...styles.tab, ...(mode === "pricing" ? styles.tabOn : {}) }}
          >
            Pricing
          </button>
          <button onClick={loadAll} style={styles.tab}>
            Refresh
          </button>
        </div>
      </div>

      <div className="owner-layout" style={styles.layout}>
        <div style={{ display: "grid", gap: 14 }}>
          <div style={styles.card}>
            {loading ? (
              <div style={{ padding: 18 }}>Loading…</div>
            ) : (
              <FullCalendar
                plugins={[dayGridPlugin, interactionPlugin]}
                initialView="dayGridMonth"
                height="auto"
                selectable
                selectMirror
                unselectAuto
                select={onSelect}
                dateClick={onDateClick}
                dayCellClassNames={dayCellClassNames}
                dayCellContent={dayCellContent}
                events={[]}
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

          {!editor && (
            <div style={{ opacity: 0.75, fontSize: 13 }}>
              Tap a booked tile in Bookings mode or a priced tile in Pricing mode.
            </div>
          )}

          {editor?.type === "rate" && (
            <>
              <Field label="Start date">
                <input
                  style={styles.input}
                  type="date"
                  value={String(editor.draft.start_date ?? editor.rate.start_date ?? "")}
                  onChange={(e) =>
                    setEditor({ ...editor, draft: { ...editor.draft, start_date: e.target.value } })
                  }
                />
              </Field>

              <Field label="End date (exclusive)">
                <input
                  style={styles.input}
                  type="date"
                  value={String(editor.draft.end_date ?? editor.rate.end_date ?? "")}
                  onChange={(e) =>
                    setEditor({ ...editor, draft: { ...editor.draft, end_date: e.target.value } })
                  }
                />
              </Field>

              <Field label="Rate type">
                <select
                  style={styles.input}
                  value={String(editor.draft.rate_type ?? editor.rate.rate_type ?? "total")}
                  onChange={(e) =>
                    setEditor({
                      ...editor,
                      draft: { ...editor.draft, rate_type: e.target.value as "nightly" | "total" },
                    })
                  }
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
                  onChange={(e) =>
                    setEditor({ ...editor, draft: { ...editor.draft, price: Number(e.target.value) } })
                  }
                />
              </Field>

              <Field label="Note (optional)">
                <input
                  style={styles.input}
                  value={String(editor.draft.note ?? editor.rate.note ?? "")}
                  onChange={(e) =>
                    setEditor({ ...editor, draft: { ...editor.draft, note: e.target.value } })
                  }
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
              <Field label="Arrival">
                <input
                  style={styles.input}
                  type="date"
                  value={String(editor.draft.start_date ?? "")}
                  onChange={(e) =>
                    setEditor({ ...editor, draft: { ...editor.draft, start_date: e.target.value } })
                  }
                />
              </Field>

              <Field label="Checkout">
                <input
                  style={styles.input}
                  type="date"
                  value={String(editor.draft.end_date ?? "")}
                  onChange={(e) =>
                    setEditor({ ...editor, draft: { ...editor.draft, end_date: e.target.value } })
                  }
                />
              </Field>

              <Field label="Status">
                <select
                  style={styles.input}
                  value={String(editor.draft.status ?? "provisional")}
                  onChange={(e) =>
                    setEditor({
                      ...editor,
                      draft: { ...editor.draft, status: e.target.value as "provisional" | "confirmed" },
                    })
                  }
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
                  onChange={(e) =>
                    setEditor({ ...editor, draft: { ...editor.draft, guest_name: e.target.value } })
                  }
                />
              </Field>

              <Field label="Email">
                <input
                  style={styles.input}
                  value={String(editor.draft.guest_email ?? "")}
                  onChange={(e) =>
                    setEditor({ ...editor, draft: { ...editor.draft, guest_email: e.target.value } })
                  }
                />
              </Field>

              <Field label="Phone">
                <input
                  style={styles.input}
                  value={String(editor.draft.phone ?? "")}
                  onChange={(e) =>
                    setEditor({ ...editor, draft: { ...editor.draft, phone: e.target.value } })
                  }
                />
              </Field>

              <Field label="Guests">
                <input
                  style={styles.input}
                  type="number"
                  min={1}
                  max={8}
                  value={Number(editor.draft.guests_count ?? 0)}
                  onChange={(e) =>
                    setEditor({ ...editor, draft: { ...editor.draft, guests_count: Number(e.target.value) } })
                  }
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

              <Field label="Dogs">
                <input
                  style={styles.input}
                  type="number"
                  min={0}
                  max={5}
                  value={Number(editor.draft.dogs_count ?? 0)}
                  onChange={(e) =>
                    setEditor({ ...editor, draft: { ...editor.draft, dogs_count: Number(e.target.value) } })
                  }
                />
              </Field>

              <Field label="Vehicle reg">
                <input
                  style={styles.input}
                  value={String(editor.draft.vehicle_reg ?? "")}
                  onChange={(e) =>
                    setEditor({ ...editor, draft: { ...editor.draft, vehicle_reg: e.target.value } })
                  }
                />
              </Field>

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
                  onChange={(e) =>
                    setEditor({ ...editor, draft: { ...editor.draft, notes: e.target.value } })
                  }
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