import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { retrieveAndVerifyShopPrice } from "./shopStripe.js";

function fakeStripe(price: Record<string, unknown> | Error) {
  return {
    prices: {
      retrieve: async () => {
        if (price instanceof Error) throw price;
        return price;
      },
    },
  } as never;
}

const valid = {
  id: "price_test_valid",
  active: true,
  type: "one_time",
  currency: "cad",
  unit_amount: 2499,
  product: "prod_test",
};

describe("retrieveAndVerifyShopPrice", () => {
  it("accepts an active one-time Price that matches catalog cents and currency", async () => {
    const verified = await retrieveAndVerifyShopPrice(fakeStripe(valid), {
      priceId: "price_test_valid",
      expectedCents: 2499,
      expectedCurrency: "CAD",
    });
    assert.equal(verified.priceId, "price_test_valid");
    assert.equal(verified.unitAmount, 2499);
    assert.equal(verified.currency, "cad");
    assert.equal(verified.type, "one_time");
  });

  it("rejects a missing or unretrievable Price", async () => {
    await assert.rejects(
      () => retrieveAndVerifyShopPrice(fakeStripe(new Error("No such price")), {
        priceId: "price_missing",
        expectedCents: 2499,
        expectedCurrency: "CAD",
      }),
      /could not be retrieved/i,
    );
  });

  it("rejects a Price ID that is not a Stripe Price", async () => {
    await assert.rejects(
      () => retrieveAndVerifyShopPrice(fakeStripe(valid), {
        priceId: "prod_not_a_price",
        expectedCents: 2499,
        expectedCurrency: "CAD",
      }),
      /valid Stripe Price ID/i,
    );
  });

  it("rejects an inactive Price", async () => {
    await assert.rejects(
      () => retrieveAndVerifyShopPrice(fakeStripe({ ...valid, active: false }), {
        priceId: "price_test_valid",
        expectedCents: 2499,
        expectedCurrency: "CAD",
      }),
      /does not match the Shop catalog/i,
    );
  });

  it("rejects a recurring Price", async () => {
    await assert.rejects(
      () => retrieveAndVerifyShopPrice(fakeStripe({ ...valid, type: "recurring" }), {
        priceId: "price_test_valid",
        expectedCents: 2499,
        expectedCurrency: "CAD",
      }),
      /does not match the Shop catalog/i,
    );
  });

  it("rejects a Price whose Stripe Product does not match the catalog", async () => {
    await assert.rejects(
      () => retrieveAndVerifyShopPrice(fakeStripe(valid), {
        priceId: "price_test_valid",
        expectedCents: 2499,
        expectedCurrency: "CAD",
        expectedProductId: "prod_other",
      }),
      /does not match the Shop catalog/i,
    );
  });

  it("rejects amount and currency mismatches", async () => {
    await assert.rejects(
      () => retrieveAndVerifyShopPrice(fakeStripe(valid), {
        priceId: "price_test_valid",
        expectedCents: 2999,
        expectedCurrency: "CAD",
      }),
      /does not match the Shop catalog/i,
    );
    await assert.rejects(
      () => retrieveAndVerifyShopPrice(fakeStripe(valid), {
        priceId: "price_test_valid",
        expectedCents: 2499,
        expectedCurrency: "USD",
      }),
      /does not match the Shop catalog/i,
    );
  });
});
