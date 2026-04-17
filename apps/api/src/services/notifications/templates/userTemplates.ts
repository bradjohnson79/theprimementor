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

function formatMentoringCircleDateTime(value: string, timezone: string) {
  if (!value) {
    return "TBD";
  }

  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: timezone || "America/Vancouver",
      weekday: "long",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    }).format(new Date(value));
  } catch {
    return text(value, "TBD");
  }
}

function formatMentoringCircleTimezone(timezone: string) {
  if (timezone === "America/Vancouver") {
    return "America/Vancouver (Pacific Time)";
  }
  return text(timezone, "America/Vancouver");
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

export function renderMentoringCircleConfirmedTemplate(
  payload: NotificationPayloadMap["mentoring_circle.confirmed"],
): RenderedTemplate {
  const eventTitle = text(payload.eventTitle, "Mentoring Circle");
  const eventTime = formatMentoringCircleDateTime(payload.startTimeUtc, payload.timezone);
  return {
    subject: `${eventTitle} access confirmed`,
    templateVersion: "mentoring-circle-confirmed-v1",
    html: renderPrimeMentorEmail({
      eyebrow: "Mentoring Circle Confirmed",
      title: "Your Mentoring Circle access is ready",
      intro: `Your seat for ${eventTitle} is confirmed. Keep this email nearby so you have the webinar details and Zoom link ready for the session.`,
      sections: [
        renderInfoCard(
          "Event details",
          renderKeyValueTable([
            { label: "Event", value: eventTitle },
            { label: "Booking reference", value: text(payload.bookingId, "Unavailable") },
            { label: "Starts", value: eventTime },
            { label: "Ends", value: formatMentoringCircleDateTime(payload.endTimeUtc, payload.timezone) },
            { label: "Timezone", value: formatMentoringCircleTimezone(payload.timezone) },
            { label: "Name", value: payload.fullName ?? undefined },
            { label: "Email", value: payload.email ?? undefined },
            { label: "Zoom link", value: payload.joinUrl },
          ]),
        ),
        renderParagraph("This is the event email for your Mentoring Circle purchase. The Zoom registration link above is the link to use for this session."),
        renderParagraph("You will also receive reminder emails 24 hours before the event and again 1 hour before it begins."),
      ],
      callToAction: {
        label: "Open Zoom Link",
        url: payload.joinUrl,
        note: "Open this link to complete Zoom registration and join the event flow for this month.",
      },
      secondaryCallToAction: {
        label: "Open Mentoring Circle Page",
        url: buildFrontendUrl(payload.accessPagePath || "/mentoring-circle"),
      },
      footerNote: "Please arrive a few minutes early so you can settle in before the Mentoring Circle begins.",
    }),
  };
}

function renderMentoringCircleReminderTemplate(
  payload: NotificationPayloadMap["mentoring_circle.reminder_24h"] | NotificationPayloadMap["mentoring_circle.reminder_1h"],
  input: {
    subjectPrefix: string;
    eyebrow: string;
    title: string;
    intro: string;
    templateVersion: string;
    footerNote: string;
  },
): RenderedTemplate {
  const eventTitle = text(payload.eventTitle, "Mentoring Circle");
  return {
    subject: `${input.subjectPrefix}: ${eventTitle}`,
    templateVersion: input.templateVersion,
    html: renderPrimeMentorEmail({
      eyebrow: input.eyebrow,
      title: input.title,
      intro: input.intro,
      sections: [
        renderInfoCard(
          "Reminder details",
          renderKeyValueTable([
            { label: "Event", value: eventTitle },
            { label: "Booking reference", value: text(payload.bookingId, "Unavailable") },
            { label: "Starts", value: formatMentoringCircleDateTime(payload.startTimeUtc, payload.timezone) },
            { label: "Timezone", value: formatMentoringCircleTimezone(payload.timezone) },
            { label: "Name", value: payload.fullName ?? undefined },
            { label: "Email", value: payload.email ?? undefined },
            { label: "Zoom link", value: payload.joinUrl },
          ]),
        ),
        renderParagraph("If you need to re-open your event details later, you can also access them from your Mentoring Circle page."),
      ],
      callToAction: {
        label: "Open Zoom Link",
        url: payload.joinUrl,
      },
      secondaryCallToAction: {
        label: "Open Mentoring Circle Page",
        url: buildFrontendUrl(payload.accessPagePath || "/mentoring-circle"),
      },
      footerNote: input.footerNote,
    }),
  };
}

export function renderMentoringCircleReminder24hTemplate(
  payload: NotificationPayloadMap["mentoring_circle.reminder_24h"],
): RenderedTemplate {
  const eventTitle = text(payload.eventTitle, "Mentoring Circle");
  return renderMentoringCircleReminderTemplate(payload, {
    subjectPrefix: "Mentoring Circle tomorrow",
    eyebrow: "24 Hour Reminder",
    title: "Your Mentoring Circle begins tomorrow",
    intro: `${eventTitle} begins in approximately 24 hours. This is your reminder to keep your Zoom link ready and set aside space for the session.`,
    templateVersion: "mentoring-circle-reminder-24h-v1",
    footerNote: "A final reminder will be sent about 1 hour before the event begins.",
  });
}

export function renderMentoringCircleReminder1hTemplate(
  payload: NotificationPayloadMap["mentoring_circle.reminder_1h"],
): RenderedTemplate {
  const eventTitle = text(payload.eventTitle, "Mentoring Circle");
  return renderMentoringCircleReminderTemplate(payload, {
    subjectPrefix: "Mentoring Circle starts in 1 hour",
    eyebrow: "1 Hour Reminder",
    title: "Your Mentoring Circle starts soon",
    intro: `${eventTitle} begins in about 1 hour. Use the Zoom link below when you are ready to enter the webinar.`,
    templateVersion: "mentoring-circle-reminder-1h-v1",
    footerNote: "If you have trouble opening the Zoom link, reply to this email before the event begins and we will help.",
  });
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
