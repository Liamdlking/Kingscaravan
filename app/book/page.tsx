"use client";

import React, { useState } from "react";

export default function BookPage() {
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState<string>("");

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg("");
    setSending(true);

    const f = new FormData(e.currentTarget);

    const payload = {
      status: "provisional",
      start_date: String(f.get("start_date") || ""),
      end_date: String(f.get("end_date") || ""),
      guest_name: String(f.get("guest_name") || ""),
      guest_email: String(f.get("guest_email") || ""),
      phone: String(f.get("phone") || ""),
      guests_count: Number(f.get("guests_count") || 0) || null,
      children_count: Number(f.get("children_count") || 0) || null,
      dogs_count: f.get("dogs") === "yes" ? Number(f.get("dogs_count") || 1) || 1 : 0,
      vehicle_reg: String(f.get("vehicle_reg") || ""),
      arrival_time: String(f.get("arrival_time") || ""),
      departure_time: String(f.get("departure_time") || ""),
      special_requests: String(f.get("special_requests") || ""),
      terms: f.get("terms") === "on",
    };

    if (!payload.terms) {
      setSending(false);
      setMsg("Please tick the terms box to submit your request.");
      return;
    }

    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();

      if (!res.ok) throw new Error(json?.error || "Could not submit request");

      setMsg("✅ Request sent! We’ll review and confirm availability.");
      (e.currentTarget as HTMLFormElement).reset();
    } catch (err: any) {
      setMsg(err?.message || "Something went wrong");
    } finally {
      setSending(false);
    }
  }

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: 18 }}>
      <h1 style={{ margin: "0 0 6px" }}>Caravan Booking Request</h1>
      <p style={{ margin: "0 0 18px", opacity: 0.75 }}>
        Choose your dates and submit a request. We’ll confirm as soon as possible.
      </p>

      <form onSubmit={submit} style={{ display: "grid", gap: 14 }}>
        <section style={card}>
          <h2 style={h2}>Dates</h2>
          <div style={grid2}>
            <label style={field}>
              <span>Arrival date</span>
              <input name="start_date" type="date" required />
            </label>

            <label style={field}>
              <span>Checkout date</span>
              <input name="end_date" type="date" required />
              <small style={help}>Checkout day is not booked (same-day turnover allowed).</small>
            </label>

            <label style={field}>
              <span>Estimated arrival time (optional)</span>
              <input name="arrival_time" placeholder="e.g. 3pm" />
            </label>

            <label style={field}>
              <span>Estimated departure time (optional)</span>
              <input name="departure_time" placeholder="e.g. 10am" />
            </label>
          </div>
        </section>

        <section style={card}>
          <h2 style={h2}>Your details</h2>
          <div style={grid2}>
            <label style={field}>
              <span>Full name</span>
              <input name="guest_name" required />
            </label>

            <label style={field}>
              <span>Email</span>
              <input name="guest_email" type="email" required />
            </label>

            <label style={field}>
              <span>Phone number</span>
              <input name="phone" required />
            </label>

            <label style={field}>
              <span>Vehicle registration (optional)</span>
              <input name="vehicle_reg" placeholder="e.g. AB12 CDE" />
            </label>
          </div>
        </section>

        <section style={card}>
          <h2 style={h2}>Party details</h2>
          <div style={grid2}>
            <label style={field}>
              <span>Number of guests</span>
              <input name="guests_count" type="number" min={1} max={20} defaultValue={2} required />
            </label>

            <label style={field}>
              <span>Number of children (optional)</span>
              <input name="children_count" type="number" min={0} max={20} defaultValue={0} />
            </label>

            <label style={field}>
              <span>Bringing dogs?</span>
              <select name="dogs" defaultValue="no">
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </select>
            </label>

            <label style={field}>
              <span>If yes, how many? (optional)</span>
              <input name="dogs_count" type="number" min={1} max={5} defaultValue={1} />
            </label>
          </div>
        </section>

        <section style={card}>
          <h2 style={h2}>Anything else?</h2>
          <label style={field}>
            <span>Special requests (optional)</span>
            <textarea name="special_requests" rows={4} placeholder="Anything we should know?" />
          </label>

          <label style={{ display: "flex", gap: 10, alignItems: "flex-start", marginTop: 10 }}>
            <input type="checkbox" name="terms" />
            <span style={{ fontSize: 13, opacity: 0.8 }}>
              I understand this is a booking request and not confirmed until accepted.
            </span>
          </label>
        </section>

        <button type="submit" disabled={sending} style={btn}>
          {sending ? "Sending…" : "Send booking request"}
        </button>

        {msg && (
          <div style={{ padding: 12, borderRadius: 10, border: "1px solid #e6e6e6", background: "#fafafa" }}>
            {msg}
          </div>
        )}
      </form>
    </div>
  );
}

const card: React.CSSProperties = {
  padding: 14,
  borderRadius: 12,
  border: "1px solid #e6e6e6",
  background: "white",
};

const h2: React.CSSProperties = { margin: "0 0 10px", fontSize: 16 };

const grid2: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 12,
};

const field: React.CSSProperties = { display: "grid", gap: 6 };

const help: React.CSSProperties = { fontSize: 12, opacity: 0.7 };

const btn: React.CSSProperties = {
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid #ddd",
  background: "white",
  cursor: "pointer",
};
