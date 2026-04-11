import { createRequire } from "module";
import { existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const swe = require("swisseph");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EPHE_PATH = path.resolve(__dirname, "../../../ephemeris");

swe.swe_set_ephe_path(EPHE_PATH);

// ---------------------------------------------------------------------------
// Ephemeris file verification
// ---------------------------------------------------------------------------

const REQUIRED_EPHE_FILE = "sepl_18.se1";

function verifyEphemerisFiles(): void {
  const filePath = path.join(EPHE_PATH, REQUIRED_EPHE_FILE);
  if (!existsSync(filePath)) {
    throw new Error(
      `Missing ephemeris file: ${filePath}\n` +
      `Swiss Ephemeris requires .se1 data files in ${EPHE_PATH}.\n` +
      `Download from https://www.astro.com/ftp/swisseph/ephe/`,
    );
  }
}

verifyEphemerisFiles();

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SEFLG_SWIEPH = swe.SEFLG_SWIEPH as number;

export const PLANET_IDS = {
  SUN: swe.SE_SUN as number,
  MOON: swe.SE_MOON as number,
  MERCURY: swe.SE_MERCURY as number,
  VENUS: swe.SE_VENUS as number,
  MARS: swe.SE_MARS as number,
  JUPITER: swe.SE_JUPITER as number,
  SATURN: swe.SE_SATURN as number,
  URANUS: swe.SE_URANUS as number,
  NEPTUNE: swe.SE_NEPTUNE as number,
  PLUTO: swe.SE_PLUTO as number,
};

const ZODIAC_SIGNS = [
  "Aries", "Taurus", "Gemini", "Cancer",
  "Leo", "Virgo", "Libra", "Scorpio",
  "Sagittarius", "Capricorn", "Aquarius", "Pisces",
] as const;

// ---------------------------------------------------------------------------
// Internal types (never exposed)
// ---------------------------------------------------------------------------

interface RawCalcResult {
  longitude: number;
  latitude: number;
  distance: number;
  longitudeSpeed: number;
  latitudeSpeed: number;
  distanceSpeed: number;
  rflag: number;
  error?: string;
}

// ---------------------------------------------------------------------------
// Core helpers
// ---------------------------------------------------------------------------

/**
 * Compute the Julian Day for a given Gregorian date.
 * `hourDecimal` is hours as a decimal (e.g. 14.5 = 2:30 PM).
 */
export function getJulianDay(
  year: number,
  month: number,
  day: number,
  hourDecimal: number = 12,
): number {
  return swe.swe_julday(year, month, day, hourDecimal, swe.SE_GREG_CAL) as number;
}

/**
 * Compute a single planet's ecliptic longitude for a given Julian Day.
 * Uses SEFLG_SWIEPH to force file-based ephemeris (no Moshier fallback).
 * Returns only `{ longitude }` — raw swisseph output is never exposed.
 */
export function getPlanetPosition(
  julianDay: number,
  planetConstant: number,
): Promise<{ longitude: number }> {
  return new Promise((resolve, reject) => {
    swe.swe_calc_ut(
      julianDay,
      planetConstant,
      SEFLG_SWIEPH,
      (result: RawCalcResult) => {
        if (result.error) {
          reject(new Error(`Swiss Ephemeris error (planet ${planetConstant}): ${result.error}`));
          return;
        }
        resolve({ longitude: result.longitude });
      },
    );
  });
}

// ---------------------------------------------------------------------------
// Main calculation function
// ---------------------------------------------------------------------------

interface AstrologyInput {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

interface AstrologyOutput {
  julianDay: number;
  planets: {
    sun: { longitude: number };
    moon: { longitude: number };
  };
}

/**
 * Deterministic astrology foundation.
 * Converts date/time → Julian Day → Sun & Moon longitudes.
 */
export async function calculateAstrology(input: AstrologyInput): Promise<AstrologyOutput> {
  const hourDecimal = input.hour + input.minute / 60;
  const julianDay = getJulianDay(input.year, input.month, input.day, hourDecimal);

  const [sun, moon] = await Promise.all([
    getPlanetPosition(julianDay, PLANET_IDS.SUN),
    getPlanetPosition(julianDay, PLANET_IDS.MOON),
  ]);

  return {
    julianDay,
    planets: {
      sun: { longitude: sun.longitude },
      moon: { longitude: moon.longitude },
    },
  };
}

// ---------------------------------------------------------------------------
// Zodiac utilities (used by astrologyService for richer output)
// ---------------------------------------------------------------------------

export function longitudeToSign(longitude: number): {
  sign: string;
  degree: number;
  minute: number;
} {
  const normalized = ((longitude % 360) + 360) % 360;
  const signIndex = Math.floor(normalized / 30);
  const signDegree = normalized - signIndex * 30;
  const degree = Math.floor(signDegree);
  const minute = Math.round((signDegree - degree) * 60);

  return { sign: ZODIAC_SIGNS[signIndex], degree, minute };
}

const PLANET_NAMES: Record<number, string> = {
  0: "Sun", 1: "Moon", 2: "Mercury", 3: "Venus", 4: "Mars",
  5: "Jupiter", 6: "Saturn", 7: "Uranus", 8: "Neptune", 9: "Pluto",
};

export function getPlanetName(id: number): string {
  return PLANET_NAMES[id] ?? `Body_${id}`;
}

// ---------------------------------------------------------------------------
// Test block — runs only when EPHEMERIS_TEST=1
// ---------------------------------------------------------------------------

if (process.env.EPHEMERIS_TEST === "1") {
  (async () => {
    const ephePath = path.join(EPHE_PATH, REQUIRED_EPHE_FILE);
    console.log(`Ephemeris file found: ${ephePath}`);
    console.log(`Ephemeris path: ${EPHE_PATH}`);
    console.log(`Using SEFLG_SWIEPH (flag=${SEFLG_SWIEPH}) — file-based mode enforced\n`);

    const result = await calculateAstrology({
      year: 1990,
      month: 5,
      day: 12,
      hour: 14,
      minute: 30,
    });

    console.log("EPHEMERIS TEST RESULT:");
    console.log(JSON.stringify(result, null, 2));

    const sunValid = result.planets.sun.longitude >= 0 && result.planets.sun.longitude < 360;
    const moonValid = result.planets.moon.longitude >= 0 && result.planets.moon.longitude < 360;
    console.log(`\nValidation: Sun longitude in range [0,360): ${sunValid}`);
    console.log(`Validation: Moon longitude in range [0,360): ${moonValid}`);

    const result2 = await calculateAstrology({
      year: 1990,
      month: 5,
      day: 12,
      hour: 14,
      minute: 30,
    });
    const deterministic = JSON.stringify(result) === JSON.stringify(result2);
    console.log(`Validation: Deterministic output: ${deterministic}`);
  })();
}
