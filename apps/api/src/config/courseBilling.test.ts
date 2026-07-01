import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type Stripe from "stripe";
import {
  RESONANT_DOWSING_CHECKOUT_UNAVAILABLE_MESSAGE,
  RESONANT_DOWSING_STRIPE_PRICE_ID,
  buildResonantDowsingCheckoutLineItem,
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
    livemode: true,
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

function stripeWithPrice(input: { price?: Stripe.Price; missing?: boolean; accountLivemode?: boolean } = {}) {
  return {
    accounts: {
      retrieve: async () => ({
        id: "acct_live_test",
        object: "account",
        livemode: input.accountLivemode ?? true,
      }),
    },
    prices: {
      retrieve: async () => {
        if (input.missing) {
          const error = new Error("No such price") as Error & { code: string; statusCode: number; type: string };
          error.code = "resource_missing";
          error.statusCode = 404;
          error.type = "StripeInvalidRequestError";
          throw error;
        }
        return input.price ?? price();
      },
    },
  } as unknown as Stripe;
}

describe("courseBilling", () => {
  it("keeps the correct Resonant Dowsing live Price ID in valid config fixtures", () => {
    assert.equal(RESONANT_DOWSING_STRIPE_PRICE_ID, "price_1ToFFCAd5V3LaCqj2pPuEFp9");
  });

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

  it("builds checkout line items from server environment only", () => {
    const previous = process.env.STRIPE_PRICE_RESONANT_DOWSING;
    try {
      process.env.STRIPE_PRICE_RESONANT_DOWSING = RESONANT_DOWSING_STRIPE_PRICE_ID;
      assert.deepEqual(buildResonantDowsingCheckoutLineItem(), {
        price: RESONANT_DOWSING_STRIPE_PRICE_ID,
        quantity: 1,
      });

      process.env.STRIPE_PRICE_RESONANT_DOWSING = "price_server_only";
      assert.deepEqual(buildResonantDowsingCheckoutLineItem(), {
        price: "price_server_only",
        quantity: 1,
      });
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
          && error.diagnostics.validationFailureReason === "missing_environment_variable",
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
        && error.diagnostics.validationFailureReason === "inactive_price",
    );
    assert.throws(
      () => validateResonantDowsingStripePrice(price({ currency: "usd" })),
      (error) => isResonantDowsingStripePriceConfigError(error)
        && error.diagnostics.validationFailureReason === "wrong_currency",
    );
    assert.throws(
      () => validateResonantDowsingStripePrice(price({ unit_amount: 9800 })),
      (error) => isResonantDowsingStripePriceConfigError(error)
        && error.diagnostics.validationFailureReason === "wrong_amount",
    );
    assert.throws(
      () => validateResonantDowsingStripePrice(price({ type: "recurring" })),
      (error) => isResonantDowsingStripePriceConfigError(error)
        && error.diagnostics.validationFailureReason === "recurring_price",
    );
    assert.throws(
      () => validateResonantDowsingStripePrice(price({ livemode: false }), { stripeAccountLivemode: true }),
      (error) => isResonantDowsingStripePriceConfigError(error)
        && error.diagnostics.validationFailureReason === "wrong_mode",
    );
  });

  it("rejects a missing Stripe Price in the current Stripe mode", async () => {
    const previous = process.env.STRIPE_PRICE_RESONANT_DOWSING;
    process.env.STRIPE_PRICE_RESONANT_DOWSING = RESONANT_DOWSING_STRIPE_PRICE_ID;
    try {
      const stripe = stripeWithPrice({ missing: true });

      await assert.rejects(
        () => verifyResonantDowsingStripePrice(stripe),
        (error) => isResonantDowsingStripePriceConfigError(error)
          && error.diagnostics.validationFailureReason === "price_not_found"
          && error.diagnostics.priceDoesNotExist === true,
      );
      const diagnostics = await diagnoseResonantDowsingStripePrice(stripe);
      assert.equal(diagnostics.priceExists, false);
      assert.equal(diagnostics.valid, false);
      assert.equal(diagnostics.validationFailureReason, "price_not_found");
      assert.equal(diagnostics.stripeAccountId, "acct_live_test");
    } finally {
      if (previous === undefined) {
        delete process.env.STRIPE_PRICE_RESONANT_DOWSING;
      } else {
        process.env.STRIPE_PRICE_RESONANT_DOWSING = previous;
      }
    }
  });

  it("does not cache stale negative validations across environment changes", async () => {
    const previous = process.env.STRIPE_PRICE_RESONANT_DOWSING;
    try {
      process.env.STRIPE_PRICE_RESONANT_DOWSING = "price_missing";
      const missing = await diagnoseResonantDowsingStripePrice(stripeWithPrice({ missing: true }));
      assert.equal(missing.configuredPriceId, "price_missing");
      assert.equal(missing.validationFailureReason, "price_not_found");

      process.env.STRIPE_PRICE_RESONANT_DOWSING = RESONANT_DOWSING_STRIPE_PRICE_ID;
      const valid = await diagnoseResonantDowsingStripePrice(stripeWithPrice({ price: price({ id: RESONANT_DOWSING_STRIPE_PRICE_ID }) }));
      assert.equal(valid.configuredPriceId, RESONANT_DOWSING_STRIPE_PRICE_ID);
      assert.equal(valid.validationResult, "valid");
      assert.equal(valid.valid, true);
    } finally {
      if (previous === undefined) {
        delete process.env.STRIPE_PRICE_RESONANT_DOWSING;
      } else {
        process.env.STRIPE_PRICE_RESONANT_DOWSING = previous;
      }
    }
  });

  it("retrieves account and price through the same Stripe client before validation succeeds", async () => {
    const previous = process.env.STRIPE_PRICE_RESONANT_DOWSING;
    process.env.STRIPE_PRICE_RESONANT_DOWSING = RESONANT_DOWSING_STRIPE_PRICE_ID;
    try {
      const calls: string[] = [];
      const stripe = {
        accounts: {
          retrieve: async () => {
            calls.push("accounts.retrieve");
            return {
              id: "acct_same_client",
              object: "account",
              livemode: true,
            };
          },
        },
        prices: {
          retrieve: async (priceId: string) => {
            calls.push(`prices.retrieve:${priceId}`);
            return price({ id: priceId });
          },
        },
      } as unknown as Stripe;

      const verified = await verifyResonantDowsingStripePrice(stripe);
      assert.equal(verified.id, RESONANT_DOWSING_STRIPE_PRICE_ID);
      assert.deepEqual(calls, [
        "accounts.retrieve",
        `prices.retrieve:${RESONANT_DOWSING_STRIPE_PRICE_ID}`,
      ]);
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
