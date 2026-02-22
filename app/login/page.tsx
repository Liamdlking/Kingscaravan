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
        background: "#f6f7fb",
        display: "grid",
        placeItems: "center",
        padding: 20,
        fontFamily:
          "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial",
      }}
    >
      <form
        onSubmit={onSubmit}
        style={{
          width: "100%",
          maxWidth: 420,
          background: "white",
          border: "1px solid #e7e7ea",
          borderRadius: 14,
          padding: 16,
          boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
        }}
      >
        <h1 style={{ margin: "0 0 6px", fontSize: 22 }}>Owner Login</h1>
        <p style={{ margin: "0 0 14px", opacity: 0.75 }}>
          Enter your owner password to manage bookings.
        </p>

        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: 13, opacity: 0.85 }}>Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoFocus
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #d9d9de",
              fontSize: 14,
            }}
          />
        </label>

        <button
          type="submit"
          style={{
            marginTop: 12,
            width: "100%",
            padding: "12px 14px",
            borderRadius: 12,
            border: "1px solid #ddd",
            background: "white",
            cursor: "pointer",
            fontWeight: 800,
            fontSize: 14,
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