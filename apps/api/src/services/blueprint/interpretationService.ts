/**
 * Blueprint Interpretation Service — Chunked Section Pipeline
 *
 * Architecture:
 *   Phase 1: Extract minimal context per section
 *   Phase 2: Generate all sections in parallel (one GPT call each)
 *   Phase 3: Assemble sections into InterpretationReport
 *
 * Benefits:
 *   - No token overflow (each section ~400–800 tokens output)
 *   - Parallel execution (all sections fire simultaneously)
 *   - Per-section retry (one failed section doesn't kill the report)
 *   - Context-optimized (each section only receives relevant data)
 */

import OpenAI from "openai";
import { getReportTierDefinition, logger, type ReportTierId } from "@wisdom/utils";
import type { BlueprintData, InterpretationReport } from "./types.js";
import {
  DIVIN8_REPORT_MODEL,
  DIVIN8_REPORT_REASONING_BY_TIER,
  divin8UnavailableError,
} from "../divin8/brainPolicy.js";

const MAX_RETRIES = 2;

// ─── Context Extractors ───────────────────────────────────────────────────────

function fmtNumerology(bp: BlueprintData): string {
  const n = bp.numerology as any;
  if (!n) return "";
  return `NUMEROLOGY: Life Path ${n.lifePath} | Destiny ${n.destiny} | Soul Urge ${n.soulUrge} | Personality ${n.personality} | Maturity ${n.maturityNumber ?? "n/a"} | Birthday ${n.birthDay} | Dominant Planet: ${n.planetaryCorrelation?.dominantPlanet ?? "n/a"} | Challenges: [${n.challenges?.join(", ") ?? ""}] | Pinnacles: [${n.pinnacles?.join(", ") ?? ""}]`;
}

function fmtVedic(bp: BlueprintData): string {
  const a = bp.astrology as any;
  if (!a) return "";
  const sun = a.planets?.find((p: any) => p.planet === "Sun");
  const moon = a.planets?.find((p: any) => p.planet === "Moon");
  const asc = a.ascendant
    ? `${a.ascendant.sign} ${a.ascendant.degree}°${a.ascendant.minute}' (${a.ascendant.nakshatra} pada ${a.ascendant.nakshatraPada})`
    : "not available (no birth time)";
  const lagnaLord = a.lagnaLord
    ? `${a.lagnaLord.planet} in ${a.lagnaLord.placement.sign} House ${a.lagnaLord.placement.house}`
    : "n/a";
  const doshas = a.doshas?.filter((d: any) => d.present).map((d: any) => d.name).join(", ") || "none";
  const retros = a.retrogrades?.join(", ") || "none";
  return `VEDIC ASTROLOGY (Lahiri sidereal, confidence: ${a.confidence}): Ascendant: ${asc} | Lagna Lord: ${lagnaLord} | Ascendant Strength: ${a.ascendantStrength?.score ?? "n/a"}/10 | Sun: ${sun?.sign} H${sun?.house} ${sun?.nakshatra} | Moon: ${moon?.sign} H${moon?.house} ${moon?.nakshatra} | Rahu: ${a.nodes?.rahu?.sign} H${a.nodes?.rahu?.house} | Ketu: ${a.nodes?.ketu?.sign} H${a.nodes?.ketu?.house} | Retrogrades: ${retros} | Active Doshas: ${doshas}`;
}

function fmtVedicDecision(bp: BlueprintData): string {
  const a = bp.astrology as any;
  if (!a) return "";
  const lagnaLord = a.lagnaLord
    ? `${a.lagnaLord.planet} in ${a.lagnaLord.placement.sign} House ${a.lagnaLord.placement.house}`
    : "n/a";
  const aspects = a.ascendantAspects?.map((asp: any) => `${asp.planet} (${asp.aspectType})`).join(", ") || "none";
  const strength = a.ascendantStrength?.score ?? "n/a";
  return `VEDIC (decision-relevant): Lagna Lord ${lagnaLord} | Ascendant Strength ${strength}/10 | Aspects to Ascendant: ${aspects}`;
}

function fmtVedicKarmic(bp: BlueprintData): string {
  const a = bp.astrology as any;
  if (!a) return "";
  const doshas = a.doshas?.filter((d: any) => d.present).map((d: any) => `${d.name}: ${d.description ?? ""}`).join("; ") || "none";
  return `VEDIC (karmic-relevant): Rahu ${a.nodes?.rahu?.sign} H${a.nodes?.rahu?.house} | Ketu ${a.nodes?.ketu?.sign} H${a.nodes?.ketu?.house} | Retrogrades: ${a.retrogrades?.join(", ") || "none"} | Active Doshas: ${doshas}`;
}

