import OpenAI from "openai";
import { logger } from "@wisdom/utils";
import { normalizeBirthTimeToStorage } from "../blueprint/schemas.js";
import { DIVIN8_CHAT_MODEL, divin8UnavailableError } from "./brainPolicy.js";

export type ExtractedBirthData = {
  name: string | null;
  name_confidence: number;
  birthDate: string | null;
  birthDate_confidence: number;
  birthTime: string | null;
  birthTime_confidence: number;
  location: string | null;
  location_confidence: number;
  timezone: string | null;
  timezone_confidence: number;
};

export interface Divin8RequestAnalysis {
  intent: string;
  needs_engine: boolean;
  systems_requested: string[];
  focus_areas: string[];
  comparison_requested: boolean;
  timing_period: string | null;
  birth_data: ExtractedBirthData;
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const ENGINE_KEYWORDS =
  /\b(astrology|vedic|birth chart|chart|numerology|life path|blueprint|nakshatra|planet|planetary|human design|kabbalah|rune|chinese astrology)\b/i;
const FINANCE_KEYWORDS = /\b(finance|financial|money|wealth|income|abundance|career|business|work)\b/i;
const RELATIONSHIP_KEYWORDS = /\b(relationship|relationships|love|partner|marriage|family)\b/i;
const PURPOSE_KEYWORDS = /\b(purpose|calling|path|mission|meaning)\b/i;
const HEALTH_KEYWORDS = /\b(health|wellness|healing|body)\b/i;
const SPIRITUAL_KEYWORDS = /\b(spiritual|soul|intuition|inner)\b/i;
const CREATIVITY_KEYWORDS = /\b(creativity|creative|structure|discipline)\b/i;
const TIMING_KEYWORDS =
  /\b(april|may|june|july|august|september|october|november|december|january|february|march|next month|coming month|this month|202\d)\b/i;

function clampConfidence(value: unknown) {
  const numeric = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(numeric)) {
    return 0;
  }
  return Math.max(0, Math.min(1, numeric));
}

function normalizeDate(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (slashMatch) {
    const month = Number(slashMatch[1]);
    const day = Number(slashMatch[2]);
    const rawYear = Number(slashMatch[3]);
    const year = slashMatch[3].length === 2 ? (rawYear >= 30 ? 1900 + rawYear : 2000 + rawYear) : rawYear;
    if (
      Number.isInteger(month) &&
      Number.isInteger(day) &&
      Number.isInteger(year) &&
      month >= 1 &&
      month <= 12 &&
      day >= 1 &&
      day <= 31
    ) {
      return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString().slice(0, 10);
}

function normalizeText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as string[];
  }

  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
}

function parseOpenAiContent(content: unknown) {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part: unknown) =>
        typeof part === "object" && part && "text" in part && typeof part.text === "string"
          ? part.text
          : "",
      )
      .join("\n");
  }

  return "";
}

function buildBirthData(input: Record<string, unknown>): ExtractedBirthData {
  return {
    name: normalizeText(input.name),
    name_confidence: clampConfidence(input.name_confidence),
    birthDate: normalizeDate(input.birthDate),
    birthDate_confidence: clampConfidence(input.birthDate_confidence),
    birthTime: normalizeBirthTimeToStorage(normalizeText(input.birthTime)),
    birthTime_confidence: clampConfidence(input.birthTime_confidence),
    location: normalizeText(input.location),
    location_confidence: clampConfidence(input.location_confidence),
    timezone: normalizeText(input.timezone),
    timezone_confidence: clampConfidence(input.timezone_confidence),
  };
}

