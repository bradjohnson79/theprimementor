import assert from "node:assert/strict";
import test from "node:test";
import { ADRONIS_WEBINAR_STRIPE_PRICE_ID, ADRONIS_WEBINAR_ZOOM_REGISTRATION_URL } from "../config/webinarEvents.js";
import {
  buildWebinarEventState,
  getWebinarEventOrThrow,
  toPublicWebinarCatalog,
  type WebinarBookingAccessRow,
} from "./webinarEventService.js";

test("canonical Adronis webinar keeps Stripe and Zoom server-owned", () => {
  const event = getWebinarEventOrThrow("adronis-disclosure-to-contact-2026");
  assert.equal(event.eventTitle, "Adronis: From Disclosure to Contact");
  assert.equal(event.presenter, "Brad Johnson channeling Adronis");
  assert.equal(event.priceCents, 1499);
  assert.equal(event.currency, "CAD");
  assert.equal(event.eventStartAt, "2026-09-12T10:00:00-07:00");
  assert.equal(event.registrationClosesAt, "2026-09-12T09:00:00-07:00");
  assert.equal(event.stripePriceId, ADRONIS_WEBINAR_STRIPE_PRICE_ID);
  assert.equal(event.zoomRegistrationUrl, ADRONIS_WEBINAR_ZOOM_REGISTRATION_URL);
});

test("public webinar catalog never includes Zoom or Stripe Price IDs", () => {
  const event = getWebinarEventOrThrow();
  const catalog = toPublicWebinarCatalog(event, new Date("2026-09-01T12:00:00-07:00"));
  const serialized = JSON.stringify(catalog);

  assert.equal(catalog.registrationOpen, true);
  assert.equal(catalog.displayPrice, "$14.99 CAD");
  assert.doesNotMatch(serialized, /zoom\.us/i);
  assert.doesNotMatch(serialized, /price_/i);
  assert.doesNotMatch(serialized, /sCZZBeMQQgOQwsYb9XuM7Q/);
});

test("unpaid webinar state never exposes the Zoom registration URL", () => {
  const event = getWebinarEventOrThrow();
  const booking: WebinarBookingAccessRow = {
    bookingId: "booking_pending",
    eventKey: event.eventKey,
    status: "pending_payment",
    joinUrl: event.zoomRegistrationUrl,
    paymentId: "payment_pending",
    paymentStatus: "pending",
  };

  const state = buildWebinarEventState(event, booking, null);
  assert.equal(state.purchaseStatus, "pending_payment");
  assert.equal(state.joinEligible, false);
  assert.equal(state.zoomRegistrationUrl, null);
});

test("confirmed webinar entitlement exposes Zoom registration only after payment", () => {
  const event = getWebinarEventOrThrow();
  const booking: WebinarBookingAccessRow = {
    bookingId: "booking_confirmed",
    eventKey: event.eventKey,
    status: "scheduled",
    joinUrl: event.zoomRegistrationUrl,
    paymentId: "payment_paid",
    paymentStatus: "paid",
  };

  const state = buildWebinarEventState(event, booking, null);
  assert.equal(state.purchaseStatus, "confirmed");
  assert.equal(state.joinEligible, true);
  assert.equal(state.zoomRegistrationUrl, event.zoomRegistrationUrl);
});

test("unknown webinar event ids are rejected", () => {
  assert.throws(() => getWebinarEventOrThrow("not-a-real-event"), /Webinar event not found/i);
});

test("homepage catalog hides the event after the owner cutoff", () => {
  const event = getWebinarEventOrThrow();
  const catalog = toPublicWebinarCatalog(event, new Date("2026-09-12T09:00:00-07:00"));
  assert.equal(catalog.registrationOpen, false);
});