function fmtHumanDesign(bp: BlueprintData): string {
  const hd = (bp as any).humanDesign;
  if (!hd) return "";
  return `HUMAN DESIGN: Type: ${hd.type} | Strategy: ${hd.strategy} | Authority: ${hd.authority} | Profile: ${hd.profile} | Definition: ${hd.definition} | Not-Self Theme: ${hd.notSelf} | Active Channels: ${hd.channels?.join(", ") || "none"} | Gates: ${hd.gates?.slice(0, 10).join(", ") || "none"}`;
}

function fmtChinese(bp: BlueprintData): string {
  const c = bp.chinese;
  if (c == null) return "";
  return `CHINESE ASTROLOGY (BaZi): Zodiac: ${c.zodiacAnimal} | Element: ${c.element} ${c.yinYang} | Year Pillar: ${c.pillars?.year?.heavenlyStem} ${c.pillars?.year?.earthlyBranch} (${c.pillars?.year?.element}) | Day Pillar: ${c.pillars?.day?.heavenlyStem} ${c.pillars?.day?.earthlyBranch}`;
}

function fmtKabbalah(bp: BlueprintData): string {
  const k = (bp as any).kabbalah;
  if (!k) return "";
  return `KABBALAH: Dominant Sephira: ${k.dominantSephira?.name} — ${k.dominantSephira?.meaning} (${k.dominantSephira?.quality}) | Soul Correction: ${k.soulCorrectionThemes?.join(" | ")}`;
}

function fmtRune(bp: BlueprintData): string {
  const r = (bp as any).rune;
  if (!r) return "";
  return `RUNE ORACLE: Primary: ${r.primaryRune?.name} (${r.primaryRune?.meaning}) | Supporting: ${r.supportingRunes?.map((s: any) => s.name).join(", ")}`;
}

function fmtPhysiognomy(bp: BlueprintData): string {
  const p = bp.physiognomy as
    | { interpretation?: string; analysis?: string; disclaimer?: string; confidence?: string }
    | null
    | undefined;
  if (p == null) return "";
  const narrative =
    typeof p.interpretation === "string"
      ? p.interpretation
      : typeof p.analysis === "string"
        ? p.analysis
        : "";
  const disc = typeof p.disclaimer === "string" ? p.disclaimer : "";
  const conf = p.confidence === "symbolic" ? "symbolic" : "symbolic";
  if (!narrative && !disc) return "";
  return `PHYSIOGNOMY (symbolic energetic impression only; confidence ${conf} — not factual, medical, or diagnostic): ${narrative}\nFraming: ${disc}`;
}

// ─── Section Definitions ──────────────────────────────────────────────────────

type TierName = ReportTierId;

interface SectionDef {
  /** Unique key — maps to InterpretationReport field */
  key: keyof InterpretationReport;
  /** Section-specific system prompt (focused task) */
  systemPrompt: string;
  /** Extract only relevant context from blueprint */
  buildContext: (bp: BlueprintData, name: string) => string;
  /** Max output tokens for this section */
  maxTokens: number;
  /** Depth instructions per tier */
  depthByTier: Record<TierName, string>;
}

