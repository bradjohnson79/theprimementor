import assert from "node:assert/strict";
import test from "node:test";
import { TIMEZONE_OPTIONS } from "@wisdom/utils";
import {
  hasValidCoordinates,
  resolveIanaTimezoneFromCoordinates,
} from "./ianaTimezoneFromCoordinates.js";

const CASES = [
  { name: "Romanian", lat: 45.943161, lng: 24.96676, timezone: "Europe/Bucharest" },
  { name: "Canadian", lat: 49.2827, lng: -123.1207, timezone: "America/Vancouver" },
  { name: "US", lat: 40.7128, lng: -74.006, timezone: "America/New_York" },
  { name: "UK", lat: 51.5074, lng: -0.1278, timezone: "Europe/London" },
  { name: "Australian", lat: -33.8688, lng: 151.2093, timezone: "Australia/Sydney" },
  { name: "Indian", lat: 19.076, lng: 72.8777, timezone: "Asia/Kolkata" },
  { name: "Japanese", lat: 35.6762, lng: 139.6503, timezone: "Asia/Tokyo" },
] as const;

for (const testCase of CASES) {
  test(`resolveIanaTimezoneFromCoordinates maps ${testCase.name} coordinates to ${testCase.timezone}`, () => {
    assert.equal(resolveIanaTimezoneFromCoordinates(testCase.lat, testCase.lng), testCase.timezone);
  });
}

test("TIMEZONE_OPTIONS includes Europe/Bucharest as its own IANA zone", () => {
  assert.ok(TIMEZONE_OPTIONS.some((option) => option.ianaName === "Europe/Bucharest"));
  assert.equal(
    TIMEZONE_OPTIONS.find((option) => option.ianaName === "Europe/Athens")?.label.includes("Bucharest"),
    false,
  );
});

test("hasValidCoordinates rejects out-of-range values", () => {
  assert.equal(hasValidCoordinates(91, 10), false);
  assert.equal(hasValidCoordinates(45, 200), false);
  assert.equal(hasValidCoordinates(Number.NaN, 10), false);
  assert.equal(hasValidCoordinates(45.94, 24.97), true);
});
