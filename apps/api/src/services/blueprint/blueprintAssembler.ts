import type {
  BlueprintData,
  BlueprintCore,
  AstronomicalSnapshot,
  ClientInput,
  DerivedThemes,
  SystemName,
  LocationCoordinates,
} from "./types.js";
import type { ReportTierId, ReportTierSystemsConfig } from "@wisdom/utils";
import { calculateAdvancedNumerology } from "./advancedNumerologyService.js";
import { calculateNumerology } from "./numerologyService.js";
import { calculateVedicAstrology } from "./vedicAstrologyService.js";
import { calculateChineseAstrology } from "./chineseAstrologyService.js";
import { calculateHumanDesign } from "./humanDesignService.js";
import { calculateKabbalahAstrology } from "./kabbalahAstrologyService.js";
import { calculateRuneSystem } from "./runeSystemService.js";
import { parseBirthDate, parseBirthTime } from "./schemas.js";
import { localToUtc } from "../divin8/engine/astrologyUtils.js";
import {
  generateIChingReading,
  generateBodyMap,
  generatePhysiognomyReading,
} from "./gptSystemsService.js";

const BLUEPRINT_VERSION = "2.0.0";

function emptyDerivedThemes(): DerivedThemes {
  return {
    coreIdentity: [],
    strengths: [],
    challenges: [],
    lifeDirection: [],
    relationshipPatterns: [],
    environmentalFactors: [],
    karmicThemes: [],
  };
}

