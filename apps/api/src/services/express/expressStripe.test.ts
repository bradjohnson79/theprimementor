import test from "node:test";
import assert from "node:assert/strict";
import { expressLivePriceId } from "./expressStripe.js";

test("Express live prices use the configured Stripe price for each service", () => {
  assert.equal(expressLivePriceId("ask", {}), "price_1UZvGHAd5V3LaCqjyY6GLQEJ");
  assert.equal(expressLivePriceId("healing", {}), "price_1UZvJPAd5V3LaCqjG4Q4j5k0");
  assert.equal(expressLivePriceId("past-life", {}), "price_1UZvHNAd5V3LaCqj4yMnfbem");
  assert.equal(expressLivePriceId("ask", { STRIPE_LIVE_PRICE_EXPRESS_ASK: "price_override" }), "price_override");
});
