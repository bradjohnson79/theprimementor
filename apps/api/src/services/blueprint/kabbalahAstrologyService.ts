/**
 * Kabbalistic Astrology Service
 * Maps planetary positions to the Tree of Life (Sephirot)
 * and derives soul correction themes and path influences.
 */

import type { VedicPlanetPosition } from "./vedicAstrologyService.js";

// ─── Sephirot definitions ─────────────────────────────────────────────────────

export interface Sephira {
  number: number;
  name: string;
  hebrewName: string;
  meaning: string;
  planet: string;
  quality: string;
  color: string;
}

const SEPHIROT: Sephira[] = [
  { number: 1,  name: "Kether",   hebrewName: "כֶּתֶר",   meaning: "Crown",          planet: "Neptune/Pluto", quality: "Divine unity, infinite light",         color: "White"  },
  { number: 2,  name: "Chokmah",  hebrewName: "חָכְמָה",  meaning: "Wisdom",         planet: "Uranus",        quality: "Pure creative force, the Father",      color: "Grey"   },
  { number: 3,  name: "Binah",    hebrewName: "בִּינָה",  meaning: "Understanding",  planet: "Saturn",        quality: "Form, restriction, the Mother",        color: "Black"  },
  { number: 4,  name: "Chesed",   hebrewName: "חֶסֶד",    meaning: "Mercy",          planet: "Jupiter",       quality: "Expansion, grace, benevolence",        color: "Blue"   },
  { number: 5,  name: "Geburah",  hebrewName: "גְּבוּרָה", meaning: "Strength",      planet: "Mars",          quality: "Power, discipline, justice",           color: "Red"    },
  { number: 6,  name: "Tiphareth",hebrewName: "תִּפְאֶרֶת",meaning: "Beauty",        planet: "Sun",           quality: "Harmony, the Christ center, the Self", color: "Gold"   },
  { number: 7,  name: "Netzach",  hebrewName: "נֶצַח",    meaning: "Victory",        planet: "Venus",         quality: "Desire, emotion, nature, art",         color: "Green"  },
  { number: 8,  name: "Hod",      hebrewName: "הוֹד",     meaning: "Splendour",      planet: "Mercury",       quality: "Mind, communication, magic",           color: "Orange" },
  { number: 9,  name: "Yesod",    hebrewName: "יְסוֹד",   meaning: "Foundation",     planet: "Moon",          quality: "Subconscious, dreams, reflection",     color: "Violet" },
  { number: 10, name: "Malkuth",  hebrewName: "מַלְכוּת", meaning: "Kingdom",        planet: "Earth",         quality: "Physical reality, manifestation",      color: "Earthtones" },
];

// ─── Planetary paths on the tree ──────────────────────────────────────────────

const PLANETARY_PATHS: Record<string, string> = {
  Sun:     "Path 6 — The path of the Self and radiant consciousness (Tiphareth)",
  Moon:    "Path 9 — The path of reflection, dreams, and the subconscious (Yesod)",
  Mercury: "Path 8 — The path of intellect, communication, and adaptation (Hod)",
  Venus:   "Path 7 — The path of love, beauty, and natural flow (Netzach)",
  Mars:    "Path 5 — The path of will, courage, and transformation (Geburah)",
  Jupiter: "Path 4 — The path of wisdom, expansion, and grace (Chesed)",
  Saturn:  "Path 3 — The path of form, discipline, and karma (Binah)",
  Uranus:  "Path 2 — The path of awakening, innovation, and higher will (Chokmah)",
  Neptune: "Path 1 — The path of dissolution, mysticism, and unity (Kether)",
  Pluto:   "Path 1 — The path of transformation, death, and rebirth (Kether)",
  Rahu:    "Path between Kether and Chokmah — the ascending node of dharma",
  Ketu:    "Path between Tiphareth and Yesod — the descending node of past karma",
};

// ─── Soul correction themes by life path ─────────────────────────────────────

