"use client";

import React, { useEffect, useMemo, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { DateSelectArg, EventClickArg } from "@fullcalendar/core";

type Status = "confirmed" | "provisional";

type Booking = {
  id: string;
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD checkout day (exclusive)
  status: Status;

  guest_name: string;
  guest_email?: string | null;
  phone?: string | null;

  guests_count?: number | null;
  children_count?: number | null;
  dogs_count?: number | null;

  vehicle_reg?: string | null;
  price?: number | null;
  special_requests?: string | null;
};

function fmtISO(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function OwnerCalendarPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/bookings", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to load");
      setBookings(json.bookings ?? []);
    } catch (e: any) {
      setError(e?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const events = useMemo(() => {
    return bookings.map((b) => ({
      id: b.id,
      title: b.guest_name || "(no name)",
      start: b.start_date,
      end: b.end_date, // exclusive = checkout day not booked
      backgroundColor: b.status === "confirmed" ? "#ef4444" : "#f59e0b",
      borderColor: b.status === "confirmed" ? "#ef4444" : "#f59e0b",
      textColor: "#111827",
      extendedProps: b,
    }));
  }, [bookings]);

  async function addBooking(sel: DateSelectArg) {
    const start = fmtISO(sel.start);
    const end = fmtISO(sel.end); // exclusive

    // Quick prompts (fast owner add)
    const guest_name = window.prompt("Guest name?");
    if (!guest_name) return;

    const statusPrompt =
      window.prompt('Status? Type "confirmed" or "provisional"', "confirmed") || "confirmed";
    const status: Status = statusPrompt.toLowerCase().startsWith("p") ? "provisional" : "confirmed";

    const phone = window.prompt("Phone (optional)") || "";
    const guest_email = window.prompt("Email (optional)") || "";
    const priceStr = window.prompt("Price (optional)") || "";
    const price = priceStr ? Number(priceStr.replace(/[,£]/g, "")) : null;

    const res = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        start_date: start,
        end_date: end,
        status,
        guest_name,
        phone: phone || null,
        guest_email: guest_email || null,
        price: Number.isFinite(price as any) ? price : null,
      }),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(json?.error || "Could not add booking");
      return;
    }

    await refresh();
  }

  async function onEventClick(arg: EventClickArg) {
    const b = arg.event.extendedProps as Booking;

    const action = window.prompt(
      [
        `Booking: ${b.guest_name}`,
        `${b.start_date} → ${b.end_date} (${b.status})`,
        "",
        'Type "edit" to edit, "delete" to delete, or Cancel.',
      ].join("\n"),
      "edit"
    );

    if (!action) return;

    if (action.toLowerCase() === "delete") {
      if (!window.confirm("Delete this booking?")) return;

      const res = await fetch(`/api/bookings?id=${encodeURIComponent(b.id)}`, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(json?.error || "Could not delete");
        return;
      }
      await refresh();
      return;
    }

    if (action.toLowerCase() === "edit") {
      const guest_name = window.prompt("Guest name", b.guest_name) ?? b.guest_name;
      const statusPrompt =
        window.prompt('Status: "confirmed" or "provisional"', b.status) ?? b.status;
      const status: Status = statusPrompt.toLowerCase().startsWith("p") ? "provisional" : "confirmed";

      const phone = window.prompt("Phone (optional)", b.phone || "") ?? (b.phone || "");
      const guest_email = window.prompt("Email (optional)", b.guest_email || "") ?? (b.guest_email || "");
      const priceStr = window.prompt("Price (optional)", b.price != null ? String(b.price) : "") ?? "";
      const price = priceStr ? Number(priceStr.replace(/[,£]/g, "")) : null;

      const res = await fetch("/api/bookings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: b.id,
          guest_name,
          status,
          phone: phone || null,
          guest_email: guest_email || null,
          price: Number.isFinite(price as any) ? price : null,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(json?.error || "Could not update booking");
        return;
      }

      await refresh();
      return;
    }
  }

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: 18, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", marginBottom: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22 }}>Owner Calendar</h1>
          <p style={{ margin: "6px 0 0", opacity: 0.75, lineHeight: 1.4 }}>
            <b>Add booking:</b> click & drag dates.
            <br />
            <b>Edit/Delete:</b> click a booking.
            <br />
            <b>Rule:</b> checkout day is <b>not</b> booked (same-day turnover allowed).
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <span style={{ display: "inline-flex", gap: 6, alignItems: "center", fontSize: 12, opacity: 0.8 }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: "#ef4444", display: "inline-block" }} />
            Confirmed
          </span>
          <span style={{ display: "inline-flex", gap: 6, alignItems: "center", fontSize: 12, opacity: 0.8 }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: "#f59e0b", display: "inline-block" }} />
            Provisional
          </span>

          <button
            onClick={refresh}
            style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd", background: "white", cursor: "pointer" }}
          >
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: 12, borderRadius: 10, background: "#fff3f3", border: "1px solid #ffd0d0", marginBottom: 12 }}>
          {error}
        </div>
      )}

      <div style={{ padding: 12, borderRadius: 12, border: "1px solid #e6e6e6", background: "white" }}>
        {loading ? (
          <div style={{ padding: 16 }}>Loading…</div>
        ) : (
          <FullCalendar
            plugins={[dayGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            selectable
            selectMirror
            select={addBooking}
            events={events}
            eventClick={onEventClick}
            height="auto"
          />
        )}
      </div>
    </div>
  );
}