import OpenAI from "openai";
import {
  SECTION_MARKDOWN_LABELS,
  getReportTierDefinition,
  logger,
  type ReportTierId,
} from "@wisdom/utils";
import type { BlueprintData, InterpretationReport } from "./types.js";
import { buildForecastContext } from "./reportForecastService.js";
import {
  DIVIN8_REPORT_MODEL,
  DIVIN8_REPORT_REASONING_CONFIG_BY_TIER,
  buildDeepThinkingInstruction,
  divin8UnavailableError,
} from "../divin8/brainPolicy.js";

const MAX_RETRIES = 2;
const REPORT_TIMEZONE = "America/Vancouver";

type TierName = ReportTierId;
type NarrativeSectionKey = Exclude<keyof InterpretationReport, "forecast">;

interface SectionDef {
  key: NarrativeSectionKey;
  systemPrompt: string;
  buildContext: (bp: BlueprintData, name: string) => string;
  maxTokens: number;
  depthByTier: Record<TierName, string>;
}

interface SectionEnvelope {
  sections: Array<{ title: string; content: string }>;
}

interface ForecastEnvelope {
  entries: Array<{ month: string; content: string }>;
}

function fmtNumerology(bp: BlueprintData): string {
  const n = bp.numerology as {
    lifePath?: number;
    destiny?: number;
    soulUrge?: number;
    personality?: number;
    maturityNumber?: number;
    birthDay?: number;
    challenges?: number[];
    pinnacles?: number[];
    planetaryCorrelation?: { dominantPlanet?: string };
  } | null;
  if (!n) return "";
  return `NUMEROLOGY: Life Path ${n.lifePath} | Destiny ${n.destiny} | Soul Urge ${n.soulUrge} | Personality ${n.personality} | Maturity ${n.maturityNumber ?? "n/a"} | Birthday ${n.birthDay} | Dominant Planet: ${n.planetaryCorrelation?.dominantPlanet ?? "n/a"} | Challenges: [${n.challenges?.join(", ") ?? ""}] | Pinnacles: [${n.pinnacles?.join(", ") ?? ""}]`;
}

function fmtVedic(bp: BlueprintData): string {
  const a = bp.astrology;
  if (!a) return "";
  const sun = a.planets.find((planet) => planet.planet === "Sun");
  const moon = a.planets.find((planet) => planet.planet === "Moon");
  const asc = a.ascendant
    ? `${a.ascendant.sign} ${a.ascendant.degree}deg ${a.ascendant.minute}' (${a.ascendant.nakshatra} pada ${a.ascendant.nakshatraPada})`
    : "not available (no birth time)";
  const lagnaLord = a.lagnaLord
    ? `${a.lagnaLord.planet} in ${a.lagnaLord.placement.sign} House ${a.lagnaLord.placement.house}`
    : "n/a";
  const doshas = a.doshas.filter((dosha) => dosha.present).map((dosha) => dosha.name).join(", ") || "none";
  const retros = a.retrogrades.join(", ") || "none";
  return `VEDIC ASTROLOGY (Lahiri sidereal, confidence: ${a.confidence}): Ascendant: ${asc} | Lagna Lord: ${lagnaLord} | Ascendant Strength: ${a.ascendantStrength?.score ?? "n/a"}/10 | Sun: ${sun?.sign} H${sun?.house} ${sun?.nakshatra} | Moon: ${moon?.sign} H${moon?.house} ${moon?.nakshatra} | Rahu: ${a.nodes.rahu.sign} H${a.nodes.rahu.house} | Ketu: ${a.nodes.ketu.sign} H${a.nodes.ketu.house} | Retrogrades: ${retros} | Active Doshas: ${doshas}`;
}

