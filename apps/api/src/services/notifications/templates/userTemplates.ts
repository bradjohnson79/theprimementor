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
      <p style="margin-top:24px;">With care,<br />Wisdom Transmissions</p>
    </div>
  `;
}

export function renderPaymentSucceededTemplate(
  payload: NotificationPayloadMap["payment.succeeded"],
): RenderedTemplate {
  const product = text(payload.product, "your order");
  return {
    subject: `Payment received for ${product}`,
    templateVersion: "payment-succeeded-v1",
    html: layout(
      "Payment received",
      `
        <p>We received your payment for <strong>${product}</strong>.</p>
        <p>Amount: <strong>${money(payload.amount, payload.currency)}</strong></p>
        <p>Payment reference: <strong>${text(payload.paymentId, "Unavailable")}</strong></p>
      `,
    ),
  };
}

export function renderPaymentFailedTemplate(
  payload: NotificationPayloadMap["payment.failed"],
): RenderedTemplate {
  const product = text(payload.product, "your order");
  return {
    subject: `Payment issue for ${product}`,
    templateVersion: "payment-failed-v1",
    html: layout(
      "Payment issue",
      `
        <p>We were unable to complete payment for <strong>${product}</strong>.</p>
        <p>Reason: <strong>${text(payload.reason, "Unavailable")}</strong></p>
        <p>Payment reference: <strong>${text(payload.paymentId, "Unavailable")}</strong></p>
      `,
    ),
  };
}

export function renderBookingCreatedTemplate(
  payload: NotificationPayloadMap["booking.created"],
): RenderedTemplate {
  const bookingLabel = text(payload.eventTitle ?? payload.bookingType, "your booking");
  return {
    subject: `Booking request received for ${bookingLabel}`,
    templateVersion: "booking-created-v2",
    html: layout(
      "Booking request received",
      `
        <p>Your ${bookingLabel} booking request has been recorded.</p>
        <p>Timezone: <strong>${text(payload.timezone, "TBD")}</strong></p>
        <p>Booking reference: <strong>${text(payload.bookingId, "Unavailable")}</strong></p>
      `,
    ),
  };
}

export function renderBookingConfirmedTemplate(
  payload: NotificationPayloadMap["booking.confirmed"],
): RenderedTemplate {
  const bookingLabel = text(payload.eventTitle ?? payload.bookingType, "your booking");
  const accessReminder = payload.accessPagePath
    ? `<p>You can also find your access anytime on the Mentoring Circle page: <strong>${payload.accessPagePath}</strong></p>`
    : "";
  const joinDetails = payload.joinUrl
    ? `<p>Zoom link: <a href="${payload.joinUrl}">${payload.joinUrl}</a></p>`
    : "";
  return {
    subject: `${bookingLabel} confirmed`,
    templateVersion: "booking-confirmed-v2",
    html: layout(
      "Booking confirmed",
      `
        <p>Your ${bookingLabel} access has been confirmed.</p>
        <p>Start: <strong>${text(payload.startTimeUtc, "TBD")}</strong></p>
        <p>End: <strong>${text(payload.endTimeUtc, "TBD")}</strong></p>
        <p>Timezone: <strong>${text(payload.timezone, "TBD")}</strong></p>
        ${joinDetails}
        ${accessReminder}
      `,
    ),
  };
}

export function renderReportGeneratedTemplate(
  payload: NotificationPayloadMap["report.generated"],
): RenderedTemplate {
  const title = text(payload.title, "Your report");
  return {
    subject: `${title} is ready`,
    templateVersion: "report-generated-v1",
    html: layout(
      "Report ready",
      `
        <p>Your report is ready.</p>
        <p>Title: <strong>${title}</strong></p>
        <p>Report reference: <strong>${text(payload.reportId, "Unavailable")}</strong></p>
        <p>Tier: <strong>${text(payload.reportTier, "standard")}</strong></p>
      `,
    ),
  };
}
