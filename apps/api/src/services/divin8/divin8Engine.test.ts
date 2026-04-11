import test from "node:test";
import assert from "node:assert/strict";
import { systemsConfigFromIncludeSystems } from "@wisdom/utils";
import { assembleBlueprint, type ClientInput } from "../blueprint/index.js";
import { runCoreSystem } from "./engine/core.js";
import { validateStrictAstrologyInput } from "./engine/ephemeris.js";
import { routeDivin8Request } from "./engine/router.js";

const VANCOUVER_COORDINATES = {
  latitude: 49.2827,
  longitude: -123.1207,
  formattedAddress: "Vancouver, BC, Canada",
} as const;

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
  assert.match(result.userMessage, /Swiss Ephemeris/i);
});

test("shared astrology computation stays aligned between chat core and blueprint assembly", async () => {
  const client: ClientInput = {
    id: "guest",
    fullBirthName: "Jane Example",
    birthDate: "1990-04-03",
    birthTime: "06:45",
    birthLocation: "Vancouver, BC, Canada",
  };

  const coreResult = await runCoreSystem({
    threadId: "thread-2",
    userId: "user-2",
    message: "Please do a vedic astrology reading for my career.",
    profile: {
      fullName: client.fullBirthName,
      birthDate: client.birthDate,
      birthTime: client.birthTime,
      birthLocation: client.birthLocation,
      timezone: "America/Vancouver",
    },
    route: ASTROLOGY_ROUTE,
    requestIntent: "Career reading",
    focusAreas: ["career"],
    comparisonRequested: false,
    timingPeriod: null,
    resolvedBirthContext: {
      coordinates: VANCOUVER_COORDINATES,
      timezone: "America/Vancouver",
      utcOffsetMinutes: -480,
    },
  });

  assert.equal(coreResult.status, "success");
  if (coreResult.status !== "success" || coreResult.data.type !== "ASTROLOGY") {
    assert.fail("core system should produce an astrology result");
  }

  const blueprint = await assembleBlueprint(
    client,
    ["astrology"],
    "intro",
    systemsConfigFromIncludeSystems(["astrology"]),
    VANCOUVER_COORDINATES,
    undefined,
    -480,
  );

  assert.equal(coreResult.data.astrology.ascendant?.sign, blueprint.astrology?.ascendant?.sign);
  assert.equal(
    coreResult.data.astrology.planets.find((planet) => planet.planet === "Moon")?.sign,
    blueprint.astrology?.planets.find((planet) => planet.planet === "Moon")?.sign,
  );
});
