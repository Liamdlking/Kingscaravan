"use client";

import React, { useEffect, useMemo, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { DateSelectArg, EventClickArg } from "@fullcalendar/core";

type Status = "provisional" | "confirmed" | "declined";

type Booking = {
  id: string;
  start_date: string;
  end_date: string; // exclusive
  status: Status;
  guest_name: string | null;
  guest_email?: string | null;
  phone?: string | null;
  guests_count?: number | null;
  children_count?: number | null;
  dogs_count?: number | null;
  vehicle_reg?: string | null;
  arrival_time?: string | null;
  departure_time?: string | null;
  price?: number | null;
  special_requests?: string | null;
  notes?: string | null;
  contact?: string | null;
};

function iso(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function eachDayInclusiveStartExclusiveEnd(startISO: string, endISO: string) {
  // returns date strings for [start, end) (exclusive end)
  const out: string[] = [];
  const start = new Date(`${startISO}T00:00:00.000Z`);
  const end = new Date(`${endISO}T00:00:00.000Z`);
  for (let d = new Date(start); d < end; d.setUTCDate(d.getUTCDate() + 1)) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

export default function AdminHome() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Booking | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/bookings");
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to load");
      setBookings(json.bookings ?? []);
    } catch (e: any) {
      setError(e?.message || "Failed to load");
      setBookings([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  // Build date sets for background colouring
  const { confirmedDates, provisionalDates } = useMemo(() => {
    const confirmed = new Set<string>();
    const provisional = new Set<string>();

    for (const b of bookings) {
      const days = eachDayInclusiveStartExclusiveEnd(b.start_date, b.end_date);
      if (b.status === "confirmed") days.forEach((d) => confirmed.add(d));
      if (b.status === "provisional") days.forEach((d) => provisional.add(d));
    }
    return { confirmedDates: confirmed, provisionalDates: provisional };
  }, [bookings]);

  const events = useMemo(() => {
    return bookings.map((b) => ({
      id: b.id,
      title: b.guest_name || "(no name)",
      start: b.start_date,
      end: b.end_date,
      extendedProps: b,
      backgroundColor: b.status === "provisional" ? "#f59e0b" : "#ef4444",
      borderColor: b.status === "provisional" ? "#d97706" : "#dc2626",
      textColor: "white",
    }));
  }, [bookings]);

  async function addBooking(sel: DateSelectArg) {
    // Admin-created bookings default to confirmed
    const start_date = iso(sel.start);
    const end_date = iso(sel.end);

    const guest_name = window.prompt("Guest name?");
    if (!guest_name) return;

    const res = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ start_date, end_date, guest_name, status: "confirmed" }),
    });
    const json = await res.json();
    if (!res.ok) {
      alert(json?.error || "Could not add booking");
      return;
    }
    await refresh();
  }

  function onEventClick(arg: EventClickArg) {
    const b = arg.event.extendedProps as any as Booking;
    setSelected(b);
  }

  async function approveSelected() {
    if (!selected) return;
    const res = await fetch(`/api/bookings?id=${encodeURIComponent(selected.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "approve" }),
    });
    const json = await res.json();
    if (!res.ok) return alert(json?.error || "Could not approve");
    setSelected(json.booking);
    await refresh();
  }

  async function declineSelected() {
    if (!selected) return;
    const res = await fetch(`/api/bookings?id=${encodeURIComponent(selected.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "decline" }),
    });
    const json = await res.json();
    if (!res.ok) return alert(json?.error || "Could not decline");
    setSelected(null);
    await refresh();
  }

  async function deleteSelected() {
    if (!selected) return;
    if (!window.confirm("Delete this booking?")) return;
    const res = await fetch(`/api/bookings?id=${encodeURIComponent(selected.id)}`, { method: "DELETE" });
    const json = await res.json();
    if (!res.ok) return alert(json?.error || "Could not delete");
    setSelected(null);
    await refresh();
  }

  const dayCellClassNames = (info: any) => {
    // info.date is local Date; convert to YYYY-MM-DD
    const d = iso(info.date);
    if (confirmedDates.has(d)) return ["day-confirmed"];
    if (provisionalDates.has(d)) return ["day-provisional"];
    return ["day-available"];
  };

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: 18 }}>
      <style>{`
        .day-available { background: rgba(34,197,94,0.10); }
        .day-confirmed { background: rgba(239,68,68,0.12); }
        .day-provisional { background: rgba(245,158,11,0.14); }

        /* Make the background apply to the full day cell */
        .fc .fc-daygrid-day.day-available,
        .fc .fc-daygrid-day.day-confirmed,
        .fc .fc-daygrid-day.day-provisional {
          transition: background 120ms ease;
        }

        /* Slightly round the day cells */
        .fc .fc-daygrid-day-frame { border-radius: 8px; overflow: hidden; }

        /* Panel */
        .panel {
          position: sticky;
          top: 12px;
          align-self: start;
          padding: 14px;
          border: 1px solid #e6e6e6;
          border-radius: 12px;
          background: white;
          min-height: 220px;
        }
        .btn {
          padding: 10px 12px;
          border-radius: 10px;
          border: 1px solid #ddd;
          background: white;
          cursor: pointer;
        }
        .btnRow { display: flex; gap: 10px; flex-wrap: wrap; }
        .label { font-size: 12px; opacity: .7; margin-top: 12px; }
        .value { margin: 4px 0 0; }
        .pill {
          display: inline-block;
          padding: 4px 10px;
          border-radius: 999px;
          font-size: 12px;
          border: 1px solid #e6e6e6;
        }
      `}</style>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22 }}>Caravan Booking Calendar (Admin)</h1>
          <p style={{ margin: "6px 0 0", opacity: 0.75 }}>
            🟢 Available • 🟠 Provisional requests • 🔴 Confirmed bookings
            <br />
            Guests request bookings at <b>/book</b> — you approve them here.
          </p>
          {error && (
            <div style={{ marginTop: 10, padding: 10, borderRadius: 10, background: "#fff3f3", border: "1px solid #ffd0d0" }}>
              {error}
            </div>
          )}
        </div>

        <button className="btn" onClick={refresh}>
          Refresh
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 14 }}>
        <div style={{ padding: 12, borderRadius: 12, border: "1px solid #e6e6e6", background: "white" }}>
          {loading ? (
            <div style={{ padding: 16 }}>Loading…</div>
          ) : (
            <FullCalendar
              plugins={[dayGridPlugin, interactionPlugin]}
              initialView="dayGridMonth"
              selectable
              selectMirror
              select={addBooking}
              events={events}
              eventClick={onEventClick}
              height="auto"
              dayCellClassNames={dayCellClassNames}
            />
          )}
        </div>

        <div className="panel">
          <h2 style={{ margin: "0 0 10px", fontSize: 16 }}>Booking details</h2>

          {!selected ? (
            <div style={{ opacity: 0.75 }}>
              Click an orange/red booking to see full details and approve/decline.
              <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
                Tip: drag-select dates on the calendar to add a confirmed booking manually.
              </div>
            </div>
          ) : (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                <div style={{ fontWeight: 700 }}>{selected.guest_name || "(no name)"}</div>
                <span className="pill">
                  {selected.status === "provisional" ? "Provisional" : selected.status === "confirmed" ? "Confirmed" : "Declined"}
                </span>
              </div>

              <div className="label">Dates</div>
              <div className="value">
                {selected.start_date} → {selected.end_date} <span style={{ opacity: 0.7 }}>(checkout)</span>
              </div>

              <div className="label">Contact</div>
              <div className="value" style={{ whiteSpace: "pre-wrap" }}>
                {selected.guest_email ? `Email: ${selected.guest_email}\n` : ""}
                {selected.phone ? `Phone: ${selected.phone}\n` : ""}
                {selected.contact ? `Other: ${selected.contact}` : ""}
                {!selected.guest_email && !selected.phone && !selected.contact ? "—" : ""}
              </div>

              <div className="label">Party</div>
              <div className="value">
                Guests: {selected.guests_count ?? "—"} • Children: {selected.children_count ?? "—"} • Dogs: {selected.dogs_count ?? "—"}
              </div>

              <div className="label">Arrival / Departure</div>
              <div className="value">
                Arrival: {selected.arrival_time || "—"} • Departure: {selected.departure_time || "—"}
              </div>

              <div className="label">Vehicle reg</div>
              <div className="value">{selected.vehicle_reg || "—"}</div>

              <div className="label">Special requests</div>
              <div className="value" style={{ whiteSpace: "pre-wrap" }}>{selected.special_requests || "—"}</div>

              <div className="label">Price</div>
              <div className="value">{selected.price != null ? `£${selected.price}` : "—"}</div>

              <div style={{ marginTop: 12 }} className="btnRow">
                {selected.status === "provisional" && (
                  <>
                    <button className="btn" onClick={approveSelected}>✅ Approve</button>
                    <button className="btn" onClick={declineSelected}>❌ Decline</button>
                  </>
                )}
                <button className="btn" onClick={deleteSelected}>🗑 Delete</button>
                <button className="btn" onClick={() => setSelected(null)}>Close</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
