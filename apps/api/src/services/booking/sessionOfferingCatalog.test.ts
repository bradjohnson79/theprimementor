import test from "node:test";
import assert from "node:assert/strict";
import {
  CANONICAL_SESSION_BOOKING_TYPE_IDS,
  CANONICAL_SESSION_OFFERINGS,
  GUIDED_SESSION_OFFERINGS,
  getActiveSessionOfferingByBookingTypeId,
} from "@wisdom/utils";
import { getBookingTypeStripePriceId } from "../../config/stripePrices.js";
import {
  validateCanonicalBookingTypeRows,
  type BookingTypeSummary,
} from "./bookingTypesService.js";

const expected = [
  ["qa-session-30", "qa_session", 30, 13900, "price_1Te0tkAd5V3LaCqjaF1A19RZ"],
  ["qa-session-45", "qa_session", 45, 18900, "price_1Te0uFAd5V3LaCqjT7Cf7Gmg"],
  ["qa-session-60", "qa_session", 60, 23900, "price_1Te0ukAd5V3LaCqjDpn9oY0w"],
  ["mentoring-session-45", "mentoring", 45, 19900, "price_1TILliAd5V3LaCqjidvbVLrl"],
  ["wisdom-mentoring-90", "mentoring", 90, 29900, "price_1TILnFAd5V3LaCqjkR9tAMuC"],
  ["regeneration-session", "regeneration", null, 9900, "price_1TSOy3Ad5V3LaCqjBkFRd1IL"],
  ["regeneration-qa-package", "regeneration", null, 14900, "price_1Twl2LAd5V3LaCqjCuljQ7Xk"],
] as const;

function rowForOffering(offering: typeof CANONICAL_SESSION_OFFERINGS[number]): BookingTypeSummary {
  return {
    id: offering.bookingTypeId,
    name: offering.displayName,
    session_type: offering.sessionType,
    duration_minutes: offering.durationMinutes ?? 0,
    price_cents: offering.amountCents,
    currency: offering.currency,
    buffer_before_minutes: 10,
    buffer_after_minutes: 10,
    is_active: true,
    created_at: "2026-06-24T00:00:00.000Z",
    updated_at: null,
  };
}

test("canonical session catalog contains the required offerings", () => {
  assert.deepEqual(CANONICAL_SESSION_BOOKING_TYPE_IDS, expected.map(([id]) => id));
  assert.equal(GUIDED_SESSION_OFFERINGS.length, 5);

  for (const [id, sessionType, durationMinutes, amountCents, stripePriceId] of expected) {
    const offering = getActiveSessionOfferingByBookingTypeId(id);
    assert.ok(offering, `${id} should be active`);
    assert.equal(offering.sessionType, sessionType);
    assert.equal(offering.durationMinutes, durationMinutes);
    assert.equal(offering.amountCents, amountCents);
    assert.equal(offering.currency, "CAD");
    assert.equal(offering.stripeLivePriceFallback, stripePriceId);
  }
});

test("canonical booking type row validation accepts exact rows and ignores unrelated active rows", () => {
  const rows = CANONICAL_SESSION_OFFERINGS.map(rowForOffering);
  rows.push({
    id: "focus-session-45",
    name: "Focus Session",
    session_type: "focus",
    duration_minutes: 45,
    price_cents: 19900,
    currency: "CAD",
    buffer_before_minutes: 10,
    buffer_after_minutes: 10,
    is_active: true,
    created_at: "2026-06-24T00:00:00.000Z",
    updated_at: null,
  });

  assert.deepEqual(validateCanonicalBookingTypeRows(rows), { ok: true, errors: [] });
});

test("canonical booking type row validation rejects amount and duration drift", () => {
  const rows = CANONICAL_SESSION_OFFERINGS.map(rowForOffering);
  const qa60 = rows.find((row) => row.id === "qa-session-60");
  assert.ok(qa60);
  qa60.duration_minutes = 45;
  qa60.price_cents = 18900;

  const result = validateCanonicalBookingTypeRows(rows);
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /qa-session-60 duration_minutes expected 60/);
  assert.match(result.errors.join("\n"), /qa-session-60 price_cents expected 23900/);
});

test("live Stripe price fallbacks resolve from the canonical catalog", () => {
  const originalSecret = process.env.STRIPE_SECRET_KEY;
  process.env.STRIPE_SECRET_KEY = "sk_live_test";
  try {
    for (const [id,,,, stripePriceId] of expected) {
      assert.equal(getBookingTypeStripePriceId(id), stripePriceId);
    }
  } finally {
    if (originalSecret === undefined) {
      delete process.env.STRIPE_SECRET_KEY;
    } else {
      process.env.STRIPE_SECRET_KEY = originalSecret;
    }
  }
});
