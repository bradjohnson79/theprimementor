import test from "node:test";
import assert from "node:assert/strict";
import { persistableInterpretationPayload, getStructuredDataFromStoredReport } from "./reportFormat.js";
import { buildReportStructuredData } from "./reportStructuredData.js";
import type { BlueprintData, InterpretationReport } from "./blueprint/types.js";

function buildBlueprint(): BlueprintData {
  return {
    core: {
      birthData: {
        id: "client_1",
        fullBirthName: "Test Client",
        birthDate: "1990-01-15",
        birthTime: "09:30",
        birthLocation: "Vancouver, BC, Canada",
      },
      astronomicalSnapshot: {
        julianDay: 2447906.5,
        birthYear: 1990,
        birthMonth: 1,
        birthDay: 15,
        birthHour: 17,
        birthMinute: 30,
        coordinates: {
          tropical: { latitude: 49.2827, longitude: -123.1207 },
          sidereal: { latitude: 49.2827, longitude: -123.1207, ayanamsa: 23.5 },
        },
      },
    },
    client: {
      id: "client_1",
      fullBirthName: "Test Client",
      birthDate: "1990-01-15",
      birthTime: "09:30",
      birthLocation: "Vancouver, BC, Canada",
    },
    coordinates: {
      latitude: 49.2827,
      longitude: -123.1207,
      formattedAddress: "Vancouver, BC, Canada",
    },
    numerology: {
      birthDay: 15,
      lifePath: 8,
      soulUrge: 7,
      destiny: 3,
      personality: 6,
      pinnacles: [1, 2, 3, 4],
    },
    astrology: {
      system: "vedic_sidereal",
      ayanamsa: "lahiri",
      ayanamsaValue: 23.5,
      julianDay: 2447906.5,
      confidence: "full",
      ascendant: {
        longitude: 12,
        sign: "Aries",
        degree: 12,
        minute: 0,
        nakshatra: "Ashwini",
        nakshatraPada: 4,
      },
      lagnaLord: {
        planet: "Mars",
        placement: { sign: "Sagittarius", house: 9, degree: 3, minute: 15 },
      },
      houses: [],
      firstHousePlanets: ["Ascendant"],
      ascendantAspects: [],
      ascendantStrength: { score: 7, factors: ["Mars supports the ascendant"] },
      planets: [
        { planet: "Sun", longitude: 10, sign: "Aries", degree: 10, minute: 0, house: 1, nakshatra: "Ashwini", nakshatraPada: 3, isRetrograde: false },
        { planet: "Moon", longitude: 130, sign: "Leo", degree: 10, minute: 0, house: 5, nakshatra: "Magha", nakshatraPada: 1, isRetrograde: false },
        { planet: "Mercury", longitude: 70, sign: "Gemini", degree: 10, minute: 0, house: 3, nakshatra: "Ardra", nakshatraPada: 2, isRetrograde: false },
        { planet: "Venus", longitude: 190, sign: "Libra", degree: 10, minute: 0, house: 7, nakshatra: "Swati", nakshatraPada: 2, isRetrograde: false },
        { planet: "Mars", longitude: 250, sign: "Sagittarius", degree: 10, minute: 0, house: 9, nakshatra: "Mula", nakshatraPada: 1, isRetrograde: false },
        { planet: "Jupiter", longitude: 310, sign: "Aquarius", degree: 10, minute: 0, house: 11, nakshatra: "Shatabhisha", nakshatraPada: 2, isRetrograde: false },
        { planet: "Saturn", longitude: 40, sign: "Taurus", degree: 10, minute: 0, house: 2, nakshatra: "Rohini", nakshatraPada: 1, isRetrograde: false },
        { planet: "Uranus", longitude: 100, sign: "Cancer", degree: 10, minute: 0, house: 4, nakshatra: "Pushya", nakshatraPada: 4, isRetrograde: false },
        { planet: "Neptune", longitude: 160, sign: "Virgo", degree: 10, minute: 0, house: 6, nakshatra: "Hasta", nakshatraPada: 2, isRetrograde: false },
        { planet: "Pluto", longitude: 220, sign: "Scorpio", degree: 10, minute: 0, house: 8, nakshatra: "Anuradha", nakshatraPada: 3, isRetrograde: false },
      ],
      nodes: {
        rahu: { planet: "Rahu", longitude: 280, sign: "Capricorn", degree: 10, minute: 0, house: 10, nakshatra: "Shravana", nakshatraPada: 2, isRetrograde: true },
        ketu: { planet: "Ketu", longitude: 100, sign: "Cancer", degree: 10, minute: 0, house: 4, nakshatra: "Pushya", nakshatraPada: 2, isRetrograde: true },
      },
      nakshatras: [],
      aspects: [],
      doshas: [],
      retrogrades: [],
    },
    systems: {
      vedic: "full",
      numerology: "full",
      humanDesign: false,
      chinese: false,
      kabbalah: false,
      rune: true,
    },
    derivedThemes: {
      coreIdentity: [],
      strengths: [],
      challenges: [],
      lifeDirection: [],
      relationshipPatterns: [],
      environmentalFactors: [],
      karmicThemes: [],
    },
    rune: {
      seed: { birthDate: "1990-01-15", lifePath: 8, dominantPlanet: "Saturn", nakshatra: "Ashwini" },
      primaryRune: { name: "Raidho", meaning: "Journey" },
      supportingRunes: [{ name: "Kenaz", meaning: "Light" }],
      interpretation: "A path-opening pattern.",
    },
    chinese: null,
    humanDesign: null,
    kabbalah: null,
    physiognomy: null,
    meta: {
      generatedAt: "2026-04-16T19:00:00.000Z",
      systemsIncluded: ["astrology", "numerology", "rune"],
      reportTier: "intro",
      systems: {
        vedic: "full",
        numerology: "full",
        humanDesign: false,
        chinese: false,
        kabbalah: false,
        rune: true,
      },
      version: "2.0.0",
    },
  };
}