export async function extractDivin8RequestAnalysis(message: string): Promise<Divin8RequestAnalysis> {
  if (!process.env.OPENAI_API_KEY) {
    throw divin8UnavailableError();
  }

  try {
    const response = await openai.chat.completions.create({
      model: DIVIN8_CHAT_MODEL,
      messages: [
        {
          role: "system",
          content: [
            "You are a birth-data extraction AI for a metaphysical analysis chat system called Divin8.",
            "Users write in chaotic, natural language. Your job is to read between the lines and extract structured data from messy input.",
            "",
            "EXTRACTION RULES:",
            "- Users may write dates in ANY format: '3/22/1979', 'March 22 1979', '22nd of March, 1979', 'born in 79'. Normalize to YYYY-MM-DD.",
            "- Users may write times in ANY format: '7:08pm', '19:08', '7pm', 'around 7 in the evening', 'morning'. Extract the best time you can. Normalize to HH:MM (24h).",
            "- Users may write locations loosely: 'Port Alberni BC', 'born in vancouver', 'from NY', 'a small town near Dallas'. Extract the most specific location string you can.",
            "- Users may include timezone in many ways: 'GMT -800', 'PST', 'EST', 'UTC-8', 'Pacific time', 'Eastern', 'GMT+5:30', 'Indian time'. Extract it as-is.",
            "- Users may write names casually: 'I'm Brad', 'my name is Brad Johnson', 'Brad J'. Extract the fullest version you can.",
            "- If any field is embedded in a sentence, extract it. Example: 'I was born at 7:08pm on March 22 1979 in Port Alberni BC and my timezone is PST' contains ALL fields.",
            "- Do NOT require exact formatting. Be flexible and generous in extraction so intent and follow-up questions can be shaped well.",
            "- Confidence: 0.9+ for clearly stated data, 0.6-0.8 for inferred data, 0.3-0.5 for partial/ambiguous data, 0 for missing.",
            "- Note: downstream logic uses confidence to decide when to confirm vs calculate; keep inferred values labeled with appropriate confidence rather than overstating certainty.",
            "",
            "Also determine:",
            "- intent: what the user wants (e.g. 'vedic chart financial reading', 'general guidance', 'birth chart analysis')",
            "- needs_engine: true if any astrological, numerological, or system-based calculation is needed",
            "- systems_requested: array of systems like astrology, numerology, humanDesign, chinese, kabbalah, rune, physiognomy, blueprint",
            "- focus_areas: array like finance, career, relationships, purpose, health, spiritual, creativity, timing, general",
            "- comparison_requested: boolean if comparing systems or time periods",
            "- timing_period: specific time window mentioned (e.g. 'April 2026', 'next month')",
            "",
            "Return JSON with keys: intent, needs_engine, systems_requested, focus_areas, comparison_requested, timing_period,",
            "name, name_confidence, birthDate, birthDate_confidence, birthTime, birthTime_confidence,",
            "location, location_confidence, timezone, timezone_confidence.",
            "If a field is missing, return null with confidence 0.",
          ].join("\n"),
        },
        { role: "user", content: message },
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 400,
    });

    const raw = parseOpenAiContent(response.choices[0]?.message?.content as unknown).trim();
    if (!raw) {
      throw divin8UnavailableError();
    }

    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return {
      intent: normalizeText(parsed.intent) ?? normalizeText(message)?.slice(0, 160) ?? "General guidance request",
      needs_engine:
        typeof parsed.needs_engine === "boolean"
          ? parsed.needs_engine
          : ENGINE_KEYWORDS.test(message),
      systems_requested: normalizeStringArray(parsed.systems_requested),
      focus_areas: normalizeStringArray(parsed.focus_areas),
      comparison_requested:
        typeof parsed.comparison_requested === "boolean"
          ? parsed.comparison_requested
          : /\b(compare|comparison|coincides|month ahead|forecast|outlook)\b/i.test(message),
      timing_period: normalizeText(parsed.timing_period),
      birth_data: buildBirthData(parsed),
    };
  } catch (error) {
    logger.error("divin8_request_analysis_failed", {
      message: error instanceof Error ? error.message : String(error),
    });
    throw divin8UnavailableError();
  }
}

export async function extractBirthData(message: string): Promise<ExtractedBirthData> {
  const analysis = await extractDivin8RequestAnalysis(message);
  return analysis.birth_data;
}
