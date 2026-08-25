import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isFeaturedOnlyQuery, isPurchasableShopProduct, isRelatedShopProduct } from "./shopCatalog.js";
import { assertCanMutateShopStripe } from "./shopStripe.js";

describe("shop featured query", () => {
  it("treats only featured=true as a featured-only listing", () => {
    assert.equal(isFeaturedOnlyQuery("true"), true);
    assert.equal(isFeaturedOnlyQuery("TRUE"), true);
    assert.equal(isFeaturedOnlyQuery(" true "), true);
    assert.equal(isFeaturedOnlyQuery("false"), false);
    assert.equal(isFeaturedOnlyQuery("1"), false);
    assert.equal(isFeaturedOnlyQuery(undefined), false);
    assert.equal(isFeaturedOnlyQuery(""), false);
  });
});

describe("shop catalog purchasability", () => {
  it("requires an active product with a Stripe Price", () => {
    assert.equal(isPurchasableShopProduct({
      is_active: true,
      status: "active",
      price_cents: 2499,
      stripe_price_id: "price_1U6awqAd5V3LaCqjYPtzgvir",
    }), true);
    assert.equal(isPurchasableShopProduct({
      is_active: false,
      status: "active",
      price_cents: 2499,
      stripe_price_id: "price_1U6awqAd5V3LaCqjYPtzgvir",
    }), false);
    assert.equal(isPurchasableShopProduct({
      is_active: true,
      status: "active",
      price_cents: 2499,
      stripe_price_id: null,
    }), false);
    assert.equal(isPurchasableShopProduct({
      is_active: true,
      status: "active",
      price_cents: 2499,
      stripe_price_id: "",
    }), false);
  });
});

describe("shop related products", () => {
  it("keeps only other active products in the same collection", () => {
    const current = { id: "body", collection: "healing-code-cards" };
    assert.equal(isRelatedShopProduct(current, { id: "mind", collection: "healing-code-cards", is_active: true, status: "active" }), true);
    assert.equal(isRelatedShopProduct(current, { id: "body", collection: "healing-code-cards", is_active: true, status: "active" }), false);
    assert.equal(isRelatedShopProduct(current, { id: "draft", collection: "healing-code-cards", is_active: false, status: "active" }), false);
    assert.equal(isRelatedShopProduct(current, { id: "other", collection: "reports", is_active: true, status: "active" }), false);
    assert.equal(isRelatedShopProduct({ id: "body", collection: null }, { id: "mind", collection: "healing-code-cards", is_active: true, status: "active" }), false);
  });
});

describe("shop Stripe mutation guard", () => {
  it("refuses live-key Price creation", () => {
    const previous = process.env.STRIPE_SECRET_KEY;
    process.env.STRIPE_SECRET_KEY = "sk_live_test_guard";
    try {
      assert.throws(() => assertCanMutateShopStripe(), /will not create or replace live Stripe/i);
    } finally {
      if (previous === undefined) delete process.env.STRIPE_SECRET_KEY;
      else process.env.STRIPE_SECRET_KEY = previous;
    }
  });
});
