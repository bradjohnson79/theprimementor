import test from "node:test";
import assert from "node:assert/strict";
import { buildCurrentTimeContext, resolveTimezone } from "./timeContextService.js";

test("resolveTimezone honors profile before user and falls back to platform", () => {
  assert.equal(resolveTimezone({
    profileTimezone: "America/Vancouver",
    userTimezone: "America/New_York",
  }), "America/Vancouver");

  assert.equal(resolveTimezone({
    profileTimezone: "Invalid/Zone",
    userTimezone: "America/New_York",
  }), "America/New_York");
});

test("buildCurrentTimeContext formats authoritative date and time in the resolved zone", () => {
  const context = buildCurrentTimeContext(
    { profileTimezone: "America/Vancouver" },
    new Date("2026-04-14T21:32:00.000Z"),
  );

  assert.equal(context.timezone, "America/Vancouver");
  assert.equal(context.source, "profile");
  assert.equal(context.currentDate, "2026-04-14");
  assert.equal(context.currentTime, "14:32");
  assert.match(context.currentDateTime, /^2026-04-14T14:32:00[-+]\d{2}:\d{2}$/);
});
