import test from "node:test";
import assert from "node:assert/strict";
import { initSwissEphemeris } from "../blueprint/swissEphemerisService.js";
import { runCoreSystem } from "./engine/core.js";
import { VANCOUVER_JANE_EXAMPLE_FIXTURE } from "./__fixtures__/coreChartSnapshots.js";
import { validateStrictAstrologyInput } from "./engine/ephemeris.js";
import { routeDivin8Request } from "./engine/router.js";

await initSwissEphemeris();

const ASTROLOGY_ROUTE = routeDivin8Request({
  message: "Please do a vedic astrology reading for my career.",
  detectedSystems: [{ key: "vedic_astrology", matchedKeywords: ["vedic astrology"], score: 18 }],
  requestedSystems: ["astrology"],
});

test("router classifies obvious astrology prompts with strict engine confidence", () => {
  const route = routeDivin8Request({
    message: "Please do a vedic astrology reading for me.",
    detectedSystems: [{ key: "vedic_astrology", matchedKeywords: ["vedic astrology"], score: 18 }],
    requestedSystems: ["astrology"],
  });

  assert.equal(route.type, "ASTROLOGY");
  assert.equal(route.requiresEngine, true);
  assert.equal(route.strict, true);
  assert.ok(route.confidence >= 0.9);
});

test("router classifies general prompts without engine", () => {
  const route = routeDivin8Request({
    message: "How can I stay grounded this week?",
    detectedSystems: [],
    requestedSystems: [],
  });

  assert.equal(route.type, "GENERAL");
  assert.equal(route.requiresEngine, false);
  assert.equal(route.strict, false);
  assert.ok(route.confidence >= 0.75);
});

test("birth-data validation blocks ephemeris when strict astrology inputs are incomplete", () => {
  const validation = validateStrictAstrologyInput({
    birthDate: "1990-04-03",
    birthTime: null,
    coordinates: null,
    utcOffsetMinutes: null,
  });

  assert.equal(validation.valid, false);
  if (validation.valid) {
    assert.fail("validation should fail");
  }

  assert.equal(validation.error.errorCode, "MISSING_BIRTH_DATA");
  assert.ok(validation.error.missingFields.includes("birth time"));
  assert.ok(validation.error.missingFields.includes("birth location"));
  assert.ok(validation.error.missingFields.includes("timezone"));
});

test("strict runtime enforcement returns an error instead of astrology output when data is missing", async () => {
  const result = await runCoreSystem({
    threadId: "thread-1",
    userId: "user-1",
    message: "Do my chart",
    system: "vedic",
    profile: {
      fullName: "Jane Example",
      birthDate: "1990-04-03",
      birthTime: null,
      birthLocation: "Vancouver, BC, Canada",
      timezone: null,
    },
    route: ASTROLOGY_ROUTE,
    requestIntent: "Chart reading",
    focusAreas: ["career"],
    comparisonRequested: false,
    timingPeriod: null,
    resolvedBirthContext: null,
  });

  assert.equal(result.status, "error");
  assert.equal(result.errorCode, "MISSING_BIRTH_DATA");
  assert.match(result.userMessage, /calculation-backed/i);
});

test("shared astrology computation stays aligned between chat core and blueprint assembly", async () => {
  const client = VANCOUVER_JANE_EXAMPLE_FIXTURE.client;

  const coreResult = await runCoreSystem({
    threadId: "thread-2",
    userId: "user-2",
    message: "Please do a vedic astrology reading for my career.",
    system: "vedic",
    profile: {
      fullName: client.fullBirthName,
      birthDate: client.birthDate,
      birthTime: client.birthTime,
      birthLocation: client.birthLocation,
      timezone: VANCOUVER_JANE_EXAMPLE_FIXTURE.timezone.name,
    },
    route: ASTROLOGY_ROUTE,
    requestIntent: "Career reading",
    focusAreas: ["career"],
    comparisonRequested: false,
    timingPeriod: null,
    resolvedBirthContext: {
      coordinates: VANCOUVER_JANE_EXAMPLE_FIXTURE.coordinates,
      timezone: VANCOUVER_JANE_EXAMPLE_FIXTURE.timezone.name,
      utcOffsetMinutes: VANCOUVER_JANE_EXAMPLE_FIXTURE.timezone.utcOffsetMinutes,
    },
  });

  assert.equal(coreResult.status, "success");
  if (coreResult.status !== "success" || coreResult.data.type !== "ENGINE") {
    assert.fail("core system should produce an astrology result");
  }
  assert.equal(coreResult.data.system, "vedic");
  assert.ok(coreResult.data.interpretation.summary);
  assert.ok(coreResult.data.interpretation.systemsUsed.includes("vedic"));
  assert.equal(coreResult.data.resolvedBirthContext?.timezone, VANCOUVER_JANE_EXAMPLE_FIXTURE.timezone.name);
});

test("numerology runs without astrology-only birth requirements", async () => {
  const result = await runCoreSystem({
    threadId: "thread-3",
    userId: "user-3",
    message: "Run numerology for me.",
    system: "numerology",
    profile: {
      fullName: "Jane Example",
      birthDate: "1990-04-03",
      birthTime: null,
      birthLocation: null,
      timezone: null,
    },
    route: routeDivin8Request({
      message: "Run numerology for me.",
      detectedSystems: [{ key: "numerology", matchedKeywords: ["numerology"], score: 12 }],
      requestedSystems: ["numerology"],
    }),
    requestIntent: "Numerology reading",
    focusAreas: ["general"],
    comparisonRequested: false,
    timingPeriod: null,
    resolvedBirthContext: null,
  });

  assert.equal(result.status, "success");
  if (result.status !== "success" || result.data.type !== "ENGINE") {
    assert.fail("numerology should produce an engine result");
  }
  assert.equal(result.data.system, "numerology");
  assert.ok(result.data.interpretation.systemsUsed.includes("numerology"));
});
