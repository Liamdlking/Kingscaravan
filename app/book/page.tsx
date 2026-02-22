
'use client';
import { useState } from 'react';

export default function Book() {
  const [msg, setMsg] = useState("");

  async function submit(e:any) {
    e.preventDefault();
    const f = new FormData(e.target);
    await fetch('/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        start_date: f.get('start'),
        end_date: f.get('end'),
        guest_name: f.get('name'),
        status: 'provisional'
      })
    });
    setMsg("Request sent!");
  }

  return (
    <form onSubmit={submit} style={{ padding:20 }}>
      <h1>Request Booking</h1>
      <input name="start" type="date" required /><br/>
      <input name="end" type="date" required /><br/>
      <input name="name" placeholder="Name" required /><br/>
      <button>Send</button>
      <div>{msg}</div>
    </form>
  );
}
