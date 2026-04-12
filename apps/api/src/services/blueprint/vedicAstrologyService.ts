/**
 * Vedic Sidereal Astrology Engine — v3 (Lagna Complete)
 * Swiss Ephemeris + Lahiri ayanamsa
 * Supports: Ascendant, Whole Sign Houses, Lagna Lord,
 *           Ascendant Aspects, First House Planets, Ascendant Strength
 */

import {
  assertSwissEphemerisReady,
  getJulianDay,
  getPlanetPosition,
  PLANET_IDS,
  getPlanetName,
} from "./swissEphemerisService.js";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const swe = require("swisseph");

const SE_SIDM_LAHIRI = 1;

// ─── Constants ────────────────────────────────────────────────────────────────

const VEDIC_SIGNS = [
  "Aries", "Taurus", "Gemini", "Cancer",
  "Leo", "Virgo", "Libra", "Scorpio",
  "Sagittarius", "Capricorn", "Aquarius", "Pisces",
] as const;

type VedicSign = typeof VEDIC_SIGNS[number];

const NAKSHATRAS = [
  "Ashwini", "Bharani", "Krittika", "Rohini", "Mrigashira", "Ardra",
  "Punarvasu", "Pushya", "Ashlesha", "Magha", "Purva Phalguni",
  "Uttara Phalguni", "Hasta", "Chitra", "Swati", "Vishakha",
  "Anuradha", "Jyeshtha", "Mula", "Purva Ashadha", "Uttara Ashadha",
  "Shravana", "Dhanishta", "Shatabhisha", "Purva Bhadrapada",
  "Uttara Bhadrapada", "Revati",
] as const;

// Sign → ruling planet
const SIGN_LORDS: Record<VedicSign, string> = {
  "Aries": "Mars",     "Taurus": "Venus",   "Gemini": "Mercury",
  "Cancer": "Moon",    "Leo": "Sun",         "Virgo": "Mercury",
  "Libra": "Venus",    "Scorpio": "Mars",    "Sagittarius": "Jupiter",
  "Capricorn": "Saturn","Aquarius": "Saturn","Pisces": "Jupiter",
};

// Sign index → ruling planet (for house lord lookup by index)
const HOUSE_LORDS = [
  "Mars","Venus","Mercury","Moon","Sun","Mercury",
  "Venus","Mars","Jupiter","Saturn","Saturn","Jupiter",
] as const;

// Exaltation signs for strength calculation
const EXALTATION_SIGNS: Record<string, VedicSign> = {
  "Sun": "Aries", "Moon": "Taurus", "Mars": "Capricorn",
  "Mercury": "Virgo", "Jupiter": "Cancer", "Venus": "Pisces",
  "Saturn": "Libra",
};

const ANGULAR_HOUSES = new Set([1, 4, 7, 10]);
const BENEFICS = new Set(["Venus", "Jupiter", "Mercury", "Moon"]);
const MALEFICS = new Set(["Mars", "Saturn", "Sun", "Rahu", "Ketu"]);

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface VedicPlanetPosition {
  planet: string;
  longitude: number;
  sign: string;
  degree: number;
  minute: number;
  house: number;
  nakshatra: string;
  nakshatraPada: number;
  isRetrograde: boolean;
}

export interface VedicHouse {
  number: number;
  sign: string;
  lord: string;
  cusp: number;
}

export interface VedicAspect {
  from: string;
  to: string;
  type: string;
  strength: number;
}

export interface Dosha {
  name: string;
  present: boolean;
  severity?: "low" | "medium" | "high";
  description?: string;
}

export interface LagnaLord {
  planet: string;
  placement: {
    sign: string;
    house: number;
    degree: number;
    minute: number;
  };
}

export interface AscendantAspect {
  planet: string;
  fromHouse: number;
  aspectType: string;
}

export interface AscendantStrength {
  score: number;          // 0–10
  factors: string[];
}

