"use client";

import React, { useEffect, useMemo, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { DateSelectArg, EventClickArg } from "@fullcalendar/core";

type Booking = {
  id: string;
  start_date: string;
  end_date: string;
  guest_name: string;
  notes?: string | null;
};

type Rate = {
  id: string;
  start_date: string;
  end_date: string;
  price: number;
  rate_type: "nightly" | "total";
};

type Editor =
  | { type: "booking"; booking: Booking }
  | { type: "rate"; rate: Rate }
  | null;

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default function Dashboard() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [rates, setRates] = useState<Rate[]>([]);
  const [mode, setMode] = useState<"bookings" | "pricing">("bookings");
  const [editor, setEditor] = useState<Editor>(null);

  async function load() {
    const b = await fetch("/api/bookings").then(r => r.json());
    const r = await fetch("/api/rates").then(r => r.json());
    setBookings(b.bookings ?? []);
    setRates(r.rates ?? []);
  }

  useEffect(() => { load(); }, []);

  async function onSelect(sel: DateSelectArg) {
    const start = iso(sel.start);
    const end = iso(sel.end);

    if (mode === "pricing") {
      const res = await fetch("/api/rates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ start_date: start, end_date: end, price: 0, rate_type: "total" })
      });
      const json = await res.json();
      setEditor({ type: "rate", rate: json.rate });
      await load();
    } else {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ start_date: start, end_date: end, guest_name: "New booking" })
      });
      const json = await res.json();
      setEditor({ type: "booking", booking: json.booking });
      await load();
    }
  }

  function onEventClick(arg: EventClickArg) {
    const ext = arg.event.extendedProps as any;
    if (ext.rate) setEditor({ type: "rate", rate: ext.rate });
    if (ext.booking) setEditor({ type: "booking", booking: ext.booking });
  }

  async function deleteRate(id: string) {
    await fetch(`/api/rates?id=${id}`, { method: "DELETE" });
    setEditor(null);
    await load();
  }

  async function deleteBooking(id: string) {
    await fetch(`/api/bookings?id=${id}`, { method: "DELETE" });
    setEditor(null);
    await load();
  }

  const events = useMemo(() => [
    ...rates.map(r => ({
      title: `£${r.price}`,
      start: r.start_date,
      end: r.end_date,
      backgroundColor: "#22c55e33",
      borderColor: "#22c55e",
      extendedProps: { rate: r }
    })),
    ...bookings.map(b => ({
      title: b.guest_name,
      start: b.start_date,
      end: b.end_date,
      backgroundColor: "#ef444433",
      borderColor: "#ef4444",
      extendedProps: { booking: b }
    }))
  ], [rates, bookings]);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 16, padding: 20 }}>
      <div>
        <h1>Caravan Dashboard</h1>

        <div style={{ marginBottom: 10 }}>
          <button onClick={() => setMode("bookings")}>Bookings</button>
          <button onClick={() => setMode("pricing")} style={{ marginLeft: 8 }}>Pricing</button>
        </div>

        <FullCalendar
          plugins={[dayGridPlugin, interactionPlugin]}
          selectable
          select={onSelect}
          eventClick={onEventClick}
          events={events}
          initialView="dayGridMonth"
          height="auto"
        />
      </div>

      <div style={{ borderLeft: "1px solid #eee", paddingLeft: 16 }}>
        <h2>Editor</h2>

        {!editor && <p>Select something to edit</p>}

        {editor?.type === "rate" && (
          <>
            <p>Price</p>
            <input
              value={editor.rate.price}
              onChange={e =>
                setEditor({
                  ...editor,
                  rate: { ...editor.rate, price: Number(e.target.value) }
                })
              }
            />

            <button onClick={() => deleteRate(editor.rate.id)} style={{ marginTop: 10 }}>
              Delete rate
            </button>
          </>
        )}

        {editor?.type === "booking" && (
          <>
            <p>Guest</p>
            <input value={editor.booking.guest_name} readOnly />

            <button onClick={() => deleteBooking(editor.booking.id)} style={{ marginTop: 10 }}>
              Delete booking
            </button>
          </>
        )}
      </div>
    </div>
  );
}
