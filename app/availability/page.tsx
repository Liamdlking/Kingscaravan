"use client";

import React, { useEffect, useMemo, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin, { DateClickArg } from "@fullcalendar/interaction";

type Booking = {
  start_date: string;
  end_date: string; // checkout day (not booked)
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
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + days);
  return isoLocal(d);
}

function eachDay(startISO: string, endISO: string) {
  const out: string[] = [];
  const start = new Date(`${startISO}T00:00:00`);
  const end = new Date(`${endISO}T00:00:00`);

  for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
    out.push(isoLocal(d));
  }

  return out;
}

function nightsCount(startISO: string, endISO: string) {
  const s = new Date(`${startISO}T00:00:00`).getTime();
  const e = new Date(`${endISO}T00:00:00`).getTime();
  return Math.round((e - s) / 86400000);
}

function isAllowedPattern(startISO: string, endISO: string) {
  const start = new Date(`${startISO}T00:00:00`);
  const end = new Date(`${endISO}T00:00:00`);
  const len = nightsCount(startISO, endISO);

  if (len < 3) return { ok: false, reason: "Minimum stay is 3 nights." };

  const startDay = start.getDay(); // 0 Sun .. 6 Sat
  const endDay = end.getDay();

  // Fri → Mon
  if (startDay === 5 && endDay === 1) return { ok: true, reason: "" };

  // Mon → Fri
  if (startDay === 1 && endDay === 5) return { ok: true, reason: "" };

  // Sat → Sat
  if (startDay === 6 && endDay === 6) return { ok: true, reason: "" };

  return {
    ok: false,
    reason: "Allowed stays are Fri–Mon, Mon–Fri, or Sat–Sat.",
  };
}

function calcPrice(startISO: string, endISO: string, rates: Rate[]) {
  // exact total match
  const exactTotal = rates.find(
    (r) => r.rate_type === "total" && r.start_date === startISO && r.end_date === endISO
  );
  if (exactTotal) {
    return {
      ok: true as const,
      total: Number(exactTotal.price),
      method: "total" as const,
    };
  }

  // nightly sum
  const nights = eachDay(startISO, endISO);
  let total = 0;

  for (const day of nights) {
    const nightly = rates.find(
      (r) => r.rate_type === "nightly" && r.start_date <= day && day < r.end_date
    );
    if (!nightly) {
      return {
        ok: false as const,
        total: null,
        method: "missing" as const,
      };
    }
    total += Number(nightly.price);
  }

  return {
    ok: true as const,
    total,
    method: "nightly" as const,
  };
}

