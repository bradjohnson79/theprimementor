import test from "node:test";
import assert from "node:assert/strict";
import { isPublicAnalyticsPath, sanitizeAnalyticsPath } from "./analytics.ts";

test("analytics paths drop payment and account identifiers", () => {
  assert.equal(
    sanitizeAnalyticsPath("/order/thank-you?kind=session&checkoutSessionId=cs_live_secret&intake=abc"),
    "/order/thank-you?kind=session",
  );
  assert.equal(sanitizeAnalyticsPath("/sign-in?email=person@example.com#token"), "/sign-in");
  assert.equal(sanitizeAnalyticsPath("/webinars/prime-alchemy-teachings"), "/webinars/prime-alchemy-teachings");
  assert.equal(isPublicAnalyticsPath("/dashboard/webinars"), false);
  assert.equal(isPublicAnalyticsPath("/webinars/prime-alchemy-teachings"), true);
  assert.equal(isPublicAnalyticsPath("/services/healing"), true);
});
