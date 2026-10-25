import test from "node:test";
import assert from "node:assert/strict";
import { analyticsComparisonLabel, formatAnalyticsCount, goatCounterConnectionLabel } from "./analyticsDisplay.ts";

test("missing traffic renders as unavailable instead of zero", () => {
  assert.equal(formatAnalyticsCount(null), "Unavailable");
  assert.equal(formatAnalyticsCount(undefined), "Unavailable");
  assert.equal(formatAnalyticsCount(0), "0");
  assert.equal(formatAnalyticsCount(1280), "1,280");
});

test("a zero previous period does not become a percentage increase", () => {
  assert.equal(
    analyticsComparisonLabel({ current: 1, previous: 0, deltaLabel: "+100% vs previous period" }),
    "No previous-period activity",
  );
  assert.equal(
    analyticsComparisonLabel({ current: 4, previous: 2, deltaLabel: "+100% vs previous period" }),
    "+100% vs previous period",
  );
  assert.equal(analyticsComparisonLabel(null), null);
});

test("connection label distinguishes credentials from outages", () => {
  assert.equal(goatCounterConnectionLabel({ connected: true, reason: "ok" }), "Connected");
  assert.equal(goatCounterConnectionLabel({ connected: false, reason: "unconfigured" }), "Not configured");
  assert.equal(goatCounterConnectionLabel({ connected: false, reason: "unauthorized" }), "Authentication failed");
  assert.equal(goatCounterConnectionLabel({ connected: false, reason: "timeout" }), "Unavailable");
});
