import {
  resolveWebinarZoomRegistrationUrl,
  type WebinarEventDefinition,
} from "../config/webinarEvents.js";

export type WebinarCheckoutConfirmationPlan =
  | { status: "ready"; zoomRegistrationUrl: string }
  | { status: "processing" }
  | { status: "unavailable" };

/**
 * Decide what a public thank-you page may show for a Stripe Checkout session.
 * The Zoom registration URL is returned only after Stripe reports the matching webinar as paid.
 */
export function planWebinarCheckoutConfirmation(input: {
  event: WebinarEventDefinition;
  mode: string | null;
  paymentStatus: string | null;
  sessionStatus: string | null;
  metadataEventId: string | null;
  metadataType: string | null;
}): WebinarCheckoutConfirmationPlan {
  const matchesEvent = input.metadataEventId === input.event.eventId
    && input.metadataType === "webinar"
    && input.mode === "payment";
  if (!matchesEvent) {
    return { status: "unavailable" };
  }
  if (input.paymentStatus === "paid") {
    return {
      status: "ready",
      zoomRegistrationUrl: resolveWebinarZoomRegistrationUrl(input.event),
    };
  }
  if (input.paymentStatus === "unpaid" && input.sessionStatus === "open") {
    return { status: "processing" };
  }
  return { status: "unavailable" };
}
