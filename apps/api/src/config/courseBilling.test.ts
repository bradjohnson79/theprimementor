import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type Stripe from "stripe";
import {
  RESONANT_DOWSING_CHECKOUT_UNAVAILABLE_MESSAGE,
  RESONANT_DOWSING_STRIPE_PRICE_ID,
  diagnoseResonantDowsingStripePrice,
  getResonantDowsingStripePriceId,
  isResonantDowsingStripePriceConfigError,
  validateResonantDowsingStripePrice,
  verifyResonantDowsingStripePrice,
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
  it("uses the configured Resonant Dowsing Stripe Price ID from the environment", () => {
    const previous = process.env.STRIPE_PRICE_RESONANT_DOWSING;
    try {
      process.env.STRIPE_PRICE_RESONANT_DOWSING = RESONANT_DOWSING_STRIPE_PRICE_ID;
      assert.equal(getResonantDowsingStripePriceId(), RESONANT_DOWSING_STRIPE_PRICE_ID);

      process.env.STRIPE_PRICE_RESONANT_DOWSING = "price_other";
      assert.equal(getResonantDowsingStripePriceId(), "price_other");
    } finally {
      if (previous === undefined) {
        delete process.env.STRIPE_PRICE_RESONANT_DOWSING;
      } else {
        process.env.STRIPE_PRICE_RESONANT_DOWSING = previous;
      }
    }
  });

  it("rejects a missing configured Price ID", () => {
    const previous = process.env.STRIPE_PRICE_RESONANT_DOWSING;
    try {
      delete process.env.STRIPE_PRICE_RESONANT_DOWSING;
      assert.throws(
        () => getResonantDowsingStripePriceId(),
        (error) => isResonantDowsingStripePriceConfigError(error)
          && error.diagnostics.failureReason === "missing_env",
      );
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
    assert.throws(
      () => validateResonantDowsingStripePrice(price({ active: false })),
      (error) => isResonantDowsingStripePriceConfigError(error)
        && error.diagnostics.failureReason === "price_inactive",
    );
    assert.throws(
      () => validateResonantDowsingStripePrice(price({ currency: "usd" })),
      (error) => isResonantDowsingStripePriceConfigError(error)
        && error.diagnostics.failureReason === "wrong_currency",
    );
    assert.throws(
      () => validateResonantDowsingStripePrice(price({ unit_amount: 9800 })),
      (error) => isResonantDowsingStripePriceConfigError(error)
        && error.diagnostics.failureReason === "wrong_amount",
    );
    assert.throws(
      () => validateResonantDowsingStripePrice(price({ type: "recurring" })),
      (error) => isResonantDowsingStripePriceConfigError(error)
        && error.diagnostics.failureReason === "wrong_type",
    );
  });

  it("rejects a missing Stripe Price in the current Stripe mode", async () => {
    const previous = process.env.STRIPE_PRICE_RESONANT_DOWSING;
    process.env.STRIPE_PRICE_RESONANT_DOWSING = RESONANT_DOWSING_STRIPE_PRICE_ID;
    try {
      const stripe = {
        prices: {
          retrieve: async () => {
            const error = new Error("No such price") as Error & { code: string; statusCode: number; type: string };
            error.code = "resource_missing";
            error.statusCode = 404;
            error.type = "StripeInvalidRequestError";
            throw error;
          },
        },
      } as unknown as Stripe;

      await assert.rejects(
        () => verifyResonantDowsingStripePrice(stripe),
        (error) => isResonantDowsingStripePriceConfigError(error)
          && error.diagnostics.failureReason === "price_not_found"
          && error.diagnostics.priceDoesNotExist === true,
      );
      const diagnostics = await diagnoseResonantDowsingStripePrice(stripe);
      assert.equal(diagnostics.exists, false);
      assert.equal(diagnostics.valid, false);
      assert.equal(diagnostics.failureReason, "price_not_found");
    } finally {
      if (previous === undefined) {
        delete process.env.STRIPE_PRICE_RESONANT_DOWSING;
      } else {
        process.env.STRIPE_PRICE_RESONANT_DOWSING = previous;
      }
    }
  });

  it("keeps detailed diagnostics server-side and a generic checkout error for members", () => {
    assert.equal(
      RESONANT_DOWSING_CHECKOUT_UNAVAILABLE_MESSAGE,
      "Course checkout is temporarily unavailable. Please try again later or contact support.",
    );
    assert.doesNotMatch(RESONANT_DOWSING_CHECKOUT_UNAVAILABLE_MESSAGE, /Stripe|Price ID|9900|CAD|configuration/i);
  });
});