function fmtVedicDecision(bp: BlueprintData): string {
  const a = bp.astrology;
  if (!a) return "";
  const lagnaLord = a.lagnaLord
    ? `${a.lagnaLord.planet} in ${a.lagnaLord.placement.sign} House ${a.lagnaLord.placement.house}`
    : "n/a";
  const aspects = a.ascendantAspects.map((aspect) => `${aspect.planet} (${aspect.aspectType})`).join(", ") || "none";
  const strength = a.ascendantStrength?.score ?? "n/a";
  return `VEDIC (decision-relevant): Lagna Lord ${lagnaLord} | Ascendant Strength ${strength}/10 | Aspects to Ascendant: ${aspects}`;
}

function fmtVedicKarmic(bp: BlueprintData): string {
  const a = bp.astrology;
  if (!a) return "";
  const doshas = a.doshas
    .filter((dosha) => dosha.present)
    .map((dosha) => `${dosha.name}: ${dosha.description ?? ""}`)
    .join("; ") || "none";
  return `VEDIC (karmic-relevant): Rahu ${a.nodes.rahu.sign} H${a.nodes.rahu.house} | Ketu ${a.nodes.ketu.sign} H${a.nodes.ketu.house} | Retrogrades: ${a.retrogrades.join(", ") || "none"} | Active Doshas: ${doshas}`;
}

function fmtHumanDesign(bp: BlueprintData): string {
  const hd = bp.humanDesign;
  if (!hd) return "";
  return `HUMAN DESIGN: Type: ${hd.type} | Strategy: ${hd.strategy} | Authority: ${hd.authority} | Profile: ${hd.profile} | Definition: ${hd.definition} | Not-Self Theme: ${hd.notSelf} | Active Channels: ${hd.channels.join(", ") || "none"} | Gates: ${hd.gates.slice(0, 10).join(", ") || "none"}`;
}

function fmtChinese(bp: BlueprintData): string {
  const c = bp.chinese;
  if (!c) return "";
  return `CHINESE ASTROLOGY (BaZi): Zodiac: ${c.zodiacAnimal} | Element: ${c.element} ${c.yinYang} | Year Pillar: ${c.pillars?.year?.heavenlyStem} ${c.pillars?.year?.earthlyBranch} (${c.pillars?.year?.element}) | Day Pillar: ${c.pillars?.day?.heavenlyStem} ${c.pillars?.day?.earthlyBranch}`;
}

function fmtKabbalah(bp: BlueprintData): string {
  const k = bp.kabbalah;
  if (!k) return "";
  return `KABBALAH: Dominant Sephira: ${k.dominantSephira?.name} - ${k.dominantSephira?.meaning} (${k.dominantSephira?.quality}) | Soul Correction: ${k.soulCorrectionThemes?.join(" | ")}`;
}

function fmtRune(bp: BlueprintData): string {
  const r = bp.rune;
  if (!r) return "";
  return `RUNE ORACLE: Primary: ${r.primaryRune?.name} (${r.primaryRune?.meaning}) | Supporting: ${r.supportingRunes?.map((entry) => entry.name).join(", ")}`;
}

function fmtPhysiognomy(bp: BlueprintData): string {
  const p = bp.physiognomy;
  if (!p) return "";
  const narrative = typeof p.interpretation === "string" ? p.interpretation : "";
  const disclaimer = typeof p.disclaimer === "string" ? p.disclaimer : "";
  if (!narrative && !disclaimer) return "";
  return `PHYSIOGNOMY (symbolic energetic impression only; not factual, medical, or diagnostic): ${narrative}\nFraming: ${disclaimer}`;
}

