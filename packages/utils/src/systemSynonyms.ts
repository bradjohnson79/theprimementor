export const SYSTEM_SYNONYMS = {
  vedic_astrology: [
    "vedic",
    "vedic astrology",
    "jyotish",
    "jyotish astrology",
    "sidereal",
    "sidereal astrology",
    "indian astrology",
  ],
  western_astrology: [
    "western astrology",
    "tropical astrology",
  ],
  chinese_astrology: [
    "chinese astrology",
    "chinese zodiac",
  ],
  astrology_general: [
    "astrology",
    "birth chart",
    "natal chart",
    "my chart",
  ],
  numerology: [
    "numerology",
    "life path",
    "number reading",
  ],
  tarot: [
    "tarot",
    "tarot reading",
    "tarot spread",
  ],
  iching: [
    "i ching",
    "iching",
    "hexagram",
  ],
  human_design: [
    "human design",
    "projector",
    "generator",
    "manifestor",
    "reflector",
  ],
  kabbalah: [
    "kabbalah",
    "kabbalistic",
  ],
  rune: [
    "runes",
    "rune reading",
  ],
} as const;

export type ResolvedSystemKey = keyof typeof SYSTEM_SYNONYMS;

function explicitMultiSystemRequest(message: string) {
  return /\b(combine|combined|both|together|plus|synthesis)\b/i.test(message)
    || /\b(?:and|plus)\b/i.test(message);
}

export function detectSystemsFromMessage(message: string): ResolvedSystemKey[] {
  const normalized = message.toLowerCase();
  const matches = Object.entries(SYSTEM_SYNONYMS)
    .map(([system, keywords]) => {
      const indexes = keywords
        .map((keyword) => normalized.indexOf(keyword.toLowerCase()))
        .filter((index) => index >= 0);

      if (indexes.length === 0) {
        return null;
      }

      return {
        system: system as ResolvedSystemKey,
        index: Math.min(...indexes),
      };
    })
    .filter((match): match is { system: ResolvedSystemKey; index: number } => Boolean(match))
    .sort((left, right) => left.index - right.index);

  return [...new Set(matches.map((match) => match.system))];
}

export function resolveSystems(message: string): ResolvedSystemKey[] {
  const detected = detectSystemsFromMessage(message);
  if (detected.length === 0) {
    if (message.toLowerCase().includes("astrology")) {
      return ["astrology_general"];
    }
    return [];
  }

  if (detected.length === 1) {
    return detected;
  }

  if (explicitMultiSystemRequest(message)) {
    return detected;
  }

  return [detected[0]];
}
