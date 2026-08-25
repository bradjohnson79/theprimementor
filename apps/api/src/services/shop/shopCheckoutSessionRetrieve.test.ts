import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { isShopFulfillmentTestStubEnabled } from "./shopCheckoutSessionRetrieve.js";

const KEYS = ["NODE_ENV", "STRIPE_SECRET_KEY", "SHOP_TEST_FULFILLMENT"] as const;

describe("Shop fulfillment test stub guard", () => {
  const original = Object.fromEntries(KEYS.map((key) => [key, process.env[key]]));

  afterEach(() => {
    for (const key of KEYS) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }
  });

  it("is off in production even if the flag is set", () => {
    process.env.NODE_ENV = "production";
    process.env.SHOP_TEST_FULFILLMENT = "1";
    process.env.STRIPE_SECRET_KEY = "sk_test_x";
    assert.equal(isShopFulfillmentTestStubEnabled(), false);
  });

  it("is off when the dedicated flag is unset, even with a test Stripe key", () => {
    process.env.NODE_ENV = "test";
    process.env.STRIPE_SECRET_KEY = "sk_test_x";
    delete process.env.SHOP_TEST_FULFILLMENT;
    assert.equal(isShopFulfillmentTestStubEnabled(), false);
  });

  it("is on only for a dedicated test process", () => {
    process.env.NODE_ENV = "test";
    process.env.SHOP_TEST_FULFILLMENT = "1";
    process.env.STRIPE_SECRET_KEY = "sk_live_ignored_by_stub_mode";
    assert.equal(isShopFulfillmentTestStubEnabled(), true);
  });
});
