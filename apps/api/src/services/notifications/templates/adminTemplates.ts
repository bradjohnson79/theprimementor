import type { NotificationPayloadMap } from "../events.js";
import {
  renderAvailabilityTable,
  buildAdminUrl,
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

export function renderAdminPaymentReceivedTemplate(
  payload: NotificationPayloadMap["admin.payment.received"],
): RenderedTemplate {
  const product = text(payload.product, "Unknown product");
  return {
    subject: `Order Received: ${product}`,
    templateVersion: "admin-payment-received-v2",
    html: renderPrimeMentorEmail({
      eyebrow: "Order Received",
      title: `${product} order received`,
      intro: `A new ${product} order was successfully recorded in The Prime Mentor system.`,
      sections: [
        renderInfoCard(
          "Payment details",
          renderKeyValueTable([
            { label: "Product", value: product },
            { label: "Amount", value: money(payload.amount, payload.currency) },
            { label: "Customer", value: text(payload.userEmail, "Unavailable") },
            { label: "Payment reference", value: text(payload.paymentId, "Unavailable") },
          ]),
        ),
      ],
      callToAction: {
        label: "Open Orders",
        url: buildAdminUrl("/admin/orders"),
      },
      secondaryCallToAction: {
        label: "Open Notifications",
        url: buildAdminUrl("/admin/settings/notifications"),
      },
      footerNote: "Use the admin dashboard for full order context, retries, or follow-up actions.",
    }),
  };
}

export function renderAdminNewBookingTemplate(
  payload: NotificationPayloadMap["admin.new.booking"],
): RenderedTemplate {
  const bookingLabel = text(payload.eventTitle ?? payload.bookingType, "booking");
  const hasSubmittedAvailability = Object.values(payload.availability ?? {}).some(
    (slots) => Array.isArray(slots) && slots.length > 0,
  );
  return {
    subject: `Order Received: ${bookingLabel}`,
    templateVersion: "admin-new-booking-v3",
    html: renderPrimeMentorEmail({
      eyebrow: "Order Received",
      title: `${bookingLabel} booking received`,
      intro: `A new ${bookingLabel} booking has entered the system and is ready for review in the admin dashboard.`,
      sections: [
        renderInfoCard(
          "Booking details",
          renderKeyValueTable([
            { label: "Booking type", value: bookingLabel },
            { label: "Customer", value: text(payload.fullName ?? payload.userEmail, "Unavailable") },
            { label: "Customer email", value: text(payload.userEmail, "Unavailable") },
            { label: "Booking reference", value: text(payload.bookingId, "Unavailable") },
            { label: "Start", value: payload.startTimeUtc ? payload.startTimeUtc : undefined },
            { label: "Timezone", value: text(payload.timezone, "TBD") },
          ]),
        ),
        ...(hasSubmittedAvailability
          ? [
              renderInfoCard(
                "Submitted availability",
                renderAvailabilityTable(payload.availability),
              ),
            ]
          : []),
      ],
      callToAction: {
        label: "Open Bookings",
        url: buildAdminUrl("/bookings"),
      },
      secondaryCallToAction: {
        label: "Open Notifications",
        url: buildAdminUrl("/admin/settings/notifications"),
      },
      footerNote: "Review confirmations, follow-up timing, and any customer communication from the admin panel.",
    }),
  };
}

export function renderAdminNewUserTemplate(
  payload: NotificationPayloadMap["admin.new.user"],
): RenderedTemplate {
  return {
    subject: `Admin alert: new user signup ${text(payload.email, "unknown user")}`,
    templateVersion: "admin-new-user-v2",
    html: renderPrimeMentorEmail({
      eyebrow: "Admin User Alert",
      title: "A new account has been created",
      intro: "A new user signup has been recorded and is available for review in the admin system.",
      sections: [
        renderInfoCard(
          "User details",
          renderKeyValueTable([
            { label: "Email", value: text(payload.email, "Unavailable") },
            { label: "Name", value: text(payload.name, "Unavailable") },
            { label: "Clerk ID", value: text(payload.clerkId, "Unavailable") },
          ]),
        ),
      ],
      callToAction: {
        label: "Open Clients",
        url: buildAdminUrl("/clients"),
      },
      secondaryCallToAction: {
        label: "Open Notifications",
        url: buildAdminUrl("/admin/settings/notifications"),
      },
      footerNote: "Use the client and account tools in admin if follow-up or cleanup is needed.",
    }),
  };
}

export function renderAdminTestTemplate(
  payload: NotificationPayloadMap["admin.test"],
): RenderedTemplate {
  return {
    subject: "Admin test notification",
    templateVersion: "admin-test-v2",
    html: renderPrimeMentorEmail({
      eyebrow: "Admin Test",
      title: "Notification pipeline check",
      intro: "This is a branded test notification from The Prime Mentor admin dashboard.",
      sections: [
        renderInfoCard(
          "Test details",
          renderKeyValueTable([
            { label: "Message", value: text(payload.message, "Notification pipeline verified.") },
            { label: "Entity", value: text(payload.entityId, "Unavailable") },
          ]),
        ),
        renderParagraph("If this email arrived with the expected styling and content, the notification pipeline is working end to end."),
      ],
      callToAction: {
        label: "Open Notifications",
        url: buildAdminUrl("/admin/settings/notifications"),
      },
      footerNote: "Use this test flow to validate delivery, branding, and recipient routing before sending customer-facing emails.",
    }),
  };
}
