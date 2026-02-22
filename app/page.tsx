
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';

export default function Home() {
  const [bookings, setBookings] = useState<any[]>([]);

  async function refresh() {
    const res = await fetch('/api/bookings');
    const json = await res.json();
    setBookings(json.bookings ?? []);
  }

  useEffect(() => { refresh(); }, []);

  const events = useMemo(() => bookings.map(b => ({
    id: b.id,
    title: b.guest_name,
    start: b.start_date,
    end: b.end_date,
    backgroundColor: b.status === 'provisional' ? '#f59e0b' : '#ef4444'
  })), [bookings]);

  return (
    <div style={{ padding: 20 }}>
      <h1>Caravan Booking Calendar</h1>
      <FullCalendar
        plugins={[dayGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        events={events}
        selectable
        select={async (sel) => {
          const name = prompt("Guest name?");
          if (!name) return;
          await fetch('/api/bookings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              start_date: sel.startStr,
              end_date: sel.endStr,
              guest_name: name
            })
          });
          refresh();
        }}
      />
    </div>
  );
}
