import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { dollarsToCents, formatShopPriceCad } from "@wisdom/utils";

describe("shopPricing", () => {
  it("formats Body Deck as $24.99 CAD", () => {
    assert.equal(formatShopPriceCad(2499, "CAD"), "$24.99 CAD");
  });

  it("converts dollars to cents", () => {
    assert.equal(dollarsToCents("29.99"), 2999);
  });
});
