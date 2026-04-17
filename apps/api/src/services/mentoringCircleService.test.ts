import test from "node:test";
import assert from "node:assert/strict";
import {
  buildMentoringCircleEventState,
  getActiveMentoringCirclePurchaseEvent,
  getDueMentoringCircleReminderTargets,
  getMentoringCircleEventOrThrow,
  type MentoringCircleBookingAccessRow,
} from "./mentoringCircleService.js";

test("mentoring circle resolves the default event definition", () => {
  const event = getMentoringCircleEventOrThrow();

  assert.equal(event.eventId, "2026-04-26");
  assert.equal(event.priceCents, 2500);
  assert.equal(event.currency, "CAD");
  assert.equal(event.timezone, "America/Vancouver");
  assert.equal(event.zoomLink, "https://us02web.zoom.us/meeting/register/4mdPcnhtRTmneCxhp51-Fg");
});

test("mentoring circle sales switch to may after april sales window opens", () => {
  const activeEvent = getActiveMentoringCirclePurchaseEvent(new Date("2026-04-26T12:05:00-07:00"));

  assert.equal(activeEvent?.eventId, "2026-05-31");
});

test("mentoring circle rejects unknown event ids", () => {
  assert.throws(
    () => getMentoringCircleEventOrThrow("not-a-real-event"),
    /Mentoring Circle event not found/i,
  );
});

test("pending access never exposes the Zoom link", () => {
  const event = getMentoringCircleEventOrThrow();
  const booking: MentoringCircleBookingAccessRow = {
    bookingId: "booking_pending",
    eventKey: event.eventKey,
    status: "pending_payment",
    joinUrl: event.zoomLink,
    paymentId: "payment_pending",
    paymentStatus: "pending",
  };

  const state = buildMentoringCircleEventState(event, booking, null);

  assert.equal(state.purchaseStatus, "pending_payment");
  assert.equal(state.accessStatus, "pending_payment");
  assert.equal(state.joinEligible, false);
  assert.equal(state.joinUrl, null);
});

test("confirmed access exposes the Zoom link", () => {
  const event = getMentoringCircleEventOrThrow();
  const booking: MentoringCircleBookingAccessRow = {
    bookingId: "booking_confirmed",
    eventKey: event.eventKey,
    status: "scheduled",
    joinUrl: event.zoomLink,
    paymentId: "payment_confirmed",
    paymentStatus: "paid",
  };

  const state = buildMentoringCircleEventState(event, booking, null);

  assert.equal(state.purchaseStatus, "confirmed");
  assert.equal(state.accessStatus, "confirmed");
  assert.equal(state.joinEligible, true);
  assert.equal(state.joinUrl, event.zoomLink);
});

test("mentoring circle detects the 24 hour reminder window", () => {
  const reminders = getDueMentoringCircleReminderTargets(new Date("2026-04-25T16:05:00.000Z"));

  assert.deepEqual(reminders, [
    {
      eventId: "2026-04-26",
      eventKey: "2026-04-26",
      reminderWindow: "24h",
      reminderAt: "2026-04-25T16:00:00.000Z",
    },
  ]);
});

test("mentoring circle detects the 1 hour reminder window", () => {
  const reminders = getDueMentoringCircleReminderTargets(new Date("2026-04-26T15:10:00.000Z"));

  assert.deepEqual(reminders, [
    {
      eventId: "2026-04-26",
      eventKey: "2026-04-26",
      reminderWindow: "1h",
      reminderAt: "2026-04-26T15:00:00.000Z",
    },
  ]);
});
