"use client";

import React, { useEffect, useMemo, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";

type Booking = {
  start_date: string;
  end_date: string;
  status: "provisional" | "confirmed";
};

function iso(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function eachDay(startISO: string, endISO: string) {
  const out: string[] = [];
  const start = new Date(`${startISO}T00:00:00.000Z`);
  const end = new Date(`${endISO}T00:00:00.000Z`);
  for (let d = new Date(start); d < end; d.setUTCDate(d.getUTCDate() + 1)) out.push(d.toISOString().slice(0, 10));
  return out;
}

export default function AvailabilityPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/bookings");
      const json = await res.json();
      setBookings(json.bookings ?? []);
    })();
  }, []);

  const { confirmedDates, provisionalDates } = useMemo(() => {
    const confirmed = new Set<string>();
    const provisional = new Set<string>();
    for (const b of bookings) {
      const days = eachDay(b.start_date, b.end_date);
      if (b.status === "confirmed") days.forEach((d) => confirmed.add(d));
      if (b.status === "provisional") days.forEach((d) => provisional.add(d));
    }
    return { confirmedDates: confirmed, provisionalDates: provisional };
  }, [bookings]);

  const dayCellClassNames = (info: any) => {
    const d = iso(info.date);
    if (confirmedDates.has(d)) return ["day-confirmed"];
    if (provisionalDates.has(d)) return ["day-provisional"];
    return ["day-available"];
  };

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: 18 }}>
      <style>{`
        .day-available { background: rgba(34,197,94,0.10); }
        .day-confirmed { background: rgba(239,68,68,0.12); }
        .day-provisional { background: rgba(245,158,11,0.14); }
        .fc .fc-daygrid-day-frame { border-radius: 8px; overflow: hidden; }
      `}</style>

      <h1 style={{ margin: "0 0 6px" }}>Availability</h1>
      <p style={{ margin: "0 0 16px", opacity: 0.75 }}>
        🟢 Available • 🟠 Provisional • 🔴 Booked
        <br />
        To request a booking, go to <b>/book</b>.
      </p>

      <div style={{ padding: 12, borderRadius: 12, border: "1px solid #e6e6e6", background: "white" }}>
        <FullCalendar
          plugins={[dayGridPlugin]}
          initialView="dayGridMonth"
          height="auto"
          dayCellClassNames={dayCellClassNames}
        />
      </div>
    </div>
  );
}