export async function assembleBlueprint(
  client: ClientInput,
  systems: SystemName[],
  reportTier: ReportTierId,
  tierSystems: ReportTierSystemsConfig,
  coordinates?: LocationCoordinates,
  /** Local upload: id + data URL for OpenAI vision only (never persisted as base64 in JSON) */
  physiognomyImage?: { assetId: string; dataUrl: string },
  utcOffsetMinutes?: number,
): Promise<BlueprintData> {
  const parsed = parseBirthDate(client.birthDate);
  if (!parsed) {
    throw new Error(`Invalid birth date format: ${client.birthDate}. Expected YYYY-MM-DD`);
  }

  const time = parseBirthTime(client.birthTime);
  const hasBirthTime = time !== null;

  // ── Local birth date/time (for numerology, Chinese, etc.) ────────────────
  const { year: localYear, month: localMonth, day: localDay } = parsed;
  const localHour = time?.hour ?? 12;
  const localMinute = time?.minute ?? 0;

  // ── UTC time for Swiss Ephemeris ──────────────────────────────────────────
  // Swiss Ephemeris swe_julday requires Universal Time, not local time.
  // Apply UTC offset conversion only when birth time is known.
  let utcYear = localYear;
  let utcMonth = localMonth;
  let utcDay = localDay;
  let utcHour = localHour;
  let utcMinute = localMinute;

  if (hasBirthTime && utcOffsetMinutes !== undefined) {
    const utc = localToUtc(localYear, localMonth, localDay, localHour, localMinute, utcOffsetMinutes);
    utcYear = utc.year;
    utcMonth = utc.month;
    utcDay = utc.day;
    utcHour = utc.hour;
    utcMinute = utc.minute;
  }

  const latitude = coordinates?.latitude ?? 0;
  const longitude = coordinates?.longitude ?? 0;

  // ── Phase 1: Parallel — Numerology + Vedic + Chinese (no interdependencies) ─
  const [numerologyResult, astrologyResult, chineseResult] = await Promise.all([
    systems.includes("numerology")
      ? Promise.resolve(calculateAdvancedNumerology(client.fullBirthName, localYear, localMonth, localDay))
      : Promise.resolve(null),

    systems.includes("astrology")
      ? calculateVedicAstrology(utcYear, utcMonth, utcDay, utcHour, utcMinute, latitude, longitude, hasBirthTime)
      : Promise.resolve(null),

    systems.includes("chinese")
      ? Promise.resolve(calculateChineseAstrology(localYear, localMonth, localDay, localHour))
      : Promise.resolve(null),
  ]);

  const numerology = numerologyResult;
  const astrology = astrologyResult;
  const baseNumerology = numerology ?? calculateNumerology(client.fullBirthName, localYear, localMonth, localDay);

  // ── Core layer ────────────────────────────────────────────────────────────
  const astronomicalSnapshot: AstronomicalSnapshot = {
    julianDay: astrology?.julianDay ?? 0,
    birthYear: localYear,
    birthMonth: localMonth,
    birthDay: localDay,
    birthHour: utcHour,
    birthMinute: utcMinute,
    coordinates: {
      tropical: latitude !== 0 || longitude !== 0 ? { latitude, longitude } : null,
      sidereal: astrology ? { latitude, longitude, ayanamsa: astrology.ayanamsaValue } : null,
    },
  };

  const clientData = {
    id: client.id === "guest" ? null : client.id,
    fullBirthName: client.fullBirthName,
    birthDate: client.birthDate,
    birthTime: client.birthTime,
    birthLocation: client.birthLocation,
  };

  const core: BlueprintCore = { birthData: clientData, astronomicalSnapshot };

  // Build chinese blueprint data — always `null` when BaZi is not in scope (never `undefined`; see assertNoUndefinedDeep)
  let chineseData: NonNullable<BlueprintData["chinese"]> | null = null;
  if (chineseResult) {
    chineseData = {
      zodiacAnimal: chineseResult.zodiacAnimal,
      element: chineseResult.element,
      yinYang: chineseResult.yinYang,
      pillars: chineseResult.pillars as any,
      compatibility: chineseResult.compatibility,
      challenges: chineseResult.challenges,
    };
  }

  const blueprint: BlueprintData = {
    core,
    client: clientData,
    coordinates: coordinates || null,
    numerology,
    astrology,
    chinese: chineseData ?? null,
    systems: tierSystems,
    derivedThemes: emptyDerivedThemes(),
    meta: {
      generatedAt: new Date().toISOString(),
      systemsIncluded: systems,
      reportTier,
      systems: tierSystems,
      version: BLUEPRINT_VERSION,
      ...(physiognomyImage ? { physiognomyImageAssetId: physiognomyImage.assetId } : {}),
    },
  };

  // ── Phase 2: Parallel — Human Design + Kabbalah + all GPT systems ─────────
  // These all depend on Phase 1 (astrology/numerology) but not on each other.
  const sharedJD = astrology?.julianDay;
  const vedicPlanets = astrology?.planets as any ?? [];
  const sunNakshatra = astrology?.planets.find(p => p.planet === "Sun")?.nakshatra ?? "Ashwini";
  const dominantPlanet = (numerology as any)?.planetaryCorrelation?.dominantPlanet ?? "Sun";

  const [hdResult, kabResult, runeResult, ichingResult, bodymapResult, physiognomyResult] = await Promise.all([
    systems.includes("humanDesign")
      ? calculateHumanDesign(utcYear, utcMonth, utcDay, utcHour, utcMinute, sharedJD)
      : Promise.resolve(null),

    systems.includes("kabbalah")
      ? Promise.resolve(calculateKabbalahAstrology(vedicPlanets, baseNumerology.lifePath))
      : Promise.resolve(null),

    systems.includes("rune")
      ? calculateRuneSystem(client.birthDate, baseNumerology.lifePath, dominantPlanet, sunNakshatra)
      : Promise.resolve(null),

    systems.includes("iching")
      ? generateIChingReading(blueprint)
      : Promise.resolve(null),

    systems.includes("bodymap")
      ? generateBodyMap(blueprint)
      : Promise.resolve(null),

    systems.includes("physiognomy")
      ? generatePhysiognomyReading(blueprint, physiognomyImage?.dataUrl)
      : Promise.resolve(null),
  ]);

  // Assign Phase 2 results
  if (hdResult) blueprint.humanDesign = hdResult;

  if (kabResult) {
    blueprint.kabbalah = {
      sephirotMapping: kabResult.sephirotMapping.map(m => ({
        sephira: { name: m.sephira.name, meaning: m.sephira.meaning, quality: m.sephira.quality },
        planet: m.planet,
        sign: m.sign,
        influence: m.influence,
      })),
      planetaryTreeOverlay: kabResult.planetaryTreeOverlay,
      pathInfluences: kabResult.pathInfluences,
      soulCorrectionThemes: kabResult.soulCorrectionThemes,
      dominantSephira: {
        name: kabResult.dominantSephira.name,
        meaning: kabResult.dominantSephira.meaning,
        quality: kabResult.dominantSephira.quality,
      },
    };
  }

  if (runeResult) blueprint.rune = runeResult;
  if (ichingResult) blueprint.iching = ichingResult;
  if (bodymapResult) blueprint.bodymap = bodymapResult;

  if (systems.includes("physiognomy") && physiognomyResult) {
    blueprint.physiognomy = physiognomyResult;
  } else {
    blueprint.physiognomy = null;
  }

  if (!systems.includes("humanDesign")) {
    blueprint.humanDesign = null;
  }
  if (!systems.includes("kabbalah")) {
    blueprint.kabbalah = null;
  }

  return blueprint;
}