const SECTION_DEFS: SectionDef[] = [
  {
    key: "overview",
    systemPrompt: "You are a metaphysical counselor. Write a cross-system synthesis — weave insights from multiple traditions into a cohesive overview of this person. Be specific, warm, and grounded. Plain prose only.",
    buildContext: (bp, name) => [
      `Person: ${name}`,
      fmtNumerology(bp),
      fmtVedic(bp),
      fmtHumanDesign(bp),
      fmtChinese(bp),
      fmtKabbalah(bp),
      fmtPhysiognomy(bp),
    ].filter(Boolean).join("\n"),
    maxTokens: 700,
    depthByTier: {
      intro:     "Write 2 paragraphs. Weave 2–3 systems together. Be specific with actual values.",
      deep_dive: "Write 3 paragraphs. Synthesize all available systems. Find cross-system themes.",
      initiate:  "Write 4 paragraphs. Full multi-system synthesis. Reference specific values from each system.",
    },
  },
  {
    key: "coreIdentity",
    systemPrompt: "You are a metaphysical counselor. Describe who this person is at their core — their soul essence, natural way of being, and fundamental nature. Grounded, specific, no generic affirmations.",
    buildContext: (bp, name) => [
      `Person: ${name}`,
      fmtNumerology(bp),
      fmtVedic(bp),
      fmtHumanDesign(bp),
    ].filter(Boolean).join("\n"),
    maxTokens: 600,
    depthByTier: {
      intro:     "Write 2 paragraphs. Focus on life path, sun sign, and HD type.",
      deep_dive: "Write 3 paragraphs. Include ascendant, lagna lord, and authority.",
      initiate:  "Write 4 paragraphs. Full identity synthesis — number, star, design, and kabbalah essence.",
    },
  },
  {
    key: "strengths",
    systemPrompt: "You are a metaphysical counselor. Identify and describe this person's innate strengths and gifts as revealed by their blueprint. Avoid vague adjectives — be precise and reference the data.",
    buildContext: (bp, name) => [
      `Person: ${name}`,
      fmtNumerology(bp),
      fmtVedic(bp),
      fmtHumanDesign(bp),
      fmtKabbalah(bp),
    ].filter(Boolean).join("\n"),
    maxTokens: 550,
    depthByTier: {
      intro:     "2 paragraphs. 3–4 concrete strengths from 2 systems.",
      deep_dive: "3 paragraphs. Cross-system strengths with specific values.",
      initiate:  "3–4 paragraphs. Full strengths map including karmic gifts and sephirot.",
    },
  },
  {
    key: "challenges",
    systemPrompt: "You are a metaphysical counselor. Identify the growth areas, blind spots, and challenges shown in this blueprint. Be honest but compassionate. Frame challenges as invitations to growth.",
    buildContext: (bp, name) => [
      `Person: ${name}`,
      fmtNumerology(bp),
      fmtVedicKarmic(bp),
      fmtHumanDesign(bp),
      fmtKabbalah(bp),
    ].filter(Boolean).join("\n"),
    maxTokens: 550,
    depthByTier: {
      intro:     "2 paragraphs. Focus on numerology challenges and HD not-self theme.",
      deep_dive: "3 paragraphs. Include doshas, retrogrades, and soul correction themes.",
      initiate:  "3–4 paragraphs. Deep shadow mapping — doshas, karmic nodes, soul correction, not-self.",
    },
  },
  {
    key: "lifeDirection",
    systemPrompt: "You are a metaphysical counselor. Describe this person's life purpose, direction, and trajectory as shown by their blueprint. What are they here to do and become? Be practical and visionary.",
    buildContext: (bp, name) => [
      `Person: ${name}`,
      fmtNumerology(bp),
      fmtVedic(bp),
      fmtVedicKarmic(bp),
      fmtHumanDesign(bp),
    ].filter(Boolean).join("\n"),
    maxTokens: 600,
    depthByTier: {
      intro:     "2 paragraphs. Life path, lagnaLord placement, and HD strategy.",
      deep_dive: "3 paragraphs. Full direction analysis — purpose, Rahu path, HD type.",
      initiate:  "4 paragraphs. Life mission, karmic trajectory, Rahu direction, and integration path.",
    },
  },
  {
    key: "relationships",
    systemPrompt: "You are a metaphysical counselor. Describe this person's patterns in relationships — how they love, connect, give, and receive. Use the blueprint data to illuminate relational dynamics.",
    buildContext: (bp, name) => [
      `Person: ${name}`,
      fmtNumerology(bp),
      fmtVedic(bp),
      fmtHumanDesign(bp),
      fmtChinese(bp),
    ].filter(Boolean).join("\n"),
    maxTokens: 550,
    depthByTier: {
      intro:     "2 paragraphs. Moon sign, soul urge, and HD authority in relationships.",
      deep_dive: "3 paragraphs. Moon, venus (if available), HD authority, and BaZi compatibility.",
      initiate:  "3–4 paragraphs. Full relational blueprint — moon dynamics, authority, soul urge, and karmic patterns.",
    },
  },
  {
    key: "practices",
    systemPrompt: "You are a metaphysical counselor. Recommend concrete, specific spiritual and personal growth practices tailored to this exact blueprint. Each suggestion must connect to actual data in the blueprint.",
    buildContext: (bp, name) => [
      `Person: ${name}`,
      fmtNumerology(bp),
      fmtVedic(bp),
      fmtHumanDesign(bp),
      fmtKabbalah(bp),
      fmtRune(bp),
    ].filter(Boolean).join("\n"),
    maxTokens: 600,
    depthByTier: {
      intro:     "2 paragraphs. 3–4 specific practices tied to their core numbers and design.",
      deep_dive: "3 paragraphs. Practices for numerology, Vedic remedies, and HD experiment.",
      initiate:  "4 paragraphs. Full practice stack — numerical, astrological remedies, HD experiment, kabbalah work, rune medicine.",
    },
  },
  {
    key: "closingGuidance",
    systemPrompt: "You are a metaphysical counselor. Write a closing message that grounds and affirms this person. Warm, direct, and specific to their blueprint. End with a single clear invitation or insight for their next step.",
    buildContext: (bp, name) => [
      `Person: ${name}`,
      fmtNumerology(bp),
      fmtVedic(bp),
      fmtHumanDesign(bp),
    ].filter(Boolean).join("\n"),
    maxTokens: 400,
    depthByTier: {
      intro:     "1 paragraph. Warm, grounding, specific to their core numbers and design.",
      deep_dive: "1–2 paragraphs. Reference 2–3 systems in a unified closing.",
      initiate:  "2 paragraphs. Full synthesis closing — affirm their path, honor the depth, clear invitation.",
    },
  },
];

