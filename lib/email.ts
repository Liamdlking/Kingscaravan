import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendOwnerNotification(booking: any) {
  const name = booking.name ?? booking.guest_name ?? "Not provided";
  const email = booking.email ?? booking.guest_email ?? booking.contact ?? "Not provided";
  const checkIn = booking.check_in ?? booking.start_date ?? "Not provided";
  const checkOut = booking.check_out ?? booking.end_date ?? "Not provided";
  const guests = booking.guests ?? booking.guests_count ?? "Not provided";

  try {
    await resend.emails.send({
      from: process.env.RESEND_FROM!,
      to: process.env.OWNER_NOTIFICATION_EMAIL!,
      subject: "📅 New Booking Request",
      html: `
        <h2>New Booking Request</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Dates:</strong> ${checkIn} → ${checkOut}</p>
        <p><strong>Guests:</strong> ${guests}</p>
      `,
    });
  } catch (error) {
    console.error("Owner email failed:", error);
  }
}

export async function sendGuestApproval(booking: any) {
  const name = booking.name ?? booking.guest_name ?? "Guest";
  const email = booking.email ?? booking.guest_email;
  const checkIn = booking.check_in ?? booking.start_date ?? "Not provided";
  const checkOut = booking.check_out ?? booking.end_date ?? "Not provided";

  if (!email) return;

  try {
    await resend.emails.send({
      from: process.env.RESEND_FROM!,
      to: email,
      subject: "🎉 Your Booking is Confirmed!",
      html: `
        <h2>Booking Confirmed</h2>
        <p>Hi ${name},</p>
        <p>Your booking has been approved 🎉</p>
        <p><strong>Check-in:</strong> ${checkIn}</p>
        <p><strong>Check-out:</strong> ${checkOut}</p>
        <p>We look forward to your stay at Kings Caravan.</p>
      `,
    });
  } catch (error) {
    console.error("Guest email failed:", error);
  }
}