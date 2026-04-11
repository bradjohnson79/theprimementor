import type { VedicAstrologyResult } from "../../blueprint/vedicAstrologyService.js";
import type { ParsedAstrologyChart } from "./types.js";

function firstPlanetInSign(astrology: VedicAstrologyResult, planetName: string) {
  return astrology.planets.find((planet) => planet.planet === planetName) ?? null;
}

export function parseAstrologyChart(astrology: VedicAstrologyResult): ParsedAstrologyChart {
  const moon = firstPlanetInSign(astrology, "Moon");
  const sun = firstPlanetInSign(astrology, "Sun");
  const presentDoshas = astrology.doshas
    .filter((dosha) => dosha.present)
    .map((dosha) => ({
      name: dosha.name,
      present: dosha.present,
      severity: dosha.severity,
    }));

  const summaryParts = [
    astrology.ascendant?.sign ? `Ascendant in ${astrology.ascendant.sign}` : null,
    moon?.sign ? `Moon in ${moon.sign}` : null,
    sun?.sign ? `Sun in ${sun.sign}` : null,
    astrology.lagnaLord?.planet ? `Lagna lord ${astrology.lagnaLord.planet} in house ${astrology.lagnaLord.placement.house}` : null,
  ].filter(Boolean);

  const keyInsights = [
    astrology.ascendant?.sign ? `The chart rises in ${astrology.ascendant.sign}.` : null,
    moon?.nakshatra ? `Moon nakshatra: ${moon.nakshatra}.` : null,
    astrology.firstHousePlanets.length > 0 ? `First-house emphasis: ${astrology.firstHousePlanets.join(", ")}.` : null,
    astrology.ascendantStrength ? `Ascendant strength score: ${astrology.ascendantStrength.score}/10.` : null,
    presentDoshas[0] ? `${presentDoshas[0].name} is present${presentDoshas[0].severity ? ` (${presentDoshas[0].severity})` : ""}.` : null,
  ].filter((value): value is string => Boolean(value));

  return {
    summary: summaryParts.length > 0
      ? `${summaryParts.join("; ")}.`
      : "Swiss Ephemeris completed a Vedic sidereal chart calculation.",
    keyInsights,
    highlights: {
      ascendantSign: astrology.ascendant?.sign ?? null,
      moonSign: moon?.sign ?? null,
      sunSign: sun?.sign ?? null,
      lagnaLord: astrology.lagnaLord?.planet ?? null,
      firstHousePlanets: astrology.firstHousePlanets,
      ascendantStrength: astrology.ascendantStrength?.score ?? null,
      doshas: presentDoshas,
      confidence: astrology.confidence,
      ayanamsa: astrology.ayanamsaValue,
      chart: astrology,
    },
  };
}