// Sections active per tier
const TIER_SECTIONS: Record<TierName, Array<keyof InterpretationReport>> = {
  intro: ["overview", "coreIdentity", "strengths", "challenges", "lifeDirection", "relationships", "practices", "closingGuidance"],
  deep_dive: ["overview", "coreIdentity", "strengths", "challenges", "lifeDirection", "relationships", "practices", "closingGuidance"],
  initiate: ["overview", "coreIdentity", "strengths", "challenges", "lifeDirection", "relationships", "practices", "closingGuidance"],
};

// ─── Section Generator (with retry) ──────────────────────────────────────────

async function generateSection(
  openai: OpenAI,
  def: SectionDef,
  blueprint: BlueprintData,
  name: string,
  tier: TierName,
): Promise<string> {
  const tierDefinition = getReportTierDefinition(tier);
  const context = def.buildContext(blueprint, name);
  const depthInstruction = def.depthByTier[tier];
  const reasoningEffort = DIVIN8_REPORT_REASONING_BY_TIER[tier];
  const systemsContext = JSON.stringify({
    systems: blueprint.systems,
    systemsIncluded: blueprint.meta?.systemsIncluded ?? [],
    reportTier: blueprint.meta?.reportTier ?? tier,
  });
  const userPrompt = [
    `BLUEPRINT.SYSTEMS: ${systemsContext}`,
    `TIER LABEL: ${tierDefinition.label}`,
    `TIER MODEL: ${DIVIN8_REPORT_MODEL}`,
    `TIER REASONING STRATEGY: ${reasoningEffort}`,
    `OUTPUT STYLE: ${tierDefinition.outputStyle}`,
    context,
    depthInstruction,
    "Do not ramble, do not become abstract, and do not break structure.",
    "Return ONLY plain prose — no markdown, no headers, no JSON.",
  ].join("\n\n");

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await openai.chat.completions.create({
        model: DIVIN8_REPORT_MODEL,
        messages: [
          {
            role: "system",
            content: `${def.systemPrompt}\nReasoning effort: ${reasoningEffort}. Maintain clarity and structure. Avoid rambling or vague mysticism.`,
          },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.75,
        max_completion_tokens: def.maxTokens,
      });

      const content = response.choices[0]?.message?.content?.trim();
      if (!content) throw new Error("Empty response from model");
      return content;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, 1000 * attempt));
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

// ─── Helper: resolve person name ─────────────────────────────────────────────

function resolveName(blueprint: BlueprintData): string {
  return (blueprint as any).core?.birthData?.fullBirthName
    ?? blueprint.client?.fullBirthName
    ?? "the client";
}

// ─── Main Export ──────────────────────────────────────────────────────────────

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
  const activeSectionKeys = TIER_SECTIONS[tier];
  const activeDefs = SECTION_DEFS.filter((d) => activeSectionKeys.includes(d.key));

  logger.info("interpretation_generation_started", {
    sectionCount: activeDefs.length,
    tier,
    person: name,
  });

  // Fire all sections concurrently
  const results = await Promise.all(
    activeDefs.map((def) => generateSection(openai, def, blueprint, name, tier)),
  );

  // Map results back to section keys
  const sectionMap: Record<string, string> = {};
  activeDefs.forEach((def, i) => {
    sectionMap[def.key] = results[i];
  });

  const report: InterpretationReport = {
    overview:        sectionMap.overview        ?? "",
    coreIdentity:    sectionMap.coreIdentity    ?? "",
    strengths:       sectionMap.strengths       ?? "",
    challenges:      sectionMap.challenges      ?? "",
    lifeDirection:   sectionMap.lifeDirection   ?? "",
    relationships:   sectionMap.relationships   ?? "",
    practices:       sectionMap.practices       ?? "",
    closingGuidance: sectionMap.closingGuidance ?? "",
  };

  return report;
}
