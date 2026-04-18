import OpenAI from "openai";
import type { BlueprintData } from "./types.js";
import {
  DIVIN8_GENERATION_MODEL,
  DIVIN8_GENERATION_REASONING_CONFIG,
  buildDeepThinkingInstruction,
} from "../divin8/brainPolicy.js";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * I Ching GPT Service
 * Generates hexagram based on birth data and interprets
 */
export async function generateIChingReading(
  blueprint: BlueprintData,
): Promise<{
  hexagram: number;
  lines: number[];
  description: string;
}> {
  const prompt = `Based on this birth data, generate an I Ching reading:

Birth Date: ${blueprint.client.birthDate}
Birth Time: ${blueprint.client.birthTime || "unknown"}
${blueprint.numerology ? `Life Path: ${blueprint.numerology.lifePath}` : ""}

Generate a hexagram number (1-64) that resonates with this person's life energy.
Provide the 6 lines (each 0 for broken/yin or 1 for solid/yang, bottom to top).
Give a 2-3 paragraph interpretation of what this hexagram means for their life path.

Respond in JSON format:
{
  "hexagram": <number 1-64>,
  "lines": [<6 numbers, each 0 or 1>],
  "description": "<interpretation text>"
}`;

  const response = await openai.chat.completions.create({
    model: DIVIN8_GENERATION_MODEL,
    reasoning_effort: DIVIN8_GENERATION_REASONING_CONFIG.effort,
    messages: [
      {
        role: "system",
        content:
          `You are an expert in I Ching divination. Generate authentic hexagram readings based on birth data. ${buildDeepThinkingInstruction(DIVIN8_GENERATION_REASONING_CONFIG.deepThinking)}`,
      },
      { role: "user", content: prompt },
    ],
    response_format: { type: "json_object" },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("No I Ching response from GPT");
  }

  const result = JSON.parse(content);
  return {
    hexagram: result.hexagram,
    lines: result.lines,
    description: result.description,
  };
}

/**
 * Body Map GPT Service
 * Numerology-based body energy centers
 */
export async function generateBodyMap(
  blueprint: BlueprintData,
): Promise<{
  profile: string;
  centers: Record<string, string>;
}> {
  if (!blueprint.numerology) {
    throw new Error("Numerology data required for Body Map");
  }

  const prompt = `Based on these numerology values, create a Body Map profile:

Life Path: ${blueprint.numerology.lifePath}
Birth Day: ${blueprint.numerology.birthDay}
Destiny: ${blueprint.numerology.destiny}
Soul Urge: ${blueprint.numerology.soulUrge}
Personality: ${blueprint.numerology.personality}

Map these numbers to 9 body energy centers (Head, Throat, Heart, Solar Plexus, Sacral, Root, Left Hand, Right Hand, Feet).
For each center, describe which numbers activate it and what energy/qualities it holds for this person.
Also provide a 2-paragraph overall profile summary.

Respond in JSON format:
{
  "profile": "<overall summary>",
  "centers": {
    "head": "<description>",
    "throat": "<description>",
    "heart": "<description>",
    "solarPlexus": "<description>",
    "sacral": "<description>",
    "root": "<description>",
    "leftHand": "<description>",
    "rightHand": "<description>",
    "feet": "<description>"
  }
}`;

  const response = await openai.chat.completions.create({
    model: DIVIN8_GENERATION_MODEL,
    reasoning_effort: DIVIN8_GENERATION_REASONING_CONFIG.effort,
    messages: [
      {
        role: "system",
        content:
          `You are an expert in numerology-based body mapping and energy work. ${buildDeepThinkingInstruction(DIVIN8_GENERATION_REASONING_CONFIG.deepThinking)}`,
      },
      { role: "user", content: prompt },
    ],
    response_format: { type: "json_object" },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("No Body Map response from GPT");
  }

  const result = JSON.parse(content);
  return {
    profile: result.profile,
    centers: result.centers,
  };
}

/**
 * Physiognomy GPT Service — Symbolic/Energetic Interpretation
 *
 * COMPLIANCE NOTE:
 * This service frames visual input as symbolic and energetic interpretation only.
 * It does NOT make diagnostic, scientific, or personality claims.
 * All outputs are framed as impressionistic and non-deterministic.
 */
export async function generatePhysiognomyReading(
  blueprint: BlueprintData,
  /** Public URL or `data:image/...;base64,...` for OpenAI vision */
  imageUrl?: string,
): Promise<{
  interpretation: string;
  features: Record<string, string>;
  disclaimer: string;
  confidence: "symbolic";
}> {
  if (!imageUrl) {
    throw new Error("Image input required for symbolic interpretation reading");
  }

  const SYSTEM_PROMPT = `You are assisting with a metaphysical blueprint system that offers symbolic, energetic interpretation.

CRITICAL RULES — YOU MUST FOLLOW THESE WITHOUT EXCEPTION:
- Do NOT identify or attempt to identify the person
- Do NOT infer sensitive attributes (race, ethnicity, health conditions, intelligence, sexual orientation, religion)
- Do NOT make definitive personality judgments from appearance
- Do NOT state anything as factual or diagnostic
- Do NOT use language like "this reveals", "proves", or "indicates with certainty"

YOUR ROLE:
- Offer symbolic and energetic impressions based on visual presence
- Describe the quality of expression, energetic presence, and symbolic imagery you observe
- Frame everything as interpretive, reflective, and non-absolute
- Use language such as: "may suggest", "carries a quality of", "energetically expresses", "symbolically resonates with"

TONE: grounded, observational, warm, non-judgmental
DISCLAIMER: All output is symbolic interpretation and must not be treated as factual assessment.

Return a JSON object with keys: analysis (2–3 paragraphs of symbolic impressions), features (forehead, eyes, nose, mouth, chin, faceShape — each a 1–2 sentence symbolic impression), disclaimer (one-sentence non-diagnostic statement).`;

  const USER_PROMPT = `Provide a symbolic and energetic visual interpretation for this person's blueprint.

Context from their metaphysical profile:
${blueprint.numerology ? `- Life Path: ${(blueprint.numerology as any).lifePath} (${(blueprint.numerology as any).planetaryCorrelation?.dominantPlanet ?? "n/a"} influence)` : ""}
${(blueprint.astrology as any)?.ascendant ? `- Vedic Ascendant: ${(blueprint.astrology as any).ascendant.sign}` : ""}

Using the image as visual context, describe:
1. The symbolic energetic quality of their presence and expression
2. Energetic impressions from key facial areas (symbolic, not diagnostic)
3. How their visual presence may align with or reflect their metaphysical chart

Return ONLY valid JSON with keys: analysis, features (object with forehead/eyes/nose/mouth/chin/faceShape), disclaimer.
Frame everything as symbolic and energetic. Use "may", "carries", "suggests" — never absolute statements.`;

  const response = await openai.chat.completions.create({
    model: DIVIN8_GENERATION_MODEL,
    reasoning_effort: DIVIN8_GENERATION_REASONING_CONFIG.effort,
    messages: [
      {
        role: "system",
        content: `${SYSTEM_PROMPT}\n${buildDeepThinkingInstruction(DIVIN8_GENERATION_REASONING_CONFIG.deepThinking)}`,
      },
      {
        role: "user",
        content: [
          { type: "text", text: USER_PROMPT },
          { type: "image_url", image_url: { url: imageUrl, detail: "low" } },
        ],
      },
    ],
    response_format: { type: "json_object" },
    max_completion_tokens: 1200,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("No physiognomy response from GPT");

  const result = JSON.parse(content);
  const narrative =
    (typeof result.interpretation === "string" && result.interpretation) ||
    (typeof result.analysis === "string" && result.analysis) ||
    "";
  return {
    interpretation: narrative,
    features: typeof result.features === "object" && result.features ? result.features : {},
    disclaimer:
      typeof result.disclaimer === "string" && result.disclaimer
        ? result.disclaimer
        : "This section is a symbolic and energetic interpretation based on visual presentation and is not a factual, medical, or diagnostic assessment.",
    confidence: "symbolic",
  };
}