export default function AvailabilityPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [rates, setRates] = useState<Rate[]>([]);
  const [msg, setMsg] = useState("");

  const [checkIn, setCheckIn] = useState<string | null>(null);
  const [checkOut, setCheckOut] = useState<string | null>(null);

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

    return {
      confirmedFull,
      provisionalFull,
      inConfirmed,
      inProvisional,
      outConfirmed,
      outProvisional,
    };
  }, [bookings]);

  const dayCellClassNames = (info: any) => {
    const d = isoLocal(info.date);
    const classes: string[] = [];

    if (markers.confirmedFull.has(d)) classes.push("day-confirmed");
    else if (markers.provisionalFull.has(d)) classes.push("day-provisional");
    else classes.push("day-available");

    if (markers.inConfirmed.has(d)) classes.push("in-confirmed");
    if (markers.inProvisional.has(d)) classes.push("in-provisional");
    if (markers.outConfirmed.has(d)) classes.push("out-confirmed");
    if (markers.outProvisional.has(d)) classes.push("out-provisional");

    return classes;
  };

  function selectionHasConfirmed(startISO: string, endISO: string) {
    const days = eachDay(startISO, endISO);
    return days.some((d) => markers.confirmedFull.has(d));
  }

  function onDateClick(arg: DateClickArg) {
    setMsg("");
    const clicked = arg.dateStr; // ✅ exact calendar date clicked

    // First click = check-in
    if (!checkIn) {
      if (markers.confirmedFull.has(clicked)) {
        setMsg("That date is unavailable. Please choose another check-in date.");
        return;
      }
      setCheckIn(clicked);
      setCheckOut(null);
      return;
    }

    // Second click = checkout
    if (checkIn && !checkOut) {
      if (clicked <= checkIn) {
        setMsg("Checkout must be after check-in.");
        return;
      }

      const rule = isAllowedPattern(checkIn, clicked);
      if (!rule.ok) {
        setMsg(rule.reason);
        return;
      }

      if (selectionHasConfirmed(checkIn, clicked)) {
        setMsg("Those dates include unavailable days. Please choose another stay.");
        return;
      }

      setCheckOut(clicked); // ✅ exact clicked day becomes checkout
      return;
    }

    // Third click resets and starts again
    if (markers.confirmedFull.has(clicked)) {
      setMsg("That date is unavailable. Please choose another check-in date.");
      return;
    }

    setCheckIn(clicked);
    setCheckOut(null);
  }

  function clearSelection() {
    setCheckIn(null);
    setCheckOut(null);
    setMsg("");
  }

  const priceInfo = useMemo(() => {
    if (!checkIn || !checkOut) return null;
    return calcPrice(checkIn, checkOut, rates);
  }, [checkIn, checkOut, rates]);

  const nights = useMemo(() => {
    if (!checkIn || !checkOut) return null;
    return nightsCount(checkIn, checkOut);
  }, [checkIn, checkOut]);

  const selectionEvent = useMemo(() => {
    if (!checkIn) return [];

    // Highlight selected nights only. If checkout chosen, highlight [checkIn, checkOut)
    // If only check-in chosen, highlight just that day visually.
    const end = checkOut ?? addDaysISO(checkIn, 1);

    return [
      {
        id: "selected-range",
        start: checkIn,
        end,
        display: "background" as const,
        backgroundColor: "rgba(59,130,246,0.18)",
      },
    ];
  }, [checkIn, checkOut]);

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

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: 18 }}>
      <style>{`
        .fc .fc-daygrid-day.day-available .fc-daygrid-day-frame { background: rgba(34,197,94,0.10); }
        .fc .fc-daygrid-day.day-confirmed .fc-daygrid-day-frame { background: rgba(239,68,68,0.12); }
        .fc .fc-daygrid-day.day-provisional .fc-daygrid-day-frame { background: rgba(245,158,11,0.14); }

        .fc .fc-daygrid-day-frame {
          border-radius: 10px;
          overflow: hidden;
          position: relative;
        }

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

        .fc .fc-daygrid-day.out-confirmed { --leftOverlay: rgba(239,68,68,0.26); }
        .fc .fc-daygrid-day.in-confirmed  { --rightOverlay: rgba(239,68,68,0.26); }

        .fc .fc-daygrid-day.out-provisional { --leftOverlay: rgba(245,158,11,0.28); }
        .fc .fc-daygrid-day.in-provisional  { --rightOverlay: rgba(245,158,11,0.28); }

        .fc .fc-daygrid-day-top,
        .fc .fc-daygrid-day-events { position: relative; z-index: 1; }
      `}</style>

      <h1 style={{ margin: "0 0 6px" }}>Availability</h1>
      <p style={{ margin: "0 0 12px", opacity: 0.75 }}>
        Click your <b>check-in</b> date, then click your <b>checkout</b> date.
        <br />
        Example: click <b>Friday 17th</b>, then click <b>Monday 20th</b> for a Monday checkout.
        <br />
        Minimum stay <b>3 nights</b>. Allowed stays: <b>Fri–Mon</b>, <b>Mon–Fri</b>, or <b>Sat–Sat</b>.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 14 }}>
        <div style={{ padding: 12, borderRadius: 12, border: "1px solid #e6e6e6", background: "white" }}>
          <FullCalendar
            plugins={[dayGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            height="auto"
            selectable={false}
            dateClick={onDateClick}
            dayCellClassNames={dayCellClassNames}
            events={selectionEvent}
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
                <div style={{ marginBottom: 12 }}>
                  Nights: <b>{nights}</b>
                </div>
              )}

              {checkIn && checkOut && (
                <div style={{ padding: 12, borderRadius: 12, border: "1px solid #eee", background: "#fafafa", marginBottom: 12 }}>
                  <div style={{ fontSize: 12, opacity: 0.7 }}>Estimated price</div>
                  {priceInfo?.ok ? (
                    <div style={{ fontSize: 20, fontWeight: 900 }}>£{priceInfo.total}</div>
                  ) : (
                    <div style={{ fontWeight: 800 }}>Price not set for these dates</div>
                  )}
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
        </div>
      </div>
    </div>
  );
}