function buildInterpretation(): InterpretationReport {
  return {
    overview: "Overview section.",
    coreIdentity: "Core identity section.",
    strengths: "Strengths section.",
    challenges: "Challenges section.",
    lifeDirection: "Life direction section.",
    relationships: "Relationships section.",
    closingGuidance: "Closing guidance section.",
    practices: "Mudra: Practice section.\n\nMantra: Mantra section.",
    forecast: "May 2026: Forecast section.",
  };
}

test("buildReportStructuredData returns deterministic client and Swiss blocks", () => {
  const structuredData = buildReportStructuredData({
    blueprint: buildBlueprint(),
    reportDate: "2026-04-16T19:00:00.000Z",
    birthPlaceName: "Vancouver, BC, Canada",
    birthTimezone: "America/Vancouver",
  });

  assert.equal(structuredData.clientInfo.clientName, "Test Client");
  assert.equal(structuredData.reportDateLabel, "April 16, 2026");
  assert.equal(structuredData.astronomicalCalculations.planets[0]?.body, "Sun");
  assert.equal(structuredData.astronomicalCalculations.planets.at(-1)?.body, "Ascendant");
  assert.ok(structuredData.astronomicalCalculations.aspects.length > 0);
  assert.ok(
    structuredData.astronomicalCalculations.aspects.some(
      (aspect) => aspect.aspect === "Conjunction" && aspect.planets === "Sun - Ascendant",
    ),
  );
});

test("persistableInterpretationPayload stores ordered sections and structured data", () => {
  const structuredData = buildReportStructuredData({
    blueprint: buildBlueprint(),
    reportDate: "2026-04-16T19:00:00.000Z",
    birthPlaceName: "Vancouver, BC, Canada",
    birthTimezone: "America/Vancouver",
  });

  const payload = persistableInterpretationPayload(
    buildInterpretation(),
    "intro",
    "Test Client",
    structuredData,
  );

  assert.equal(payload.generated_report.sections.forecast, "May 2026: Forecast section.");
  assert.equal(payload.generated_report.ordered_sections?.length, 9);
  assert.equal(payload.generated_report.ordered_sections?.at(-1)?.key, "forecast");
  assert.match(payload.full_markdown, /## Forecast/);
  assert.deepEqual(getStructuredDataFromStoredReport(payload.generated_report), structuredData);
});
