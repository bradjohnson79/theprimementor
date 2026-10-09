import assert from "node:assert/strict";
import test from "node:test";
import {
  assertConsultationAvailable,
  isManifestationConsultationSlot,
  MANIFESTATION_CONSULTATION_SLOTS,
  periodBenefitKey,
} from "./regenerationPeriodBenefitService.js";

test("a monthly period gets exactly two consultation slots", () => {
  assert.deepEqual([...MANIFESTATION_CONSULTATION_SLOTS], ["alignment", "reinforcement"]);
  assert.equal(isManifestationConsultationSlot("alignment"), true);
  assert.equal(isManifestationConsultationSlot("reinforcement"), true);
  assert.equal(isManifestationConsultationSlot("extra"), false);
});

test("the same subscription period keeps one benefit key across retries", () => {
  const start = new Date("2026-10-01T07:00:00.000Z");
  assert.equal(periodBenefitKey("sub-1", start), periodBenefitKey("sub-1", new Date(start.toISOString())));
  assert.notEqual(periodBenefitKey("sub-1", start), periodBenefitKey("sub-1", new Date("2026-11-01T07:00:00.000Z")));
});

test("a consultation cannot be claimed again after it is scheduled", () => {
  assert.doesNotThrow(() => assertConsultationAvailable("available"));
  assert.throws(() => assertConsultationAvailable("scheduled"), /already been scheduled/);
  assert.throws(() => assertConsultationAvailable("completed"), /already been scheduled/);
});
