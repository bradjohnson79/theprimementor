import assert from "node:assert/strict";
import test from "node:test";
import { PRIME_ALCHEMY_WEBINAR_EVENT } from "../config/webinarEvents.js";
import { planWebinarCheckoutConfirmation } from "./webinarCheckoutConfirmation.js";

const event = PRIME_ALCHEMY_WEBINAR_EVENT;

test("paid Prime Alchemy checkout reveals the Zoom registration URL", () => {
  const plan = planWebinarCheckoutConfirmation({
    event,
    mode: "payment",
    paymentStatus: "paid",
    sessionStatus: "complete",
    metadataEventId: event.eventId,
    metadataType: "webinar",
  });
  assert.equal(plan.status, "ready");
  if (plan.status === "ready") {
    assert.match(plan.zoomRegistrationUrl, /^https:\/\/us02web\.zoom\.us\/meeting\/register\//);
  }
});

test("an open unpaid checkout stays processing and hides the Zoom URL", () => {
  const plan = planWebinarCheckoutConfirmation({
    event,
    mode: "payment",
    paymentStatus: "unpaid",
    sessionStatus: "open",
    metadataEventId: event.eventId,
    metadataType: "webinar",
  });
  assert.deepEqual(plan, { status: "processing" });
});

test("a paid session for another product does not reveal this event", () => {
  const plan = planWebinarCheckoutConfirmation({
    event,
    mode: "payment",
    paymentStatus: "paid",
    sessionStatus: "complete",
    metadataEventId: "adronis-disclosure-to-contact-2026",
    metadataType: "webinar",
  });
  assert.deepEqual(plan, { status: "unavailable" });
});

test("an expired unpaid checkout is not treated as registration", () => {
  const plan = planWebinarCheckoutConfirmation({
    event,
    mode: "payment",
    paymentStatus: "unpaid",
    sessionStatus: "expired",
    metadataEventId: event.eventId,
    metadataType: "webinar",
  });
  assert.deepEqual(plan, { status: "unavailable" });
});
