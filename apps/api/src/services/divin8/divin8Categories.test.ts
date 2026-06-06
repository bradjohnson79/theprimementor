import assert from "node:assert/strict";
import test from "node:test";
import {
  filterDivin8CategorySuggestions,
  insertDivin8CategoryTags,
  parseDivin8CategoryTags,
} from "@wisdom/utils";

test("parseDivin8CategoryTags detects canonical category hashtags", () => {
  const parsed = parseDivin8CategoryTags("Use #VedicAstrology #Numerology #Tarot for this reading.");

  assert.deepEqual(parsed.tags, ["#VedicAstrology", "#Numerology", "#Tarot"]);
  assert.deepEqual(parsed.labels, ["Vedic Astrology", "Numerology", "Tarot"]);
  assert.deepEqual(parsed.requiresImageCategories, []);
});

test("parseDivin8CategoryTags maps common aliases to canonical categories", () => {
  const parsed = parseDivin8CategoryTags("Compare #Kabbalah #HumanDesign #Western #BodyMap #AuraReading #Tasseography.");

  assert.deepEqual(parsed.tags, [
    "#Kaballah",
    "#HumanSystems",
    "#WesternAstrology",
    "#BodyMapNumerology",
    "#EnergyBodyReading",
    "#TeaLeafReading",
  ]);
  assert.deepEqual(parsed.labels, [
    "Kaballah",
    "Human Systems",
    "Western Astrology",
    "Body Map Numerology",
    "Energy Body Reading",
    "Tea Leaf Reading",
  ]);
  assert.deepEqual(parsed.requiresImageCategories.map((category) => category.tag), [
    "#EnergyBodyReading",
    "#TeaLeafReading",
  ]);
});

test("parseDivin8CategoryTags ignores timeline-style non-category hashtags", () => {
  const parsed = parseDivin8CategoryTags("Look at #April1-30-2026 and #Q2Timing.");

  assert.deepEqual(parsed.tags, []);
  assert.deepEqual(parsed.labels, []);
});

test("insertDivin8CategoryTags appends canonical tags without duplicates", () => {
  assert.equal(
    insertDivin8CategoryTags("Give me a reading for @BradJohnson #Kabbalah", [
      "#Kaballah",
      "#Numerology",
      "#BodyMap",
    ]),
    "Give me a reading for @BradJohnson #Kabbalah #Numerology #BodyMapNumerology",
  );
  assert.equal(insertDivin8CategoryTags("", ["#Vedic", "#Numerology"]), "#VedicAstrology #Numerology ");
});

test("filterDivin8CategorySuggestions handles casing, spacing, and aliases", () => {
  assert.deepEqual(filterDivin8CategorySuggestions("#ve").map((category) => category.label), ["Vedic Astrology"]);
  assert.deepEqual(filterDivin8CategorySuggestions("#num").map((category) => category.label), [
    "Numerology",
    "Body Map Numerology",
  ]);
  assert.deepEqual(filterDivin8CategorySuggestions("#face").map((category) => category.label), ["Face Reading"]);
  assert.deepEqual(filterDivin8CategorySuggestions("#BodyMap").map((category) => category.label), [
    "Body Map Numerology",
  ]);
  assert.deepEqual(filterDivin8CategorySuggestions("#body map").map((category) => category.label), [
    "Body Map Numerology",
  ]);
  assert.deepEqual(filterDivin8CategorySuggestions("#tea leaf").map((category) => category.label), [
    "Tea Leaf Reading",
  ]);
  assert.deepEqual(filterDivin8CategorySuggestions("#tasse").map((category) => category.label), [
    "Tea Leaf Reading",
  ]);
});
