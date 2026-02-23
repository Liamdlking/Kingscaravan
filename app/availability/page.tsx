"use client";

import React, { useEffect, useMemo, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { DateSelectArg } from "@fullcalendar/core";

type Booking = {
  start_date: string;
  end_date: string;
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

function addDaysISO(date: string, days: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function nights(start: string, end: string) {
  const s = new Date(`${start}T00:00:00Z`);
  const e = new Date(`${end}T00:00:00Z`);
  return Math.round((e.getTime() - s.getTime()) / 86400000);
}

function eachDay(start: string, end: string) {
  const days: string[] = [];
  let d = new Date(`${start}T00:00:00Z`);
  const endD = new Date(`${end}T00:00:00Z`);
  while (d < endD) {
    days.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return days;
}

export default function AvailabilityPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [rates, setRates] = useState<Rate[]>([]);
  const [selected, setSelected] = useState<{ start: string; end: string } | null>(null);
  const [price, setPrice] = useState<number | null>(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      const b = await fetch("/api/bookings").then(r => r.json());
      setBookings(b.bookings ?? []);
      const r = await fetch("/api/rates").then(r => r.json());
      setRates(r.rates ?? []);
    })();
  }, []);

  const confirmed = useMemo(() => {
    const s = new Set<string>();
    bookings
      .filter(b => b.status === "confirmed")
      .forEach(b => eachDay(b.start_date, b.end_date).forEach(d => s.add(d)));
    return s;
  }, [bookings]);

  function calcPrice(start: string, end: string) {
    const nightsList = eachDay(start, end);
    let total = 0;
    for (const day of nightsList) {
      const rate = rates.find(r =>
        r.rate_type === "nightly" &&
        r.start_date <= day &&
        day < r.end_date
      );
      if (!rate) return null;
      total += rate.price;
    }
    return total;
  }

  function onSelect(sel: DateSelectArg) {
    setMsg("");

    const start = iso(sel.start);

    // ⭐ checkout = last highlighted day
    const checkout = addDaysISO(iso(sel.end), -1);

    const nightsCount = nights(start, checkout);

    if (nightsCount < 1) {
      setMsg("Please select at least one night.");
      return;
    }

    const conflict = eachDay(start, checkout).some(d => confirmed.has(d));
    if (conflict) {
      setMsg("Some selected dates are unavailable.");
      return;
    }

    setSelected({ start, end: checkout });

    const p = calcPrice(start, checkout);
    setPrice(p);
  }

  function goToBooking() {
    if (!selected) return;
    const params = new URLSearchParams();
    params.set("start", selected.start);
    params.set("end", selected.end);
    if (price != null) params.set("price", String(price));
    window.location.href = `/book?${params.toString()}`;
  }

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: 18 }}>
      <style>{`
        .fc-daygrid-day { border-radius:8px }
      `}</style>

      <h1>Availability</h1>
      <p style={{ opacity: 0.75 }}>
        Drag to include your checkout day (e.g. drag Mon–Fri for Friday checkout).
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 16 }}>
        <div style={{ background: "white", padding: 12, borderRadius: 12 }}>
          <FullCalendar
            plugins={[dayGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            selectable
            select={onSelect}
            height="auto"
          />
        </div>

        <div style={{ background: "white", padding: 16, borderRadius: 12 }}>
          <h2>Selected stay</h2>

          {!selected && <p style={{ opacity: 0.7 }}>Drag dates on calendar.</p>}

          {selected && (
            <>
              <div style={{ marginBottom: 8 }}>
                <b>Arrival:</b> {selected.start}
              </div>

              <div style={{ marginBottom: 8 }}>
                <b>Checkout:</b> {selected.end}
              </div>

              <div style={{ marginBottom: 12 }}>
                ⭐ <b>Nights:</b> {nights(selected.start, selected.end)}
              </div>

              {price != null ? (
                <div style={{ marginBottom: 12 }}>
                  <b>Total:</b> £{price}
                </div>
              ) : (
                <div style={{ marginBottom: 12 }}>Price not set</div>
              )}

              <button
                onClick={goToBooking}
                style={{
                  width: "100%",
                  padding: 12,
                  borderRadius: 10,
                  border: "1px solid #ddd",
                  fontWeight: 700,
                  cursor: "pointer"
                }}
              >
                Request booking
              </button>
            </>
          )}

          {msg && (
            <div style={{ marginTop: 12, color: "#b91c1c" }}>{msg}</div>
          )}
        </div>
      </div>
    </div>
  );
}
