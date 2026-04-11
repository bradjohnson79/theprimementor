/**
 * Human Design Service
 * Derives type, authority, profile, centers, channels, and gates
 * from planetary positions computed by Swiss Ephemeris.
 *
 * Gate assignments use the I Ching hexagram ↔ ecliptic mapping
 * that underpins the original Human Design system.
 */

import { getJulianDay, getPlanetPosition, PLANET_IDS } from "./swissEphemerisService.js";

// ─── Gate mapping ─────────────────────────────────────────────────────────────
// Each 360° of the ecliptic is divided into 64 gates (I Ching hexagrams).
// Each gate occupies 5.625° (360/64). The sequence starts at 0° Aries
// with Gate 41 (the "start of the cycle" in HD).

const GATE_SEQUENCE: number[] = [
  41, 19, 13, 49, 30, 55, 37, 63, 22, 36, 25, 17, 21, 51, 42, 3,
  27, 24, 2,  23, 8,  20, 16, 35, 45, 12, 15, 52, 39, 53, 62, 56,
  31, 33, 7,  4,  29, 59, 40, 64, 47, 6,  46, 18, 48, 57, 32, 50,
  28, 44, 1,  43, 14, 34, 9,  5,  26, 11, 10, 58, 38, 54, 61, 60,
];

function longitudeToGate(longitude: number): number {
  const normalized = ((longitude % 360) + 360) % 360;
  const gateIndex = Math.floor(normalized / 5.625);
  return GATE_SEQUENCE[gateIndex % 64];
}

function longitudeToLine(longitude: number): number {
  const normalized = ((longitude % 360) + 360) % 360;
  const positionInGate = (normalized % 5.625) / 5.625;
  return Math.floor(positionInGate * 6) + 1;
}

// ─── Channel definitions (gate pairs that form channels) ─────────────────────

const CHANNEL_MAP: Array<{ gates: [number, number]; name: string; centers: [string, string] }> = [
  { gates: [1, 8],   name: "Inspiration",      centers: ["G", "Throat"] },
  { gates: [2, 14],  name: "The Beat",          centers: ["G", "Sacral"] },
  { gates: [3, 60],  name: "Mutation",          centers: ["Sacral", "Root"] },
  { gates: [4, 63],  name: "Logic",             centers: ["Ajna", "Head"] },
  { gates: [5, 15],  name: "Rhythm",            centers: ["Sacral", "G"] },
  { gates: [6, 59],  name: "Mating",            centers: ["Emotional", "Sacral"] },
  { gates: [7, 31],  name: "Alpha",             centers: ["G", "Throat"] },
  { gates: [9, 52],  name: "Concentration",     centers: ["Sacral", "Root"] },
  { gates: [10, 20], name: "Awakening",         centers: ["G", "Throat"] },
  { gates: [10, 34], name: "Exploration",       centers: ["G", "Sacral"] },
  { gates: [10, 57], name: "Perfected Form",    centers: ["G", "Spleen"] },
  { gates: [11, 56], name: "Curiosity",         centers: ["Ajna", "Throat"] },
  { gates: [12, 22], name: "Openness",          centers: ["Throat", "Emotional"] },
  { gates: [13, 33], name: "Prodigal",          centers: ["G", "Throat"] },
  { gates: [16, 48], name: "Wavelength",        centers: ["Throat", "Spleen"] },
  { gates: [17, 62], name: "Acceptance",        centers: ["Ajna", "Throat"] },
  { gates: [18, 58], name: "Judgment",          centers: ["Spleen", "Root"] },
  { gates: [19, 49], name: "Synthesis",         centers: ["Root", "Emotional"] },
  { gates: [20, 34], name: "Charisma",          centers: ["Throat", "Sacral"] },
  { gates: [20, 57], name: "Brainwave",         centers: ["Throat", "Spleen"] },
  { gates: [21, 45], name: "Money",             centers: ["Ego", "Throat"] },
  { gates: [23, 43], name: "Structuring",       centers: ["Throat", "Ajna"] },
  { gates: [24, 61], name: "Awareness",         centers: ["Ajna", "Head"] },
  { gates: [25, 51], name: "Initiation",        centers: ["G", "Ego"] },
  { gates: [26, 44], name: "Surrender",         centers: ["Ego", "Spleen"] },
  { gates: [27, 50], name: "Preservation",      centers: ["Sacral", "Spleen"] },
  { gates: [28, 38], name: "Struggle",          centers: ["Spleen", "Root"] },
  { gates: [29, 46], name: "Discovery",         centers: ["Sacral", "G"] },
  { gates: [30, 41], name: "Recognition",       centers: ["Emotional", "Root"] },
  { gates: [32, 54], name: "Transformation",    centers: ["Spleen", "Root"] },
  { gates: [35, 36], name: "Transitoriness",    centers: ["Throat", "Emotional"] },
  { gates: [37, 40], name: "Community",         centers: ["Emotional", "Ego"] },
  { gates: [39, 55], name: "Emoting",           centers: ["Root", "Emotional"] },
  { gates: [42, 53], name: "Maturation",        centers: ["Sacral", "Root"] },
  { gates: [47, 64], name: "Abstraction",       centers: ["Ajna", "Head"] },
];

