import type { NotificationPayloadMap } from "../events.js";

interface RenderedTemplate {
  subject: string;
  html: string;
  templateVersion: string;
}

function text(value: string | number | null | undefined, fallback: string) {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  return String(value);
}

function money(amount: number | null | undefined, currency: string | null | undefined) {
  if (typeof amount !== "number") {
    return "Unavailable";
  }

  return `${amount} ${text(currency?.toUpperCase(), "USD")}`;
}

function layout(title: string, body: string) {
  return `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a;">
      <h1 style="font-size:24px;margin-bottom:16px;">${title}</h1>
      ${body}
    </div>
  `;
}

export function renderAdminPaymentReceivedTemplate(
  payload: NotificationPayloadMap["admin.payment.received"],
): RenderedTemplate {
  const product = text(payload.product, "Unknown product");
  return {
    subject: `Admin alert: payment received for ${product}`,
    templateVersion: "admin-payment-received-v1",
    html: layout(
      "Payment received",
      `
        <p>A payment was recorded.</p>
        <p>Product: <strong>${product}</strong></p>
        <p>Amount: <strong>${money(payload.amount, payload.currency)}</strong></p>
        <p>Customer: <strong>${text(payload.userEmail, "Unavailable")}</strong></p>
        <p>Payment reference: <strong>${text(payload.paymentId, "Unavailable")}</strong></p>
      `,
    ),
  };
}

export function renderAdminNewBookingTemplate(
  payload: NotificationPayloadMap["admin.new.booking"],
): RenderedTemplate {
  const bookingLabel = text(payload.eventTitle ?? payload.bookingType, "booking");
  return {
    subject: `Admin alert: new ${bookingLabel} booking`,
    templateVersion: "admin-new-booking-v2",
    html: layout(
      "New booking",
      `
        <p>A new booking was created.</p>
        <p>Booking type: <strong>${bookingLabel}</strong></p>
        <p>Customer: <strong>${text(payload.fullName ?? payload.userEmail, "Unavailable")}</strong></p>
        <p>Booking reference: <strong>${text(payload.bookingId, "Unavailable")}</strong></p>
        <p>Start: <strong>${text(payload.startTimeUtc, "TBD")}</strong></p>
        <p>Timezone: <strong>${text(payload.timezone, "TBD")}</strong></p>
      `,
    ),
  };
}

export function renderAdminNewUserTemplate(
  payload: NotificationPayloadMap["admin.new.user"],
): RenderedTemplate {
  return {
    subject: `Admin alert: new user signup ${text(payload.email, "unknown user")}`,
    templateVersion: "admin-new-user-v1",
    html: layout(
      "New user signup",
      `
        <p>A new account was created.</p>
        <p>Email: <strong>${text(payload.email, "Unavailable")}</strong></p>
        <p>Name: <strong>${text(payload.name, "Unavailable")}</strong></p>
        <p>Clerk ID: <strong>${text(payload.clerkId, "Unavailable")}</strong></p>
      `,
    ),
  };
}

export function renderAdminTestTemplate(
  payload: NotificationPayloadMap["admin.test"],
): RenderedTemplate {
  return {
    subject: "Admin test notification",
    templateVersion: "admin-test-v1",
    html: layout(
      "Notification test",
      `
        <p>This is a test notification from the admin dashboard.</p>
        <p>Message: <strong>${text(payload.message, "Notification pipeline verified.")}</strong></p>
        <p>Entity: <strong>${text(payload.entityId, "Unavailable")}</strong></p>
      `,
    ),
  };
}
