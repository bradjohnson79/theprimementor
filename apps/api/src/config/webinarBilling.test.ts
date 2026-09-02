import assert from "node:assert/strict";
import test from "node:test";
import {
  ADRONIS_WEBINAR_LIVE_PRICE_ENV_KEY,
  ADRONIS_WEBINAR_PRICE_ENV_KEY,
  assertWebinarRegistrationOpen,
  resolveWebinarStripePriceId,
} from "./webinarBilling.js";
import { ADRONIS_WEBINAR_EVENT, ADRONIS_WEBINAR_STRIPE_PRICE_ID } from "./webinarEvents.js";

const ORIGINAL_ENV = { ...process.env };

test.afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

test("webinar checkout uses the server-owned Stripe Price ID", () => {
  process.env.STRIPE_SECRET_KEY = "sk_live_example";
  delete process.env[ADRONIS_WEBINAR_LIVE_PRICE_ENV_KEY];
  delete process.env[ADRONIS_WEBINAR_PRICE_ENV_KEY];

  assert.deepEqual(resolveWebinarStripePriceId(ADRONIS_WEBINAR_EVENT), {
    priceId: ADRONIS_WEBINAR_STRIPE_PRICE_ID,
    envKey: ADRONIS_WEBINAR_LIVE_PRICE_ENV_KEY,
    event: ADRONIS_WEBINAR_EVENT,
    source: "event",
  });
});

test("webinar live price prefers the environment override", () => {
  process.env.STRIPE_SECRET_KEY = "sk_live_example";
  process.env[ADRONIS_WEBINAR_LIVE_PRICE_ENV_KEY] = "price_live_override";

  assert.equal(resolveWebinarStripePriceId(ADRONIS_WEBINAR_EVENT).priceId, "price_live_override");
  assert.equal(resolveWebinarStripePriceId(ADRONIS_WEBINAR_EVENT).source, "env");
});

test("webinar test mode uses the non-live environment key when present", () => {
  process.env.STRIPE_SECRET_KEY = "sk_test_example";
  process.env[ADRONIS_WEBINAR_PRICE_ENV_KEY] = "price_test_configured";

  assert.deepEqual(resolveWebinarStripePriceId(ADRONIS_WEBINAR_EVENT), {
    priceId: "price_test_configured",
    envKey: ADRONIS_WEBINAR_PRICE_ENV_KEY,
    event: ADRONIS_WEBINAR_EVENT,
    source: "env",
  });
});

test("webinar registration is rejected after the owner cutoff", () => {
  assert.throws(
    () => assertWebinarRegistrationOpen(ADRONIS_WEBINAR_EVENT, new Date("2026-09-12T09:00:00-07:00")),
    /Registration for this webinar has closed/i,
  );
});

test("webinar registration remains open before the owner cutoff", () => {
  assert.doesNotThrow(() => {
    assertWebinarRegistrationOpen(ADRONIS_WEBINAR_EVENT, new Date("2026-09-12T08:59:59-07:00"));
  });
});