// ─── Center list ─────────────────────────────────────────────────────────────

const ALL_CENTERS = ["Head", "Ajna", "Throat", "G", "Ego", "Sacral", "Spleen", "Emotional", "Root"] as const;
type Center = typeof ALL_CENTERS[number];

// ─── Type determination from defined centers ──────────────────────────────────

function determineType(definedCenters: Set<Center>): string {
  const hasSacral = definedCenters.has("Sacral");
  const hasThroat = definedCenters.has("Throat");
  const hasMotor = definedCenters.has("Sacral") || definedCenters.has("Ego") ||
                   definedCenters.has("Emotional") || definedCenters.has("Root");
  const throatConnectedToMotor =
    definedCenters.has("Sacral") && hasThroat ||
    definedCenters.has("Ego") && hasThroat ||
    definedCenters.has("Emotional") && hasThroat;

  if (hasSacral && !hasThroat) return "Generator";
  if (hasSacral && hasThroat) return "Manifesting Generator";
  if (!hasSacral && hasMotor && throatConnectedToMotor) return "Manifestor";
  if (!hasSacral && hasMotor && !throatConnectedToMotor) return "Projector";
  return "Reflector";
}

// ─── Authority determination ──────────────────────────────────────────────────

function determineAuthority(definedCenters: Set<Center>): string {
  if (definedCenters.has("Emotional")) return "Emotional";
  if (definedCenters.has("Sacral")) return "Sacral";
  if (definedCenters.has("Spleen")) return "Splenic";
  if (definedCenters.has("Ego")) return "Ego";
  if (definedCenters.has("G")) return "G Center / Self";
  if (definedCenters.has("Ajna")) return "Mental";
  return "Lunar";
}

// ─── Profile from Sun gate line ───────────────────────────────────────────────

const PROFILE_NAMES: Record<string, string> = {
  "1/3": "Investigator / Martyr",  "1/4": "Investigator / Opportunist",
  "2/4": "Hermit / Opportunist",   "2/5": "Hermit / Heretic",
  "3/5": "Martyr / Heretic",       "3/6": "Martyr / Role Model",
  "4/6": "Opportunist / Role Model","4/1": "Opportunist / Investigator",
  "5/1": "Heretic / Investigator", "5/2": "Heretic / Hermit",
  "6/2": "Role Model / Hermit",    "6/3": "Role Model / Martyr",
};

function determineProfile(consciousLine: number, unconsciousLine: number): string {
  const key = `${consciousLine}/${unconsciousLine}`;
  return PROFILE_NAMES[key] ?? `${consciousLine}/${unconsciousLine}`;
}

// ─── Definition type ──────────────────────────────────────────────────────────

