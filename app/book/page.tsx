"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

function getQS(name: string) {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get(name) || "";
}

function getDayNumber(date: string) {
  return new Date(`${date}T00:00:00`).getDay();
}

function isAllowedStay(startDate: string, endDate: string) {
  const startDay = getDayNumber(startDate);
  const endDay = getDayNumber(endDate);

  return (
    (startDay === 5 && endDay === 1) || // Friday to Monday
    (startDay === 1 && endDay === 5) || // Monday to Friday
    (startDay === 6 && endDay === 6) || // Saturday to Saturday
    (startDay === 5 && endDay === 5)    // Friday to Friday
  );
}

export default function BookPage() {
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState<string>("");

  const [startPrefill, setStartPrefill] = useState("");
  const [endPrefill, setEndPrefill] = useState("");
  const [pricePrefill, setPricePrefill] = useState<string>("");

  useEffect(() => {
    const start = getQS("start");
    const end = getQS("end");
    const price = getQS("price");
    const method = getQS("price_method");

    if (start) setStartPrefill(start);
    if (end) setEndPrefill(end);

    if (price) {
      const p = Number(price);
      if (Number.isFinite(p)) {
        setPricePrefill(
          method === "nightly"
            ? `Estimated total: £${p} (nightly rates)`
            : `Estimated total: £${p}`
        );
      }
    }
  }, []);

  const [termsUnlocked, setTermsUnlocked] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const termsBoxRef = useRef<HTMLDivElement | null>(null);

  const termsText = useMemo(
    () => `TERMS & CONDITIONS (Summary + full policy notes)

Accommodation & guest rules
• The accommodation may only be used by the named guests on the booking.
• Maximum 8 people. If more than stated guests are found in the caravan, you may be asked to leave.
• This applies to pets, smoking/vaping, and drugs (not allowed).
• Bookings are for family groups only. We do not accept young singles or all-male/all-female parties.
• Spot checks may be carried out. Breaches may result in eviction without compensation.

Smoking / vaping / drugs
• No smoking or vaping inside the caravan.
• Smoking is permitted outside only, away from hazards; dispose of cigarette butts safely.
• Use of drugs is forbidden.

Condition & reporting issues
• On arrival, please check equipment and condition.
• Any problems must be reported immediately so we have a fair chance to rectify.
• Photos may be requested where helpful.

Safety
• Smoke alarms/fire extinguishers must not be tampered with.
• No naked flames inside the caravan.
• Do not use the fire to dry items over stools.

Utilities & fair use
• Gas/electric included on a fair-use basis.
• Excessive use may be charged.
• When leaving, ensure heating/equipment is turned off except fridge/freezer and WiFi.

Security
• You are responsible for security; doors/windows must be locked when not in the caravan.

Bedding / towels
• Bedding is supplied. Towels/soaps are not.

CCTV
• CCTV is installed outside the caravan for security.

Parking
• A permit is provided. Max 2 cars per booking.
• Permit MUST be left in the caravan after your stay.
• Do not drive or park on the grass.

Behaviour
• Please avoid nuisance, excessive noise or unacceptable behaviour.

Caravan site / facilities / passes
• You are bound by the park’s site rules.
• Entertainment passes are not included/provided.

Cancellation
• If you cancel before the final balance due date, you lose the £60 deposit.
• Cancellation fees:
  42–28 days: 50%
  27–14 days: 75%
  13–0 days: 100%

Liability & insurance
• The owner does not accept liability for injury, loss or damage.
• Holiday insurance is strongly recommended.

By submitting this request, you confirm you have read and agree to these Terms & Conditions.`,
    []
  );

  function onTermsScroll() {
    const el = termsBoxRef.current;
    if (!el) return;

    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 6) {
      setTermsUnlocked(true);
    }
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setMsg("");

    const f = new FormData(form);

    const startDate = String(f.get("start_date") || "");
    const endDate = String(f.get("end_date") || "");

    if (!startDate || !endDate) {
      setMsg("Please choose an arrival and departure date.");
      return;
    }

    if (endDate <= startDate) {
      setMsg("Departure date must be after arrival date.");
      return;
    }

    if (!isAllowedStay(startDate, endDate)) {
      setMsg(
        "Please choose one of our available stay patterns: Friday to Monday, Monday to Friday, Saturday to Saturday, or Friday to Friday."
      );
      return;
    }

    if (!termsUnlocked) {
      setMsg("Please scroll to the bottom of the Terms & Conditions to enable acceptance.");
      return;
    }

    if (!termsAccepted) {
      setMsg("Please tick the box to accept the Terms & Conditions.");
      return;
    }

    setSending(true);

    const dogsYes = String(f.get("dogs") || "no") === "yes";
    const dogsCount = dogsYes ? Number(f.get("dogs_count") || 1) || 1 : 0;

    const payload = {
      status: "requested",

      start_date: startDate,
      end_date: endDate,

      guest_name: String(f.get("guest_name") || ""),
      guest_email: String(f.get("guest_email") || ""),
      phone: String(f.get("phone") || ""),

      guests_count: Number(f.get("guests_count") || 0) || null,
      children_count: Number(f.get("children_count") || 0) || null,
      dogs_count: dogsCount,

      vehicle_reg: String(f.get("vehicle_reg") || ""),
      special_requests: String(f.get("special_requests") || ""),
    };

    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Could not submit request");

      setMsg("✅ Request sent! We’ll review and confirm availability.");
      form.reset();

      if (startPrefill) {
        const startInput = form.elements.namedItem("start_date") as HTMLInputElement | null;
        if (startInput) startInput.value = startPrefill;
      }

      if (endPrefill) {
        const endInput = form.elements.namedItem("end_date") as HTMLInputElement | null;
        if (endInput) endInput.value = endPrefill;
      }

      setTermsUnlocked(false);
      setTermsAccepted(false);
      if (termsBoxRef.current) termsBoxRef.current.scrollTop = 0;
    } catch (err: any) {
      setMsg(err?.message || "Something went wrong.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <header style={{ marginBottom: 14 }}>
          <h1 style={styles.h1}>Booking request</h1>
          <p style={styles.sub}>
            Choose your dates and enter your details. This sends a <b>booking request</b> for review.
          </p>
          {pricePrefill && <div style={styles.priceBanner}>{pricePrefill}</div>}
        </header>

        <form onSubmit={submit} style={{ display: "grid", gap: 14 }}>
          <section style={styles.card}>
            <h2 style={styles.h2}>1) Dates</h2>
            <p style={styles.helpText}>Add your arrival date and your departure date.</p>

            <div style={styles.grid2}>
              <label style={styles.field}>
                <span style={styles.label}>Arrival date</span>
                <input name="start_date" type="date" required defaultValue={startPrefill || undefined} style={styles.input} />
              </label>

              <label style={styles.field}>
                <span style={styles.label}>Departure date</span>
                <input name="end_date" type="date" required defaultValue={endPrefill || undefined} style={styles.input} />
                <small style={styles.small}>
                  Available stays: Fri–Mon, Mon–Fri, Sat–Sat, or Fri–Fri.
                </small>
              </label>
            </div>
          </section>

          <section style={styles.card}>
            <h2 style={styles.h2}>2) Your details</h2>

            <div style={styles.grid2}>
              <label style={styles.field}>
                <span style={styles.label}>Full name</span>
                <input name="guest_name" required placeholder="e.g. Sarah Smith" style={styles.input} />
              </label>

              <label style={styles.field}>
                <span style={styles.label}>Email</span>
                <input name="guest_email" type="email" required placeholder="e.g. sarah@email.com" style={styles.input} />
              </label>

              <label style={styles.field}>
                <span style={styles.label}>Phone number</span>
                <input name="phone" required placeholder="e.g. 07xxx xxxxxx" style={styles.input} />
              </label>

              <label style={styles.field}>
                <span style={styles.label}>Vehicle registration</span>
                <input name="vehicle_reg" placeholder="Optional" style={styles.input} />
              </label>
            </div>
          </section>

          <section style={styles.card}>
            <h2 style={styles.h2}>3) Party</h2>

            <div style={styles.grid2}>
              <label style={styles.field}>
                <span style={styles.label}>Guests</span>
                <input name="guests_count" type="number" min={1} max={8} defaultValue={2} required style={styles.input} />
              </label>

              <label style={styles.field}>
                <span style={styles.label}>Children</span>
                <input name="children_count" type="number" min={0} max={8} defaultValue={0} style={styles.input} />
              </label>

              <label style={styles.field}>
                <span style={styles.label}>Bringing dogs?</span>
                <select name="dogs" defaultValue="no" style={styles.input}>
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </select>
              </label>

              <label style={styles.field}>
                <span style={styles.label}>If yes, how many?</span>
                <input name="dogs_count" type="number" min={1} max={5} defaultValue={1} style={styles.input} />
              </label>
            </div>

            <label style={{ ...styles.field, marginTop: 10 }}>
              <span style={styles.label}>Special requests</span>
              <textarea name="special_requests" rows={4} placeholder="Optional" style={{ ...styles.input, resize: "vertical" }} />
            </label>
          </section>

          <section style={styles.card}>
            <h2 style={styles.h2}>4) Terms & Conditions</h2>
            <p style={styles.helpText}>Please scroll to the bottom to unlock the acceptance checkbox.</p>

            <div ref={termsBoxRef} onScroll={onTermsScroll} style={styles.termsBox}>
              {termsText}
            </div>

            <div style={styles.termsRow}>
              <input
                type="checkbox"
                name="terms"
                disabled={!termsUnlocked}
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
              />
              <div style={{ fontSize: 13, opacity: termsUnlocked ? 0.9 : 0.6 }}>
                I have read and agree to the Terms & Conditions.
                {!termsUnlocked && <div style={{ fontSize: 12 }}>Scroll the box above to unlock.</div>}
              </div>
            </div>
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

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#f6f7fb",
    padding: 20,
    fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial",
  },
  container: {
    maxWidth: 900,
    margin: "0 auto",
  },
  h1: {
    margin: "0 0 6px",
    fontSize: 28,
  },
  sub: {
    margin: 0,
    opacity: 0.8,
    lineHeight: 1.4,
  },
  priceBanner: {
    marginTop: 10,
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #e7e7ea",
    background: "white",
    fontWeight: 700,
  },
  card: {
    background: "white",
    border: "1px solid #e7e7ea",
    borderRadius: 14,
    padding: 16,
    boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
  },
  h2: {
    margin: "0 0 6px",
    fontSize: 16,
  },
  helpText: {
    margin: "0 0 12px",
    fontSize: 13,
    opacity: 0.75,
  },
  grid2: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
  },
  field: {
    display: "grid",
    gap: 6,
  },
  label: {
    fontSize: 13,
    opacity: 0.85,
  },
  input: {
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #d9d9de",
    background: "white",
    fontSize: 14,
    outline: "none",
  },
  small: {
    fontSize: 12,
    opacity: 0.7,
    marginTop: -2,
  },
  termsBox: {
    border: "1px solid #d9d9de",
    borderRadius: 12,
    padding: 12,
    height: 280,
    overflowY: "auto",
    background: "#fafafa",
    whiteSpace: "pre-wrap",
    fontSize: 13,
    lineHeight: 1.4,
    WebkitOverflowScrolling: "touch",
  },
  termsRow: {
    display: "flex",
    gap: 10,
    alignItems: "flex-start",
    marginTop: 12,
  },
  button: {
    padding: "12px 14px",
    borderRadius: 12,
    border: "1px solid #111",
    background: "#111",
    color: "white",
    cursor: "pointer",
    fontSize: 15,
    fontWeight: 700,
  },
  message: {
    padding: 12,
    borderRadius: 12,
    border: "1px solid #e6e6e6",
    background: "white",
  },
};