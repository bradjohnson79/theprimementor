/**
 * Advanced Numerology Service
 * Expands the basic numerology with planetary correlations,
 * energy centers (chakras), maturity number, and challenges.
 */

import type { NumerologyResult } from "./types.js";

// ─── Basic helpers (duplicated for self-containment) ─────────────────────────

const LETTER_VALUES: Record<string, number> = {
  A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8, I: 9,
  J: 1, K: 2, L: 3, M: 4, N: 5, O: 6, P: 7, Q: 8, R: 9,
  S: 1, T: 2, U: 3, V: 4, W: 5, X: 6, Y: 7, Z: 8,
};
const VOWELS = new Set(["A", "E", "I", "O", "U"]);

function reduce(n: number): number {
  if (n === 11 || n === 22 || n === 33) return n;
  while (n > 9) {
    n = String(n).split("").reduce((s, d) => s + parseInt(d, 10), 0);
    if (n === 11 || n === 22 || n === 33) return n;
  }
  return n;
}

function sumDigitsStr(str: string): number {
  return str.split("").filter(c => c >= "0" && c <= "9").reduce((s, d) => s + parseInt(d, 10), 0);
}

function letterSum(name: string, filter?: (c: string) => boolean): number {
  return [...name.toUpperCase()].reduce((sum, c) => {
    if (!LETTER_VALUES[c]) return sum;
    if (filter && !filter(c)) return sum;
    return sum + LETTER_VALUES[c];
  }, 0);
}

// ─── Planetary correlations ───────────────────────────────────────────────────

const NUMBER_TO_PLANET: Record<number, string> = {
  1: "Sun", 2: "Moon", 3: "Jupiter", 4: "Rahu", 5: "Mercury",
  6: "Venus", 7: "Ketu", 8: "Saturn", 9: "Mars",
  11: "Moon", 22: "Saturn", 33: "Jupiter",
};

const NUMBER_SUPPORTING_PLANETS: Record<number, string[]> = {
  1: ["Mars", "Jupiter"], 2: ["Venus", "Mercury"], 3: ["Sun", "Mars"],
  4: ["Saturn", "Venus"], 5: ["Jupiter", "Venus"], 6: ["Saturn", "Mercury"],
  7: ["Neptune", "Mercury"], 8: ["Sun", "Mars"], 9: ["Jupiter", "Moon"],
  11: ["Sun", "Saturn"], 22: ["Uranus", "Mercury"], 33: ["Venus", "Neptune"],
};

// ─── Energy centers (chakras) mapped from numerology ─────────────────────────

const CHAKRA_DESCRIPTIONS: Record<string, Record<number, string>> = {
  root: {
    1: "Pioneer grounding — forging new paths through physical reality",
    4: "Builder's foundation — rock-solid safety through structure",
    8: "Power grounding — material mastery as spiritual practice",
  },
  sacral: {
    2: "Relational creativity — co-creation and deep feeling",
    6: "Nurturing creative flow — beauty, home, and healing",
    9: "Universal compassion — giving from an abundant sacral center",
  },
  solarPlexus: {
    1: "Sovereign will — unwavering personal power",
    3: "Expressive confidence — joy as fuel for action",
    8: "Executive authority — natural command of resources",
  },
  heart: {
    2: "Empathic love — the bridge between self and other",
    6: "Unconditional nurturance — family and community heart",
    9: "Humanitarian love — love as a cosmic principle",
  },
  throat: {
    3: "Expressive voice — the artist and communicator",
    5: "Freedom speech — truth-telling across all domains",
    7: "Mystical expression — teaching the hidden",
  },
  thirdEye: {
    7: "Visionary sight — seeing beyond the veil",
    11: "Intuitive channel — lightning insight and prophecy",
    22: "Masterful vision — building from inspired blueprints",
  },
  crown: {
    9: "Universal connection — dissolution into the whole",
    11: "Divine channel — direct line to higher realms",
    33: "Christ consciousness — master teacher of love",
  },
};

function getChakraNote(chakra: string, number: number): string {
  const map = CHAKRA_DESCRIPTIONS[chakra];
  if (!map) return `Balanced ${chakra} energy`;
  const entry = map[number] || map[reduce(number)];
  return entry || `${number} energy expressed through ${chakra} center`;
}

// ─── Main export ──────────────────────────────────────────────────────────────

export interface AdvancedNumerologyResult extends NumerologyResult {
  maturityNumber: number;
  challenges: [number, number, number, number];
  planetaryCorrelation: {
    dominantPlanet: string;
    supportingPlanets: string[];
  };
  energyCenters: {
    root: string;
    sacral: string;
    solarPlexus: string;
    heart: string;
    throat: string;
    thirdEye: string;
    crown: string;
  };
}

export function calculateAdvancedNumerology(
  fullBirthName: string,
  year: number,
  month: number,
  day: number,
): AdvancedNumerologyResult {
  // ── Core numbers ──
  const monthR = reduce(month);
  const dayR = reduce(day);
  const yearR = reduce(sumDigitsStr(String(year)));
  const lifePath = reduce(monthR + dayR + yearR);

  const destiny = reduce(letterSum(fullBirthName));
  const soulUrge = reduce(letterSum(fullBirthName, c => VOWELS.has(c)));
  const personality = reduce(letterSum(fullBirthName, c => !VOWELS.has(c)));
  const birthDay = reduce(day);

  // ── Pinnacles ──
  const p1 = reduce(monthR + dayR);
  const p2 = reduce(dayR + yearR);
  const p3 = reduce(p1 + p2);
  const p4 = reduce(monthR + yearR);

  // ── Maturity number ──
  const maturityNumber = reduce(lifePath + destiny);

  // ── Challenges ──
  const c1 = Math.abs(monthR - dayR);
  const c2 = Math.abs(dayR - yearR);
  const c3 = Math.abs(c1 - c2);
  const c4 = Math.abs(monthR - yearR);

  // ── Planetary correlation ──
  const dominantPlanet = NUMBER_TO_PLANET[lifePath] ?? "Sun";
  const supportingPlanets = NUMBER_SUPPORTING_PLANETS[lifePath] ?? [];

  // ── Energy centers ──
  const energyCenters = {
    root: getChakraNote("root", lifePath),
    sacral: getChakraNote("sacral", destiny),
    solarPlexus: getChakraNote("solarPlexus", personality),
    heart: getChakraNote("heart", soulUrge),
    throat: getChakraNote("throat", destiny),
    thirdEye: getChakraNote("thirdEye", lifePath),
    crown: getChakraNote("crown", lifePath),
  };

  return {
    birthDay,
    lifePath,
    soulUrge,
    destiny,
    personality,
    pinnacles: [p1, p2, p3, p4],
    maturityNumber,
    challenges: [c1, c2, c3, c4],
    planetaryCorrelation: { dominantPlanet, supportingPlanets },
    energyCenters,
  };
}
