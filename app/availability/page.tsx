"use client";

import React, { useEffect, useMemo, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { DateClickArg } from "@fullcalendar/core";

type Booking = {
  start_date: string;
  end_date: string; // exclusive (checkout day)
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

function iso(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(isoDate: string, days: number) {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function eachDay(startISO: string, endISO: string) {
  const out: string[] = [];
  const start = new Date(`${startISO}T00:00:00.000Z`);
  const end = new Date(`${endISO}T00:00:00.000Z`);
  for (let d = new Date(start); d < end; d.setUTCDate(d.getUTCDate() + 1)) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

function nightsCount(startISO: string, endISO: string) {
  const a = new Date(`${startISO}T00:00:00Z`).getTime();
  const b = new Date(`${endISO}T00:00:00Z`).getTime();
  return Math.round((b - a) / 86400000);
}

function isAllowedPattern(startISO: string, endISO: string) {
  const start = new Date(`${startISO}T00:00:00Z`);
  const end = new Date(`${endISO}T00:00:00Z`);
  const len = nightsCount(startISO, endISO);

  if (len < 3) return { ok: false, reason: "Minimum stay is 3 nights." };

  const startDay = start.getUTCDay(); // 0 Sun .. 6 Sat
  const endDay = end.getUTCDay();

  // Fri → Mon (3 nights)
  if (startDay === 5 && endDay === 1) return { ok: true, reason: "" };
  // Mon → Fri (4 nights)
  if (startDay === 1 && endDay === 5) return { ok: true, reason: "" };
  // Sat → Sat (7 nights)
  if (startDay === 6 && endDay === 6) return { ok: true, reason: "" };

  return { ok: false, reason: "Allowed stays are Fri–Mon, Mon–Fri, or Sat–Sat." };
}

function calcPrice(startISO: string, endISO: string, rates: Rate[]) {
  const exactTotal = rates.find(
    (r) => r.rate_type === "total" && r.start_date === startISO && r.end_date === endISO
  );
  if (exactTotal) {
    return { ok: true as const, total: Number(exactTotal.price), method: "total" as const };
  }

  const nights = eachDay(startISO, endISO);
  let total = 0;

  for (const day of nights) {
    const nightly = rates.find((r) => r.rate_type === "nightly" && r.start_date <= day && day < r.end_date);
    if (!nightly) return { ok: false as const, total: null, method: "missing" as const };
    total += Number(nightly.price);
  }

  return { ok: true as const, total, method: "nightly" as const };
}

export default function AvailabilityPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [rates, setRates] = useState<Rate[]>([]);
  const [msg, setMsg] = useState<string>("");

  const [checkIn, setCheckIn] = useState<string | null>(null);
  const [checkOut, setCheckOut] = useState<string | null>(null);

  const priceInfo = useMemo(() => {
    if (!checkIn || !checkOut) return null;
    return calcPrice(checkIn, checkOut, rates);
  }, [checkIn, checkOut, rates]);

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

  function selectionHasConfirmed(startISO: string, endISO: string) {
    const days = eachDay(startISO, endISO);
    return days.some((d) => confirmedDates.has(d));
  }

  const dayCellClassNames = (info: any) => {
    const d = info.date.toISOString().slice(0, 10);
    if (confirmedDates.has(d)) return ["day-confirmed"];
    if (provisionalDates.has(d)) return ["day-provisional"];
    return ["day-available"];
  };

  // Visual: show selected range as a background highlight
  const selectionEvent = useMemo(() => {
    if (!checkIn || !checkOut) return [];
    return [
      {
        id: "selected-range",
        start: checkIn,
        end: checkOut,
        display: "background" as const,
        backgroundColor: "rgba(59,130,246,0.18)",
      },
    ];
  }, [checkIn, checkOut]);

  // Optional: show rate spans as faint background (still visible)
  const rateEvents = useMemo(() => {
    return rates.map((r) => ({
      id: `rate-${r.id}`,
      start: r.start_date,
      end: r.end_date,
      title: "",
      display: "background" as const,
      backgroundColor: "rgba(34,197,94,0.10)",
    }));
  }, [rates]);

  function onDateClick(arg: DateClickArg) {
    setMsg("");
    const clicked = arg.date.toISOString().slice(0, 10);

    // Disallow starting on booked day (confirmed)
    if (!checkIn && confirmedDates.has(clicked)) {
      setMsg("That date is not available. Please choose an available check-in date.");
      return;
    }

    // 1st click sets check-in
    if (!checkIn) {
      setCheckIn(clicked);
      setCheckOut(null);
      return;
    }

    // 2nd click sets checkout (must be after check-in)
    if (checkIn && !checkOut) {
      if (clicked <= checkIn) {
        setMsg("Checkout must be after check-in. Please choose a later date.");
        return;
      }

      const start = checkIn;
      const end = clicked; // checkout day (exclusive). User clicked checkout day.

      const rule = isAllowedPattern(start, end);
      if (!rule.ok) {
        setMsg(rule.reason);
        return;
      }

      if (selectionHasConfirmed(start, end)) {
        setMsg("Those dates include booked (unavailable) days. Please choose different dates.");
        return;
      }

      setCheckOut(end);
      return;
    }

    // If both already set, clicking starts a fresh selection
    setCheckIn(clicked);
    setCheckOut(null);
  }

  function clearSelection() {
    setCheckIn(null);
    setCheckOut(null);
    setMsg("");
  }

  function requestBooking() {
    if (!checkIn || !checkOut) return;

    const params = new URLSearchParams();
    params.set("start", checkIn);
    params.set("end", checkOut);

    if (priceInfo?.ok && priceInfo.total != null) {
      params.set("price", String(priceInfo.total));
      params.set("price_method", String(priceInfo.method));
    }

    window.location.href = `/book?${params.toString()}`;
  }

  const nights = checkIn && checkOut ? nightsCount(checkIn, checkOut) : null;

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: 18 }}>
      <style>{`
        .day-available { background: rgba(34,197,94,0.10); }
        .day-confirmed { background: rgba(239,68,68,0.12); }
        .day-provisional { background: rgba(245,158,11,0.14); }
        .fc .fc-daygrid-day-frame { border-radius: 10px; overflow: hidden; }
      `}</style>

      <h1 style={{ margin: "0 0 6px" }}>Availability</h1>
      <p style={{ margin: "0 0 12px", opacity: 0.75 }}>
        ✅ Click your <b>check-in</b> date, then click your <b>checkout</b> date.
        <br />
        Minimum stay <b>3 nights</b>. Allowed stays: <b>Fri–Mon</b>, <b>Mon–Fri</b>, or <b>Sat–Sat</b>.
        <br />
        🟢 Available • 🟠 Provisional • 🔴 Booked
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 14 }}>
        <div style={{ padding: 12, borderRadius: 12, border: "1px solid #e6e6e6", background: "white" }}>
          <FullCalendar
            plugins={[dayGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            selectable={false}
            dateClick={onDateClick}
            height="auto"
            dayCellClassNames={dayCellClassNames}
            events={[...rateEvents, ...selectionEvent]}
          />
        </div>

        <div style={{ padding: 14, borderRadius: 12, border: "1px solid #e6e6e6", background: "white" }}>
          <h2 style={{ margin: "0 0 10px", fontSize: 16 }}>Your selection</h2>

          {!checkIn ? (
            <div style={{ opacity: 0.75 }}>Click a check-in date to start.</div>
          ) : (
            <>
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 12, opacity: 0.7 }}>Check-in</div>
                <div style={{ fontWeight: 800 }}>{checkIn}</div>
              </div>

              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 12, opacity: 0.7 }}>Checkout</div>
                <div style={{ fontWeight: 800 }}>{checkOut ?? "Now click your checkout date"}</div>
              </div>

              {nights != null && (
                <div style={{ marginBottom: 12, fontSize: 13, opacity: 0.8 }}>
                  Nights: <b>{nights}</b>
                </div>
              )}

              {checkIn && checkOut && (
                <div style={{ padding: 12, borderRadius: 12, border: "1px solid #eee", background: "#fafafa", marginBottom: 12 }}>
                  <div style={{ fontSize: 12, opacity: 0.7 }}>Estimated price</div>
                  {priceInfo?.ok ? (
                    <div style={{ fontSize: 22, fontWeight: 900 }}>£{priceInfo.total}</div>
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
              )}

              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={clearSelection}
                  style={{
                    flex: 1,
                    padding: "12px 14px",
                    borderRadius: 12,
                    border: "1px solid #ddd",
                    background: "white",
                    cursor: "pointer",
                    fontWeight: 800,
                  }}
                >
                  Clear
                </button>

                <button
                  onClick={requestBooking}
                  disabled={!checkIn || !checkOut}
                  style={{
                    flex: 2,
                    padding: "12px 14px",
                    borderRadius: 12,
                    border: "1px solid #111",
                    background: !checkIn || !checkOut ? "#f3f4f6" : "#111",
                    color: !checkIn || !checkOut ? "#6b7280" : "white",
                    cursor: !checkIn || !checkOut ? "not-allowed" : "pointer",
                    fontWeight: 900,
                  }}
                >
                  Request booking
                </button>
              </div>
            </>
          )}

          {msg && (
            <div style={{ marginTop: 12, padding: 10, borderRadius: 10, border: "1px solid #ffd0d0", background: "#fff3f3" }}>
              {msg}
            </div>
          )}

          <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
            This creates a provisional request — not confirmed until approved.
          </div>
        </div>
      </div>
    </div>
  );
}