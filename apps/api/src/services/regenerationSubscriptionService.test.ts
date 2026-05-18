import assert from "node:assert/strict";
import test from "node:test";
import { REGENERATION_MANIFESTATION_ENHANCEMENT_PRICE_ID } from "../config/regenerationBilling.js";
import { buildRegenerationCheckoutLineItems } from "./regenerationSubscriptionService.js";

test("buildRegenerationCheckoutLineItems keeps checkout to base subscription without add-on", () => {
  assert.deepEqual(buildRegenerationCheckoutLineItems("price_base_monthly", false), [
    { price: "price_base_monthly", quantity: 1 },
  ]);
});

test("buildRegenerationCheckoutLineItems adds manifestation enhancement as initial checkout add-on", () => {
  assert.deepEqual(buildRegenerationCheckoutLineItems("price_base_monthly", true), [
    { price: "price_base_monthly", quantity: 1 },
    { price: REGENERATION_MANIFESTATION_ENHANCEMENT_PRICE_ID, quantity: 1 },
  ]);
});
