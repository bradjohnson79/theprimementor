import assert from "node:assert/strict";
import test from "node:test";
import { deriveTierFromPriceId } from "./entitlementService.js";

test("deriveTierFromPriceId maps legacy live Premium monthly price for existing subscribers", () => {
  assert.deepEqual(deriveTierFromPriceId("price_1TXljJAd5V3LaCqjtT1GHbO2"), {
    tier: "seeker",
    billingInterval: "monthly",
  });
});
