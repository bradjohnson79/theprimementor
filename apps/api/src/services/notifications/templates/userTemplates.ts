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
      <p style="margin-top:24px;">With care,<br />Wisdom Transmissions</p>
    </div>
  `;
}

export function renderPaymentSucceededTemplate(
  payload: NotificationPayloadMap["payment.succeeded"],
): RenderedTemplate {
  return {
    subject: `Payment received for ${payload.product}`,
    templateVersion: "payment-succeeded-v1",
    html: layout(
      "Payment received",
      `
        <p>We received your payment for <strong>${payload.product}</strong>.</p>
        <p>Amount: <strong>${payload.amount} ${payload.currency.toUpperCase()}</strong></p>
        <p>Payment reference: <strong>${payload.paymentId}</strong></p>
      `,
    ),
  };
}

export function renderPaymentFailedTemplate(
  payload: NotificationPayloadMap["payment.failed"],
): RenderedTemplate {
  return {
    subject: `Payment issue for ${payload.product}`,
    templateVersion: "payment-failed-v1",
    html: layout(
      "Payment issue",
      `
        <p>We were unable to complete payment for <strong>${payload.product}</strong>.</p>
        <p>Reason: <strong>${payload.reason}</strong></p>
        <p>Payment reference: <strong>${payload.paymentId}</strong></p>
      `,
    ),
  };
}

export function renderBookingCreatedTemplate(
  payload: NotificationPayloadMap["booking.created"],
): RenderedTemplate {
  const bookingLabel = payload.eventTitle ?? payload.bookingType;
  return {
    subject: `Booking request received for ${bookingLabel}`,
    templateVersion: "booking-created-v2",
    html: layout(
      "Booking request received",
      `
        <p>Your ${bookingLabel} booking request has been recorded.</p>
        <p>Timezone: <strong>${payload.timezone}</strong></p>
        <p>Booking reference: <strong>${payload.bookingId}</strong></p>
      `,
    ),
  };
}

export function renderBookingConfirmedTemplate(
  payload: NotificationPayloadMap["booking.confirmed"],
): RenderedTemplate {
  const bookingLabel = payload.eventTitle ?? payload.bookingType;
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
        <p>Start: <strong>${payload.startTimeUtc}</strong></p>
        <p>End: <strong>${payload.endTimeUtc}</strong></p>
        <p>Timezone: <strong>${payload.timezone}</strong></p>
        ${joinDetails}
        ${accessReminder}
      `,
    ),
  };
}

export function renderReportGeneratedTemplate(
  payload: NotificationPayloadMap["report.generated"],
): RenderedTemplate {
  return {
    subject: `${payload.title} is ready`,
    templateVersion: "report-generated-v1",
    html: layout(
      "Report ready",
      `
        <p>Your report is ready.</p>
        <p>Title: <strong>${payload.title}</strong></p>
        <p>Report reference: <strong>${payload.reportId}</strong></p>
        <p>Tier: <strong>${payload.reportTier ?? "standard"}</strong></p>
      `,
    ),
  };
}
