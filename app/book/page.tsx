"use client";

import React, { useMemo, useRef, useState } from "react";

export default function BookPage() {
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState<string>("");

  const params =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search)
      : null;

  const preStart = params?.get("start") || "";
  const preEnd = params?.get("end") || "";
  const prePrice = params?.get("price") || "";

  // Terms gating
  const [termsUnlocked, setTermsUnlocked] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const termsBoxRef = useRef<HTMLDivElement | null>(null);

  const termsText = useMemo(
    () => `TERMS & CONDITIONS (Summary + full policy notes)

By submitting this request, you confirm you have read and agree to these Terms & Conditions.`,
    []
  );

  function onTermsScroll() {
    const el = termsBoxRef.current;
    if (!el) return;
    const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 10;
    if (nearBottom) setTermsUnlocked(true);
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg("");

    if (!termsUnlocked) {
      setMsg("Please scroll to the bottom of the Terms & Conditions.");
      return;
    }
    if (!termsAccepted) {
      setMsg("Please accept the Terms & Conditions.");
      return;
    }

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
      dogs_count: Number(f.get("dogs_count") || 0) || 0,
      vehicle_reg: String(f.get("vehicle_reg") || ""),
      special_requests: String(f.get("special_requests") || ""),
      price: prePrice ? Number(prePrice) : null,
    };

    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Could not submit");

      setMsg("✅ Booking request sent!");
      e.currentTarget.reset();
    } catch (err: any) {
      setMsg(err?.message || "Something went wrong.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <h1 style={styles.h1}>Request your stay</h1>

        <p style={styles.sub}>
          Choose your dates, add your details, and we’ll confirm availability.
        </p>

        {prePrice && (
          <div style={styles.priceBox}>
            <div style={{ fontSize: 12, opacity: 0.7 }}>
              Estimated price for selected dates
            </div>
            <div style={{ fontSize: 24, fontWeight: 800 }}>£{prePrice}</div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>
              Final price confirmed on approval.
            </div>
          </div>
        )}

        <form onSubmit={submit} style={{ display: "grid", gap: 14 }}>
          <section style={styles.card}>
            <h2 style={styles.h2}>Your dates</h2>

            <div style={styles.grid2}>
              <label style={styles.field}>
                Arrival
                <input
                  name="start_date"
                  type="date"
                  required
                  defaultValue={preStart}
                  style={styles.input}
                />
              </label>

              <label style={styles.field}>
                Departure
                <input
                  name="end_date"
                  type="date"
                  required
                  defaultValue={preEnd}
                  style={styles.input}
                />
              </label>
            </div>
          </section>

          <section style={styles.card}>
            <h2 style={styles.h2}>Your details</h2>

            <div style={styles.grid2}>
              <input name="guest_name" placeholder="Full name" required style={styles.input} />
              <input name="guest_email" type="email" placeholder="Email" required style={styles.input} />
              <input name="phone" placeholder="Phone number" required style={styles.input} />
              <input name="vehicle_reg" placeholder="Vehicle registration" style={styles.input} />
            </div>
          </section>

          <section style={styles.card}>
            <h2 style={styles.h2}>Party</h2>

            <div style={styles.grid2}>
              <input name="guests_count" type="number" placeholder="Guests" style={styles.input} />
              <input name="children_count" type="number" placeholder="Children" style={styles.input} />
              <input name="dogs_count" type="number" placeholder="Dogs" style={styles.input} />
            </div>
          </section>

          <section style={styles.card}>
            <textarea
              name="special_requests"
              placeholder="Special requests"
              rows={3}
              style={styles.input}
            />
          </section>

          <section style={styles.card}>
            <h2 style={styles.h2}>Terms</h2>

            <div
              ref={termsBoxRef}
              onScroll={onTermsScroll}
              style={styles.termsBox}
            >
              {termsText}
            </div>

            <label style={{ marginTop: 10 }}>
              <input
                type="checkbox"
                disabled={!termsUnlocked}
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
              />{" "}
              I agree to the Terms & Conditions
            </label>
          </section>

          <button type="submit" disabled={sending} style={styles.button}>
            {sending ? "Sending…" : "Send request"}
          </button>

          {msg && <div style={styles.message}>{msg}</div>}
        </form>
      </div>
    </div>
  );
}

const styles: any = {
  page: { background: "#f6f7fb", padding: 20, minHeight: "100vh" },
  container: { maxWidth: 820, margin: "0 auto" },
  h1: { fontSize: 28 },
  sub: { opacity: 0.7 },
  card: { background: "white", padding: 16, borderRadius: 12, border: "1px solid #eee" },
  grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
  field: { display: "grid", gap: 6 },
  input: { padding: 10, borderRadius: 10, border: "1px solid #ddd" },
  termsBox: { maxHeight: 200, overflowY: "auto", border: "1px solid #ddd", padding: 10 },
  button: { padding: 12, borderRadius: 12, border: "1px solid #ddd", cursor: "pointer" },
  message: { padding: 10, background: "white", borderRadius: 10 },
  priceBox: { padding: 16, background: "#fff", borderRadius: 12, border: "1px solid #eee", marginBottom: 12 },
};
