"use client";

import React, { useMemo, useRef, useState } from "react";

export default function BookPage() {
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState<string>("");

  // Terms gating
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
• Smoke alarms/fire extinguishers must not be tampered with (including removing batteries).
• No naked flames (candles/BBQs) inside the caravan.
• Do not use the fire to dry items over stools (fire hazard).

Utilities & fair use
• Gas/electric included on a fair-use basis.
• Excessive use (e.g. heating left on constantly without consent) may be charged.
• When leaving the caravan, ensure heating/equipment is turned off and plugs switched off
  (except fridge/freezer and WiFi).

Security
• You are responsible for security; doors/windows must be locked when not in the caravan.

Bedding / towels
• Bedding is supplied. Towels/soaps are not.
• If you require a cot bed, request at booking so it can be available.

CCTV
• CCTV is installed outside the caravan for security.
• It records on motion and may be reviewed if needed (e.g. behavioural concerns).

Parking
• A permit is provided. Max 2 cars per booking.
• Park at your own risk (loss/damage/theft not accepted as liability).
• Permit MUST be left in the caravan after your stay — failure may result in a deduction/charge.
• Do not drive or park on the grass.

Behaviour
• If you/your party behave in a way prejudicial to others’ wellbeing, you may be required to vacate.
• Please avoid nuisance (verbal/excessive music). Alcohol permitted, but guests must remain civil.

Caravan site / facilities / passes
• You are bound by the park’s site rules (available via their website/reception).
• The owner is not responsible for onsite services/facilities that may change at short notice.
• You are renting accommodation only; entertainment passes are not included/provided.

Noise notice
• The caravan is in a busy area with amusements/bars/rides nearby; loud music may be heard.

Cleaning products
• Cleaning products are provided for hygiene—please use when needed and keep in the caravan.

Cancellation
• If you cancel before the final balance due date (8 weeks prior), you lose the £60 deposit.
• Cancellation fees:
  42–28 days: 50%
  27–14 days: 75%
  13–0 days: 100%
• Refunds may be considered at owner discretion and subject to replacement booking.

Liability & insurance
• The owner does not accept liability for injury, loss or damage.
• Holiday insurance is strongly recommended.

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
      setMsg("Please scroll to the bottom of the Terms & Conditions to enable acceptance.");
      return;
    }
    if (!termsAccepted) {
      setMsg("You must accept the Terms & Conditions to submit your request.");
      return;
    }

    setSending(true);

    const f = new FormData(e.currentTarget);

    const dogsYes = String(f.get("dogs") || "no") === "yes";
    const dogsCount = dogsYes ? Number(f.get("dogs_count") || 1) || 1 : 0;

    const payload = {
      status: "provisional",
      start_date: String(f.get("start_date") || ""),
      end_date: String(f.get("end_date") || ""),

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
      e.currentTarget.reset();
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
    <div style={{ maxWidth: 820, margin: "0 auto", padding: 20 }}>
      <h1 style={{ margin: "0 0 6px" }}>Caravan Booking Request</h1>
      <p style={{ margin: "0 0 18px", opacity: 0.75 }}>
        Submit your preferred dates and details. This creates a <b>provisional</b> request until approved.
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
              <input name="guests_count" type="number" min={1} max={8} defaultValue={2} required />
            </label>

            <label style={field}>
              <span>Number of children (optional)</span>
              <input name="children_count" type="number" min={0} max={8} defaultValue={0} />
            </label>

            <label style={field}>
              <span>Bringing dogs?</span>
              <select name="dogs" defaultValue="no">
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </select>
            </label>

            <label style={field}>
              <span>If yes, how many?</span>
              <input name="dogs_count" type="number" min={1} max={5} defaultValue={1} />
            </label>
          </div>
        </section>

        <section style={card}>
          <h2 style={h2}>Special requests</h2>
          <label style={field}>
            <span>Anything we should know? (optional)</span>
            <textarea name="special_requests" rows={4} placeholder="e.g. accessibility needs, questions, etc." />
          </label>
        </section>

        <section style={card}>
          <h2 style={h2}>Terms & Conditions</h2>
          <p style={{ margin: "0 0 10px", fontSize: 13, opacity: 0.8 }}>
            Please scroll to the bottom to enable acceptance. :contentReference[oaicite:1]{index=1}
          </p>

          <div
            ref={termsBoxRef}
            onScroll={onTermsScroll}
            style={{
              border: "1px solid #ddd",
              borderRadius: 12,
              padding: 12,
              maxHeight: 240,
              overflowY: "auto",
              background: "#fafafa",
              whiteSpace: "pre-wrap",
              fontSize: 13,
              lineHeight: 1.35,
            }}
          >
            {termsText}
          </div>

          <label style={{ display: "flex", gap: 10, alignItems: "flex-start", marginTop: 12 }}>
            <input
              type="checkbox"
              name="terms"
              disabled={!termsUnlocked}
              checked={termsAccepted}
              onChange={(e) => setTermsAccepted(e.target.checked)}
            />
            <span style={{ fontSize: 13, opacity: termsUnlocked ? 0.9 : 0.6 }}>
              I have read and agree to the Terms & Conditions (checkbox unlocks after scrolling).
            </span>
          </label>
        </section>

        <button type="submit" disabled={sending} style={btn}>
          {sending ? "Sending…" : "Send booking request"}
        </button>

        {msg && (
          <div style={{ padding: 12, borderRadius: 10, border: "1px solid #e6e6e6", background: "#fff" }}>
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
