"use client";

import React, { useEffect, useMemo, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { DateSelectArg } from "@fullcalendar/core";

type Booking = {
  start_date: string;
  end_date: string; // exclusive
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

function eachDay(startISO: string, endISO: string) {
  const out: string[] = [];
  const start = new Date(`${startISO}T00:00:00.000Z`);
  const end = new Date(`${endISO}T00:00:00.000Z`);
  for (let d = new Date(start); d < end; d.setUTCDate(d.getUTCDate() + 1)) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

function nightsCount(start: Date, end: Date) {
  return Math.round((end.getTime() - start.getTime()) / 86400000);
}

function isAllowedPattern(start: Date, end: Date) {
  const len = nightsCount(start, end);
  if (len < 3) return { ok: false, reason: "Minimum stay is 3 nights." };

  const startDay = start.getDay(); // 0 Sun .. 6 Sat
  const endDay = end.getDay();

  // Fri → Mon (3 nights)
  if (startDay === 5 && endDay === 1) return { ok: true, reason: "" };

  // Mon → Fri (4 nights)
  if (startDay === 1 && endDay === 5) return { ok: true, reason: "" };

  // Sat → Sat (7 nights)
  if (startDay === 6 && endDay === 6) return { ok: true, reason: "" };

  return {
    ok: false,
    reason: "Allowed stays are Fri–Mon, Mon–Fri, or Sat–Sat.",
  };
}

function calcPrice(startISO: string, endISO: string, rates: Rate[]) {
  // If there's a TOTAL rate that exactly matches, use it
  const exactTotal = rates.find(
    (r) => r.rate_type === "total" && r.start_date === startISO && r.end_date === endISO
  );
  if (exactTotal) {
    return { ok: true as const, total: Number(exactTotal.price), method: "total" as const };
  }

  // Otherwise sum nightly prices for each night/day in [start,end)
  const nights = eachDay(startISO, endISO);
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
  const [selectedRange, setSelectedRange] = useState<{ start: string; end: string } | null>(null);
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

  // Date sets for colouring + blocking
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

  // Add price overlays as background events (this was blocking drag-select before)
  const rateEvents = useMemo(() => {
    return rates.map((r) => ({
      id: `rate-${r.id}`,
      title: r.rate_type === "nightly" ? `£${r.price}/night` : `£${r.price} total`,
      start: r.start_date,
      end: r.end_date,
      display: "background" as const,
    }));
  }, [rates]);

  const dayCellClassNames = (info: any) => {
    const d = iso(info.date);
    if (confirmedDates.has(d)) return ["day-confirmed"];
    if (provisionalDates.has(d)) return ["day-provisional"];
    return ["day-available"];
  };

  function selectionHasConfirmed(startISO: string, endISO: string) {
    const days = eachDay(startISO, endISO);
    return days.some((d) => confirmedDates.has(d));
  }

  function onSelect(sel: DateSelectArg) {
    setMsg("");

    const rule = isAllowedPattern(sel.start, sel.end);
    const start = iso(sel.start);
    const end = iso(sel.end);

    if (!rule.ok) {
      setSelectedRange(null);
      setPriceInfo(null);
      setMsg(rule.reason);
      return;
    }

    if (selectionHasConfirmed(start, end)) {
      setSelectedRange(null);
      setPriceInfo(null);
      setMsg("Those dates include booked days. Please choose available dates.");
      return;
    }

    setSelectedRange({ start, end });
    setPriceInfo(calcPrice(start, end, rates));
  }

  function requestBooking() {
    if (!selectedRange) return;

    const params = new URLSearchParams();
    params.set("start", selectedRange.start);
    params.set("end", selectedRange.end);

    if (priceInfo?.ok && priceInfo.total != null) {
      params.set("price", String(priceInfo.total));
      params.set("price_method", String(priceInfo.method));
    }

    window.location.href = `/book?${params.toString()}`;
  }

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: 18 }}>
      <style>{`
        .day-available { background: rgba(34,197,94,0.10); }
        .day-confirmed { background: rgba(239,68,68,0.12); }
        .day-provisional { background: rgba(245,158,11,0.14); }
        .fc .fc-daygrid-day-frame { border-radius: 8px; overflow: hidden; }
      `}</style>

      <h1 style={{ margin: "0 0 6px" }}>Availability</h1>
      <p style={{ margin: "0 0 12px", opacity: 0.75 }}>
        Minimum stay <b>3 nights</b>. Allowed stays: <b>Fri–Mon</b>, <b>Mon–Fri</b>, or <b>Sat–Sat</b>.
        <br />
        🟢 Available • 🟠 Provisional • 🔴 Booked
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 14 }}>
        <div style={{ padding: 12, borderRadius: 12, border: "1px solid #e6e6e6", background: "white" }}>
          <FullCalendar
            plugins={[dayGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            height="auto"
            dayCellClassNames={dayCellClassNames}
            events={rateEvents}
            selectable={true}
            selectMirror={true}
            unselectAuto={true}
            select={onSelect}

            // ✅ KEY FIX: allow selecting even if rate background ranges overlap
            selectOverlap={true}
            selectAllow={() => true}

            // ✅ makes dragging easier on touch devices
            longPressDelay={50}
            selectLongPressDelay={50}

            // optional
            dragScroll={true}
          />
        </div>

        <div style={{ padding: 14, borderRadius: 12, border: "1px solid #e6e6e6", background: "white" }}>
          <h2 style={{ margin: "0 0 10px", fontSize: 16 }}>Selected dates</h2>

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
                <div style={{ fontWeight: 700 }}>{selectedRange.start}</div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, opacity: 0.7 }}>Departure (checkout)</div>
                <div style={{ fontWeight: 700 }}>{selectedRange.end}</div>
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
                  <div style={{ fontSize: 20, fontWeight: 800 }}>£{priceInfo.total}</div>
                ) : (
                  <div style={{ fontWeight: 700 }}>Price not set for these dates</div>
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
                  border: "1px solid #ddd",
                  background: "white",
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                Request booking for these dates
              </button>

              <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
                This creates a provisional request — not confirmed until approved.
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
