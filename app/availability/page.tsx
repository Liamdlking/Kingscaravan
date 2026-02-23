"use client";

import React, { useEffect, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { DateSelectArg } from "@fullcalendar/core";

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

function nights(start: Date, end: Date) {
  return Math.round((end.getTime() - start.getTime()) / 86400000);
}

function isAllowed(start: Date, end: Date) {
  const len = nights(start, end);
  if (len < 3) return false;

  const startDay = start.getDay();
  const endDay = end.getDay();

  // Fri → Mon
  if (startDay === 5 && endDay === 1) return true;

  // Mon → Fri
  if (startDay === 1 && endDay === 5) return true;

  // Sat → Sat weekly
  if (startDay === 6 && endDay === 6) return true;

  return false;
}

export default function Availability() {
  const [msg, setMsg] = useState("");

  function onSelect(sel: DateSelectArg) {
    if (!isAllowed(sel.start, sel.end)) {
      setMsg(
        "Bookings must be minimum 3 nights and either Fri–Mon, Mon–Fri, or Sat–Sat."
      );
      return;
    }

    const params = new URLSearchParams();
    params.set("start", iso(sel.start));
    params.set("end", iso(sel.end));

    window.location.href = "/book?" + params.toString();
  }

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: 20 }}>
      <h1>Check availability</h1>

      <p style={{ opacity: 0.8 }}>
        Minimum stay 3 nights • Short breaks Fri–Mon or Mon–Fri • Weekly Sat–Sat
      </p>

      <FullCalendar
        plugins={[dayGridPlugin, interactionPlugin]}
        selectable
        select={onSelect}
        initialView="dayGridMonth"
        height="auto"
      />

      {msg && (
        <div style={{ marginTop: 12, color: "#b91c1c", fontWeight: 600 }}>
          {msg}
        </div>
      )}
    </div>
  );
}
