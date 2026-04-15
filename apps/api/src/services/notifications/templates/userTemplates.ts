import type { NotificationPayloadMap } from "../events.js";
import {
  buildFrontendUrl,
  escapeHtml,
  money,
  renderInfoCard,
  renderKeyValueTable,
  renderParagraph,
  renderPrimeMentorEmail,
  text,
} from "./emailLayout.js";

interface RenderedTemplate {
  subject: string;
  html: string;
  templateVersion: string;
}

export function renderPaymentSucceededTemplate(
  payload: NotificationPayloadMap["payment.succeeded"],
): RenderedTemplate {
  const product = text(payload.product, "your order");
  return {
    subject: `Payment received for ${product}`,
    templateVersion: "payment-succeeded-v2",
    html: renderPrimeMentorEmail({
      eyebrow: "Payment Confirmed",
      title: "Your order is confirmed",
      intro: `We have received your payment for ${product}. Thank you for moving forward with The Prime Mentor.`,
      sections: [
        renderInfoCard(
          "Payment summary",
          renderKeyValueTable([
            { label: "Product", value: product },
            { label: "Amount", value: money(payload.amount, payload.currency) },
            { label: "Payment reference", value: text(payload.paymentId, "Unavailable") },
            { label: "Order ID", value: payload.orderId ?? undefined },
          ]),
        ),
        renderParagraph("You can continue exploring sessions, reports, and mentoring opportunities from the main site whenever you are ready."),
      ],
      callToAction: {
        label: "Visit The Prime Mentor",
        url: buildFrontendUrl("/"),
      },
      secondaryCallToAction: {
        label: "Explore Sessions",
        url: buildFrontendUrl("/sessions"),
      },
      footerNote: "If you have any billing questions, simply reply to this email and we will help.",
    }),
  };
}

export function renderPaymentFailedTemplate(
  payload: NotificationPayloadMap["payment.failed"],
): RenderedTemplate {
  const product = text(payload.product, "your order");
  return {
    subject: `Payment issue for ${product}`,
    templateVersion: "payment-failed-v2",
    html: renderPrimeMentorEmail({
      eyebrow: "Payment Issue",
      title: "We could not complete your payment",
      intro: `Your payment for ${product} did not go through. The good news is that you can review the details and try again when ready.`,
      sections: [
        renderInfoCard(
          "What we know",
          renderKeyValueTable([
            { label: "Product", value: product },
            { label: "Amount", value: money(payload.amount, payload.currency) },
            { label: "Reason", value: text(payload.reason, "Unavailable") },
            { label: "Payment reference", value: text(payload.paymentId, "Unavailable") },
          ]),
        ),
        renderParagraph("If the issue continues, reply to this email and we will help you complete the next step."),
      ],
      callToAction: {
        label: "Contact Support",
        url: buildFrontendUrl("/contact"),
      },
      secondaryCallToAction: {
        label: "Return to The Prime Mentor",
        url: buildFrontendUrl("/"),
      },
      footerNote: "Payment links, session access, and report delivery only continue after the payment is successfully confirmed.",
    }),
  };
}

export function renderBookingCreatedTemplate(
  payload: NotificationPayloadMap["booking.created"],
): RenderedTemplate {
  const bookingLabel = text(payload.eventTitle ?? payload.bookingType, "your booking");
  return {
    subject: `Booking request received for ${bookingLabel}`,
    templateVersion: "booking-created-v3",
    html: renderPrimeMentorEmail({
      eyebrow: "Booking Request",
      title: "Your booking request is in",
      intro: `We have recorded your ${bookingLabel} request and will follow the next confirmation step from here.`,
      sections: [
        renderInfoCard(
          "Request details",
          renderKeyValueTable([
            { label: "Booking", value: bookingLabel },
            { label: "Booking reference", value: text(payload.bookingId, "Unavailable") },
            { label: "Timezone", value: text(payload.timezone, "TBD") },
            { label: "Name", value: payload.fullName ?? undefined },
            { label: "Email", value: payload.email ?? undefined },
          ]),
        ),
        renderParagraph("You do not need to take any additional action right now unless we contact you for a follow-up."),
      ],
      callToAction: {
        label: "Explore Sessions",
        url: buildFrontendUrl("/sessions"),
      },
      secondaryCallToAction: {
        label: "Visit The Prime Mentor",
        url: buildFrontendUrl("/"),
      },
      footerNote: "You will receive another email when your booking is fully confirmed or if we need anything else from you.",
    }),
  };
}

