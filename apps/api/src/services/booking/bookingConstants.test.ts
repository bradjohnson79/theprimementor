import assert from "node:assert/strict";
import test from "node:test";
import {
  isBookingSessionType,
  sessionTypeRequiresAvailabilitySelection,
  sessionTypeRequiresSchedule,
} from "./bookingConstants.js";

test("qa_session is recognized as a booking session type", () => {
  assert.equal(isBookingSessionType("qa_session"), true);
});

test("qa_session requires scheduling like other live 1-on-1 sessions", () => {
  assert.equal(sessionTypeRequiresSchedule("qa_session"), true);
});

test("sessionTypeRequiresSchedule only requires availability for live sessions", () => {
  assert.equal(sessionTypeRequiresSchedule("focus"), true);
  assert.equal(sessionTypeRequiresSchedule("mentoring"), true);
  assert.equal(sessionTypeRequiresSchedule("regeneration"), false);
  assert.equal(sessionTypeRequiresSchedule("mentoring_circle"), false);
});

test("qa_session skips the explicit availability-selection step", () => {
  assert.equal(sessionTypeRequiresAvailabilitySelection("qa_session"), false);
  assert.equal(sessionTypeRequiresAvailabilitySelection("focus"), true);
  assert.equal(sessionTypeRequiresAvailabilitySelection("mentoring"), true);
});
