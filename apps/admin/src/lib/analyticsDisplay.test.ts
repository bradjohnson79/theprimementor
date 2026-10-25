import test from "node:test";
import assert from "node:assert/strict";
import { formatAnalyticsCount, goatCounterConnectionLabel } from "./analyticsDisplay.ts";

test("missing traffic renders as unavailable instead of zero", () => {
  assert.equal(formatAnalyticsCount(null), "Unavailable");
  assert.equal(formatAnalyticsCount(undefined), "Unavailable");
  assert.equal(formatAnalyticsCount(0), "0");
  assert.equal(formatAnalyticsCount(1280), "1,280");
});

test("connection label distinguishes credentials from outages", () => {
  assert.equal(goatCounterConnectionLabel({ connected: true, reason: "ok" }), "Connected");
  assert.equal(goatCounterConnectionLabel({ connected: false, reason: "unconfigured" }), "Not configured");
  assert.equal(goatCounterConnectionLabel({ connected: false, reason: "unauthorized" }), "Authentication failed");
  assert.equal(goatCounterConnectionLabel({ connected: false, reason: "timeout" }), "Unavailable");
});
