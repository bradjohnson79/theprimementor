import assert from "node:assert/strict";
import test from "node:test";
import {
  isBookingSessionType,
  sessionTypeRequiresAvailabilitySelection,
  sessionTypeRequiresSchedule,
  validatePrimeBodyHealingIntake,
  bookingRequiresNatalFields,
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
  assert.equal(sessionTypeRequiresSchedule("regeneration"), true);
  assert.equal(sessionTypeRequiresSchedule("mentoring_circle"), false);
  assert.equal(sessionTypeRequiresSchedule("prime_body_healing"), false);
});

test("prime_body_healing is recognized as a booking session type", () => {
  assert.equal(isBookingSessionType("prime_body_healing"), true);
});

test("Level 1 live intake requires format and at least one area", () => {
  assert.deepEqual(
    validatePrimeBodyHealingIntake({
      bookingTypeId: "prime-body-healing-level-1-live",
      deliveryFormat: "live",
      healingAreas: ["Left shoulder"],
      concerns: "",
    }),
    {
      deliveryFormat: "live",
      healingAreas: ["Left shoulder"],
      concerns: undefined,
    },
  );
  assert.throws(
    () => validatePrimeBodyHealingIntake({
      bookingTypeId: "prime-body-healing-level-1-live",
      deliveryFormat: "live",
      healingAreas: [],
      concerns: "",
    }),
    /At least one healing area/,
  );
  assert.throws(
    () => validatePrimeBodyHealingIntake({
      bookingTypeId: "prime-body-healing-level-1-live",
      deliveryFormat: "prerecorded",
      healingAreas: ["Shoulder"],
      concerns: "",
    }),
    /deliveryFormat must be live/,
  );
});

test("Level 1 prerecorded rejects a live format and does not require a schedule", () => {
  assert.equal(sessionTypeRequiresSchedule("prime_body_healing"), false);
  assert.deepEqual(
    validatePrimeBodyHealingIntake({
      bookingTypeId: "prime-body-healing-level-1-prerecorded",
      deliveryFormat: "prerecorded",
      healingAreas: ["Sleep", "Anxiety"],
      concerns: "",
    }),
    {
      deliveryFormat: "prerecorded",
      healingAreas: ["Sleep", "Anxiety"],
      concerns: undefined,
    },
  );
});

test("Level 2 intake requires concerns and natal fields, not a live format", () => {
  assert.equal(bookingRequiresNatalFields("prime_body_healing", "prime-body-healing-level-2"), true);
  assert.equal(bookingRequiresNatalFields("prime_body_healing", "prime-body-healing-level-1-live"), false);
  assert.throws(
    () => validatePrimeBodyHealingIntake({
      bookingTypeId: "prime-body-healing-level-2",
      deliveryFormat: "scan",
      healingAreas: [],
      concerns: "",
    }),
    /concerns are required/,
  );
  assert.deepEqual(
    validatePrimeBodyHealingIntake({
      bookingTypeId: "prime-body-healing-level-2",
      deliveryFormat: "scan",
      healingAreas: [],
      concerns: "Persistent fatigue and emotional heaviness",
    }),
    {
      deliveryFormat: "scan",
      healingAreas: [],
      concerns: "Persistent fatigue and emotional heaviness",
    },
  );
  assert.throws(
    () => validatePrimeBodyHealingIntake({
      bookingTypeId: "prime-body-healing-level-2",
      deliveryFormat: "live",
      healingAreas: [],
      concerns: "Fatigue",
    }),
    /deliveryFormat must be scan/,
  );
});

test("session intake types require the explicit availability-selection step", () => {
  assert.equal(sessionTypeRequiresAvailabilitySelection("qa_session"), true);
  assert.equal(sessionTypeRequiresAvailabilitySelection("focus"), true);
  assert.equal(sessionTypeRequiresAvailabilitySelection("mentoring"), true);
  assert.equal(sessionTypeRequiresAvailabilitySelection("regeneration"), true);
  assert.equal(sessionTypeRequiresAvailabilitySelection("prime_body_healing"), false);
});
