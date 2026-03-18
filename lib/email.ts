import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendOwnerNotification(booking: any) {
  try {
    await resend.emails.send({
      from: process.env.RESEND_FROM!,
      to: process.env.OWNER_NOTIFICATION_EMAIL!,
      subject: "🚨 New Booking Request",
      html: `
        <h2>New Booking Request</h2>

        <p><strong>Name:</strong> ${booking.guest_name || "N/A"}</p>
        <p><strong>Email:</strong> ${booking.guest_email || "N/A"}</p>
        <p><strong>Phone:</strong> ${booking.phone || "N/A"}</p>

        <hr/>

        <p><strong>Dates:</strong> ${booking.start_date} → ${booking.end_date}</p>

        <p><strong>Guests:</strong> ${booking.guests_count || 0}</p>
        <p><strong>Dogs:</strong> ${booking.dogs_count || 0}</p>

        <br/>

        <p>👉 Check your dashboard to approve</p>
      `,
    });
  } catch (err) {
    console.error("Email error:", err);
  }
}