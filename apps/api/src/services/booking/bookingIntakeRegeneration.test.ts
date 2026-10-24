import assert from "node:assert/strict";
import test from "node:test";
import { buildNormalizedIntake, parseStoredIntake } from "./bookingService.js";

const regenIntake = {
  type: "regeneration",
  gender: "female",
  manifestationIntention: "A new home by the sea",
  manifestationFeeling: "Calm and grateful",
  manifestationAssumptions: "It is already done",
  healthFocusAreas: [{ name: "A new home by the sea", severity: 10 }],
  manifestationEnhancement: { version: 1, selected: false, priceCents: 2900, currency: "CAD" },
};

test("parseStoredIntake keeps the Manifestation Monthly text fields", () => {
  const parsed = parseStoredIntake(regenIntake);
  assert.equal(parsed?.manifestationIntention, "A new home by the sea");
  assert.equal(parsed?.manifestationFeeling, "Calm and grateful");
  assert.equal(parsed?.manifestationAssumptions, "It is already done");
});

test("client Manifestation Monthly booking intake passes validation when the form is filled in", () => {
  const normalized = buildNormalizedIntake("regeneration", regenIntake, undefined, false, "regeneration-session");
  assert.equal(normalized.intake.manifestationFeeling, "Calm and grateful");
  assert.equal(normalized.intake.manifestationAssumptions, "It is already done");
  assert.equal(normalized.intake.manifestationIntention, "A new home by the sea");
});

test("client Manifestation Monthly booking still requires feeling + assumptions", () => {
  assert.throws(
    () => buildNormalizedIntake("regeneration", { type: "regeneration", manifestationIntention: "x" }, undefined, false, "regeneration-session"),
    /Share how the manifestation would feel/,
  );
});

test("other session types do not pick up manifestation fields", () => {
  const parsed = parseStoredIntake({ type: "qa_session", topics: "hi", manifestationFeeling: "nope" });
  assert.equal(parsed?.manifestationFeeling, undefined);
});
