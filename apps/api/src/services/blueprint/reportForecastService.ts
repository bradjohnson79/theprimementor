import type { ReportTierId } from "@wisdom/utils";
import type { BlueprintData } from "./types.js";
import {
  PLANET_IDS,
  getAyanamsaUt,
  getJulianDay,
  getPlanetPositionWithSpeed,
} from "./swissEphemerisService.js";

const PLATFORM_TIMEZONE = "America/Vancouver";
const FORECAST_MONTH_COUNT_BY_TIER: Record<ReportTierId, number> = {
  intro: 1,
  deep_dive: 2,
  initiate: 3,
};

const TRANSIT_PLANETS = [
  { name: "Sun", id: PLANET_IDS.SUN },
  { name: "Mars", id: PLANET_IDS.MARS },
  { name: "Jupiter", id: PLANET_IDS.JUPITER },
  { name: "Saturn", id: PLANET_IDS.SATURN },
  { name: "Uranus", id: PLANET_IDS.URANUS },
  { name: "Neptune", id: PLANET_IDS.NEPTUNE },
  { name: "Pluto", id: PLANET_IDS.PLUTO },
] as const;

const NATAL_BODIES = [
  "Sun",
  "Moon",
  "Mercury",
  "Venus",
  "Mars",
  "Jupiter",
  "Saturn",
  "Ascendant",
] as const;

const ASPECT_DEFINITIONS = [
  { label: "Conjunction", angle: 0, maxOrb: 6 },
  { label: "Sextile", angle: 60, maxOrb: 3 },
  { label: "Square", angle: 90, maxOrb: 4 },
  { label: "Trine", angle: 120, maxOrb: 4 },
  { label: "Opposition", angle: 180, maxOrb: 6 },
] as const;

interface ForecastTransitAspect {
  transitBody: string;
  natalBody: string;
  aspect: string;
  orbDegrees: number;
  orbLabel: string;
}

interface NatalBody {
  name: string;
  longitude: number;
  sign: string;
}

export interface ForecastMonthContext {
  monthLabel: string;
  monthIso: string;
  transitSummary: string[];
  activatingAspects: ForecastTransitAspect[];
}

export interface ForecastContext {
  reportDateIso: string;
  monthCount: number;
  months: ForecastMonthContext[];
}

function getPlatformDateParts(value: Date) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: PLATFORM_TIMEZONE,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  });
  const parts = formatter.formatToParts(value);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);
  return { year, month, day };
}

function getMonthWindowDate(anchorDate: Date, monthOffset: number) {
  const platform = getPlatformDateParts(anchorDate);
  const targetMonthIndex = platform.month - 1 + monthOffset;
  const year = platform.year + Math.floor(targetMonthIndex / 12);
  const month = (targetMonthIndex % 12 + 12) % 12;
  return new Date(Date.UTC(year, month, 1, 20, 0, 0));
}

function normalizeAngle(value: number) {
  return ((value % 360) + 360) % 360;
}

function toSiderealLongitude(tropicalLongitude: number, ayanamsa: number) {
  return normalizeAngle(tropicalLongitude - ayanamsa);
}

function signFromLongitude(longitude: number) {
  const signs = [
    "Aries",
    "Taurus",
    "Gemini",
    "Cancer",
    "Leo",
    "Virgo",
    "Libra",
    "Scorpio",
    "Sagittarius",
    "Capricorn",
    "Aquarius",
    "Pisces",
  ];
  return signs[Math.floor(normalizeAngle(longitude) / 30)] ?? "Unknown";
}

function formatOrb(value: number) {
  const whole = Math.floor(value);
  const minutes = Math.round((value - whole) * 60);
  const safeMinutes = minutes === 60 ? 59 : minutes;
  return `${whole}deg ${String(safeMinutes).padStart(2, "0")}'`;
}

function angularDistance(left: number, right: number) {
  const raw = Math.abs(left - right) % 360;
  return raw > 180 ? 360 - raw : raw;
}

function selectAspect(distance: number) {
  return ASPECT_DEFINITIONS
    .map((definition) => ({
      definition,
      orbDegrees: Math.abs(distance - definition.angle),
    }))
    .filter((candidate) => candidate.orbDegrees <= candidate.definition.maxOrb)
    .sort((first, second) => first.orbDegrees - second.orbDegrees)[0] ?? null;
}

function buildNatalBodies(blueprint: BlueprintData) {
  const astrology = blueprint.astrology;
  if (!astrology) {
    return [];
  }

  const bodies = NATAL_BODIES.map((name): NatalBody | null => {
    if (name === "Ascendant") {
      return astrology.ascendant
        ? { name, longitude: astrology.ascendant.longitude, sign: astrology.ascendant.sign }
        : null;
    }
    const planet = astrology.planets.find((entry) => entry.planet === name);
    return planet ? { name, longitude: planet.longitude, sign: planet.sign } : null;
  }).filter((entry): entry is NatalBody => entry !== null);

  return bodies;
}

async function buildMonthContext(
  blueprint: BlueprintData,
  monthDate: Date,
): Promise<ForecastMonthContext> {
  const natalBodies = buildNatalBodies(blueprint);
  const year = monthDate.getUTCFullYear();
  const month = monthDate.getUTCMonth() + 1;
  const day = monthDate.getUTCDate();
  const julianDay = getJulianDay(year, month, day, 20);
  const ayanamsa = getAyanamsaUt(julianDay);

  const transitPositions = await Promise.all(
    TRANSIT_PLANETS.map(async (planet) => {
      const raw = await getPlanetPositionWithSpeed(julianDay, planet.id);
      const longitude = toSiderealLongitude(raw.longitude, ayanamsa);
      return {
        name: planet.name,
        longitude,
        sign: signFromLongitude(longitude),
      };
    }),
  );

  const activatingAspects: ForecastTransitAspect[] = [];
  for (const transit of transitPositions) {
    for (const natal of natalBodies) {
      const distance = angularDistance(transit.longitude, natal.longitude);
      const match = selectAspect(distance);
      if (!match) continue;
      activatingAspects.push({
        transitBody: transit.name,
        natalBody: natal.name,
        aspect: match.definition.label,
        orbDegrees: Number(match.orbDegrees.toFixed(4)),
        orbLabel: formatOrb(match.orbDegrees),
      });
    }
  }

  const rankedAspects = activatingAspects
    .sort((first, second) => first.orbDegrees - second.orbDegrees)
    .slice(0, 6);

  const transitSummary = transitPositions.map((planet) => `${planet.name} in ${planet.sign}`);
  return {
    monthLabel: new Intl.DateTimeFormat("en-US", {
      timeZone: PLATFORM_TIMEZONE,
      month: "long",
      year: "numeric",
    }).format(monthDate),
    monthIso: monthDate.toISOString(),
    transitSummary,
    activatingAspects: rankedAspects,
  };
}

export async function buildForecastContext(
  blueprint: BlueprintData,
  tier: ReportTierId,
  anchorDate = new Date(),
): Promise<ForecastContext> {
  const monthCount = FORECAST_MONTH_COUNT_BY_TIER[tier];
  const monthDates = Array.from({ length: monthCount }, (_, index) => getMonthWindowDate(anchorDate, index + 1));
  const months = await Promise.all(monthDates.map((monthDate) => buildMonthContext(blueprint, monthDate)));
  return {
    reportDateIso: anchorDate.toISOString(),
    monthCount,
    months,
  };
}
