"use client";

import React, { useMemo, useState } from "react";

type ImportRow = {
  start_date: string;
  end_date: string;
  status?: "confirmed" | "provisional";
  guest_name?: string;
  guest_email?: string;
  phone?: string;
  guests_count?: number | "";
  children_count?: number | "";
  dogs_count?: number | "";
  vehicle_reg?: string;
  price?: number | "";
  special_requests?: string;
};

function parseCSV(text: string) {
  // Simple CSV parser with quote support
  const rows: string[][] = [];
  let cur = "";
  let inQuotes = false;
  let row: string[] = [];

  const pushCell = () => {
    row.push(cur.trim());
    cur = "";
  };

  const pushRow = () => {
    // ignore totally empty rows
    if (row.length === 1 && row[0] === "") {
      row = [];
      return;
    }
    rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (ch === '"') {
      // escaped quote
      if (inQuotes && text[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && ch === ",") {
      pushCell();
      continue;
    }

    if (!inQuotes && (ch === "\n" || ch === "\r")) {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      pushCell();
      pushRow();
      continue;
    }

    cur += ch;
  }

  // flush final
  pushCell();
  if (row.length) pushRow();

  return rows;
}

function numOrBlank(v: string) {
  if (!v) return "";
  const n = Number(v);
  return Number.isFinite(n) ? n : "";
}

export default function ImportPage() {
  const [csv, setCsv] = useState<string>(
    `start_date,end_date,status,guest_name,guest_email,phone,guests_count,children_count,dogs_count,vehicle_reg,price,special_requests
2026-04-03,2026-04-06,confirmed,Example Guest,,,,,,,,
`
  );

  const [mode, setMode] = useState<"skip" | "strict">("skip");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const preview = useMemo(() => {
    setMsg("");
    try {
      const parsed = parseCSV(csv);
      if (!parsed.length) return { rows: [] as ImportRow[], errors: ["No rows found."] };

      const headers = parsed[0].map((h) => h.toLowerCase());
      const body = parsed.slice(1);

      const rows: ImportRow[] = [];
      const errors: string[] = [];

      for (let i = 0; i < body.length; i++) {
        const line = body[i];
        if (!line || line.every((c) => !c)) continue;

        const obj: any = {};
        headers.forEach((h, idx) => (obj[h] = line[idx] ?? ""));

        const start_date = String(obj.start_date || "");
        const end_date = String(obj.end_date || "");
        const statusRaw = String(obj.status || "confirmed").toLowerCase();
        const status = statusRaw === "provisional" ? "provisional" : "confirmed";

        if (!start_date || !end_date) {
          errors.push(`Row ${i + 2}: start_date and end_date are required`);
          continue;
        }
        if (end_date <= start_date) {
          errors.push(`Row ${i + 2}: end_date must be after start_date`);
          continue;
        }

        rows.push({
          start_date,
          end_date,
          status,
          guest_name: obj.guest_name || "",
          guest_email: obj.guest_email || "",
          phone: obj.phone || "",
          guests_count: numOrBlank(obj.guests_count || ""),
          children_count: numOrBlank(obj.children_count || ""),
          dogs_count: numOrBlank(obj.dogs_count || ""),
          vehicle_reg: obj.vehicle_reg || "",
          price: numOrBlank(obj.price || ""),
          special_requests: obj.special_requests || "",
        });
      }

      return { rows, errors };
    } catch (e: any) {
      return { rows: [] as ImportRow[], errors: [e?.message || "Could not parse CSV"] };
    }
  }, [csv]);

  async function runImport() {
    setMsg("");
    if (preview.errors.length) {
      setMsg("Fix the errors in the preview before importing.");
      return;
    }
    if (!preview.rows.length) {
      setMsg("Nothing to import.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, rows: preview.rows }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Import failed");

      let text = `✅ Imported: ${json.imported} • Skipped: ${json.skipped} • Errors: ${json.errors?.length || 0}`;
      if (json.errors?.length) text += `\n\nErrors:\n- ${json.errors.join("\n- ")}`;
      setMsg(text);
    } catch (e: any) {
      setMsg(e?.message || "Import failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.wrap}>
        <h1 style={styles.h1}>Import bookings (Owner)</h1>
        <p style={styles.sub}>
          Paste your CSV below → preview → import.
          <br />
          <b>Skip overlaps</b> will skip clashes with confirmed bookings. <b>Strict</b> will stop on first clash.
        </p>

        <div style={styles.card}>
          <div style={styles.row}>
            <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <span style={{ fontSize: 13, opacity: 0.8 }}>Import mode</span>
              <select value={mode} onChange={(e) => setMode(e.target.value as any)} style={styles.input}>
                <option value="skip">Skip overlaps</option>
                <option value="strict">Strict</option>
              </select>
            </label>

            <button onClick={runImport} disabled={busy} style={styles.btn}>
              {busy ? "Importing…" : "Import bookings"}
            </button>
          </div>

          <label style={{ display: "grid", gap: 6, marginTop: 10 }}>
            <span style={{ fontSize: 13, opacity: 0.85 }}>CSV</span>
            <textarea
              value={csv}
              onChange={(e) => setCsv(e.target.value)}
              rows={12}
              style={{
                ...styles.input,
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
              }}
            />
          </label>

          {msg && <pre style={styles.msg}>{msg}</pre>}
        </div>

        <div style={styles.card}>
          <h2 style={styles.h2}>Preview</h2>

          {preview.errors.length ? (
            <div style={styles.errBox}>
              <b>Fix these first:</b>
              <ul>
                {preview.errors.map((e, idx) => (
                  <li key={idx}>{e}</li>
                ))}
              </ul>
            </div>
          ) : (
            <p style={{ marginTop: 0, opacity: 0.8 }}>
              Rows ready: <b>{preview.rows.length}</b>
            </p>
          )}

          <div style={{ overflowX: "auto" }}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th>start_date</th>
                  <th>end_date</th>
                  <th>status</th>
                  <th>guest_name</th>
                  <th>email</th>
                  <th>phone</th>
                  <th>guests</th>
                  <th>kids</th>
                  <th>dogs</th>
                  <th>reg</th>
                  <th>price</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.slice(0, 25).map((r, i) => (
                  <tr key={i}>
                    <td>{r.start_date}</td>
                    <td>{r.end_date}</td>
                    <td>{r.status}</td>
                    <td>{r.guest_name}</td>
                    <td>{r.guest_email}</td>
                    <td>{r.phone}</td>
                    <td>{String(r.guests_count ?? "")}</td>
                    <td>{String(r.children_count ?? "")}</td>
                    <td>{String(r.dogs_count ?? "")}</td>
                    <td>{r.vehicle_reg}</td>
                    <td>{String(r.price ?? "")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p style={{ fontSize: 12, opacity: 0.7, marginBottom: 0 }}>
            Preview shows first 25 rows. Import will include all rows.
          </p>
        </div>

        <div style={{ marginTop: 12, fontSize: 13, opacity: 0.8 }}>
          URL: <code>/import</code>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#f6f7fb",
    padding: 20,
    fontFamily:
      "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial",
  },
  wrap: { maxWidth: 1050, margin: "0 auto" },
  h1: { margin: "0 0 6px", fontSize: 26 },
  h2: { margin: "0 0 10px", fontSize: 16 },
  sub: { margin: "0 0 14px", opacity: 0.8, lineHeight: 1.4 },
  card: {
    background: "white",
    border: "1px solid #e7e7ea",
    borderRadius: 14,
    padding: 16,
    boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
    marginTop: 12,
  },
  row: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
    alignItems: "center",
  },
  input: {
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #d9d9de",
    background: "white",
    fontSize: 14,
    outline: "none",
    width: "100%",
  },
  btn: {
    padding: "12px 14px",
    borderRadius: 12,
    border: "1px solid #ddd",
    background: "white",
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 700,
    width: "fit-content",
  },
  msg: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    border: "1px solid #e6e6e6",
    background: "#fff",
    whiteSpace: "pre-wrap",
  },
  errBox: {
    padding: 12,
    borderRadius: 12,
    border: "1px solid #ffd0d0",
    background: "#fff3f3",
    marginBottom: 12,
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 13,
  },
};