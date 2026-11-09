import test from "node:test";
import assert from "node:assert/strict";
import { nextBusinessDayDeadline, vancouverDateKey } from "./businessDayDeadline.js";

function at(iso: string) {
  return new Date(iso);
}

test("Friday before daylight saving lands on the next Monday at 11:59 PM Pacific", () => {
  const result = nextBusinessDayDeadline(at("2026-03-07T02:00:00.000Z"));
  assert.equal(result.deliveryDate, "2026-03-09");
  assert.equal(vancouverDateKey(result.deadlineAt), "2026-03-09");
  assert.equal(result.deadlineAt.toISOString(), "2026-03-10T06:59:00.000Z");
});

test("Saturday and Sunday both land on Monday", () => {
  assert.equal(nextBusinessDayDeadline(at("2026-03-07T20:00:00.000Z")).deliveryDate, "2026-03-09");
  assert.equal(nextBusinessDayDeadline(at("2026-03-08T20:00:00.000Z")).deliveryDate, "2026-03-09");
});

test("a winter Friday lands on the following Monday", () => {
  const result = nextBusinessDayDeadline(at("2026-01-16T20:00:00.000Z"));
  assert.equal(result.deliveryDate, "2026-01-19");
  assert.equal(result.deadlineAt.toISOString(), "2026-01-20T07:59:00.000Z");
});

test("month end crosses from January into February", () => {
  const result = nextBusinessDayDeadline(at("2026-01-30T20:00:00.000Z"));
  assert.equal(result.deliveryDate, "2026-02-02");
});

test("year end crosses into the next calendar year", () => {
  const result = nextBusinessDayDeadline(at("2026-12-31T20:00:00.000Z"));
  assert.equal(result.deliveryDate, "2027-01-01");
  assert.equal(result.deadlineAt.toISOString(), "2027-01-02T07:59:00.000Z");
});

test("a configured holiday is skipped", () => {
  const result = nextBusinessDayDeadline(at("2026-05-04T19:00:00.000Z"), ["2026-05-05"]);
  assert.equal(result.deliveryDate, "2026-05-06");
});
