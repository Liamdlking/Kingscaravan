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

function eachDayExclusiveEnd(startISO: string, endISO: string) {
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

  // editable copy (form state)
  const [edit, setEdit] = useState<any>(null);
  const [saving, setSaving] = useState(false);

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

  // Background colouring sets
  const { confirmedDates, provisionalDates } = useMemo(() => {
    const confirmed = new Set<string>();
    const provisional = new Set<string>();

    for (const b of bookings) {
      const days = eachDayExclusiveEnd(b.start_date, b.end_date);
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
    setEdit({
      guest_name: b.guest_name ?? "",
      guest_email: b.guest_email ?? "",
      phone: b.phone ?? "",
      guests_count: b.guests_count ?? "",
      children_count: b.children_count ?? "",
      dogs_count: b.dogs_count ?? "",
      vehicle_reg: b.vehicle_reg ?? "",
      price: b.price ?? "",
      special_requests: b.special_requests ?? "",
      notes: b.notes ?? "",
      contact: b.contact ?? "",
    });
  }

  const dayCellClassNames = (info: any) => {
    const d = iso(info.date);
    if (confirmedDates.has(d)) return ["day-confirmed"];
    if (provisionalDates.has(d)) return ["day-provisional"];
    return ["day-available"];
  };

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
    setEdit((e: any) => e); // keep edits
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
    setEdit(null);
    await refresh();
  }

  async function deleteSelected() {
    if (!selected) return;
    if (!window.confirm("Delete this booking?")) return;
    const res = await fetch(`/api/bookings?id=${encodeURIComponent(selected.id)}`, { method: "DELETE" });
    const json = await res.json();
    if (!res.ok) return alert(json?.error || "Could not delete");
    setSelected(null);
    setEdit(null);
    await refresh();
  }

  async function saveChanges() {
    if (!selected) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/bookings?id=${encodeURIComponent(selected.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update", ...edit }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Could not save changes");

      setSelected(json.booking);
      await refresh();
      alert("✅ Saved");
    } catch (e: any) {
      alert(e?.message || "Could not save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ maxWidth: 1250, margin: "0 auto", padding: 18 }}>
      <style>{`
        .day-available { background: rgba(34,197,94,0.10); }
        .day-confirmed { background: rgba(239,68,68,0.12); }
        .day-provisional { background: rgba(245,158,11,0.14); }
        .fc .fc-daygrid-day-frame { border-radius: 8px; overflow: hidden; }
        .panel { position: sticky; top: 12px; align-self: start; padding: 14px; border: 1px solid #e6e6e6; border-radius: 12px; background: white; }
        .btn { padding: 10px 12px; border-radius: 10px; border: 1px solid #ddd; background: white; cursor: pointer; font-weight: 700; }
        .btnRow { display: flex; gap: 10px; flex-wrap: wrap; }
        .label { font-size: 12px; opacity: .7; margin-top: 10px; }
        .input { width: 100%; padding: 10px 12px; border-radius: 10px; border: 1px solid #ddd; font-size: 14px; }
        .pill { display: inline-block; padding: 4px 10px; border-radius: 999px; font-size: 12px; border: 1px solid #e6e6e6; }
      `}</style>

      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", marginBottom: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22 }}>Caravan Booking Calendar (Admin)</h1>
          <p style={{ margin: "6px 0 0", opacity: 0.75 }}>
            🟢 Available • 🟠 Provisional requests • 🔴 Confirmed bookings
            <br />
            Import bulk bookings at <b>/import</b>
          </p>
          {error && (
            <div style={{ marginTop: 10, padding: 10, borderRadius: 10, background: "#fff3f3", border: "1px solid #ffd0d0" }}>
              {error}
            </div>
          )}
        </div>
        <button className="btn" onClick={refresh}>Refresh</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 390px", gap: 14 }}>
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

          {!selected || !edit ? (
            <div style={{ opacity: 0.75 }}>
              Click a booking to view/edit details.
              <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
                Tip: drag-select dates to add a confirmed booking manually.
              </div>
            </div>
          ) : (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                <div style={{ fontWeight: 800 }}>{selected.guest_name || "(no name)"}</div>
                <span className="pill">
                  {selected.status === "provisional" ? "Provisional" : selected.status === "confirmed" ? "Confirmed" : "Declined"}
                </span>
              </div>

              <div className="label">Dates</div>
              <div style={{ marginTop: 4 }}>
                {selected.start_date} → {selected.end_date} <span style={{ opacity: 0.7 }}>(checkout)</span>
              </div>

              <div className="label">Guest name</div>
              <input className="input" value={edit.guest_name} onChange={(e) => setEdit({ ...edit, guest_name: e.target.value })} />

              <div className="label">Email</div>
              <input className="input" value={edit.guest_email} onChange={(e) => setEdit({ ...edit, guest_email: e.target.value })} />

              <div className="label">Phone</div>
              <input className="input" value={edit.phone} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} />

              <div className="label">Guests / Children / Dogs</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                <input className="input" placeholder="Guests" value={edit.guests_count} onChange={(e) => setEdit({ ...edit, guests_count: e.target.value })} />
                <input className="input" placeholder="Children" value={edit.children_count} onChange={(e) => setEdit({ ...edit, children_count: e.target.value })} />
                <input className="input" placeholder="Dogs" value={edit.dogs_count} onChange={(e) => setEdit({ ...edit, dogs_count: e.target.value })} />
              </div>

              <div className="label">Vehicle reg</div>
              <input className="input" value={edit.vehicle_reg} onChange={(e) => setEdit({ ...edit, vehicle_reg: e.target.value })} />

              <div className="label">Price</div>
              <input className="input" placeholder="e.g. 740" value={edit.price} onChange={(e) => setEdit({ ...edit, price: e.target.value })} />

              <div className="label">Special requests</div>
              <textarea className="input" rows={3} value={edit.special_requests} onChange={(e) => setEdit({ ...edit, special_requests: e.target.value })} />

              <div className="label">Internal notes</div>
              <textarea className="input" rows={3} value={edit.notes} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} />

              <div style={{ marginTop: 12 }} className="btnRow">
                <button className="btn" onClick={saveChanges} disabled={saving}>
                  {saving ? "Saving…" : "💾 Save changes"}
                </button>

                {selected.status === "provisional" && (
                  <>
                    <button className="btn" onClick={approveSelected}>✅ Approve</button>
                    <button className="btn" onClick={declineSelected}>❌ Decline</button>
                  </>
                )}

                <button className="btn" onClick={deleteSelected}>🗑 Delete</button>
                <button className="btn" onClick={() => { setSelected(null); setEdit(null); }}>Close</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}