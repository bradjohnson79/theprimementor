import assert from "node:assert/strict";
import test from "node:test";
import { normalizeHealthFocusAreas } from "./bookingService.js";

test("normalizeHealthFocusAreas keeps only named rows and preserves severity", () => {
  const areas = normalizeHealthFocusAreas([
    { name: "Chronic fatigue", severity: 8 },
    { name: " ", severity: 4 },
    { name: "Emotional overwhelm", severity: "6" },
  ], { requireAtLeastOne: true });

  assert.deepEqual(areas, [
    { name: "Chronic fatigue", severity: 8 },
    { name: "Emotional overwhelm", severity: 6 },
  ]);
});

test("normalizeHealthFocusAreas requires at least one named area when configured", () => {
  assert.throws(
    () => normalizeHealthFocusAreas([], { requireAtLeastOne: true }),
    /Please enter at least one health focus area\./i,
  );
});

test("normalizeHealthFocusAreas rejects out-of-range severity values", () => {
  assert.throws(
    () => normalizeHealthFocusAreas([{ name: "Back pain", severity: 11 }], { requireAtLeastOne: true }),
    /Health focus severity must be between 1 and 10\./i,
  );
});

test("normalizeHealthFocusAreas caps persisted rows at five entries", () => {
  const areas = normalizeHealthFocusAreas([
    { name: "Area 1", severity: 1 },
    { name: "Area 2", severity: 2 },
    { name: "Area 3", severity: 3 },
    { name: "Area 4", severity: 4 },
    { name: "Area 5", severity: 5 },
    { name: "Area 6", severity: 6 },
  ], { requireAtLeastOne: true });

  assert.equal(areas.length, 5);
  assert.equal(areas[4]?.name, "Area 5");
});
