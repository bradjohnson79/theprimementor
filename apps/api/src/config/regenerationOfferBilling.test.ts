import assert from "node:assert/strict";
import test from "node:test";
import {
  REGENERATION_OFFER_ENDS_AT,
  REGENERATION_OFFER_TIMEZONE,
  getRegenerationOfferStatus,
  isRegenerationOfferActive,
} from "@wisdom/utils";
import {
  REGENERATION_OFFER_LIVE_PRICE_ENV_KEY,
  REGENERATION_OFFER_PRICE_ENV_KEY,
  resolveRegenerationOfferStripePriceId,
} from "./regenerationOfferBilling.js";

const ORIGINAL_ENV = { ...process.env };

test.afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

test("regeneration offer stays active through the final Vancouver second", () => {
  assert.equal(isRegenerationOfferActive(new Date("2026-09-01T06:59:59.000Z")), true);
  assert.equal(isRegenerationOfferActive(new Date("2026-09-01T07:00:00.000Z")), false);
});

test("regeneration offer status exposes canonical business timezone and expiry", () => {
  const status = getRegenerationOfferStatus(new Date("2026-09-01T06:59:59.000Z"));

  assert.deepEqual(status, {
    active: true,
    title: "Regeneration Q&A Package",
    priceCents: 14900,
    currency: "cad",
    endsAt: REGENERATION_OFFER_ENDS_AT,
    timezone: REGENERATION_OFFER_TIMEZONE,
  });
});

test("regeneration offer live price must come from environment", () => {
  process.env.STRIPE_SECRET_KEY = "sk_live_example";
  delete process.env[REGENERATION_OFFER_LIVE_PRICE_ENV_KEY];
  delete process.env[REGENERATION_OFFER_PRICE_ENV_KEY];

  assert.throws(
    () => resolveRegenerationOfferStripePriceId(),
    /Missing STRIPE_LIVE_PRICE_REGENERATION_OFFER/,
  );

  process.env[REGENERATION_OFFER_LIVE_PRICE_ENV_KEY] = "price_live_configured";
  assert.deepEqual(resolveRegenerationOfferStripePriceId(), {
    priceId: "price_live_configured",
    envKey: REGENERATION_OFFER_LIVE_PRICE_ENV_KEY,
  });
});

test("regeneration offer test price uses the non-live environment key", () => {
  process.env.STRIPE_SECRET_KEY = "sk_test_example";
  process.env[REGENERATION_OFFER_PRICE_ENV_KEY] = "price_test_configured";

  assert.deepEqual(resolveRegenerationOfferStripePriceId(), {
    priceId: "price_test_configured",
    envKey: REGENERATION_OFFER_PRICE_ENV_KEY,
  });
});