export function renderBookingConfirmedTemplate(
  payload: NotificationPayloadMap["booking.confirmed"],
): RenderedTemplate {
  const bookingLabel = text(payload.eventTitle ?? payload.bookingType, "your booking");
  const primaryUrl = payload.joinUrl || (payload.accessPagePath ? buildFrontendUrl(payload.accessPagePath) : buildFrontendUrl("/events/mentoring-circle"));
  const accessNote = payload.accessPagePath
    ? `You can also find your access anytime at ${payload.accessPagePath}.`
    : "If you need help accessing your event, reply to this email and we will help.";
  return {
    subject: `${bookingLabel} confirmed`,
    templateVersion: "booking-confirmed-v3",
    html: renderPrimeMentorEmail({
      eyebrow: "Booking Confirmed",
      title: "Your session access is ready",
      intro: `Your ${bookingLabel} booking is confirmed. Below are the key details you will want to keep handy.`,
      sections: [
        renderInfoCard(
          "Event details",
          renderKeyValueTable([
            { label: "Booking", value: bookingLabel },
            { label: "Booking reference", value: text(payload.bookingId, "Unavailable") },
            { label: "Start", value: text(payload.startTimeUtc, "TBD") },
            { label: "End", value: text(payload.endTimeUtc, "TBD") },
            { label: "Timezone", value: text(payload.timezone, "TBD") },
            { label: "Name", value: payload.fullName ?? undefined },
            { label: "Email", value: payload.email ?? undefined },
            { label: "Join link", value: payload.joinUrl ?? undefined },
          ]),
        ),
        renderParagraph(accessNote),
      ],
      callToAction: {
        label: payload.joinUrl ? "Open Join Link" : "View Access Details",
        url: primaryUrl,
        note: payload.joinUrl ? "Use this button when it is time to join." : undefined,
      },
      secondaryCallToAction: {
        label: "Open Mentoring Circle Page",
        url: payload.accessPagePath ? buildFrontendUrl(payload.accessPagePath) : buildFrontendUrl("/events/mentoring-circle"),
      },
      footerNote: "Please arrive a few minutes early so you can settle in before the session begins.",
    }),
  };
}

export function renderReportGeneratedTemplate(
  payload: NotificationPayloadMap["report.generated"],
): RenderedTemplate {
  const title = text(payload.title, "Your report");
  return {
    subject: `${title} is ready`,
    templateVersion: "report-generated-v2",
    html: renderPrimeMentorEmail({
      eyebrow: "Report Ready",
      title: "Your report is available",
      intro: `Your ${title} has been generated and is ready for review inside The Prime Mentor.`,
      sections: [
        renderInfoCard(
          "Report details",
          renderKeyValueTable([
            { label: "Title", value: title },
            { label: "Report reference", value: text(payload.reportId, "Unavailable") },
            { label: "Order ID", value: text(payload.orderId, "Unavailable") },
            { label: "Tier", value: text(payload.reportTier, "standard") },
            { label: "Name", value: payload.fullName ?? undefined },
            { label: "Email", value: payload.email ?? undefined },
          ]),
        ),
        renderParagraph("When you open the report, take your time with the first read-through and note any sections you want to revisit more deeply."),
      ],
      callToAction: {
        label: "View Reports",
        url: buildFrontendUrl("/reports"),
      },
      secondaryCallToAction: {
        label: "Return to The Prime Mentor",
        url: buildFrontendUrl("/"),
      },
      footerNote: "If you would like help integrating the insights from your report, reply to this email or book a session.",
    }),
  };
}