const SECTION_DEFS: SectionDef[] = [
  {
    key: "overview",
    systemPrompt: "You are a metaphysical counselor. Write a cross-system synthesis that frames the person clearly and concretely.",
    buildContext: (bp, name) => [
      `Person: ${name}`,
      fmtNumerology(bp),
      fmtVedic(bp),
      fmtHumanDesign(bp),
      fmtChinese(bp),
      fmtKabbalah(bp),
      fmtPhysiognomy(bp),
    ].filter(Boolean).join("\n"),
    maxTokens: 900,
    depthByTier: {
      intro: "Write exactly 2 paragraphs. Weave 2-3 systems together and stay concrete.",
      deep_dive: "Write 3 paragraphs. Build a layered synthesis across all relevant systems.",
      initiate: "Write 4 paragraphs. Deliver a high-depth multi-system synthesis with precise references.",
    },
  },
  {
    key: "coreIdentity",
    systemPrompt: "You are a metaphysical counselor. Describe the person's core nature, soul orientation, and stable baseline identity.",
    buildContext: (bp, name) => [
      `Person: ${name}`,
      fmtNumerology(bp),
      fmtVedic(bp),
      fmtHumanDesign(bp),
      fmtKabbalah(bp),
    ].filter(Boolean).join("\n"),
    maxTokens: 850,
    depthByTier: {
      intro: "Write exactly 2 paragraphs. Focus on stable identity signals and avoid generic reassurance.",
      deep_dive: "Write 3 paragraphs. Include how core identity expresses through multiple systems.",
      initiate: "Write 4 paragraphs. Show the soul-level pattern beneath surface personality.",
    },
  },
  {
    key: "strengths",
    systemPrompt: "You are a metaphysical counselor. Identify the person's strongest usable gifts and show how those gifts operate in practice.",
    buildContext: (bp, name) => [
      `Person: ${name}`,
      fmtNumerology(bp),
      fmtVedic(bp),
      fmtHumanDesign(bp),
      fmtKabbalah(bp),
      fmtRune(bp),
    ].filter(Boolean).join("\n"),
    maxTokens: 850,
    depthByTier: {
      intro: "Write exactly 2 paragraphs. Name 3-4 specific strengths and what they help the person do.",
      deep_dive: "Write 3 paragraphs. Show cross-system gifts and where they become most effective.",
      initiate: "Write 4 paragraphs. Include subtle strengths, karmic gifts, and long-range advantages.",
    },
  },
  {
    key: "challenges",
    systemPrompt: "You are a metaphysical counselor. Describe the main friction patterns, blind spots, and recurring challenges in a compassionate but exact way.",
    buildContext: (bp, name) => [
      `Person: ${name}`,
      fmtNumerology(bp),
      fmtVedicKarmic(bp),
      fmtHumanDesign(bp),
      fmtKabbalah(bp),
    ].filter(Boolean).join("\n"),
    maxTokens: 850,
    depthByTier: {
      intro: "Write exactly 2 paragraphs. Focus on the clearest two or three challenge patterns.",
      deep_dive: "Write 3 paragraphs. Distinguish root patterns from secondary symptoms.",
      initiate: "Write 4 paragraphs. Map karmic and behavioral challenges without vague spiritual language.",
    },
  },
  {
    key: "lifeDirection",
    systemPrompt: "You are a metaphysical counselor. Describe the person's directional path, life orientation, and what aligned progress looks like.",
    buildContext: (bp, name) => [
      `Person: ${name}`,
      fmtNumerology(bp),
      fmtVedic(bp),
      fmtVedicKarmic(bp),
      fmtVedicDecision(bp),
      fmtHumanDesign(bp),
      fmtKabbalah(bp),
    ].filter(Boolean).join("\n"),
    maxTokens: 850,
    depthByTier: {
      intro: "Write exactly 2 paragraphs. Keep the direction practical, grounded, and actionable.",
      deep_dive: "Write 3 paragraphs. Show how purpose, timing, and right decision-making interact.",
      initiate: "Write 4 paragraphs. Connect purpose, karmic direction, and long-range mastery.",
    },
  },
  {
    key: "relationships",
    systemPrompt: "You are a metaphysical counselor. Describe how this person bonds, receives, protects, and reveals themselves in close relationships.",
    buildContext: (bp, name) => [
      `Person: ${name}`,
      fmtNumerology(bp),
      fmtVedic(bp),
      fmtHumanDesign(bp),
      fmtChinese(bp),
    ].filter(Boolean).join("\n"),
    maxTokens: 800,
    depthByTier: {
      intro: "Write exactly 2 paragraphs. Focus on the strongest relational dynamics and needs.",
      deep_dive: "Write 3 paragraphs. Show how emotional, energetic, and decision patterns affect bonds.",
      initiate: "Write 4 paragraphs. Include repeating karmic relational patterns and the needed adjustment.",
    },
  },
  {
    key: "closingGuidance",
    systemPrompt: "You are a metaphysical counselor. Write a grounding synthesis that consolidates the report into a clear next orientation.",
    buildContext: (bp, name) => [
      `Person: ${name}`,
      fmtNumerology(bp),
      fmtVedic(bp),
      fmtHumanDesign(bp),
      fmtKabbalah(bp),
    ].filter(Boolean).join("\n"),
    maxTokens: 650,
    depthByTier: {
      intro: "Write exactly 2 paragraphs. Consolidate the report into one grounded next orientation.",
      deep_dive: "Write 2-3 paragraphs. Bring the report together without repeating whole sections.",
      initiate: "Write 3 paragraphs. Resolve the synthesis into a precise invitation for aligned action.",
    },
  },
  {
    key: "practices",
    systemPrompt: "You are a metaphysical counselor. Recommend embodiment practices that must bridge interpretation into action with one mudra and one mantra tied to identified patterns.",
    buildContext: (bp, name) => [
      `Person: ${name}`,
      fmtNumerology(bp),
      fmtVedic(bp),
      fmtVedicKarmic(bp),
      fmtHumanDesign(bp),
      fmtKabbalah(bp),
      fmtRune(bp),
    ].filter(Boolean).join("\n"),
    maxTokens: 700,
    depthByTier: {
      intro: "Write exactly 2 paragraphs. Paragraph 1 must start with 'Mudra:' and paragraph 2 must start with 'Mantra:'.",
      deep_dive: "Write exactly 2 paragraphs. The mudra and mantra must each name the pattern or planetary tension they address.",
      initiate: "Write 2-3 paragraphs. Start with 'Mudra:' then 'Mantra:' and make each recommendation deeply tied to the earlier synthesis.",
    },
  },
];