const SOUL_CORRECTION_THEMES: Record<number, string> = {
  1:  "Reclaiming spiritual certainty — moving from doubt to trust",
  2:  "Circuitry — recognising where you hide your light from connection",
  3:  "Quiet — learning to make decisions in silence, not reaction",
  4:  "Difficult childhood — transforming inherited wounds into wisdom",
  5:  "Finishing what you start — mastery through completion",
  6:  "World hunger — transforming lack consciousness into abundance",
  7:  "Recognising design — seeing the divine order within all events",
  8:  "Defiance — moving from resistance to purposeful transformation",
  9:  "Restriction — releasing the fear of limitation to find freedom",
  10: "Planting in fertile ground — discernment in where you invest life-force",
  11: "Transparent — radiant service without agenda",
  12: "Misuse of power — aligning will with the greater good",
  13: "Redemption — transforming collective suffering through love",
  14: "Stepping away from the wheel — releasing addictive cycles",
  15: "Spiritual candle — being the light without seeking the spotlight",
  16: "Turning back — the courage to change direction at any moment",
  17: "Breaking free — dissolving structures that no longer serve",
  18: "Extending the hand — unconditional service and healing",
  19: "Reexamination — seeing past illusion to essential truth",
  20: "Altruism — moving beyond the personal self into collective service",
  21: "Lost in the shuffle — finding yourself within the crowd",
  22: "Payback — transforming debt (karmic & financial) into abundance",
  23: "Totality — full commitment to the spiritual path",
  24: "Addiction to perfection — embracing the beauty of the imperfect",
  25: "Speak your mind — healing through authentic voice and truth",
  26: "Sharing the flame — teaching others to ignite their own fire",
  27: "Selfishness / Selflessness — finding the balance between self-care and giving",
  28: "Soul mate — the longing for deep spiritual union",
  29: "Turning on the light — bringing higher consciousness to dense situations",
  30: "Chutzpah — holy boldness on the spiritual path",
  31: "Appreciate your blessings — gratitude as a transformative technology",
  32: "Memories — releasing ancestral and personal past",
  33: "Revealing the dark side — integrating shadow into wholeness and master teacher of love",
};

// ─── Main export ──────────────────────────────────────────────────────────────

export interface KabbalahAstrologyResult {
  sephirotMapping: Array<{
    sephira: Sephira;
    planet: string;
    longitude: number;
    sign: string;
    influence: string;
  }>;
  planetaryTreeOverlay: string[];
  pathInfluences: string[];
  soulCorrectionThemes: string[];
  dominantSephira: Sephira;
}

export function calculateKabbalahAstrology(
  planets: VedicPlanetPosition[],
  lifePath: number,
): KabbalahAstrologyResult {
  // ── Map each planet to its sephira ──
  const planetToSephira: Record<string, Sephira> = {};
  SEPHIROT.forEach(s => {
    s.planet.split("/").forEach(p => {
      planetToSephira[p.trim()] = s;
    });
  });

  const sephirotMapping = planets.map(p => {
    const sephira = planetToSephira[p.planet] ?? SEPHIROT[9]; // Default Malkuth
    return {
      sephira,
      planet: p.planet,
      longitude: p.longitude,
      sign: p.sign,
      influence: `${p.planet} in ${p.sign} activates ${sephira.name} — ${sephira.quality}`,
    };
  });

  // ── Planetary tree overlay ──
  const planetaryTreeOverlay = planets.map(p => PLANETARY_PATHS[p.planet] ?? `${p.planet}: uncharted path`);

  // ── Path influences from planetary signs ──
  const pathInfluences = planets.map(p => {
    const sephira = planetToSephira[p.planet];
    if (!sephira) return `${p.planet} in ${p.sign} — earthly manifestation (Malkuth)`;
    return `${sephira.name} (${sephira.meaning}) is activated by ${p.planet} in ${p.sign} — ${sephira.quality}`;
  });

  // ── Soul correction from life path ──
  const primaryTheme = SOUL_CORRECTION_THEMES[lifePath] ?? SOUL_CORRECTION_THEMES[lifePath % 9 || 9];
  const soulCorrectionThemes = [primaryTheme];

  // Add secondary theme if master number
  if ([11, 22, 33].includes(lifePath)) {
    const secondary = SOUL_CORRECTION_THEMES[lifePath];
    if (secondary && !soulCorrectionThemes.includes(secondary)) {
      soulCorrectionThemes.push(secondary);
    }
  }

  // ── Dominant sephira (from Sun planet) ──
  const sunPlanet = planets.find(p => p.planet === "Sun");
  const dominantSephira = sunPlanet ? (planetToSephira[sunPlanet.planet] ?? SEPHIROT[5]) : SEPHIROT[5];

  return {
    sephirotMapping,
    planetaryTreeOverlay,
    pathInfluences,
    soulCorrectionThemes,
    dominantSephira,
  };
}