export interface VedicAscendant {
  longitude: number;
  sign: string;
  degree: number;
  minute: number;
  nakshatra: string;
  nakshatraPada: number;
}

export interface VedicAstrologyResult {
  system: "vedic_sidereal";
  ayanamsa: "lahiri";
  ayanamsaValue: number;
  julianDay: number;
  confidence: "full" | "reduced";

  ascendant: VedicAscendant | null;
  lagnaLord: LagnaLord | null;
  houses: VedicHouse[] | null;
  firstHousePlanets: string[];
  ascendantAspects: AscendantAspect[];
  ascendantStrength: AscendantStrength | null;

  planets: VedicPlanetPosition[];
  nodes: { rahu: VedicPlanetPosition; ketu: VedicPlanetPosition };
  nakshatras: Array<{ planet: string; nakshatra: string; pada: number; lord: string }>;
  aspects: VedicAspect[];
  doshas: Dosha[];
  retrogrades: string[];
}

// ─── Pure helpers ─────────────────────────────────────────────────────────────

function getAyanamsa(julianDay: number): number {
  assertSwissEphemerisReady();
  swe.swe_set_sid_mode(SE_SIDM_LAHIRI, 0, 0);
  return swe.swe_get_ayanamsa_ut(julianDay) as number;
}

function normalizeAngle(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

function tropicalToSidereal(tropical: number, ayanamsa: number): number {
  return normalizeAngle(tropical - ayanamsa);
}

function longitudeToSignInfo(longitude: number): {
  sign: VedicSign; degree: number; minute: number; signIndex: number;
} {
  const norm = normalizeAngle(longitude);
  const signIndex = Math.floor(norm / 30);
  const signDegree = norm - signIndex * 30;
  return {
    sign: VEDIC_SIGNS[signIndex],
    degree: Math.floor(signDegree),
    minute: Math.round((signDegree - Math.floor(signDegree)) * 60),
    signIndex,
  };
}

function getNakshatraInfo(siderealLongitude: number): {
  nakshatra: string; pada: number; lord: string; index: number;
} {
  const norm = normalizeAngle(siderealLongitude);
  const idx = Math.floor(norm / (360 / 27));
  const posInNak = norm % (360 / 27);
  const pada = Math.min(4, Math.floor(posInNak / (360 / 27 / 4)) + 1);

  // Dasha lords cycle: Ke Ve Su Mo Ma Ra Ju Sa Me (repeating)
  const LORDS = ["Ketu","Venus","Sun","Moon","Mars","Rahu","Jupiter","Saturn","Mercury"];
  return {
    nakshatra: NAKSHATRAS[idx],
    pada,
    lord: LORDS[idx % 9],
    index: idx,
  };
}

function houseFromSignIndices(planetSignIndex: number, ascSignIndex: number): number {
  return ((planetSignIndex - ascSignIndex + 12) % 12) + 1;
}

// ─── Swiss Ephemeris calls ────────────────────────────────────────────────────

async function getPlanetWithSpeed(
  julianDay: number,
  planetId: number,
): Promise<{ longitude: number; speed: number }> {
  assertSwissEphemerisReady();
  return new Promise((resolve, reject) => {
    const SEFLG_SWIEPH = 2;
    const SEFLG_SPEED = 256;
    swe.swe_calc_ut(julianDay, planetId, SEFLG_SWIEPH | SEFLG_SPEED, (result: any) => {
      if (result.error) return reject(new Error(`swe_calc_ut: ${result.error}`));
      resolve({ longitude: result.longitude, speed: result.longitudeSpeed });
    });
  });
}

/**
 * Compute the Ascendant tropical longitude from Swiss Ephemeris (house system W = Whole Sign).
 * For Vedic, we only need the ASC longitude — house cusps come from Whole Sign logic.
 */
async function computeAscendantTropical(
  julianDay: number,
  latitude: number,
  longitude: number,
): Promise<number> {
  assertSwissEphemerisReady();
  return new Promise((resolve, reject) => {
    // Use 'W' (Whole Sign) — all house systems give the same Ascendant longitude
    swe.swe_houses_ex(julianDay, 2 /* SEFLG_SWIEPH */, latitude, longitude, "W", (result: any) => {
      if (result.error) return reject(new Error(`swe_houses_ex: ${result.error}`));
      resolve(result.ascendant as number);
    });
  });
}

// ─── Lagna Lord ───────────────────────────────────────────────────────────────

function computeLagnaLord(
  ascendantSign: VedicSign,
  planets: VedicPlanetPosition[],
): LagnaLord | null {
  const lordName = SIGN_LORDS[ascendantSign];
  if (!lordName) return null;

  const lordPlanet = planets.find(p => p.planet === lordName);
  if (!lordPlanet) return null;

  return {
    planet: lordName,
    placement: {
      sign: lordPlanet.sign,
      house: lordPlanet.house,
      degree: lordPlanet.degree,
      minute: lordPlanet.minute,
    },
  };
}

// ─── Aspects to Ascendant (House 1) ──────────────────────────────────────────

function computeAscendantAspects(planets: VedicPlanetPosition[]): AscendantAspect[] {
  const aspects: AscendantAspect[] = [];

  for (const p of planets) {
    const h = p.house;

    // Universal 7th house aspect: planet in house 7 → aspects house 1
    if (h === 7) {
      aspects.push({ planet: p.planet, fromHouse: h, aspectType: "7th (opposition)" });
      continue; // 7th aspect already captured
    }

    // Mars special: 4th (house+3), 8th (house+7) beyond universal
    if (p.planet === "Mars") {
      if (((h + 3 - 1) % 12) + 1 === 1) aspects.push({ planet: "Mars", fromHouse: h, aspectType: "4th (special)" });
      if (((h + 7 - 1) % 12) + 1 === 1) aspects.push({ planet: "Mars", fromHouse: h, aspectType: "8th (special)" });
    }

    // Jupiter special: 5th (house+4), 9th (house+8) beyond universal
    if (p.planet === "Jupiter") {
      if (((h + 4 - 1) % 12) + 1 === 1) aspects.push({ planet: "Jupiter", fromHouse: h, aspectType: "5th (special)" });
      if (((h + 8 - 1) % 12) + 1 === 1) aspects.push({ planet: "Jupiter", fromHouse: h, aspectType: "9th (special)" });
    }

    // Saturn special: 3rd (house+2), 10th (house+9) beyond universal
    if (p.planet === "Saturn") {
      if (((h + 2 - 1) % 12) + 1 === 1) aspects.push({ planet: "Saturn", fromHouse: h, aspectType: "3rd (special)" });
      if (((h + 9 - 1) % 12) + 1 === 1) aspects.push({ planet: "Saturn", fromHouse: h, aspectType: "10th (special)" });
    }
  }

  return aspects;
}

// ─── Ascendant Strength ───────────────────────────────────────────────────────

function computeAscendantStrength(
  ascendantSign: VedicSign,
  lagnaLord: LagnaLord | null,
  planets: VedicPlanetPosition[],
  ascendantAspects: AscendantAspect[],
): AscendantStrength {
  let score = 0;
  const factors: string[] = [];

  if (lagnaLord) {
    // Angular house placement
    if (ANGULAR_HOUSES.has(lagnaLord.placement.house)) {
      score += 2;
      factors.push(`Lagna lord (${lagnaLord.planet}) in angular house ${lagnaLord.placement.house} (+2)`);
    }

    // Own sign
    if (SIGN_LORDS[lagnaLord.placement.sign as VedicSign] === lagnaLord.planet) {
      score += 2;
      factors.push(`Lagna lord (${lagnaLord.planet}) in own sign ${lagnaLord.placement.sign} (+2)`);
    }

    // Exaltation
    if (EXALTATION_SIGNS[lagnaLord.planet] === lagnaLord.placement.sign) {
      score += 3;
      factors.push(`Lagna lord (${lagnaLord.planet}) exalted in ${lagnaLord.placement.sign} (+3)`);
    }
  }

  // Benefics in 1st house
  const firstHousePlanets = planets.filter(p => p.house === 1);
  for (const p of firstHousePlanets) {
    if (BENEFICS.has(p.planet)) {
      score += 1;
      factors.push(`${p.planet} (benefic) in 1st house (+1)`);
    } else if (MALEFICS.has(p.planet)) {
      score -= 1;
      factors.push(`${p.planet} (malefic) in 1st house (-1)`);
    }
  }

  // Jupiter aspecting the ascendant
  const jupiterAspects = ascendantAspects.filter(a => a.planet === "Jupiter");
  if (jupiterAspects.length > 0) {
    score += 2;
    factors.push(`Jupiter aspects ascendant from house ${jupiterAspects[0].fromHouse} (+2)`);
  }

  // Clamp 0–10
  const clampedScore = Math.max(0, Math.min(10, score));

  return { score: clampedScore, factors };
}

// ─── Whole Sign Houses ────────────────────────────────────────────────────────

function buildWholeSignHouses(ascSignIndex: number): VedicHouse[] {
  return Array.from({ length: 12 }, (_, i) => {
    const houseSignIndex = (ascSignIndex + i) % 12;
    return {
      number: i + 1,
      sign: VEDIC_SIGNS[houseSignIndex],
      lord: HOUSE_LORDS[houseSignIndex],
      cusp: houseSignIndex * 30,
    };
  });
}

// ─── Graha Drishti (general planetary aspects) ────────────────────────────────

function calculateVedicAspects(planets: VedicPlanetPosition[]): VedicAspect[] {
  const aspects: VedicAspect[] = [];

  for (const planet of planets) {
    const h = planet.house;

    // All planets aspect 7th
    const opp = ((h + 6 - 1) % 12) + 1;
    aspects.push({ from: planet.planet, to: `House ${opp}`, type: "7th", strength: 1.0 });

    if (planet.planet === "Mars") {
      const h4 = ((h + 3 - 1) % 12) + 1;
      const h8 = ((h + 7 - 1) % 12) + 1;
      aspects.push({ from: "Mars", to: `House ${h4}`, type: "4th", strength: 1.0 });
      aspects.push({ from: "Mars", to: `House ${h8}`, type: "8th", strength: 1.0 });
    }

    if (planet.planet === "Jupiter") {
      const h5 = ((h + 4 - 1) % 12) + 1;
      const h9 = ((h + 8 - 1) % 12) + 1;
      aspects.push({ from: "Jupiter", to: `House ${h5}`, type: "5th", strength: 1.0 });
      aspects.push({ from: "Jupiter", to: `House ${h9}`, type: "9th", strength: 1.0 });
    }

    if (planet.planet === "Saturn") {
      const h3 = ((h + 2 - 1) % 12) + 1;
      const h10 = ((h + 9 - 1) % 12) + 1;
      aspects.push({ from: "Saturn", to: `House ${h3}`, type: "3rd", strength: 1.0 });
      aspects.push({ from: "Saturn", to: `House ${h10}`, type: "10th", strength: 1.0 });
    }
  }

  return aspects;
}

// ─── Doshas ───────────────────────────────────────────────────────────────────

function detectManglikDosha(marsHouse: number): Dosha {
  const manglikHouses = [1, 4, 7, 8, 12];
  const present = manglikHouses.includes(marsHouse);
  const ordinal = ["1st","2nd","3rd","4th","5th","6th","7th","8th","9th","10th","11th","12th"][marsHouse - 1];
  return {
    name: "Manglik Dosha",
    present,
    ...(present ? { severity: marsHouse === 7 || marsHouse === 8 ? "high" : "medium" } : {}),
    description: present
      ? `Mars in the ${ordinal} house activates Manglik Dosha`
      : "Not present",
  };
}

function detectKalaSarpaDosha(
  corePlanets: VedicPlanetPosition[],
  rahuLong: number,
  ketuLong: number,
): Dosha {
  const isOnRahuSide = (lon: number) => ((lon - rahuLong + 360) % 360) < 180;
  const sides = corePlanets.map(p => isOnRahuSide(p.longitude));
  const allSame = sides.every(s => s === sides[0]);
  return {
    name: "Kala Sarpa Dosha",
    present: allSame,
    ...(allSame ? { severity: "medium" as const } : {}),
    description: allSame
      ? "All planets are hemmed between Rahu and Ketu"
      : "Not present",
  };
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function calculateVedicAstrology(
  year: number,
  month: number,
  day: number,
  hour: number = 12,
  minute: number = 0,
  latitude: number = 0,
  longitude: number = 0,
  hasBirthTime: boolean = false,   // CRITICAL: must be true for valid Ascendant
): Promise<VedicAstrologyResult> {
  assertSwissEphemerisReady();
  const hourDecimal = hour + minute / 60;
  const julianDay = getJulianDay(year, month, day, hourDecimal);

  // Single Swiss Ephemeris ayanamsa call
  const ayanamsa = getAyanamsa(julianDay);

  // ── Ascendant & Houses (requires BOTH birth time AND coordinates) ──────────
  const hasLocation = latitude !== 0 || longitude !== 0;
  const canComputeLagna = hasBirthTime && hasLocation;

  let ascendant: VedicAscendant | null = null;
  let houses: VedicHouse[] | null = null;
  let ascSignIndex = 0;   // Default Aries (used only when no Lagna)

  if (canComputeLagna) {
    const tropicalAsc = await computeAscendantTropical(julianDay, latitude, longitude);
    const siderealAsc = tropicalToSidereal(tropicalAsc, ayanamsa);
    const signInfo = longitudeToSignInfo(siderealAsc);
    const nakshatraInfo = getNakshatraInfo(siderealAsc);

    ascSignIndex = signInfo.signIndex;
    ascendant = {
      longitude: siderealAsc,
      sign: signInfo.sign,
      degree: signInfo.degree,
      minute: signInfo.minute,
      nakshatra: nakshatraInfo.nakshatra,
      nakshatraPada: nakshatraInfo.pada,
    };
    houses = buildWholeSignHouses(ascSignIndex);
  }

  // ── Core planets (10 bodies, single Promise.all — no duplicate Swiss Eph) ──
  const CORE_PLANET_IDS = [
    PLANET_IDS.SUN, PLANET_IDS.MOON, PLANET_IDS.MERCURY, PLANET_IDS.VENUS,
    PLANET_IDS.MARS, PLANET_IDS.JUPITER, PLANET_IDS.SATURN,
    PLANET_IDS.URANUS, PLANET_IDS.NEPTUNE, PLANET_IDS.PLUTO,
  ];

  const rawPlanets = await Promise.all(
    CORE_PLANET_IDS.map(id => getPlanetWithSpeed(julianDay, id))
  );

  const planetData: VedicPlanetPosition[] = rawPlanets.map((raw, i) => {
    const sid = tropicalToSidereal(raw.longitude, ayanamsa);
    const signInfo = longitudeToSignInfo(sid);
    const nakshatraInfo = getNakshatraInfo(sid);
    const house = houseFromSignIndices(signInfo.signIndex, ascSignIndex);
    return {
      planet: getPlanetName(CORE_PLANET_IDS[i]),
      longitude: sid,
      sign: signInfo.sign,
      degree: signInfo.degree,
      minute: signInfo.minute,
      house,
      nakshatra: nakshatraInfo.nakshatra,
      nakshatraPada: nakshatraInfo.pada,
      isRetrograde: raw.speed < 0,
    };
  });

  // ── Rahu / Ketu ───────────────────────────────────────────────────────────
  const rahuId = swe.SE_MEAN_NODE as number;
  const rahuRaw = await getPlanetWithSpeed(julianDay, rahuId);
  const rahuSid = tropicalToSidereal(rahuRaw.longitude, ayanamsa);
  const rahuSign = longitudeToSignInfo(rahuSid);
  const rahuNak = getNakshatraInfo(rahuSid);
  const rahu: VedicPlanetPosition = {
    planet: "Rahu",
    longitude: rahuSid,
    sign: rahuSign.sign,
    degree: rahuSign.degree,
    minute: rahuSign.minute,
    house: houseFromSignIndices(rahuSign.signIndex, ascSignIndex),
    nakshatra: rahuNak.nakshatra,
    nakshatraPada: rahuNak.pada,
    isRetrograde: true,
  };

  const ketuSid = normalizeAngle(rahuSid + 180);
  const ketuSign = longitudeToSignInfo(ketuSid);
  const ketuNak = getNakshatraInfo(ketuSid);
  const ketu: VedicPlanetPosition = {
    planet: "Ketu",
    longitude: ketuSid,
    sign: ketuSign.sign,
    degree: ketuSign.degree,
    minute: ketuSign.minute,
    house: houseFromSignIndices(ketuSign.signIndex, ascSignIndex),
    nakshatra: ketuNak.nakshatra,
    nakshatraPada: ketuNak.pada,
    isRetrograde: true,
  };

  const allPlanets = [...planetData, rahu, ketu];

  // ── Lagna Lord (only if Ascendant is known) ───────────────────────────────
  const lagnaLord = ascendant
    ? computeLagnaLord(ascendant.sign as VedicSign, allPlanets)
    : null;

  // ── Ascendant Aspects ─────────────────────────────────────────────────────
  const ascendantAspects = ascendant ? computeAscendantAspects(allPlanets) : [];

  // ── First House Planets ───────────────────────────────────────────────────
  const firstHousePlanets = ascendant
    ? allPlanets.filter(p => p.house === 1).map(p => p.planet)
    : [];

  // ── Ascendant Strength ────────────────────────────────────────────────────
  const ascendantStrength = ascendant
    ? computeAscendantStrength(ascendant.sign as VedicSign, lagnaLord, allPlanets, ascendantAspects)
    : null;

  // ── Nakshatras ────────────────────────────────────────────────────────────
  const nakshatras = allPlanets.map(p => {
    const info = getNakshatraInfo(p.longitude);
    return { planet: p.planet, nakshatra: info.nakshatra, pada: info.pada, lord: info.lord };
  });

  // ── Retrogrades ───────────────────────────────────────────────────────────
  const retrogrades = allPlanets.filter(p => p.isRetrograde).map(p => p.planet);

  // ── Aspects ───────────────────────────────────────────────────────────────
  const aspects = calculateVedicAspects(allPlanets);

  // ── Doshas ────────────────────────────────────────────────────────────────
  const mars = planetData.find(p => p.planet === "Mars");
  const doshas: Dosha[] = [
    mars ? detectManglikDosha(mars.house) : { name: "Manglik Dosha", present: false, description: "Mars position unavailable" },
    detectKalaSarpaDosha(planetData, rahu.longitude, ketu.longitude),
  ];

  return {
    system: "vedic_sidereal",
    ayanamsa: "lahiri",
    ayanamsaValue: ayanamsa,
    julianDay,
    confidence: canComputeLagna ? "full" : "reduced",

    ascendant,
    lagnaLord,
    houses,
    firstHousePlanets,
    ascendantAspects,
    ascendantStrength,

    planets: allPlanets,
    nodes: { rahu, ketu },
    nakshatras,
    aspects,
    doshas,
    retrogrades,
  };
}
