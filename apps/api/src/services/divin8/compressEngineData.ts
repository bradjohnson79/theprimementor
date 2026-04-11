import type { BlueprintData } from "../blueprint/types.js";

export interface CompressedEngineData {
  summary: string | null;
  keyInsights: string[];
  systemsUsed: string[];
  highlights: Record<string, unknown>;
}

function clampList(items: Array<string | null | undefined>, limit = 5) {
  return items
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean)
    .slice(0, limit);
}

function planetSignal(blueprint: BlueprintData, planetName: string) {
  const planet = blueprint.astrology?.planets.find((item) => item.planet === planetName);
  if (!planet) {
    return null;
  }

  return {
    sign: planet.sign,
    house: planet.house,
    nakshatra: planet.nakshatra,
    degree: `${planet.degree}.${planet.minute}`,
  };
}

function extractImportantSignals(blueprint: BlueprintData) {
  return {
    identity: {
      name: blueprint.client.fullBirthName,
      birthDate: blueprint.client.birthDate,
      birthTime: blueprint.client.birthTime,
      birthLocation: blueprint.client.birthLocation,
    },
    numerology: blueprint.numerology
      ? {
          lifePath: blueprint.numerology.lifePath,
          destiny: blueprint.numerology.destiny,
          soulUrge: blueprint.numerology.soulUrge,
          personality: blueprint.numerology.personality,
        }
      : null,
    astrology: blueprint.astrology
      ? {
          ascendant: blueprint.astrology.ascendant
            ? {
                sign: blueprint.astrology.ascendant.sign,
                nakshatra: blueprint.astrology.ascendant.nakshatra,
              }
            : null,
          sun: planetSignal(blueprint, "Sun"),
          moon: planetSignal(blueprint, "Moon"),
          doshas: (blueprint.astrology.doshas ?? []).filter((dosha) => dosha.present).map((dosha) => dosha.name),
        }
      : null,
    humanDesign: blueprint.humanDesign
      ? {
          type: blueprint.humanDesign.type,
          authority: blueprint.humanDesign.authority,
          profile: blueprint.humanDesign.profile,
          strategy: blueprint.humanDesign.strategy,
        }
      : null,
    chinese: blueprint.chinese
      ? {
          zodiacAnimal: blueprint.chinese.zodiacAnimal,
          element: blueprint.chinese.element,
          yinYang: blueprint.chinese.yinYang,
        }
      : null,
    kabbalah: blueprint.kabbalah
      ? {
          dominantSephira: blueprint.kabbalah.dominantSephira.name,
          soulCorrectionThemes: clampList(blueprint.kabbalah.soulCorrectionThemes, 3),
        }
      : null,
    rune: blueprint.rune
      ? {
          primaryRune: blueprint.rune.primaryRune.name,
          supportingRunes: blueprint.rune.supportingRunes.map((item) => item.name).slice(0, 2),
        }
      : null,
    derivedThemes: {
      coreIdentity: clampList(blueprint.derivedThemes.coreIdentity, 3),
      strengths: clampList(blueprint.derivedThemes.strengths, 3),
      challenges: clampList(blueprint.derivedThemes.challenges, 3),
      lifeDirection: clampList(blueprint.derivedThemes.lifeDirection, 3),
      relationshipPatterns: clampList(blueprint.derivedThemes.relationshipPatterns, 2),
      karmicThemes: clampList(blueprint.derivedThemes.karmicThemes, 2),
    },
  };
}

function buildSummary(blueprint: BlueprintData, systemsUsed: string[]) {
  const summaryParts: string[] = [];

  summaryParts.push(
    `Client ${blueprint.client.fullBirthName} was born on ${blueprint.client.birthDate}${blueprint.client.birthTime ? ` at ${blueprint.client.birthTime}` : ""}${blueprint.client.birthLocation ? ` in ${blueprint.client.birthLocation}` : ""}.`,
  );

  if (blueprint.numerology) {
    summaryParts.push(`Numerology highlights Life Path ${blueprint.numerology.lifePath} and Destiny ${blueprint.numerology.destiny}.`);
  }

  if (blueprint.astrology?.ascendant) {
    summaryParts.push(
      `Astrology highlights Ascendant ${blueprint.astrology.ascendant.sign} in ${blueprint.astrology.ascendant.nakshatra}.`,
    );
  }

  if (blueprint.humanDesign) {
    summaryParts.push(
      `Human Design highlights ${blueprint.humanDesign.type} with ${blueprint.humanDesign.authority} authority and ${blueprint.humanDesign.profile} profile.`,
    );
  }

  if (blueprint.chinese) {
    summaryParts.push(`Chinese astrology highlights ${blueprint.chinese.element} ${blueprint.chinese.zodiacAnimal}.`);
  }

  if (systemsUsed.length > 0) {
    summaryParts.push(`Systems used: ${systemsUsed.join(", ")}.`);
  }

  return summaryParts.join(" ");
}

export function compressEngineData(blueprint: BlueprintData): CompressedEngineData {
  const systemsUsed = Array.isArray(blueprint.meta?.systemsIncluded) ? blueprint.meta.systemsIncluded : [];
  const highlights = extractImportantSignals(blueprint);

  return {
    summary: buildSummary(blueprint, systemsUsed) || null,
    keyInsights: [
      ...clampList(blueprint.derivedThemes.coreIdentity, 2),
      ...clampList(blueprint.derivedThemes.strengths, 2),
      ...clampList(blueprint.derivedThemes.lifeDirection, 2),
    ].slice(0, 6),
    systemsUsed,
    highlights,
  };
}
