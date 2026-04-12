import type { VedicAstrologyResult } from "../../blueprint/vedicAstrologyService.js";

function roundLongitude(value: number) {
  return Number(value.toFixed(6));
}

export interface CoreChartPlanetSnapshot {
  sign: string;
  degree: number;
  minute: number;
  house: number;
  longitude: number;
  retrograde: boolean;
}

export interface CoreChartAscendantSnapshot {
  sign: string;
  degree: number;
  minute: number;
  longitude: number;
  nakshatra: string;
  nakshatraPada: number;
}

export interface CoreChartSnapshot {
  confidence: "full" | "reduced";
  ayanamsaValue: number;
  ascendant: CoreChartAscendantSnapshot | null;
  planets: Record<string, CoreChartPlanetSnapshot>;
  nodes: {
    rahu: CoreChartPlanetSnapshot;
    ketu: CoreChartPlanetSnapshot;
  };
}

function toPlanetSnapshot(planet: {
  sign: string;
  degree: number;
  minute: number;
  house: number;
  longitude: number;
  isRetrograde: boolean;
}): CoreChartPlanetSnapshot {
  return {
    sign: planet.sign,
    degree: planet.degree,
    minute: planet.minute,
    house: planet.house,
    longitude: roundLongitude(planet.longitude),
    retrograde: planet.isRetrograde,
  };
}

export function toCoreChartSnapshot(astrology: VedicAstrologyResult): CoreChartSnapshot {
  return {
    confidence: astrology.confidence,
    ayanamsaValue: roundLongitude(astrology.ayanamsaValue),
    ascendant: astrology.ascendant
      ? {
          sign: astrology.ascendant.sign,
          degree: astrology.ascendant.degree,
          minute: astrology.ascendant.minute,
          longitude: roundLongitude(astrology.ascendant.longitude),
          nakshatra: astrology.ascendant.nakshatra,
          nakshatraPada: astrology.ascendant.nakshatraPada,
        }
      : null,
    planets: Object.fromEntries(
      astrology.planets.map((planet) => [planet.planet, toPlanetSnapshot(planet)]),
    ),
    nodes: {
      rahu: toPlanetSnapshot(astrology.nodes.rahu),
      ketu: toPlanetSnapshot(astrology.nodes.ketu),
    },
  };
}
