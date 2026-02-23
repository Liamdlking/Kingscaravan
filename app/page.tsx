"use client";

import React, { useEffect, useMemo, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { DateSelectArg } from "@fullcalendar/core";

type Booking = {
  id: string;
  start_date: string;
  end_date: string;
  guest_name: string;
  status: "provisional" | "confirmed";
};

type Rate = {
  id: string;
  start_date: string;
  end_date: string;
  price: number;
  rate_type: "nightly" | "total";
};

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default function Home() {
  const [mode, setMode] = useState<"bookings" | "pricing">("bookings");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [rates, setRates] = useState<Rate[]>([]);

  async function load() {
    const b = await fetch("/api/bookings").then(r => r.json());
    setBookings(b.bookings ?? []);

    const r = await fetch("/api/rates").then(r => r.json());
    setRates(r.rates ?? []);
  }

  useEffect(() => { load(); }, []);

  async function onSelect(sel: DateSelectArg) {
    const start = iso(sel.start);
    const end = iso(sel.end);

    if (mode === "pricing") {
      const priceStr = window.prompt("Enter price (£)");
      if (!priceStr) return;

      const rateType = window.confirm(
        "OK = nightly rate\nCancel = total price"
      ) ? "nightly" : "total";

      await fetch("/api/rates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          start_date: start,
          end_date: end,
          price: Number(priceStr),
          rate_type: rateType
        })
      });

      await load();
      return;
    }

    const name = window.prompt("Guest name");
    if (!name) return;

    await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        start_date: start,
        end_date: end,
        guest_name: name,
        status: "confirmed"
      })
    });

    await load();
  }

  const bookingEvents = useMemo(() => {
    return bookings.map(b => ({
      title: b.guest_name,
      start: b.start_date,
      end: b.end_date,
      backgroundColor: b.status === "confirmed" ? "#ef4444" : "#f59e0b"
    }));
  }, [bookings]);

  const rateEvents = useMemo(() => {
    return rates.map(r => ({
      title: `£${r.price}${r.rate_type === "nightly" ? "/n" : ""}`,
      start: r.start_date,
      end: r.end_date,
      backgroundColor: "#22c55e33",
      borderColor: "#22c55e"
    }));
  }, [rates]);

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: 20 }}>
      <h1>Caravan Dashboard</h1>

      <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
        <button onClick={() => setMode("bookings")}>
          Bookings mode
        </button>
        <button onClick={() => setMode("pricing")}>
          Pricing mode
        </button>
      </div>

      <div style={{ padding: 12, border: "1px solid #eee", borderRadius: 12 }}>
        <FullCalendar
          plugins={[dayGridPlugin, interactionPlugin]}
          selectable
          select={onSelect}
          initialView="dayGridMonth"
          events={[...bookingEvents, ...rateEvents]}
          height="auto"
        />
      </div>

      <p style={{ marginTop: 10, opacity: 0.7 }}>
        {mode === "pricing"
          ? "Drag dates to set pricing"
          : "Drag dates to create bookings"}
      </p>
    </div>
  );
}