const TIER_SECTIONS: Record<TierName, NarrativeSectionKey[]> = {
  intro: ["overview", "coreIdentity", "strengths", "challenges", "lifeDirection", "relationships", "closingGuidance", "practices"],
  deep_dive: ["overview", "coreIdentity", "strengths", "challenges", "lifeDirection", "relationships", "closingGuidance", "practices"],
  initiate: ["overview", "coreIdentity", "strengths", "challenges", "lifeDirection", "relationships", "closingGuidance", "practices"],
};

function formatReportDateLabel(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: REPORT_TIMEZONE,
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(value);
}

function resolveName(blueprint: BlueprintData): string {
  return blueprint.core?.birthData?.fullBirthName ?? blueprint.client?.fullBirthName ?? "the client";
}

function safeJsonParse<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function buildPreviousSectionsDigest(
  sections: Array<{ key: NarrativeSectionKey; title: string; content: string }>,
) {
  if (sections.length === 0) {
    return "No previous sections have been generated yet.";
  }
  return sections
    .map((section, index) => {
      const excerpt = section.content.replace(/\s+/g, " ").trim().slice(0, 240);
      return `${index + 1}. ${section.title}: ${excerpt}`;
    })
    .join("\n");
}

function validateSectionEnvelope(
  payload: SectionEnvelope | null,
  expectedTitle: string,
) {
  if (!payload || !Array.isArray(payload.sections) || payload.sections.length !== 1) {
    throw new Error("Model returned invalid section envelope");
  }
  const [section] = payload.sections;
  if (typeof section?.content !== "string" || !section.content.trim()) {
    throw new Error("Model returned empty section content");
  }
  if (typeof section.title !== "string" || section.title.trim() !== expectedTitle) {
    throw new Error("Model returned the wrong section title");
  }
  return section.content.trim();
}

