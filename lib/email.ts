import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

type BookingEmailData = {
  name: string;
  email: string;
  check_in: string;
  check_out: string;
  guests?: number | string;
};

export async function sendOwnerNotification(booking: BookingEmailData) {
  try {
    await resend.emails.send({
      from: process.env.RESEND_FROM!,
      to: process.env.OWNER_NOTIFICATION_EMAIL!,
      subject: "📅 New Booking Request",
      html: `
        <h2>New Booking Request</h2>
        <p><strong>Name:</strong> ${booking.name}</p>
        <p><strong>Email:</strong> ${booking.email}</p>
        <p><strong>Dates:</strong> ${booking.check_in} → ${booking.check_out}</p>
        <p><strong>Guests:</strong> ${booking.guests ?? "Not provided"}</p>
      `,
    });
  } catch (error) {
    console.error("Owner email failed:", error);
  }
}

export async function sendGuestApproval(booking: BookingEmailData) {
  try {
    await resend.emails.send({
      from: process.env.RESEND_FROM!,
      to: booking.email,
      subject: "🎉 Your Booking is Confirmed!",
      html: `
        <h2>Booking Confirmed</h2>
        <p>Hi ${booking.name},</p>
        <p>Your booking has been approved 🎉</p>
        <p><strong>Check-in:</strong> ${booking.check_in}</p>
        <p><strong>Check-out:</strong> ${booking.check_out}</p>
        <p>We look forward to your stay at Kings Caravan.</p>
      `,
    });
  } catch (error) {
    console.error("Guest email failed:", error);
  }
}