function determineDefinition(channelCount: number): string {
  if (channelCount === 0) return "No Definition";
  if (channelCount === 1) return "Single Definition";
  if (channelCount === 2) return "Split Definition";
  if (channelCount === 3) return "Triple Split Definition";
  return "Quadruple Split Definition";
}

// ─── Main export ──────────────────────────────────────────────────────────────

export interface HumanDesignResult {
  type: string;
  authority: string;
  profile: string;
  definition: string;
  centers: Record<Center, "defined" | "undefined">;
  channels: string[];
  gates: number[];
  notSelf: string;
  strategy: string;
}

export async function calculateHumanDesign(
  year: number,
  month: number,
  day: number,
  hour: number = 12,
  minute: number = 0,
  precomputedJulianDay?: number,  // Accept pre-computed JD to avoid duplicate call
): Promise<HumanDesignResult> {
  const hourDecimal = hour + minute / 60;
  // Use pre-computed JD if provided (shared from Vedic calculation)
  const julianDay = precomputedJulianDay ?? getJulianDay(year, month, day, hourDecimal);

  // ── Birth chart gates (conscious) ──
  const planetIds = [
    PLANET_IDS.SUN, PLANET_IDS.MOON, PLANET_IDS.MERCURY, PLANET_IDS.VENUS,
    PLANET_IDS.MARS, PLANET_IDS.JUPITER, PLANET_IDS.SATURN, PLANET_IDS.URANUS,
    PLANET_IDS.NEPTUNE, PLANET_IDS.PLUTO,
  ];

  const positions = await Promise.all(
    planetIds.map(id => getPlanetPosition(julianDay, id))
  );

  const consciousGates = positions.map(p => longitudeToGate(p.longitude));

  // ── Design chart (88° before birth) ──
  const designJD = julianDay - 88 / 360;
  const designPositions = await Promise.all(
    planetIds.map(id => getPlanetPosition(designJD, id))
  );
  const unconsciousGates = designPositions.map(p => longitudeToGate(p.longitude));

  const allGates = [...new Set([...consciousGates, ...unconsciousGates])];

  // ── Active channels ──
  const activeChannels = CHANNEL_MAP.filter(ch =>
    allGates.includes(ch.gates[0]) && allGates.includes(ch.gates[1])
  );

  // ── Defined centers ──
  const definedCenters = new Set<Center>();
  activeChannels.forEach(ch => {
    ch.centers.forEach(c => {
      if (ALL_CENTERS.includes(c as Center)) definedCenters.add(c as Center);
    });
  });

  // ── Build centers map ──
  const centers = Object.fromEntries(
    ALL_CENTERS.map(c => [c, definedCenters.has(c) ? "defined" : "undefined"])
  ) as Record<Center, "defined" | "undefined">;

  // ── Type, authority, profile ──
  const type = determineType(definedCenters);
  const authority = determineAuthority(definedCenters);

  const sunLine = longitudeToLine(positions[0].longitude);
  const designSunLine = longitudeToLine(designPositions[0].longitude);
  const profile = determineProfile(sunLine, designSunLine);
  const definition = determineDefinition(activeChannels.length);

  // ── Strategy and not-self based on type ──
  const strategyMap: Record<string, string> = {
    "Generator": "Wait to respond",
    "Manifesting Generator": "Wait to respond, then inform",
    "Manifestor": "Initiate and inform",
    "Projector": "Wait for the invitation",
    "Reflector": "Wait a lunar cycle",
  };
  const notSelfMap: Record<string, string> = {
    "Generator": "Frustration",
    "Manifesting Generator": "Frustration and anger",
    "Manifestor": "Anger",
    "Projector": "Bitterness",
    "Reflector": "Disappointment",
  };

  return {
    type,
    authority,
    profile,
    definition,
    centers,
    channels: activeChannels.map(c => c.name),
    gates: allGates.sort((a, b) => a - b),
    notSelf: notSelfMap[type] ?? "Dissonance",
    strategy: strategyMap[type] ?? "Wait and observe",
  };
}
