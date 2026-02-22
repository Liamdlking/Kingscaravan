"use client";

import React, { useState } from "react";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");

    const next = new URLSearchParams(window.location.search).get("next") || "/";

    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password, next }),
    });

    const json = await res.json();
    if (!res.ok) {
      setMsg(json?.error || "Login failed");
      return;
    }

    window.location.href = json.next || "/";
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 20,
        fontFamily:
          "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial",
        background: "#f6f7fb",
      }}
    >
      <form
        onSubmit={onSubmit}
        style={{
          width: "100%",
          maxWidth: 420,
          background: "white",
          border: "1px solid #e6e6e6",
          borderRadius: 14,
          padding: 16,
        }}
      >
        <h1 style={{ margin: "0 0 8px", fontSize: 22 }}>Owner Login</h1>
        <p style={{ margin: "0 0 14px", opacity: 0.75 }}>
          Enter your owner password to manage bookings.
        </p>

        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: 13, opacity: 0.85 }}>Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #ddd",
              fontSize: 14,
            }}
            required
          />
        </label>

        <button
          style={{
            marginTop: 12,
            width: "100%",
            padding: "12px 14px",
            borderRadius: 12,
            border: "1px solid #ddd",
            background: "white",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Log in
        </button>

        {msg && (
          <div
            style={{
              marginTop: 12,
              padding: 10,
              borderRadius: 12,
              border: "1px solid #ffd0d0",
              background: "#fff3f3",
            }}
          >
            {msg}
          </div>
        )}
      </form>
    </div>
  );
}