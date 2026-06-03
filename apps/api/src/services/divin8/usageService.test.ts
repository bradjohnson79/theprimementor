import assert from "node:assert/strict";
import test from "node:test";
import { resolveUsageWindow } from "./usageService.js";

test("resolveUsageWindow follows the current Stripe billing cycle", () => {
  const window = resolveUsageWindow({
    userId: "user-1",
    stripeSubscriptionId: "sub_123",
    tier: "seeker",
    billingInterval: "monthly",
    currentPeriodStart: new Date("2026-05-19T01:27:25.000Z"),
    currentPeriodEnd: new Date("2026-06-19T01:27:25.000Z"),
    isSynced: true,
  }, new Date("2026-06-03T16:47:41.000Z"));

  assert.equal(window.periodStart.toISOString(), "2026-05-19T01:27:25.000Z");
  assert.equal(window.periodEnd.toISOString(), "2026-06-19T01:27:25.000Z");
});
