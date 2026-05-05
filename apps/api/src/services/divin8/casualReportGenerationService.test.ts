import assert from "node:assert/strict";
import test from "node:test";
import { generateAnnualMonthLabels } from "./casualReportGenerationService.js";

test("generateAnnualMonthLabels starts with the user's local calendar month", () => {
  const nearMonthBoundary = new Date("2026-06-01T06:30:00.000Z");
  assert.deepEqual(generateAnnualMonthLabels("America/Vancouver", nearMonthBoundary).slice(0, 3), [
    "May 2026",
    "June 2026",
    "July 2026",
  ]);
});

test("generateAnnualMonthLabels returns exactly twelve months", () => {
  const months = generateAnnualMonthLabels("America/Vancouver", new Date("2026-05-05T12:00:00.000Z"));
  assert.equal(months.length, 12);
  assert.equal(months[0], "May 2026");
  assert.equal(months[11], "April 2027");
});
