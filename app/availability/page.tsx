"use client";

import React, { useEffect, useMemo, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin, { DateClickArg } from "@fullcalendar/interaction";
import type { EventContentArg } from "@fullcalendar/core";

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

function eachDay(startISO: string, endISO: string) {
  const out: string[] = [];
  const start = new Date(`${startISO}T00:00:00Z`);
  const end = new Date(`${endISO}T00:00:00Z`);
  for (let d = new Date(start); d < end; d.setUTCDate(d.getUTCDate() + 1)) {
    out.push(d.toISOString().slice(0, 10));
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

  if (startDay === 5 && endDay === 1) return { ok: true, reason: "" };
  if (startDay === 1 && endDay === 5) return { ok: true, reason: "" };
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
    const nightly = rates.find(
      (r) => r.rate_type === "nightly" && r.start_date <= day && day < r.end_date
    );
    if (!nightly) return { ok: false as const, total: null, method: "missing" as const };
    total += Number(nightly.price);
  }

  return { ok: true as const, total, method: "nightly" as const };
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

  function selectionHasConfirmed(startISO: string, endISO: string) {
    const days = eachDay(startISO, endISO);
    const confirmed = new Set(
      bookings
        .filter((b) => b.status === "confirmed")
        .flatMap((b) => eachDay(b.start_date, b.end_date))
    );
    return days.some((d) => confirmed.has(d));
  }

  function onDateClick(arg: DateClickArg) {
    setMsg("");
    const clicked = arg.dateStr;

    if (!checkIn) {
      if (
        bookings.some(
          (b) => b.status === "confirmed" && eachDay(b.start_date, b.end_date).includes(clicked)
        )
      ) {
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

  const bookingEvents = useMemo(() => {
    return bookings.map((b, idx) => ({
      id: `public-booking-${b.id ?? idx}`,
      title: b.status === "confirmed" ? "Booked" : "Provisional",
      start: b.start_date,
      end: b.end_date,
      allDay: true,
      display: "block" as const,
      extendedProps: {
        kind: "booking",
        bookingStatus: b.status,
      },
    }));
  }, [bookings]);

  const selectionEvents = useMemo(() => {
    if (!checkIn) return [];
    return [
      {
        id: "selected-band",
        title: checkOut ? "Your dates" : "Check-in selected",
        start: checkIn,
        end:
          checkOut ??
          new Date(new Date(`${checkIn}T00:00:00`).getTime() + 86400000)
            .toISOString()
            .slice(0, 10),
        allDay: true,
        display: "block" as const,
        extendedProps: {
          kind: "selection",
        },
      },
    ];
  }, [checkIn, checkOut]);

  const allEvents = useMemo(() => [...bookingEvents, ...selectionEvents], [bookingEvents, selectionEvents]);

  function eventClassNames(arg: any) {
    const kind = arg.event.extendedProps?.kind;
    if (kind === "booking") {
      return [
        "calendar-band",
        "public-booking-band",
        arg.event.extendedProps.bookingStatus === "confirmed"
          ? "public-booking-confirmed"
          : "public-booking-provisional",
      ];
    }
    if (kind === "selection") return ["calendar-band", "selection-band"];
    return [];
  }

  function eventContent(arg: EventContentArg) {
    const kind = (arg.event.extendedProps as any)?.kind;
    if (kind === "booking") {
      return (
        <div className="band-inner">
          <div className="band-title">{arg.event.title}</div>
        </div>
      );
    }
    if (kind === "selection") {
      return (
        <div className="band-inner">
          <div className="band-title" style={{ color: "#1d4ed8" }}>{arg.event.title}</div>
        </div>
      );
    }
    return <div>{arg.event.title}</div>;
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
        .fc .fc-daygrid-day-frame {
          border-radius: 10px;
          overflow: visible;
        }

        .fc .fc-daygrid-day {
          background: #f8fafc;
        }

        .fc .fc-scrollgrid,
        .fc .fc-scrollgrid td,
        .fc .fc-scrollgrid th {
          border-color: #e5e7eb;
        }

        .fc .fc-col-header-cell-cushion,
        .fc .fc-daygrid-day-number {
          color: #111827;
          text-decoration: none !important;
          font-weight: 700;
        }

        .fc .fc-daygrid-event-harness {
          margin-top: 2px;
        }

        .fc .fc-daygrid-event-harness .fc-h-event,
        .fc .fc-daygrid-event-harness .calendar-band {
          display: block !important;
          width: 100% !important;
          max-width: 100% !important;
        }

        .fc .calendar-band {
          border: none !important;
          border-radius: 0 !important;
          padding: 0 !important;
          min-height: 22px;
          box-shadow: none !important;
        }

        .fc .public-booking-band {
          min-height: 22px;
        }

        .fc .public-booking-confirmed {
          background: #f7cfd2 !important;
        }

        .fc .public-booking-provisional {
          background: #f4d08a !important;
        }

        .fc .selection-band {
          background: rgba(59,130,246,0.18) !important;
        }

        .fc .calendar-band.fc-event-start:not(.fc-event-end) {
          margin-left: 50% !important;
        }

        .fc .calendar-band.fc-event-end:not(.fc-event-start) {
          margin-right: 50% !important;
        }

        .fc .calendar-band.fc-event-start.fc-event-end {
          margin-left: 50% !important;
          margin-right: 50% !important;
        }

        .fc .band-inner {
          display: flex;
          flex-direction: column;
          gap: 2px;
          padding: 2px 4px;
          overflow: hidden;
          width: 100%;
          box-sizing: border-box;
        }

        .fc .band-title {
          font-size: 11px;
          font-weight: 900;
          color: #7f1d1d;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          background: rgba(255,255,255,0.3);
          padding: 1px 4px;
          border-radius: 4px;
          width: fit-content;
          max-width: 100%;
        }

        .fc .public-booking-provisional .band-title {
          color: #92400e;
        }

        .fc .fc-daygrid-more-link {
          color: #374151;
          font-weight: 700;
        }
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
            events={allEvents}
            eventClassNames={eventClassNames}
            eventContent={eventContent}
            dayMaxEvents={4}
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

          <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
            This creates a provisional request — not confirmed until approved.
          </div>
        </div>
      </div>
    </div>
  );
}