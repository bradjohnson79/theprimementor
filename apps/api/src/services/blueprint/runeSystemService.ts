/**
 * Rune System Service (GPT-driven)
 * Seeds a deterministic profile from birthDate, lifePath,
 * dominantPlanet, and nakshatra, then uses GPT to interpret
 * the resulting rune draw.
 */

import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL = process.env.OPENAI_MODEL || "gpt-4.1";

// Elder Futhark runes with core meanings
const RUNES = [
  { name: "Fehu",    meaning: "Abundance, earned wealth, new beginnings" },
  { name: "Uruz",    meaning: "Primal strength, wild power, vitality" },
  { name: "Thurisaz",meaning: "Reactive force, breakthrough, protection through conflict" },
  { name: "Ansuz",   meaning: "Divine communication, ancestral wisdom, Odin's breath" },
  { name: "Raidho",  meaning: "Journey, right action, cosmic order" },
  { name: "Kenaz",   meaning: "Inner flame, creativity, revelatory light" },
  { name: "Gebo",    meaning: "Gift, exchange, sacred relationship" },
  { name: "Wunjo",   meaning: "Joy, harmony, wish fulfillment" },
  { name: "Hagalaz", meaning: "Disruptive change, hail storm, necessary destruction" },
  { name: "Nauthiz",  meaning: "Need-fire, constraint, shadow work" },
  { name: "Isa",     meaning: "Stillness, ice, introspection, ego crystallization" },
  { name: "Jera",    meaning: "Harvest, cycles, reward for right effort" },
  { name: "Eihwaz",  meaning: "Yew tree, axis mundi, life-death-rebirth" },
  { name: "Perthro", meaning: "Fate, the wyrd, hidden potential" },
  { name: "Algiz",   meaning: "Protection, awakening, the self defended by spirit" },
  { name: "Sowilo",  meaning: "Sun, success, divine will, victory" },
  { name: "Tiwaz",   meaning: "Justice, sacrifice, the warrior's honor" },
  { name: "Berkano", meaning: "Birch, nurturing, birth, feminine mysteries" },
  { name: "Ehwaz",   meaning: "Horse, partnership, trust, sacred movement" },
  { name: "Mannaz",  meaning: "Humanity, self-reflection, shared consciousness" },
  { name: "Laguz",   meaning: "Water, flow, intuition, the unconscious sea" },
  { name: "Ingwaz",  meaning: "Inner seed, gestation, the potential fully held" },
  { name: "Dagaz",   meaning: "Dawn, breakthrough, paradox transcended" },
  { name: "Othala",  meaning: "Ancestral inheritance, homeland, soul lineage" },
];

export interface RuneResult {
  seed: {
    birthDate: string;
    lifePath: number;
    dominantPlanet: string;
    nakshatra: string;
  };
  primaryRune: { name: string; meaning: string };
  supportingRunes: Array<{ name: string; meaning: string }>;
  interpretation: string;
}

function selectRunesByIndex(
  birthDate: string,
  lifePath: number,
  dominantPlanet: string,
  nakshatra: string,
): { primary: number; supporting: number[] } {
  // Build a deterministic index from the seed values
  const dateDigits = birthDate.replace(/-/g, "").split("").reduce((s, d) => s + parseInt(d, 10), 0);
  const planetSeed = dominantPlanet.split("").reduce((s, c) => s + c.charCodeAt(0), 0);
  const nakshatraSeed = nakshatra.split("").reduce((s, c) => s + c.charCodeAt(0), 0);

  const primary = (dateDigits + lifePath + planetSeed) % RUNES.length;
  const s1 = (primary + lifePath) % RUNES.length;
  const s2 = (primary + nakshatraSeed) % RUNES.length;
  const supporting = [...new Set([s1, s2])].filter(i => i !== primary);

  return { primary, supporting: supporting.slice(0, 2) };
}

export async function calculateRuneSystem(
  birthDate: string,
  lifePath: number,
  dominantPlanet: string,
  nakshatra: string,
): Promise<RuneResult> {
  const { primary, supporting } = selectRunesByIndex(birthDate, lifePath, dominantPlanet, nakshatra);

  const primaryRune = RUNES[primary];
  const supportingRunes = supporting.map(i => RUNES[i]);

  const seed = { birthDate, lifePath, dominantPlanet, nakshatra };

  const prompt = `You are a Norse runic oracle deeply versed in Elder Futhark and Vedic metaphysics.

A seeker has these cosmic markers:
- Birth Date: ${birthDate}
- Life Path Number: ${lifePath}
- Dominant Planet (Vedic): ${dominantPlanet}
- Birth Nakshatra: ${nakshatra}

Their rune draw is:
- Primary Rune: ${primaryRune.name} — ${primaryRune.meaning}
- Supporting Runes: ${supportingRunes.map(r => `${r.name} (${r.meaning})`).join(", ")}

Write a 2–3 paragraph runic interpretation that:
1. Integrates the primary rune's energy with the seeker's life path and dominant planet
2. Shows how the supporting runes add nuance or tension
3. Offers practical spiritual guidance aligned with their nakshatra's qualities

Tone: mystical, direct, personal. No generic statements.

Return ONLY plain prose — no markdown, no lists, no headers.`;

  const completion = await client.chat.completions.create({
    model: MODEL,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.8,
    max_completion_tokens: 600,
  });

  const interpretation = completion.choices[0]?.message?.content?.trim() ?? "Interpretation unavailable.";

  return {
    seed,
    primaryRune,
    supportingRunes,
    interpretation,
  };
}
