import assert from "node:assert/strict";
import test from "node:test";
import {
  STRIPE_REFERENCE_SCHEMA_VERSION,
  buildStripeReferenceMetadata,
  parseStripeReferenceMetadata,
} from "./stripeReferenceMetadata.js";

test("buildStripeReferenceMetadata emits canonical references", () => {
  assert.deepEqual(buildStripeReferenceMetadata({
    entityType: "session",
    entityId: "booking-1",
    userId: "user-1",
    userEmail: "client@example.com",
    bookingId: "booking-1",
    environment: "prod",
    platform: "prime_mentor",
  }), {
    schemaVersion: STRIPE_REFERENCE_SCHEMA_VERSION,
    entityType: "session",
    entityId: "booking-1",
    userId: "user-1",
    userEmail: "client@example.com",
    bookingId: "booking-1",
    environment: "prod",
    platform: "prime_mentor",
  });
});

test("parseStripeReferenceMetadata preserves legacy checkout keys", () => {
  const parsed = parseStripeReferenceMetadata({
    version: "membership-checkout-v1",
    type: "session",
    booking_id: "booking-legacy",
    customer_email: "client@example.com",
    checkoutSessionId: "cs_123",
    paymentIntentId: "pi_123",
  });

  assert.equal(parsed.schemaVersion, "membership-checkout-v1");
  assert.equal(parsed.entityType, "session");
  assert.equal(parsed.entityId, "booking-legacy");
  assert.equal(parsed.bookingId, "booking-legacy");
  assert.equal(parsed.userEmail, "client@example.com");
  assert.equal(parsed.stripeCheckoutSessionId, "cs_123");
  assert.equal(parsed.stripePaymentIntentId, "pi_123");
});
