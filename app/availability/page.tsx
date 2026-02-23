"use client";

import React, { useEffect, useMemo, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { DateSelectArg, DayCellContentArg } from "@fullcalendar/core";

type Booking = {
  start_date: string;
  end_date: string; // checkout day (NOT booked)
  status: "provisional" | "confirmed";
};

type Rate = {
  id: string;
  start_date: string;
  end_date: string; // exclusive
  price: number;
  rate_type: "nightly" | "total";
  note?: string | null;
};

function isoLocal(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDaysISO(date: string, days: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function eachDay(startISO: string, endISO: string) {
  const out: string[] = [];
  const start = new Date(`${startISO}T00:00:00Z`);
  const end = new Date(`${endISO}T00:00:00Z`);
  for (let d = new Date(start); d < end; d.setUTCDate(d.getUTCDate() + 1)) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

function nightsCount(start: string, checkout: string) {
  const s = new Date(`${start}T00:00:00Z`).getTime();
  const e = new Date(`${checkout}T00:00:00Z`).getTime();
  return Math.round((e - s) / 86400000);
}

function calcPrice(startISO: string, checkoutISO: string, rates: Rate[]) {
  const exactTotal = rates.find(
    (r) => r.rate_type === "total" && r.start_date === startISO && r.end_date === checkoutISO
  );
  if (exactTotal) return { ok: true as const, total: Number(exactTotal.price), method: "total" as const };

  const nights = eachDay(startISO, checkoutISO);
  let total = 0;

  for (const day of nights) {
    const nightly = rates.find((r) => r.rate_type === "nightly" && r.start_date <= day && day < r.end_date);
    if (!nightly) return { ok: false as const, total: null as any, method: "missing" as const };
    total += Number(nightly.price);
  }

  return { ok: true as const, total, method: "nightly" as const };
}

export default function AvailabilityPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [rates, setRates] = useState<Rate[]>([]);
  const [msg, setMsg] = useState<string>("");
  const [selectedRange, setSelectedRange] = useState<{ start: string; checkout: string } | null>(null);
  const [priceInfo, setPriceInfo] = useState<{ ok: boolean; total: number | null; method: string } | null>(null);

  useEffect(() => {
    (async () => {
      const bRes = await fetch("/api/bookings");
      const bJson = await bRes.json();
      setBookings(bJson.bookings ?? []);

      const rRes = await fetch("/api/rates");
      const rJson = await rRes.json();
      setRates(rJson.rates ?? []);
    })();
  }, []);

  // --- HALF-DAY MARKERS (check-in / checkout) ---
  const markers = useMemo(() => {
    const confirmedFull = new Set<string>();
    const provisionalFull = new Set<string>();

    const inConfirmed = new Set<string>();
    const inProvisional = new Set<string>();

    const outConfirmed = new Set<string>();
    const outProvisional = new Set<string>();

    for (const b of bookings) {
      const days = eachDay(b.start_date, b.end_date);
      if (b.status === "confirmed") {
        days.forEach((d) => confirmedFull.add(d));
        inConfirmed.add(b.start_date);
        outConfirmed.add(b.end_date);
      } else {
        days.forEach((d) => provisionalFull.add(d));
        inProvisional.add(b.start_date);
        outProvisional.add(b.end_date);
      }
    }

    return { confirmedFull, provisionalFull, inConfirmed, inProvisional, outConfirmed, outProvisional };
  }, [bookings]);

  const dayCellClassNames = (info: any) => {
    // IMPORTANT: use UTC date string from FullCalendar to avoid timezone drift
    const d = info.date.toISOString().slice(0, 10);
    const classes: string[] = [];

    if (markers.confirmedFull.has(d)) classes.push("day-confirmed");
    else if (markers.provisionalFull.has(d)) classes.push("day-provisional");
    else classes.push("day-available");

    // right half = check-in, left half = checkout
    if (markers.inConfirmed.has(d)) classes.push("in-confirmed");
    if (markers.inProvisional.has(d)) classes.push("in-provisional");
    if (markers.outConfirmed.has(d)) classes.push("out-confirmed");
    if (markers.outProvisional.has(d)) classes.push("out-provisional");

    return classes;
  };

  const dayCellContent = (arg: DayCellContentArg) => {
    const dayISO = isoLocal(arg.date);

    const nightly = rates.find((r) => r.rate_type === "nightly" && r.start_date <= dayISO && dayISO < r.end_date);

    return (
      <div style={{ padding: 4 }}>
        <div>{arg.dayNumberText}</div>
        {nightly && <div style={{ fontSize: 11, opacity: 0.75, marginTop: 2 }}>£{nightly.price}/n</div>}
      </div>
    );
  };

  function hasConfirmedInRange(startISO: string, checkoutISO: string) {
    const days = eachDay(startISO, checkoutISO);
    return days.some((d) => markers.confirmedFull.has(d));
  }

  function onSelect(sel: DateSelectArg) {
    setMsg("");

    const start = isoLocal(sel.start);

    // ✅ last highlighted day should be checkout day:
    // FullCalendar selection end is exclusive, so we convert it to an inclusive "checkout highlight"
    const checkout = addDaysISO(isoLocal(sel.end), -1);

    const n = nightsCount(start, checkout);
    if (n < 1) {
      setSelectedRange(null);
      setPriceInfo(null);
      setMsg("Please select at least 1 night.");
      return;
    }

    if (hasConfirmedInRange(start, checkout)) {
      setSelectedRange(null);
      setPriceInfo(null);
      setMsg("Those dates include unavailable (booked) days. Please choose available dates.");
      return;
    }

    setSelectedRange({ start, checkout });
    setPriceInfo(calcPrice(start, checkout, rates));
  }

  function requestBooking() {
    if (!selectedRange) return;
    const params = new URLSearchParams();
    params.set("start", selectedRange.start);
    params.set("end", selectedRange.checkout);

    if (priceInfo?.ok && priceInfo.total != null) {
      params.set("price", String(priceInfo.total));
      params.set("price_method", String(priceInfo.method));
    }

    window.location.href = `/book?${params.toString()}`;
  }

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: 18 }}>
      <style>{`
        /* Base day colouring must be applied to the FRAME */
        .fc .fc-daygrid-day.day-available .fc-daygrid-day-frame { background: rgba(34,197,94,0.10); }
        .fc .fc-daygrid-day.day-confirmed .fc-daygrid-day-frame { background: rgba(239,68,68,0.12); }
        .fc .fc-daygrid-day.day-provisional .fc-daygrid-day-frame { background: rgba(245,158,11,0.14); }

        .fc .fc-daygrid-day-frame {
          border-radius: 10px;
          overflow: hidden;
          position: relative;
        }

        /* Half overlay layer */
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

        /* Set overlay vars on the DAY CELL so they inherit */
        .fc .fc-daygrid-day.out-confirmed { --leftOverlay: rgba(239,68,68,0.26); }
        .fc .fc-daygrid-day.in-confirmed  { --rightOverlay: rgba(239,68,68,0.26); }

        .fc .fc-daygrid-day.out-provisional { --leftOverlay: rgba(245,158,11,0.28); }
        .fc .fc-daygrid-day.in-provisional  { --rightOverlay: rgba(245,158,11,0.28); }

        /* Keep text above overlay */
        .fc .fc-daygrid-day-top,
        .fc .fc-daygrid-day-events { position: relative; z-index: 1; }
      `}</style>

      <h1 style={{ margin: "0 0 6px" }}>Availability</h1>
      <p style={{ margin: "0 0 12px", opacity: 0.75 }}>
        Drag to include your checkout day (e.g. drag <b>Mon–Fri</b> for a <b>Friday checkout</b>).
        <br />
        🟢 Available • 🟠 Provisional • 🔴 Booked — half highlights show check-in/out days.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 14 }}>
        <div style={{ padding: 12, borderRadius: 12, border: "1px solid #e6e6e6", background: "white" }}>
          <FullCalendar
            plugins={[dayGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            selectable
            selectMirror
            unselectAuto
            select={onSelect}
            height="auto"
            dayCellClassNames={dayCellClassNames}
            dayCellContent={dayCellContent}
          />
        </div>

        <div style={{ padding: 14, borderRadius: 12, border: "1px solid #e6e6e6", background: "white" }}>
          <h2 style={{ margin: "0 0 10px", fontSize: 16 }}>Selected stay</h2>

          {!selectedRange ? (
            <div style={{ opacity: 0.75 }}>
              Drag across the calendar to select your stay.
              {msg && (
                <div
                  style={{
                    marginTop: 10,
                    padding: 10,
                    borderRadius: 10,
                    border: "1px solid #ffd0d0",
                    background: "#fff3f3",
                  }}
                >
                  {msg}
                </div>
              )}
            </div>
          ) : (
            <>
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 12, opacity: 0.7 }}>Arrival</div>
                <div style={{ fontWeight: 800 }}>{selectedRange.start}</div>
              </div>

              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 12, opacity: 0.7 }}>Checkout</div>
                <div style={{ fontWeight: 800 }}>{selectedRange.checkout}</div>
              </div>

              <div style={{ marginBottom: 12 }}>
                ⭐ <b>Nights:</b> {nightsCount(selectedRange.start, selectedRange.checkout)}
              </div>

              <div
                style={{
                  padding: 12,
                  borderRadius: 12,
                  border: "1px solid #eee",
                  background: "#fafafa",
                  marginBottom: 12,
                }}
              >
                <div style={{ fontSize: 12, opacity: 0.7 }}>Estimated price</div>
                {priceInfo?.ok ? (
                  <div style={{ fontSize: 20, fontWeight: 900 }}>£{priceInfo.total}</div>
                ) : (
                  <div style={{ fontWeight: 800 }}>Price not set for these dates</div>
                )}

                <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>
                  {priceInfo?.ok
                    ? priceInfo.method === "total"
                      ? "Using a set total price for this date range."
                      : "Using nightly rates across your selected nights."
                    : "Owner has not set rates for one or more nights."}
                </div>
              </div>

              <button
                onClick={requestBooking}
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  borderRadius: 12,
                  border: "1px solid #111",
                  background: "#111",
                  color: "white",
                  cursor: "pointer",
                  fontWeight: 800,
                }}
              >
                Request booking
              </button>

              <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
                This sends a provisional request — not confirmed until approved.
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
