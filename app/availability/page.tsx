"use client";

import React, { useEffect, useMemo, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin, { DateClickArg } from "@fullcalendar/interaction";

type Booking = {
  id?: string;
  start_date: string;
  end_date: string; // checkout day
  status: "provisional" | "confirmed";
  guest_name?: string | null;
};

type Rate = {
  id: string;
  start_date: string;
  end_date: string; // exclusive
  price: number;
  rate_type: "nightly" | "total";
  note?: string | null;
};

type CellState =
  | "available"
  | "confirmed"
  | "provisional"
  | "selected"
  | "selected-checkin"
  | "selected-checkout"
  | "confirmed-checkin"
  | "confirmed-checkout"
  | "provisional-checkin"
  | "provisional-checkout";

type CellMeta = {
  state: CellState;
  bookingName?: string;
  price?: string;
};

function isoLocal(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
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

  const startDay = start.getDay();
  const endDay = end.getDay();

  if (startDay === 5 && endDay === 1) return { ok: true, reason: "" }; // Fri-Mon
  if (startDay === 1 && endDay === 5) return { ok: true, reason: "" }; // Mon-Fri
  if (startDay === 6 && endDay === 6) return { ok: true, reason: "" }; // Sat-Sat

  return { ok: false, reason: "Allowed stays are Fri–Mon, Mon–Fri, or Sat–Sat." };
}

function calcPrice(startISO: string, endISO: string, rates: Rate[]) {
  const exactTotal = rates.find(
    (r) =>
      r.rate_type === "total" &&
      r.start_date === startISO &&
      r.end_date === endISO
  );
  if (exactTotal) {
    return { ok: true as const, total: Number(exactTotal.price), method: "total" as const };
  }

  const nights = eachDay(startISO, endISO);
  let total = 0;

  for (const day of nights) {
    const nightly = rates.find(
      (r) =>
        r.rate_type === "nightly" &&
        r.start_date <= day &&
        day < r.end_date
    );
    if (!nightly) {
      return { ok: false as const, total: null, method: "missing" as const };
    }
    total += Number(nightly.price);
  }

  return { ok: true as const, total, method: "nightly" as const };
}

function getDailyDisplayPrice(day: string, rates: Rate[]) {
  const nightly = rates.find(
    (r) =>
      r.rate_type === "nightly" &&
      r.start_date <= day &&
      day < r.end_date
  );
  if (nightly) return `£${Number(nightly.price)}`;

  const total = rates.find(
    (r) =>
      r.rate_type === "total" &&
      r.start_date <= day &&
      day < r.end_date
  );
  if (total) return `£${Number(total.price)}`;

  return "";
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

  const confirmedBookedDays = useMemo(() => {
    const set = new Set<string>();
    bookings
      .filter((b) => b.status === "confirmed")
      .forEach((b) => eachDay(b.start_date, b.end_date).forEach((d) => set.add(d)));
    return set;
  }, [bookings]);

  function selectionHasConfirmed(startISO: string, endISO: string) {
    const days = eachDay(startISO, endISO);
    return days.some((d) => confirmedBookedDays.has(d));
  }

  function onDateClick(arg: DateClickArg) {
    setMsg("");
    const clicked = arg.dateStr;

    if (!checkIn) {
      if (confirmedBookedDays.has(clicked)) {
        setMsg("That date is unavailable. Please choose another check-in date.");
        return;
      }
      setCheckIn(clicked);
      setCheckOut(null);
      return;
    }

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

      setCheckOut(clicked);
      return;
    }

    if (confirmedBookedDays.has(clicked)) {
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

  const cellMap = useMemo(() => {
    const map = new Map<string, CellMeta>();

    // Fill rate-based available tiles
    for (const r of rates) {
      eachDay(r.start_date, r.end_date).forEach((day) => {
        if (!map.has(day)) {
          map.set(day, {
            state: "available",
            price: getDailyDisplayPrice(day, rates),
          });
        }
      });
    }

    // Apply bookings
    for (const b of bookings) {
      const bookedDays = eachDay(b.start_date, b.end_date);
      const bookingName = b.guest_name || (b.status === "confirmed" ? "Booked" : "Provisional");

      bookedDays.forEach((day, idx) => {
        const state =
          b.status === "confirmed"
            ? (idx === 0 ? "confirmed-checkin" : "confirmed")
            : (idx === 0 ? "provisional-checkin" : "provisional");

        map.set(day, {
          state,
          bookingName,
          price: getDailyDisplayPrice(day, rates),
        });
      });

      map.set(b.end_date, {
        state: b.status === "confirmed" ? "confirmed-checkout" : "provisional-checkout",
        bookingName,
        price: getDailyDisplayPrice(b.end_date, rates),
      });
    }

    // Apply user selection on top
    if (checkIn) {
      if (!checkOut) {
        map.set(checkIn, {
          ...(map.get(checkIn) || { price: getDailyDisplayPrice(checkIn, rates) }),
          state: "selected-checkin",
        });
      } else {
        const selectedDays = eachDay(checkIn, checkOut);

        selectedDays.forEach((day, idx) => {
          map.set(day, {
            ...(map.get(day) || { price: getDailyDisplayPrice(day, rates) }),
            state: idx === 0 ? "selected-checkin" : "selected",
          });
        });

        map.set(checkOut, {
          ...(map.get(checkOut) || { price: getDailyDisplayPrice(checkOut, rates) }),
          state: "selected-checkout",
        });
      }
    }

    return map;
  }, [bookings, rates, checkIn, checkOut]);

  function dayCellClassNames(arg: any) {
    const meta = cellMap.get(arg.dateStr);
    if (!meta) return ["tile-frame", "tile-available"];
    return ["tile-frame", `tile-${meta.state}`];
  }

  function dayCellContent(arg: any) {
    const meta = cellMap.get(arg.dateStr);
    const dayNum = arg.dayNumberText.replace(/\D/g, "");

    return (
      <div className="tile-inner">
        <div className="tile-day">{dayNum}</div>
        {meta?.bookingName && (
          <div className="tile-booking-name">{meta.bookingName}</div>
        )}
        {meta?.state === "selected-checkin" && (
          <div className="tile-selected-label">Check-in</div>
        )}
        {meta?.state === "selected-checkout" && (
          <div className="tile-selected-label">Checkout</div>
        )}
        {meta?.state === "selected" && (
          <div className="tile-selected-label">Selected</div>
        )}
        {meta?.price && <div className="tile-price">{meta.price}</div>}
      </div>
    );
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

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: 18 }}>
      <style>{`
        .fc .fc-toolbar-title {
          font-size: 30px !important;
          font-weight: 800 !important;
        }

        .fc .fc-daygrid-day {
          background: #ffffff;
        }

        .fc .fc-scrollgrid,
        .fc .fc-scrollgrid td,
        .fc .fc-scrollgrid th {
          border-color: #ffffff;
        }

        .fc .fc-col-header-cell {
          background: #ffffff;
        }

        .fc .fc-col-header-cell-cushion {
          text-decoration: none !important;
          font-size: 15px;
          font-weight: 700;
          color: #6b7280;
          padding: 10px 0;
        }

        .fc .fc-daygrid-day-top {
          display: none !important;
        }

        .fc .fc-daygrid-day-frame {
          min-height: 96px;
          padding: 0 !important;
          border-radius: 0 !important;
          overflow: hidden;
          box-sizing: border-box;
        }

        .tile-frame {
          color: #fff;
        }

        .tile-available {
          background: #5fa03e;
        }

        .tile-confirmed {
          background: #d84848;
        }

        .tile-provisional {
          background: #d99a4b;
        }

        .tile-selected {
          background: #5c8fce;
        }

        .tile-confirmed-checkin {
          background: linear-gradient(135deg, #5fa03e 0 49%, #d84848 51% 100%);
        }

        .tile-confirmed-checkout {
          background: linear-gradient(135deg, #d84848 0 49%, #5fa03e 51% 100%);
        }

        .tile-provisional-checkin {
          background: linear-gradient(135deg, #5fa03e 0 49%, #d99a4b 51% 100%);
        }

        .tile-provisional-checkout {
          background: linear-gradient(135deg, #d99a4b 0 49%, #5fa03e 51% 100%);
        }

        .tile-selected-checkin {
          background: linear-gradient(135deg, #5fa03e 0 49%, #5c8fce 51% 100%);
        }

        .tile-selected-checkout {
          background: linear-gradient(135deg, #5c8fce 0 49%, #5fa03e 51% 100%);
        }

        .tile-inner {
          position: relative;
          min-height: 96px;
          padding: 8px;
          box-sizing: border-box;
        }

        .tile-day {
          font-size: 18px;
          font-weight: 800;
          color: #fff;
          line-height: 1;
        }

        .fc .fc-day-other .tile-day {
          opacity: 0.4;
        }

        .tile-booking-name {
          position: absolute;
          top: 34px;
          left: 8px;
          right: 8px;
          font-size: 11px;
          font-weight: 700;
          color: #fff;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .tile-selected-label {
          position: absolute;
          top: 34px;
          left: 8px;
          right: 8px;
          font-size: 11px;
          font-weight: 800;
          color: #fff;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .tile-price {
          position: absolute;
          bottom: 8px;
          left: 8px;
          font-size: 12px;
          font-weight: 700;
          color: rgba(255,255,255,.88);
        }

        .fc .fc-daygrid-event-harness,
        .fc .fc-daygrid-event,
        .fc .fc-daygrid-event-harness-abs,
        .fc .fc-daygrid-more-link {
          display: none !important;
        }
      `}</style>

      <h1 style={{ margin: "0 0 6px" }}>Availability</h1>
      <p style={{ margin: "0 0 12px", opacity: 0.75 }}>
        Click your <b>check-in</b> date, then click your <b>checkout</b> date.
        <br />
        Minimum stay <b>3 nights</b>. Allowed stays: <b>Fri–Mon</b>, <b>Mon–Fri</b>, or <b>Sat–Sat</b>.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 14 }}>
        <div
          style={{
            padding: 12,
            borderRadius: 12,
            border: "1px solid #e6e6e6",
            background: "white",
          }}
        >
          <FullCalendar
            plugins={[dayGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            height="auto"
            selectable={false}
            dateClick={onDateClick}
            dayCellClassNames={dayCellClassNames}
            dayCellContent={dayCellContent}
            events={[]}
          />
        </div>

        <div
          style={{
            padding: 14,
            borderRadius: 12,
            border: "1px solid #e6e6e6",
            background: "white",
          }}
        >
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
                <div style={{ fontWeight: 800 }}>
                  {checkOut ?? "Now click your checkout date"}
                </div>
              </div>

              {nights != null && (
                <div style={{ marginBottom: 12 }}>
                  Nights: <b>{nights}</b>
                </div>
              )}

              {checkIn && checkOut && (
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
            <div
              style={{
                marginTop: 12,
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
      </div>
    </div>
  );
}