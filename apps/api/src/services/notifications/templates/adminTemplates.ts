import type { NotificationPayloadMap } from "../events.js";

interface RenderedTemplate {
  subject: string;
  html: string;
  templateVersion: string;
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
  return {
    subject: `Admin alert: payment received for ${payload.product}`,
    templateVersion: "admin-payment-received-v1",
    html: layout(
      "Payment received",
      `
        <p>A payment was recorded.</p>
        <p>Product: <strong>${payload.product}</strong></p>
        <p>Amount: <strong>${payload.amount} ${payload.currency.toUpperCase()}</strong></p>
        <p>Customer: <strong>${payload.userEmail ?? "Unavailable"}</strong></p>
        <p>Payment reference: <strong>${payload.paymentId}</strong></p>
      `,
    ),
  };
}

export function renderAdminNewBookingTemplate(
  payload: NotificationPayloadMap["admin.new.booking"],
): RenderedTemplate {
  const bookingLabel = payload.eventTitle ?? payload.bookingType;
  return {
    subject: `Admin alert: new ${bookingLabel} booking`,
    templateVersion: "admin-new-booking-v2",
    html: layout(
      "New booking",
      `
        <p>A new booking was created.</p>
        <p>Booking type: <strong>${bookingLabel}</strong></p>
        <p>Customer: <strong>${payload.fullName ?? payload.userEmail ?? "Unavailable"}</strong></p>
        <p>Booking reference: <strong>${payload.bookingId}</strong></p>
        ${payload.startTimeUtc ? `<p>Start: <strong>${payload.startTimeUtc}</strong></p>` : ""}
        ${payload.timezone ? `<p>Timezone: <strong>${payload.timezone}</strong></p>` : ""}
      `,
    ),
  };
}

export function renderAdminNewUserTemplate(
  payload: NotificationPayloadMap["admin.new.user"],
): RenderedTemplate {
  return {
    subject: `Admin alert: new user signup ${payload.email}`,
    templateVersion: "admin-new-user-v1",
    html: layout(
      "New user signup",
      `
        <p>A new account was created.</p>
        <p>Email: <strong>${payload.email}</strong></p>
        <p>Name: <strong>${payload.name ?? "Unavailable"}</strong></p>
        <p>Clerk ID: <strong>${payload.clerkId}</strong></p>
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
        <p>Message: <strong>${payload.message ?? "Notification pipeline verified."}</strong></p>
        <p>Entity: <strong>${payload.entityId}</strong></p>
      `,
    ),
  };
}
