import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type Stripe from "stripe";
import {
  RESONANT_DOWSING_STRIPE_PRICE_ID,
  getResonantDowsingStripePriceId,
  validateResonantDowsingStripePrice,
} from "./courseBilling.js";

function price(overrides: Partial<Stripe.Price> = {}) {
  return {
    id: RESONANT_DOWSING_STRIPE_PRICE_ID,
    object: "price",
    active: true,
    billing_scheme: "per_unit",
    created: 0,
    currency: "cad",
    custom_unit_amount: null,
    livemode: false,
    lookup_key: null,
    metadata: {},
    nickname: null,
    product: "prod_test",
    recurring: null,
    tax_behavior: "unspecified",
    tiers_mode: null,
    transform_quantity: null,
    type: "one_time",
    unit_amount: 9900,
    unit_amount_decimal: "9900",
    ...overrides,
  } as Stripe.Price;
}

describe("courseBilling", () => {
  it("requires the pinned Resonant Dowsing Stripe Price ID", () => {
    const previous = process.env.STRIPE_PRICE_RESONANT_DOWSING;
    try {
      process.env.STRIPE_PRICE_RESONANT_DOWSING = RESONANT_DOWSING_STRIPE_PRICE_ID;
      assert.equal(getResonantDowsingStripePriceId(), RESONANT_DOWSING_STRIPE_PRICE_ID);

      process.env.STRIPE_PRICE_RESONANT_DOWSING = "price_wrong";
      assert.throws(() => getResonantDowsingStripePriceId(), /Expected active one-time CAD price/);
    } finally {
      if (previous === undefined) {
        delete process.env.STRIPE_PRICE_RESONANT_DOWSING;
      } else {
        process.env.STRIPE_PRICE_RESONANT_DOWSING = previous;
      }
    }
  });

  it("accepts only an active one-time CAD price at 9900 cents", () => {
    assert.equal(validateResonantDowsingStripePrice(price()), true);
    assert.throws(() => validateResonantDowsingStripePrice(price({ active: false })), /Expected active one-time CAD price/);
    assert.throws(() => validateResonantDowsingStripePrice(price({ currency: "usd" })), /Expected active one-time CAD price/);
    assert.throws(() => validateResonantDowsingStripePrice(price({ unit_amount: 9800 })), /Expected active one-time CAD price/);
    assert.throws(() => validateResonantDowsingStripePrice(price({ type: "recurring" })), /Expected active one-time CAD price/);
  });
});