function validateForecastEnvelope(
  payload: ForecastEnvelope | null,
  expectedMonths: string[],
) {
  if (!payload || !Array.isArray(payload.entries) || payload.entries.length !== expectedMonths.length) {
    throw new Error("Model returned invalid forecast entries");
  }

  return expectedMonths.map((expectedMonth, index) => {
    const entry = payload.entries[index];
    if (!entry || typeof entry.month !== "string" || entry.month.trim() !== expectedMonth) {
      throw new Error("Model returned the wrong forecast month ordering");
    }
    if (typeof entry.content !== "string" || !entry.content.trim()) {
      throw new Error("Model returned empty forecast content");
    }
    return `${expectedMonth}: ${entry.content.trim()}`;
  }).join("\n\n");
}

async function generateNarrativeSection(
  openai: OpenAI,
  def: SectionDef,
  blueprint: BlueprintData,
  name: string,
  tier: TierName,
  reportDateLabel: string,
  previousSections: Array<{ key: NarrativeSectionKey; title: string; content: string }>,
): Promise<string> {
  const tierDefinition = getReportTierDefinition(tier);
  const reasoningConfig = DIVIN8_REPORT_REASONING_CONFIG_BY_TIER[tier];
  const title = SECTION_MARKDOWN_LABELS[def.key];
  const userPrompt = [
    `REPORT DATE: ${reportDateLabel}`,
    `PERSON: ${name}`,
    `TIER LABEL: ${tierDefinition.label}`,
    `OUTPUT STYLE: ${tierDefinition.outputStyle}`,
    `TARGET SECTION: ${title}`,
    `EXACT SECTION COUNT: Return exactly 1 section object.`,
    `NON-REPETITION RULE: This section must introduce new insight and must not repeat language or ideas already covered.`,
    `PREVIOUS SECTIONS:\n${buildPreviousSectionsDigest(previousSections)}`,
    `SECTION CONTEXT:\n${def.buildContext(blueprint, name)}`,
    `DEPTH:\n${def.depthByTier[tier]}`,
    "The response must be plain prose inside JSON, not markdown.",
    "Do not collapse sections into summary language. Do not omit concrete details. Do not use vague mysticism.",
    "Return JSON only in this exact shape: {\"sections\":[{\"title\":\"TARGET SECTION TITLE\",\"content\":\"...\"}]}",
  ].join("\n\n");

  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const response = await openai.chat.completions.create({
        model: DIVIN8_REPORT_MODEL,
        reasoning_effort: reasoningConfig.effort,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: [
              def.systemPrompt,
              `Reasoning effort: ${reasoningConfig.effort}.`,
              buildDeepThinkingInstruction(reasoningConfig.deepThinking),
              "Write with precision, progression, and on-brand warmth.",
            ].join(" "),
          },
          { role: "user", content: userPrompt },
        ],
        max_completion_tokens: def.maxTokens,
      });
      const raw = response.choices[0]?.message?.content?.trim();
      if (!raw) throw new Error("Empty response from model");
      return validateSectionEnvelope(safeJsonParse<SectionEnvelope>(raw), title);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < MAX_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      }
    }
  }

  logger.error("interpretation_section_failed", {
    section: def.key,
    attempts: MAX_RETRIES,
    message: lastError?.message ?? "unknown error",
  });
  throw divin8UnavailableError();
}

