"use client";

import React, { useEffect, useMemo, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { DateSelectArg, EventClickArg } from "@fullcalendar/core";

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

export default function Dashboard() {
  const [mode, setMode] = useState<"bookings" | "pricing">("pricing");
  const [rates, setRates] = useState<Rate[]>([]);

  async function load() {
    const res = await fetch("/api/rates");
    const json = await res.json();
    setRates(json.rates ?? []);
  }

  useEffect(() => { load(); }, []);

  async function onSelect(sel: DateSelectArg) {
    if (mode !== "pricing") return;

    const start = iso(sel.start);
    const end = iso(sel.end);

    const price = prompt("Enter price (£)");
    if (!price) return;

    const rateType = confirm("OK = nightly rate\nCancel = total price")
      ? "nightly"
      : "total";

    await fetch("/api/rates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        start_date: start,
        end_date: end,
        price: Number(price),
        rate_type: rateType
      })
    });

    await load();
  }

  async function onEventClick(arg: EventClickArg) {
    const rate = arg.event.extendedProps.rate as Rate;
    if (!rate) return;

    const action = prompt(
      `Rate £${rate.price}\nType: ${rate.rate_type}\n\nType:\nedit — change price\ndelete — remove`
    );

    if (action === "delete") {
      await fetch(`/api/rates?id=${rate.id}`, { method: "DELETE" });
      await load();
    }

    if (action === "edit") {
      const newPrice = prompt("New price (£)", String(rate.price));
      if (!newPrice) return;

      await fetch("/api/rates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          start_date: rate.start_date,
          end_date: rate.end_date,
          price: Number(newPrice),
          rate_type: rate.rate_type
        })
      });

      await fetch(`/api/rates?id=${rate.id}`, { method: "DELETE" });

      await load();
    }
  }

  const rateEvents = useMemo(() => {
    return rates.map(r => ({
      title: `£${r.price}${r.rate_type === "nightly" ? "/n" : ""}`,
      start: r.start_date,
      end: r.end_date,
      backgroundColor: "#22c55e33",
      borderColor: "#22c55e",
      extendedProps: { rate: r }
    }));
  }, [rates]);

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: 20 }}>
      <h1>Pricing Manager</h1>

      <p style={{ opacity: 0.7 }}>
        Drag dates to add pricing • Click pricing to edit or delete
      </p>

      <FullCalendar
        plugins={[dayGridPlugin, interactionPlugin]}
        selectable
        select={onSelect}
        eventClick={onEventClick}
        initialView="dayGridMonth"
        events={rateEvents}
        height="auto"
      />
    </div>
  );
}
