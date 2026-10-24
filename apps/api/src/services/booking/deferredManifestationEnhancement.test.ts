import assert from "node:assert/strict";
import test from "node:test";
import { deferredManifestationEnhancementSelected } from "./bookingService.js";

test("guest placeholder add-on flag is only honoured for regeneration intakes", () => {
  const selected = { version: 1, selected: true, priceCents: 2900, currency: "CAD" };
  assert.equal(deferredManifestationEnhancementSelected({ type: "regeneration", manifestationEnhancement: selected }), true);
  assert.equal(
    deferredManifestationEnhancementSelected({ type: "regeneration", manifestationEnhancement: { ...selected, selected: false } }),
    false,
  );
  assert.equal(deferredManifestationEnhancementSelected({ type: "regeneration" }), false);
  assert.equal(deferredManifestationEnhancementSelected({ type: "qa", manifestationEnhancement: selected }), false);
  assert.equal(deferredManifestationEnhancementSelected({ type: "mentoring", manifestationEnhancement: selected }), false);
  assert.equal(deferredManifestationEnhancementSelected({ type: "regeneration", manifestationEnhancement: { selected: "true" } }), false);
  assert.equal(deferredManifestationEnhancementSelected(null), false);
  assert.equal(deferredManifestationEnhancementSelected("regeneration"), false);
});