async function generateForecastSection(
  openai: OpenAI,
  blueprint: BlueprintData,
  name: string,
  tier: TierName,
  reportDate: Date,
): Promise<string> {
  const tierDefinition = getReportTierDefinition(tier);
  const reasoningConfig = DIVIN8_REPORT_REASONING_CONFIG_BY_TIER[tier];
  const forecastContext = await buildForecastContext(blueprint, tier, reportDate);
  const expectedMonths = forecastContext.months.map((month) => month.monthLabel);
  const monthPayload = forecastContext.months.map((month) => ({
    month: month.monthLabel,
    transitSummary: month.transitSummary,
    activatingAspects: month.activatingAspects.map((aspect) => ({
      transitBody: aspect.transitBody,
      natalBody: aspect.natalBody,
      aspect: aspect.aspect,
      orb: aspect.orbLabel,
    })),
  }));

  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const response = await openai.chat.completions.create({
        model: DIVIN8_REPORT_MODEL,
        reasoning_effort: reasoningConfig.effort,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: [
              "You are a metaphysical counselor writing a monthly forecast grounded in deterministic Swiss Ephemeris sidereal transit data.",
              `Reasoning effort: ${reasoningConfig.effort}.`,
              buildDeepThinkingInstruction(reasoningConfig.deepThinking),
              "Forecast must be specific, time-bound, and directional.",
              "Do not use vague phrases such as 'you may feel' or 'this could be a time'.",
              "For each month, state what is activating, what area it affects, and what action aligns with it.",
              "Do not repeat interpretation prose. Do not blend timeless character analysis into the forecast.",
            ].join(" "),
          },
          {
            role: "user",
            content: [
              `REPORT DATE: ${formatReportDateLabel(reportDate)}`,
              `PERSON: ${name}`,
              `TIER LABEL: ${tierDefinition.label}`,
              `EXACT MONTH COUNT: ${expectedMonths.length}`,
              `EXPECTED MONTH ORDER: ${expectedMonths.join(" | ")}`,
              `FORECAST DATA:\n${JSON.stringify(monthPayload, null, 2)}`,
              "Return JSON only in this exact shape: {\"entries\":[{\"month\":\"Month Year\",\"content\":\"...\"}]}",
            ].join("\n\n"),
          },
        ],
        max_completion_tokens: 900,
      });
      const raw = response.choices[0]?.message?.content?.trim();
      if (!raw) throw new Error("Empty forecast response from model");
      return validateForecastEnvelope(safeJsonParse<ForecastEnvelope>(raw), expectedMonths);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < MAX_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      }
    }
  }

  logger.error("interpretation_forecast_failed", {
    attempts: MAX_RETRIES,
    message: lastError?.message ?? "unknown error",
  });
  throw divin8UnavailableError();
}

export async function interpretBlueprint(
  blueprint: BlueprintData,
  tier: TierName = "intro",
): Promise<InterpretationReport> {
  if (!blueprint) throw new Error("interpretBlueprint: blueprint is null or undefined");
  const name = resolveName(blueprint);
  if (!name || name === "the client") {
    throw new Error("interpretBlueprint: could not resolve client name from blueprint");
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");

  const openai = new OpenAI({ apiKey });
  const reportDate = new Date();
  const reportDateLabel = formatReportDateLabel(reportDate);
  const activeDefs = SECTION_DEFS.filter((definition) => TIER_SECTIONS[tier].includes(definition.key));

  logger.info("interpretation_generation_started", {
    tier,
    person: name,
    sectionCount: activeDefs.length + 1,
    reportDate: reportDate.toISOString(),
  });

  const generatedSections: Array<{ key: NarrativeSectionKey; title: string; content: string }> = [];
  for (const def of activeDefs) {
    const content = await generateNarrativeSection(
      openai,
      def,
      blueprint,
      name,
      tier,
      reportDateLabel,
      generatedSections,
    );
    generatedSections.push({
      key: def.key,
      title: SECTION_MARKDOWN_LABELS[def.key],
      content,
    });
  }

  const forecast = await generateForecastSection(openai, blueprint, name, tier, reportDate);
  if (generatedSections.length + 1 !== 9) {
    throw new Error("Interpretation section count validation failed");
  }

  const sectionMap = new Map(generatedSections.map((section) => [section.key, section.content]));
  return {
    overview: sectionMap.get("overview") ?? "",
    coreIdentity: sectionMap.get("coreIdentity") ?? "",
    strengths: sectionMap.get("strengths") ?? "",
    challenges: sectionMap.get("challenges") ?? "",
    lifeDirection: sectionMap.get("lifeDirection") ?? "",
    relationships: sectionMap.get("relationships") ?? "",
    closingGuidance: sectionMap.get("closingGuidance") ?? "",
    practices: sectionMap.get("practices") ?? "",
    forecast,
  };
}
