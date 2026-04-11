import type { AstrologyResult, PlanetPosition } from "./types.js";
import {
  getJulianDay,
  getPlanetPosition,
  longitudeToSign,
  getPlanetName,
  PLANET_IDS,
} from "./swissEphemerisService.js";

const CORE_PLANETS = [
  PLANET_IDS.SUN,
  PLANET_IDS.MOON,
  PLANET_IDS.MERCURY,
  PLANET_IDS.VENUS,
  PLANET_IDS.MARS,
  PLANET_IDS.JUPITER,
  PLANET_IDS.SATURN,
  PLANET_IDS.URANUS,
  PLANET_IDS.NEPTUNE,
  PLANET_IDS.PLUTO,
];

async function toPlanetPosition(
  julianDay: number,
  planetId: number,
): Promise<PlanetPosition> {
  const { longitude } = await getPlanetPosition(julianDay, planetId);
  const signData = longitudeToSign(longitude);
  return {
    planet: getPlanetName(planetId),
    longitude,
    sign: signData.sign,
    degree: signData.degree,
    minute: signData.minute,
  };
}

export async function calculateFullAstrology(
  year: number,
  month: number,
  day: number,
  hour: number = 12,
  minute: number = 0,
): Promise<AstrologyResult> {
  const hourDecimal = hour + minute / 60;
  const julianDay = getJulianDay(year, month, day, hourDecimal);

  const planets = await Promise.all(
    CORE_PLANETS.map((id) => toPlanetPosition(julianDay, id)),
  );

  const sunSign = planets.find((p) => p.planet === "Sun")!;
  const moonSign = planets.find((p) => p.planet === "Moon")!;

  return {
    sunSign,
    moonSign,
    planets,
    julianDay,
  };
}
