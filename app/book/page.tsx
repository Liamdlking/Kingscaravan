"use client";

import React, { useState } from "react";

export default function BookPage() {
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState("");

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSending(true);
    setMsg("");

    const f = new FormData(e.currentTarget);

    if (f.get("terms") !== "on") {
      setSending(false);
      setMsg("You must accept the terms and conditions.");
      return;
    }

    const payload = {
      status: "provisional",
      start_date: f.get("start_date"),
      end_date: f.get("end_date"),
      guest_name: f.get("guest_name"),
      guest_email: f.get("guest_email"),
      phone: f.get("phone"),
      guests_count: f.get("guests_count"),
      children_count: f.get("children_count"),
      dogs_count: f.get("dogs") === "yes" ? f.get("dogs_count") : 0,
      vehicle_reg: f.get("vehicle_reg"),
      special_requests: f.get("special_requests"),
    };

    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Failed to submit");

      setMsg("✅ Booking request sent — we’ll review shortly.");
      e.currentTarget.reset();
    } catch {
      setMsg("Something went wrong.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: 20 }}>
      <h1>Booking Request</h1>

      <form onSubmit={submit} style={{ display: "grid", gap: 14 }}>

        <h3>Dates</h3>
        <input name="start_date" type="date" required />
        <input name="end_date" type="date" required />

        <h3>Your Details</h3>
        <input name="guest_name" placeholder="Full name" required />
        <input name="guest_email" type="email" placeholder="Email" required />
        <input name="phone" placeholder="Phone number" required />
        <input name="vehicle_reg" placeholder="Vehicle registration (optional)" />

        <h3>Party</h3>
        <input name="guests_count" type="number" placeholder="Guests" required />
        <input name="children_count" type="number" placeholder="Children" />

        <label>
          Dogs?
          <select name="dogs">
            <option value="no">No</option>
            <option value="yes">Yes</option>
          </select>
        </label>

        <input name="dogs_count" type="number" placeholder="Number of dogs" />

        <textarea name="special_requests" placeholder="Special requests"></textarea>

        <h3>Terms & Conditions</h3>

        <div style={{
          border: "1px solid #ddd",
          padding: 12,
          maxHeight: 200,
          overflowY: "scroll",
          background: "#fafafa",
          fontSize: 13
        }}>
          <p><b>Summary of key terms:</b></p>
          <ul>
            <li>Maximum 8 guests — family groups only.</li>
            <li>No smoking or vaping inside caravan.</li>
            <li>You are responsible for your party and behaviour.</li>
            <li>Parking permits must be returned.</li>
            <li>CCTV operates outside for security.</li>
            <li>Cancellation charges apply.</li>
            <li>Owner not liable for injury or loss.</li>
          </ul>
          <p>Full terms available on request.</p>
        </div>

        <label>
          <input type="checkbox" name="terms" /> I agree to the Terms & Conditions
        </label>

        <button disabled={sending}>
          {sending ? "Sending…" : "Submit Request"}
        </button>

        {msg && <div>{msg}</div>}
      </form>
    </div>
  );
}
