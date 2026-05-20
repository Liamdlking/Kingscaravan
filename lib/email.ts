import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

function formatDate(date?: string | null) {
  if (!date) return "Not provided";
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getBookingData(booking: any) {
  return {
    name: booking.name ?? booking.guest_name ?? "Guest",
    email: booking.email ?? booking.guest_email ?? booking.contact ?? "",
    checkIn: booking.check_in ?? booking.start_date ?? "",
    checkOut: booking.check_out ?? booking.end_date ?? "",
    guests: booking.guests ?? booking.guests_count ?? "Not provided",
  };
}

export async function sendOwnerNotification(booking: any) {
  const b = getBookingData(booking);

  try {
    await resend.emails.send({
      from: process.env.RESEND_FROM!,
      to: process.env.OWNER_NOTIFICATION_EMAIL!,
      subject: "📅 New Booking Request",
      html: `
        <h2>New Booking Request</h2>
        <p><strong>Name:</strong> ${b.name}</p>
        <p><strong>Email:</strong> ${b.email || "Not provided"}</p>
        <p><strong>Dates:</strong> ${formatDate(b.checkIn)} → ${formatDate(b.checkOut)}</p>
        <p><strong>Guests:</strong> ${b.guests}</p>
      `,
    });
  } catch (error) {
    console.error("Owner email failed:", error);
  }
}

export async function sendGuestPaymentDetails(booking: any) {
  const b = getBookingData(booking);
  if (!b.email) return;

  try {
    await resend.emails.send({
      from: process.env.RESEND_FROM!,
      to: b.email,
      subject: "Your Kings Caravan booking request - payment details",
      html: `
        <h2>Your booking request has been provisionally accepted</h2>
        <p>Hi ${b.name},</p>

        <p>Thank you for your booking request for Kings Caravan.</p>

        <p>Your dates have been provisionally held:</p>
        <p><strong>Check-in:</strong> ${formatDate(b.checkIn)}</p>
        <p><strong>Check-out:</strong> ${formatDate(b.checkOut)}</p>

        <p>To secure the booking, please make payment using the bank details below:</p>

        <h3>Bank details</h3>
        <p>
          <strong>Account name:</strong> YOUR NAME<br />
          <strong>Sort code:</strong> 00-00-00<br />
          <strong>Account number:</strong> 00000000<br />
          <strong>Reference:</strong> ${b.name}
        </p>

        <p>Once payment has been received, your booking will be confirmed and we’ll send the full stay information.</p>

        <p>Many thanks,<br />Kings Caravan</p>
      `,
    });
  } catch (error) {
    console.error("Payment details email failed:", error);
  }
}

export async function sendGuestBookingConfirmed(booking: any) {
  const b = getBookingData(booking);
  if (!b.email) return;

  try {
    await resend.emails.send({
      from: process.env.RESEND_FROM!,
      to: b.email,
      subject: "🎉 Your Kings Caravan booking is confirmed",
      html: `
        <h2>Your booking is confirmed</h2>
        <p>Hi ${b.name},</p>

        <p>We’ve received your payment and your booking is now confirmed.</p>

        <p><strong>Check-in:</strong> ${formatDate(b.checkIn)}</p>
        <p><strong>Check-out:</strong> ${formatDate(b.checkOut)}</p>
        <p><strong>Guests:</strong> ${b.guests}</p>

        <h3>Before your stay</h3>
        <p>Please make sure all guests are aware of the caravan rules and site expectations.</p>

        <h3>Arrival information</h3>
        <p>Full arrival details, key information, parking and site information will be provided before your stay.</p>

        <p>We look forward to welcoming you to Kings Caravan.</p>

        <p>Many thanks,<br />Kings Caravan</p>
      `,
    });
  } catch (error) {
    console.error("Guest confirmation email failed:", error);
  }
}
export async function sendCustomGuestEmail({
  to,
  subject,
  message,
}: {
  to: string;
  subject: string;
  message: string;
}) {
  if (!to || !subject || !message) return;

  try {
    await resend.emails.send({
      from: process.env.RESEND_FROM!,
      to,
      subject,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.5;">
          ${message.replace(/\n/g, "<br />")}
          <p>Many thanks,<br />Kings Caravan</p>
        </div>
      `,
    });
  } catch (error) {
    console.error("Custom guest email failed:", error);
  }
}