import OpenAI from "openai";
import type { FastifyInstance } from "fastify";
import {
  DEFAULT_LANGUAGE,
  SYSTEM_SYNONYMS,
  detectSystemsFromMessage,
  languageLabel,
  logger,
  normalizeLanguage,
  type LanguageCode,
  type ResolvedSystemKey,
} from "@wisdom/utils";
import type { SystemName } from "../blueprint/types.js";
import { getActiveDivin8Prompt } from "./promptStore.js";
import {
  resolveDivin8ProfilesForMessage,
  type ResolvedDivin8Profile,
} from "./profilesService.js";
import { type NormalizedEngineInterpretationContext } from "./normalizeEngineResultForInterpretation.js";
import {
  DIVIN8_CHAT_MODEL,
  DIVIN8_CHAT_REASONING_EFFORT,
  divin8UnavailableError,
} from "./brainPolicy.js";
import { extractBirthData, extractDivin8RequestAnalysis, type ExtractedBirthData } from "./extractBirthData.js";
import { normalizeBirthData } from "./normalizeBirthData.js";
import {
  appendTimelineEvent,
  listTimelineEvents,
  selectTimelineHighlights,
  type Divin8TimelineEvent,
} from "./insightService.js";
import {
  bufferToDataUrl,
  mimeTypeForAssetId,
  readPhysiognomyImage,
} from "../physiognomyImageStorage.js";
import type {
  Divin8ChatAudit,
  Divin8ChatRequest,
  Divin8ChatResponse,
  SessionHistoryItem,
} from "./chatService.js";
import { runCoreSystem } from "./engine/core.js";
import { formatPipelineStages, formatSystemDecisionLabel, getInterpretationContext } from "./engine/formatter.js";
import { routeDivin8Request } from "./engine/router.js";
import type { Divin8ResolvedBirthContext } from "./engine/types.js";
import {
  buildDivin8Decision,
  buildSearchExecutionPlan,
  defaultOrchestrationState,
  getMissingMinimumAstroKeys,
  humanizeMinimumKey,
  type Divin8Decision,
  type Divin8QueryType,
  type ReadingState,
  type StoredOrchestrationState,
} from "./divin8OrchestrationDecision.js";
import type { Divin8ConversationState, Divin8RoutingPlan } from "./divin8RoutingTypes.js";
import { searchWeb, type SearchWebResult } from "./searchWebService.js";

export type { Divin8ConversationState, Divin8RoutingPlan } from "./divin8RoutingTypes.js";
export type { Divin8Decision, ReadingState, StoredOrchestrationState } from "./divin8OrchestrationDecision.js";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const MAX_CONTEXT_WINDOW = 10;
const MAX_PAYLOAD_SIZE = 8000;
const DIVIN8_CHAT_COMPLETION_TOKENS = 2200;
const GPT_LIVE_TAG_REGEX = /\[DIVIN8_GPT_LIVE_[^\]]+\]/g;
const COMPARISON_REGEX = /\b(compare|comparison|both|combined|synthesis|together|plus)\b/i;
const CORRECTION_REGEX = /\b(correct(?:ion)?|actually|instead|update|not\s+at|i meant)\b/i;
const FORECAST_REGEX = /\b(forecast|outlook|ahead|next month|this month|coming month|april|may|june|july|august|september|october|november|december|january|february|march|202\d)\b/i;
const TIMEZONE_REGEX = /(?:(?:UTC|GMT)\s*[+-]\s*\d{1,4}(?::?\d{2})?|(?:UTC|GMT)\b|\b[A-Z]{2,5}\/[A-Za-z_]+\b|\b(?:PST|PDT|MST|MDT|CST|CDT|EST|EDT|AST|ADT|NST|NDT|AKST|AKDT|HST|HAST|HADT|GMT|BST|CET|CEST|EET|EEST|IST|JST|KST|CST|AEST|AEDT|ACST|ACDT|AWST|NZST|NZDT|WET|WEST|SGT|HKT|PHT|ICT|WIB|WITA|WIT|PKT|NPT|BDT|MMT)\b)/i;

const TIMEZONE_ABBREVIATION_MAP: Record<string, number> = {
  PST: -480, PDT: -420, MST: -420, MDT: -360, CST: -360, CDT: -300,
  EST: -300, EDT: -240, AST: -240, ADT: -180, NST: -210, NDT: -150,
  AKST: -540, AKDT: -480, HST: -600, HAST: -600, HADT: -540,
  GMT: 0, BST: 60, CET: 60, CEST: 120, EET: 120, EEST: 180,
  IST: 330, JST: 540, KST: 540, AEST: 600, AEDT: 660,
  ACST: 570, ACDT: 630, AWST: 480, NZST: 720, NZDT: 780,
  WET: 0, WEST: 60, SGT: 480, HKT: 480, PHT: 480, ICT: 420,
  WIB: 420, WITA: 480, WIT: 540, PKT: 300, NPT: 345, BDT: 360, MMT: 390,
};

function normalizeTimezoneToUtcOffset(raw: string): string | null {
  const trimmed = raw.trim();

  const utcGmtMatch = trimmed.match(/^(?:UTC|GMT)\s*([+-])\s*(\d{1,4})(?::?(\d{2}))?$/i);
  if (utcGmtMatch) {
    const sign = utcGmtMatch[1];
    let hours: number;
    let minutes: number;
    const numericPart = utcGmtMatch[2];
    if (numericPart.length >= 3) {
      hours = Math.floor(Number(numericPart) / 100);
      minutes = Number(numericPart) % 100;
    } else {
      hours = Number(numericPart);
      minutes = Number(utcGmtMatch[3] ?? "0");
    }
    if (hours >= 0 && hours <= 14 && minutes >= 0 && minutes < 60) {
      const mm = minutes > 0 ? `:${String(minutes).padStart(2, "0")}` : "";
      return `UTC${sign}${hours}${mm}`;
    }
  }

  if (/^(?:UTC|GMT)$/i.test(trimmed)) {
    return "UTC+0";
  }

  const upper = trimmed.toUpperCase();
  if (upper in TIMEZONE_ABBREVIATION_MAP) {
    const totalMinutes = TIMEZONE_ABBREVIATION_MAP[upper];
    const sign = totalMinutes >= 0 ? "+" : "-";
    const absMinutes = Math.abs(totalMinutes);
    const h = Math.floor(absMinutes / 60);
    const m = absMinutes % 60;
    const mm = m > 0 ? `:${String(m).padStart(2, "0")}` : "";
    return `UTC${sign}${h}${mm}`;
  }

  if (/^[A-Z][a-z]+\/[A-Za-z_]+$/.test(trimmed)) {
    return trimmed;
  }

  return null;
}

type ChatHistoryMessage = { role: "user" | "assistant"; content: string };
type ChatUserContent =
  | string
  | Array<
      | { type: "text"; text: string }
      | { type: "image_url"; image_url: { url: string; detail: "low" | "high" | "auto" } }
    >;

export type Divin8FieldSource = "explicit_user" | "stored_memory" | "inferred" | "default";
export type Divin8FieldAccuracy = "exact" | "estimated" | "partial" | "unknown";

export interface Divin8MemoryField<T> {
  value: T | null;
  confidence: number;
  source: Divin8FieldSource;
  accuracy: Divin8FieldAccuracy;
  updatedAt?: string;
}

export interface Divin8KnownProfileMemory {
  fullName: Divin8MemoryField<string>;
  birthDate: Divin8MemoryField<string>;
  birthTime: Divin8MemoryField<string>;
  birthLocation: Divin8MemoryField<string>;
  timezone: Divin8MemoryField<string>;
}

export interface Divin8ConversationMemory {
  knownProfile: Divin8KnownProfileMemory;
  resolvedBirthContext: Divin8ResolvedBirthContext | null;
  extractedFacts: {
    themes: string[];
    timeWindow: string | null;
    lastIntent: string | null;
    lastResolvedSystems: string[];
  };
  conversationState: Divin8ConversationState;
  responseLanguage: LanguageCode;
  conversationSummary: string | null;
}

export interface StoredPipelineMeta {
  gpt_live: boolean;
  engine_triggered: boolean;
  engine_called: boolean;
  engine_success: boolean;
  pipeline_status: string;
  route_type: string;
  route_confidence: number;
  route_strict: boolean;
  system_decision: string;
  stages: {
    input_received: boolean;
    routed: string;
    engine_required: boolean;
    engine_run: string;
    response_sent: boolean;
  };
  divin8?: {
    action: "proceed" | "proceed_with_confirmation" | "inquiry_required";
    confidence: number;
    intent_signal: "inquiry" | "confirmation" | "neutral";
    tool_blocked_reason: "low_confidence" | "not_required" | "missing_minimum_data" | null;
  };
  telemetry?: {
    used_swiss_eph: boolean;
    used_web_search: boolean;
    search_input_used: boolean;
    query_type: Divin8QueryType;
  };
}

export interface StoredDivin8SessionState {
  memory?: Divin8ConversationMemory;
  profile?: {
    fullName?: string;
    birthDate?: string;
    birthTime?: string | null;
    birthLocation?: string | null;
    timezone?: string | null;
  };
  resolvedBirthContext?: Divin8ResolvedBirthContext | null;
  imageRef?: string;
  lastPipelineMeta?: StoredPipelineMeta;
  orchestration?: StoredOrchestrationState;
  activeExecution?: {
    requestId: string;
    status: "pending";
    actorRole: string;
    lockedAt: string;
    expiresAt: string;
    pendingMessageId: string;
  } | null;
  lastExecutionError?: {
    requestId: string;
    code: string;
    message: string;
    failedAt: string;
  } | null;
}

export interface Divin8DetectedSystem {
  key: ResolvedSystemKey;
  matchedKeywords: string[];
  score: number;
}

export interface Divin8ExtractedEntities {
  fullName: string | null;
  birthDate: string | null;
  birthTime: string | null;
  birthLocation: string | null;
  timezone: string | null;
  themes: string[];
  timeWindow: string | null;
}

export interface Divin8IntentHints {
  summary: string;
  wantsComparison: boolean;
  wantsForecast: boolean;
  explicitMultiSystem: boolean;
  correction: boolean;
}

export interface Divin8ExtractionResult {
  rawText: string;
  detectedSystems: Divin8DetectedSystem[];
  extractedEntities: Divin8ExtractedEntities;
  intentHints: Divin8IntentHints;
}

interface AssistantCompletion {
  message: string;
  gptLive: boolean;
  gptFailed: boolean;
  verificationTag: string | null;
}

interface Divin8WebContext {
  query: string;
  purpose: "factual_context" | "missing_birth_inputs" | "not_required";
  results: SearchWebResult[];
}

interface Divin8TurnTelemetry {
  usedSwissEph: boolean;
  usedWebSearch: boolean;
  searchInputUsed: boolean;
  queryType: Divin8QueryType;
}

interface Divin8PromptProfile {
  tag: string;
  name: string;
  birthDate: string;
  birthTime: string;
  location: string;
  lat: number;
  lng: number;
  timezone: string;
}

interface Divin8ProfileReading {
  tag: string;
  profile: Divin8PromptProfile;
  engineSummary: NormalizedEngineInterpretationContext;
}

export interface ProcessDivin8MessageParams {
  app: FastifyInstance;
  message: string;
  threadId: string;
  userId: string;
  tier: Divin8ChatRequest["tier"];
  language?: LanguageCode;
  imageRef?: string;
  profileTags?: string[];
  history: SessionHistoryItem[];
  storedState?: StoredDivin8SessionState | null;
  debugAudit?: boolean;
}

export interface ProcessDivin8MessageResult {
  chat: Divin8ChatResponse;
  storedState: StoredDivin8SessionState;
  timeline: Divin8TimelineEvent[];
}

const SYSTEM_ENGINE_MAP: Record<ResolvedSystemKey, SystemName | null> = {
  vedic_astrology: "astrology",
  western_astrology: null,
  chinese_astrology: "chinese",
  astrology_general: "astrology",
  numerology: "numerology",
  human_design: "humanDesign",
  kabbalah: "kabbalah",
  rune: "rune",
};

const SYSTEM_REQUIREMENTS: Partial<Record<SystemName, Array<keyof Divin8KnownProfileMemory>>> = {
  astrology: ["birthDate", "birthLocation", "birthTime"],
  numerology: ["birthDate", "birthLocation", "fullName"],
  chinese: ["birthDate"],
  humanDesign: ["birthDate", "birthLocation", "birthTime"],
  kabbalah: ["birthDate", "fullName"],
  rune: ["birthDate", "birthLocation"],
};

function createEmptyField<T>(): Divin8MemoryField<T> {
  return {
    value: null,
    confidence: 0,
    source: "default",
    accuracy: "unknown",
  };
}

function createEmptyMemory(): Divin8ConversationMemory {
  return {
    knownProfile: {
      fullName: createEmptyField<string>(),
      birthDate: createEmptyField<string>(),
      birthTime: createEmptyField<string>(),
      birthLocation: createEmptyField<string>(),
      timezone: createEmptyField<string>(),
    },
    resolvedBirthContext: null,
    extractedFacts: {
      themes: [],
      timeWindow: null,
      lastIntent: null,
      lastResolvedSystems: [],
    },
    conversationState: "collecting_input",
    responseLanguage: DEFAULT_LANGUAGE,
    conversationSummary: null,
  };
}

function clampConfidence(value: number) {
  return Math.max(0, Math.min(1, value));
}

function buildField<T>(
  value: T | null | undefined,
  source: Divin8FieldSource,
  confidence: number,
  accuracy: Divin8FieldAccuracy,
): Divin8MemoryField<T> {
  return {
    value: value ?? null,
    source,
    confidence: clampConfidence(confidence),
    accuracy,
  };
}

function compactWhitespace(value: string, limit = 220) {
  return value.replace(/\s+/g, " ").trim().slice(0, limit);
}

function buildWebSearchSummary(results: SearchWebResult[]) {
  return results
    .map((result, index) =>
      `${index + 1}. ${result.title} (${result.source}, confidence ${Math.round(result.confidence * 100)}%): ${compactWhitespace(result.snippet, 240)}`,
    )
    .join("\n");
}

function mergeWebSearchBirthData(
  memory: Divin8ConversationMemory,
  birthData: ExtractedBirthData,
): { memory: Divin8ConversationMemory; appliedFields: string[] } {
  const next = structuredClone(memory) as Divin8ConversationMemory;
  const normalized = normalizeBirthData({
    fullName: birthData.name,
    birthDate: birthData.birthDate,
    birthTime: birthData.birthTime,
    birthLocation: birthData.location,
    timezone: birthData.timezone,
  });
  const appliedFields: string[] = [];

  const apply = (
    key: keyof Divin8KnownProfileMemory,
    value: string | null,
    confidence: number,
  ) => {
    if (!value) {
      return;
    }

    const current = next.knownProfile[key];
    if (current.value?.trim()) {
      return;
    }

    next.knownProfile[key] = buildField(
      value,
      "inferred",
      Math.min(0.84, Math.max(0.45, confidence * 0.9 || 0.55)),
      "estimated",
    );
    next.knownProfile[key].updatedAt = new Date().toISOString();
    appliedFields.push(key);
  };

  apply("fullName", normalized.fullName, birthData.name_confidence);
  apply("birthDate", normalized.birthDate, birthData.birthDate_confidence);
  apply("birthTime", normalized.birthTime, birthData.birthTime_confidence);
  apply("birthLocation", normalized.birthLocation, birthData.location_confidence);
  apply("timezone", normalized.timezone, birthData.timezone_confidence);

  if (appliedFields.some((field) => field === "birthDate" || field === "birthTime" || field === "birthLocation" || field === "timezone")) {
    next.resolvedBirthContext = null;
  }

  return { memory: next, appliedFields };
}

function getUtcOffsetMinutesForTimezone(timeZone: string, birthDate: string, birthTime: string) {
  try {
    const probe = new Date(`${birthDate}T${birthTime}:00Z`);
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      timeZoneName: "shortOffset",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    const offsetText = formatter.formatToParts(probe).find((part) => part.type === "timeZoneName")?.value ?? "";
    const match = offsetText.match(/GMT([+-])(\d{1,2})(?::?(\d{2}))?/i);
    if (!match) {
      return 0;
    }
    const sign = match[1] === "-" ? -1 : 1;
    const hours = Number(match[2]);
    const minutes = Number(match[3] ?? "0");
    return sign * ((hours * 60) + minutes);
  } catch {
    return 0;
  }
}

function buildPromptProfile(profile: ResolvedDivin8Profile): Divin8PromptProfile {
  return {
    tag: profile.tag,
    name: profile.fullName,
    birthDate: profile.birthDate,
    birthTime: profile.birthTime,
    location: profile.birthPlace,
    lat: profile.lat,
    lng: profile.lng,
    timezone: profile.timezone,
  };
}

function applyResolvedProfileToMemory(
  memory: Divin8ConversationMemory,
  profile: ResolvedDivin8Profile,
) {
  const next = structuredClone(memory) as Divin8ConversationMemory;
  next.knownProfile.fullName = buildField(profile.fullName, "stored_memory", 1, "exact");
  next.knownProfile.birthDate = buildField(profile.birthDate, "stored_memory", 1, "exact");
  next.knownProfile.birthTime = buildField(profile.birthTime, "stored_memory", 1, "exact");
  next.knownProfile.birthLocation = buildField(profile.birthPlace, "stored_memory", 1, "exact");
  next.knownProfile.timezone = buildField(profile.timezone, "stored_memory", 1, "exact");
  next.resolvedBirthContext = {
    coordinates: {
      latitude: profile.lat,
      longitude: profile.lng,
      formattedAddress: profile.birthPlace,
    },
    timezone: profile.timezone,
    utcOffsetMinutes: getUtcOffsetMinutesForTimezone(profile.timezone, profile.birthDate, profile.birthTime),
  };
  return next;
}

export function hydrateConversationMemory(storedState?: StoredDivin8SessionState | null): Divin8ConversationMemory {
  const memory = storedState?.memory;
  if (memory) {
    return memory;
  }

  const legacyProfile = normalizeBirthData({
    fullName: storedState?.profile?.fullName,
    birthDate: storedState?.profile?.birthDate,
    birthTime: storedState?.profile?.birthTime,
    birthLocation: storedState?.profile?.birthLocation,
    timezone: storedState?.profile?.timezone,
  });
  const next = createEmptyMemory();

  if (legacyProfile.fullName) next.knownProfile.fullName = buildField(legacyProfile.fullName, "stored_memory", 0.9, "exact");
  if (legacyProfile.birthDate) next.knownProfile.birthDate = buildField(legacyProfile.birthDate, "stored_memory", 0.95, "exact");
  if (legacyProfile.birthTime) next.knownProfile.birthTime = buildField(legacyProfile.birthTime, "stored_memory", 0.9, "exact");
  if (legacyProfile.birthLocation) next.knownProfile.birthLocation = buildField(legacyProfile.birthLocation, "stored_memory", 0.9, "exact");
  if (legacyProfile.timezone) next.knownProfile.timezone = buildField(legacyProfile.timezone, "stored_memory", 0.8, "exact");
  next.resolvedBirthContext = storedState?.resolvedBirthContext ?? null;

  return next;
}

export function buildStoredDivin8State(
  memory: Divin8ConversationMemory,
  imageRef?: string,
  lastPipelineMeta?: StoredPipelineMeta,
  orchestration?: StoredOrchestrationState,
): StoredDivin8SessionState {
  return {
    memory,
    profile: {
      fullName: memory.knownProfile.fullName.value ?? undefined,
      birthDate: memory.knownProfile.birthDate.value ?? undefined,
      birthTime: memory.knownProfile.birthTime.value,
      birthLocation: memory.knownProfile.birthLocation.value,
      timezone: memory.knownProfile.timezone.value,
    },
    resolvedBirthContext: memory.resolvedBirthContext,
    imageRef,
    lastPipelineMeta,
    orchestration,
  };
}

function stripVerificationTags(text: string) {
  return text.replace(GPT_LIVE_TAG_REGEX, "").trim();
}

function historyForCompletion(history: SessionHistoryItem[], userMessage: string) {
  const trimmedMessage = userMessage.trim();
  const effectiveHistory =
    history.at(-1)?.role === "user" && history.at(-1)?.content.trim() === trimmedMessage
      ? history.slice(0, -1)
      : history;

  return effectiveHistory
    .slice(-MAX_CONTEXT_WINDOW)
    .map((item) => ({
      role: item.role,
      content: item.role === "assistant" ? stripVerificationTags(item.content) : item.content,
    }));
}

function estimatePayloadSize(
  systemMessages: string[],
  history: ChatHistoryMessage[],
  userContent: ChatUserContent,
) {
  const systemSize = systemMessages.reduce((sum, item) => sum + item.length, 0);
  const historySize = history.reduce((sum, item) => sum + item.content.length, 0);
  const userSize = typeof userContent === "string"
    ? userContent.length
    : userContent.reduce((sum, item) => sum + ("text" in item ? item.text.length : 24), 0);

  return systemSize + historySize + userSize;
}

function trimHistoryToFitPayload(
  systemMessages: string[],
  history: ChatHistoryMessage[],
  userContent: ChatUserContent,
) {
  let trimmed = history.slice(-MAX_CONTEXT_WINDOW);

  while (estimatePayloadSize(systemMessages, trimmed, userContent) > MAX_PAYLOAD_SIZE && trimmed.length > 0) {
    trimmed = trimmed.slice(1);
  }

  return trimmed;
}

function extractAssistantMessageText(content: unknown, refusal: unknown) {
  if (typeof content === "string") {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content
      .map((part: unknown) =>
        typeof part === "object" && part && "text" in part && typeof part.text === "string"
          ? part.text
          : "",
      )
      .join("\n")
      .trim();
  }

  if (typeof refusal === "string") {
    return refusal.trim();
  }

  return "";
}

function buildLanguageDirective(language: LanguageCode = DEFAULT_LANGUAGE) {
  const label = languageLabel(language);

  if (language === DEFAULT_LANGUAGE) {
    return [
      "Language control is system-managed.",
      "You MUST respond ONLY in English unless the system language explicitly changes to another supported language.",
      "Do not infer or mirror the user's language from input text, prior conversation history, browser settings, or any other context.",
    ].join(" ");
  }

  return [
    "Language control is system-managed.",
    `You MUST respond ONLY in ${label}.`,
    "Do not infer or mirror another language from input text, prior conversation history, browser settings, or any other context.",
  ].join(" ");
}

async function loadImageContext(imageRef: string | undefined) {
  if (!imageRef) {
    return null;
  }

  const buffer = await readPhysiognomyImage(imageRef);
  if (!buffer) {
    return null;
  }

  return {
    imageRef,
    dataUrl: bufferToDataUrl(buffer, mimeTypeForAssetId(imageRef)),
  };
}

async function requestChatCompletion(params: {
  systemMessages: string[];
  history: ChatHistoryMessage[];
  userContent: ChatUserContent;
  maxCompletionTokens: number;
  includeReasoningEffort?: boolean;
}) {
  const trimmedHistory = trimHistoryToFitPayload(params.systemMessages, params.history, params.userContent);

  return openai.chat.completions.create({
    model: DIVIN8_CHAT_MODEL,
    messages: [
      ...params.systemMessages.map((content) => ({ role: "system" as const, content })),
      ...trimmedHistory,
      { role: "user", content: params.userContent },
    ],
    ...(params.includeReasoningEffort === false ? {} : { reasoning_effort: DIVIN8_CHAT_REASONING_EFFORT }),
    max_completion_tokens: params.maxCompletionTokens,
  });
}

function extractTimezone(message: string, gptTimezone?: string | null): string | null {
  if (gptTimezone) {
    const normalized = normalizeTimezoneToUtcOffset(gptTimezone);
    if (normalized) return normalized;
  }

  const match = message.match(TIMEZONE_REGEX);
  if (match?.[0]) {
    const normalized = normalizeTimezoneToUtcOffset(match[0]);
    if (normalized) return normalized;
  }

  return null;
}

function buildDetectedSystems(message: string): Divin8DetectedSystem[] {
  const normalized = message.toLowerCase();
  return detectSystemsFromMessage(message)
    .map((key) => {
      const matchedKeywords = SYSTEM_SYNONYMS[key].filter((keyword) => normalized.includes(keyword.toLowerCase()));
      const longestKeyword = matchedKeywords.reduce((max, keyword) => Math.max(max, keyword.length), 0);
      const earliestIndex = matchedKeywords.reduce((min, keyword) => {
        const index = normalized.indexOf(keyword.toLowerCase());
        return index >= 0 ? Math.min(min, index) : min;
      }, Number.POSITIVE_INFINITY);
      const score = matchedKeywords.length * 4 + longestKeyword - (Number.isFinite(earliestIndex) ? earliestIndex / 100 : 0);
      return {
        key,
        matchedKeywords,
        score,
      };
    })
    .sort((left, right) => right.score - left.score);
}

function normalizeIntentSummary(value: string | null | undefined, fallback: string) {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed ? trimmed.slice(0, 180) : fallback.slice(0, 180);
}

function uniqueList(values: Array<string | null | undefined>) {
  return [...new Set(
    values
      .map((value) => (typeof value === "string" ? value.trim() : ""))
      .filter(Boolean),
  )];
}

export async function extractDivin8Observations(message: string): Promise<Divin8ExtractionResult> {
  const analysis = await extractDivin8RequestAnalysis(message);
  const normalizedBirth = normalizeBirthData({
    fullName: analysis.birth_data.name,
    birthDate: analysis.birth_data.birthDate,
    birthTime: analysis.birth_data.birthTime,
    birthLocation: analysis.birth_data.location,
    timezone: extractTimezone(message, analysis.birth_data.timezone),
  });

  return {
    rawText: message,
    detectedSystems: buildDetectedSystems(message),
    extractedEntities: {
      fullName: normalizedBirth.fullName,
      birthDate: normalizedBirth.birthDate,
      birthTime: normalizedBirth.birthTime,
      birthLocation: normalizedBirth.birthLocation,
      timezone: normalizedBirth.timezone,
      themes: uniqueList(analysis.focus_areas),
      timeWindow: analysis.timing_period,
    },
    intentHints: {
      summary: normalizeIntentSummary(analysis.intent, message),
      wantsComparison: analysis.comparison_requested || COMPARISON_REGEX.test(message),
      wantsForecast: FORECAST_REGEX.test(message),
      explicitMultiSystem: COMPARISON_REGEX.test(message),
      correction: CORRECTION_REGEX.test(message),
    },
  };
}

function fieldPriority(field: Divin8MemoryField<string>) {
  const sourceScore =
    field.source === "explicit_user"
      ? 4
      : field.source === "stored_memory"
        ? 3
        : field.source === "inferred"
          ? 2
          : 1;
  const accuracyScore =
    field.accuracy === "exact"
      ? 3
      : field.accuracy === "estimated"
        ? 2
        : field.accuracy === "partial"
          ? 1
          : 0;

  return sourceScore * 10 + accuracyScore * 2 + field.confidence;
}

function mergeField(
  current: Divin8MemoryField<string>,
  incoming: Divin8MemoryField<string>,
  correction = false,
): Divin8MemoryField<string> {
  if (!incoming.value) {
    return current;
  }

  if (correction && incoming.source === "explicit_user") {
    return {
      ...incoming,
      updatedAt: new Date().toISOString(),
    };
  }

  if (!current.value) {
    return {
      ...incoming,
      updatedAt: new Date().toISOString(),
    };
  }

  if (fieldPriority(incoming) >= fieldPriority(current)) {
    return {
      ...incoming,
      updatedAt: new Date().toISOString(),
    };
  }

  return current;
}

function hasFullBirthName(field: Divin8MemoryField<string>) {
  return Boolean(field.value && field.value.trim().split(/\s+/).length >= 2);
}

export function mergeConversationMemory(memory: Divin8ConversationMemory, extracted: Divin8ExtractionResult, language?: LanguageCode) {
  const next = structuredClone(memory) as Divin8ConversationMemory;
  const normalized = normalizeBirthData({
    fullName: extracted.extractedEntities.fullName,
    birthDate: extracted.extractedEntities.birthDate,
    birthTime: extracted.extractedEntities.birthTime,
    birthLocation: extracted.extractedEntities.birthLocation,
    timezone: extracted.extractedEntities.timezone,
  });
  const correction = extracted.intentHints.correction;

  next.knownProfile.fullName = mergeField(
    next.knownProfile.fullName,
    buildField(normalized.fullName, normalized.fullName ? "explicit_user" : "inferred", normalized.fullName ? 0.85 : 0, "exact"),
    correction,
  );
  next.knownProfile.birthDate = mergeField(
    next.knownProfile.birthDate,
    buildField(normalized.birthDate, normalized.birthDate ? "explicit_user" : "inferred", normalized.birthDate ? 0.92 : 0, "exact"),
    correction,
  );
  next.knownProfile.birthTime = mergeField(
    next.knownProfile.birthTime,
    buildField(normalized.birthTime, normalized.birthTime ? "explicit_user" : "inferred", normalized.birthTime ? 0.88 : 0, "exact"),
    correction,
  );
  next.knownProfile.birthLocation = mergeField(
    next.knownProfile.birthLocation,
    buildField(normalized.birthLocation, normalized.birthLocation ? "explicit_user" : "inferred", normalized.birthLocation ? 0.86 : 0, "exact"),
    correction,
  );
  next.knownProfile.timezone = mergeField(
    next.knownProfile.timezone,
    buildField(normalized.timezone, normalized.timezone ? "explicit_user" : "inferred", normalized.timezone ? 0.8 : 0, "exact"),
    correction,
  );

  const locationChanged =
    next.knownProfile.birthDate.value !== memory.knownProfile.birthDate.value
    || next.knownProfile.birthTime.value !== memory.knownProfile.birthTime.value
    || next.knownProfile.birthLocation.value !== memory.knownProfile.birthLocation.value
    || next.knownProfile.timezone.value !== memory.knownProfile.timezone.value;
  if (locationChanged) {
    next.resolvedBirthContext = null;
  }

  next.extractedFacts.themes = uniqueList([
    ...next.extractedFacts.themes,
    ...extracted.extractedEntities.themes,
  ]);
  next.extractedFacts.timeWindow = extracted.extractedEntities.timeWindow ?? next.extractedFacts.timeWindow;
  next.extractedFacts.lastIntent = extracted.intentHints.summary;
  next.responseLanguage = normalizeLanguage(language ?? next.responseLanguage ?? DEFAULT_LANGUAGE);

  return next;
}

function collectMissingFieldsForSystems(systemsToRun: SystemName[], memory: Divin8ConversationMemory): string[] {
  const missing: string[] = [];
  for (const system of systemsToRun) {
    if (system === "astrology") {
      missing.push(...getMissingMinimumAstroKeys(memory).map(humanizeMinimumKey));
      continue;
    }
    for (const field of SYSTEM_REQUIREMENTS[system] ?? []) {
      const current = memory.knownProfile[field];
      if (!current.value) {
        missing.push(formatMissingField(field));
      } else if (field === "fullName" && !hasFullBirthName(current)) {
        missing.push(formatMissingField(field));
      }
    }
  }
  return uniqueList(missing);
}

function formatMissingField(field: keyof Divin8KnownProfileMemory) {
  switch (field) {
    case "fullName":
      return "full birth name";
    case "birthDate":
      return "birth date";
    case "birthTime":
      return "birth time";
    case "birthLocation":
      return "birth location";
    case "timezone":
      return "timezone";
    default:
      return field;
  }
}

function buildClarificationPrompt(missingFields: string[], routingNotes: string[]) {
  const base = missingFields.length > 0
    ? `Ask only for these missing details: ${missingFields.join(", ")}.`
    : "Ask a concise clarifying question before proceeding.";
  return [
    "Keep the clarification concise, warm, and direct.",
    base,
    ...(routingNotes.length > 0 ? [`Clarify this constraint: ${routingNotes.join(" ")}`] : []),
  ].join(" ");
}

function choosePrimarySystem(detectedSystems: Divin8DetectedSystem[], extracted: Divin8ExtractionResult) {
  if (detectedSystems.length === 0) {
    return { systems: [] as Divin8DetectedSystem[], ambiguous: false };
  }

  if (detectedSystems.length === 1 || extracted.intentHints.explicitMultiSystem) {
    return { systems: detectedSystems, ambiguous: false };
  }

  const [first, second] = detectedSystems;
  if (second && Math.abs(first.score - second.score) < 1) {
    return { systems: [first, second], ambiguous: true };
  }

  return { systems: [first], ambiguous: false };
}

export function decideNextAction(params: {
  memory: Divin8ConversationMemory;
  detectedSystems: Divin8DetectedSystem[];
  extracted: Divin8ExtractionResult;
  hasImage: boolean;
}): Divin8RoutingPlan {
  const routingNotes: string[] = [];
  const selected = choosePrimarySystem(params.detectedSystems, params.extracted);

  if (selected.ambiguous) {
    routingNotes.push("Multiple systems were detected with similar confidence. Ask the user which system they want first.");
    return {
      needsEngine: false,
      missingFields: [],
      systemsToRun: [],
      responseMode: "chat",
      conversationState: "collecting_input",
      clarificationPrompt: buildClarificationPrompt([], routingNotes),
      routingNotes,
    };
  }

  const resolvedKeys = uniqueList(selected.systems.map((system) => system.key)) as ResolvedSystemKey[];
  if (params.hasImage && resolvedKeys.length === 0) {
    routingNotes.push("Use symbolic physiognomy interpretation for the uploaded image.");
  }

  const unsupported = resolvedKeys.filter((key) => SYSTEM_ENGINE_MAP[key] === null);
  if (unsupported.length > 0) {
    routingNotes.push("The requested system is not supported by the current engine contract.");
    return {
      needsEngine: false,
      missingFields: [],
      systemsToRun: [],
      responseMode: "chat",
      conversationState: "collecting_input",
      clarificationPrompt: buildClarificationPrompt([], [
        "Western astrology is not currently calculable in the engine. Ask whether they want a Vedic/sidereal reading instead or a conversational explanation without calculation.",
      ]),
      routingNotes,
      unsupportedReason: unsupported.join(", "),
    };
  }

  let systemsToRun = resolvedKeys
    .map((key) => SYSTEM_ENGINE_MAP[key])
    .filter((value): value is SystemName => Boolean(value));

  if (params.hasImage && !systemsToRun.includes("physiognomy")) {
    systemsToRun = [...systemsToRun, "physiognomy"];
  }

  if (systemsToRun.length === 0) {
    return {
      needsEngine: false,
      missingFields: [],
      systemsToRun: [],
      responseMode: "chat",
      conversationState: "conversational",
      routingNotes,
    };
  }

  if (params.extracted.intentHints.wantsForecast && systemsToRun.includes("astrology")) {
    routingNotes.push(
      "The current engine supports natal astrology context, not a dedicated forecast/transit layer. If you use engine output, explicitly frame it as a general chart-based reading rather than a precise forecast.",
    );
  }

  const missingFields = collectMissingFieldsForSystems(systemsToRun, params.memory);

  if (missingFields.length > 0) {
    return {
      needsEngine: false,
      missingFields,
      systemsToRun,
      responseMode: "chat",
      conversationState: "collecting_input",
      clarificationPrompt: buildClarificationPrompt(missingFields, routingNotes),
      routingNotes,
    };
  }

  return {
    needsEngine: true,
    missingFields: [],
    systemsToRun,
    responseMode: "engine",
    conversationState: "ready_for_engine",
    routingNotes,
    downgradedToGeneral: params.extracted.intentHints.wantsForecast && systemsToRun.includes("astrology"),
  };
}

function serializeKnownProfile(memory: Divin8ConversationMemory) {
  return {
    fullName: memory.knownProfile.fullName.value,
    birthDate: memory.knownProfile.birthDate.value,
    birthTime: memory.knownProfile.birthTime.value,
    birthLocation: memory.knownProfile.birthLocation.value,
    timezone: memory.knownProfile.timezone.value,
  };
}

function buildKnownProfileFacts(memory: Divin8ConversationMemory) {
  const facts: string[] = [];
  const profile = serializeKnownProfile(memory);

  if (profile.fullName) facts.push(`Confirmed profile fact: full birth name is ${profile.fullName}.`);
  if (profile.birthDate) facts.push(`Confirmed profile fact: birth date is ${profile.birthDate}.`);
  if (profile.birthTime) facts.push(`Confirmed profile fact: birth time is ${profile.birthTime}.`);
  if (profile.birthLocation) facts.push(`Confirmed profile fact: birth location is ${profile.birthLocation}.`);
  if (profile.timezone) facts.push(`Confirmed profile fact: timezone is ${profile.timezone}.`);

  return facts;
}

function buildStructuredPayload(params: {
  message: string;
  memory: Divin8ConversationMemory;
  extracted: Divin8ExtractionResult;
  engineSummary: NormalizedEngineInterpretationContext | null;
  profiles: Divin8PromptProfile[];
  profileReadings: Divin8ProfileReading[];
  webContext: Divin8WebContext | null;
  timelineHighlights: string[];
  responseMode: "chat" | "engine";
  execDecision: Divin8Decision;
  readingState: ReadingState;
  telemetry: Divin8TurnTelemetry;
}) {
  return JSON.stringify({
    userMessage: params.message,
    conversationSummary: params.memory.conversationSummary,
    extractedFacts: {
      intent: params.extracted.intentHints.summary,
      themes: params.extracted.extractedEntities.themes,
      timeWindow: params.extracted.extractedEntities.timeWindow,
      comparisonRequested: params.extracted.intentHints.wantsComparison,
      detectedSystems: params.extracted.detectedSystems.map((system) => system.key),
    },
    knownProfile: serializeKnownProfile(params.memory),
    profiles: params.profiles,
    profileReadings: params.profileReadings,
    engineSummary: params.engineSummary,
    webContext: params.webContext
      ? {
          query: params.webContext.query,
          purpose: params.webContext.purpose,
          summary: buildWebSearchSummary(params.webContext.results),
        }
      : null,
    timelineHighlights: params.timelineHighlights,
    responseMode: params.responseMode,
    responseLanguage: params.memory.responseLanguage,
    divin8Decision: {
      action: params.execDecision.action,
      confidence: params.execDecision.confidence,
      assumptions: params.execDecision.assumptions ?? null,
    },
    readingState: params.readingState,
    telemetry: {
      usedSwissEph: params.telemetry.usedSwissEph,
      usedWebSearch: params.telemetry.usedWebSearch,
      searchInputUsed: params.telemetry.searchInputUsed,
      queryType: params.telemetry.queryType,
    },
  }, null, 2);
}

function buildInstructionFromDecision(
  execDecision: Divin8Decision,
  routingPlan: Divin8RoutingPlan,
  engineSummary: NormalizedEngineInterpretationContext | null,
  webContext: Divin8WebContext | null,
  profileReadings: Divin8ProfileReading[],
): string {
  if (execDecision.action === "inquiry_required" && execDecision.inquiry) {
    return [
      "You are in a gentle clarification turn. Ask naturally in one short paragraph.",
      `Guidance: ${execDecision.inquiry.question}`,
      "Never use the words: error, invalid, missing required, or system failure.",
    ].join(" ");
  }
  if (execDecision.action === "proceed_with_confirmation" && execDecision.confirmation) {
    const assumptionLine = execDecision.assumptions
      ? `If relevant, weave continuity in plain language (no raw JSON): ${Object.entries(execDecision.assumptions).map(([k, v]) => `${k}: ${v}`).join("; ")}.`
      : "";
    return [
      "You are in a forward-moving confirmation turn: sound confident, not interrogative. Prefer statements over questions.",
      `Anchor line: ${execDecision.confirmation.message}`,
      assumptionLine,
      "Then deliver the next slice of the reading (one section at a time). Default sections: Overview; Career/Finances; Love/Relationships; Personal Growth/Spiritual Path.",
    ].filter(Boolean).join(" ");
  }
  if (engineSummary) {
    const parts = [
      "Use the structured engine summary as authoritative for calculation-backed signals.",
      profileReadings.length > 1 ? "If multiple profile readings are provided, compare them directly and keep the distinction between each person clear." : "",
      webContext ? "Use any provided web context only as supporting factual input or background; never let it override calculation-backed signals." : "",
      "Keep the visible answer concise and practical.",
      "Return one short primary section now with a brief takeaway and at most 3 action-oriented bullets.",
      "Invite which area to deepen next unless the user already chose a focus.",
    ];
    if (routingPlan.downgradedToGeneral) {
      parts.push("Frame as a general natal-style reading rather than a precise time-bound forecast.");
    }
    return parts.join(" ");
  }
  const parts = [
    "Respond conversationally and directly.",
    webContext ? "If web context is provided, synthesize it naturally and do not list raw links." : "",
    "Keep the answer concise and useful.",
    "When giving a reading, use clear section headings and advance one short section at a time unless the user requests a specific area.",
  ];
  if (routingPlan.unsupportedReason) {
    parts.push("Do not imply an unsupported modality was calculated.");
  }
  return parts.join(" ");
}

async function requestStructuredAssistantReply(params: {
  prompt: string;
  history: SessionHistoryItem[];
  message: string;
  memory: Divin8ConversationMemory;
  extracted: Divin8ExtractionResult;
  tier: Divin8ChatRequest["tier"];
  imageDataUrl?: string | null;
  engineSummary: NormalizedEngineInterpretationContext | null;
  profiles: Divin8PromptProfile[];
  profileReadings: Divin8ProfileReading[];
  webContext: Divin8WebContext | null;
  timelineHighlights: string[];
  responseMode: "chat" | "engine";
  execDecision: Divin8Decision;
  readingState: ReadingState;
  routingPlan: Divin8RoutingPlan;
  telemetry: Divin8TurnTelemetry;
}) : Promise<AssistantCompletion> {
  const verificationTag = `[DIVIN8_GPT_LIVE_${new Date().toISOString()}]`;
  const instruction = buildInstructionFromDecision(
    params.execDecision,
    params.routingPlan,
    params.engineSummary,
    params.webContext,
    params.profileReadings,
  );
  const systemMessages = [
    "Conversation orchestration: always answer the user's actual request clearly, directly, and conversationally.",
    "Never return an empty response. If uncertain, say what you can do next in one visible answer.",
    buildLanguageDirective(params.memory.responseLanguage),
    params.prompt,
    instruction,
  ];
  const history = historyForCompletion(params.history, params.message);
  const payload = buildStructuredPayload({
    message: params.message,
    memory: params.memory,
    extracted: params.extracted,
    engineSummary: params.engineSummary,
    profiles: params.profiles,
    profileReadings: params.profileReadings,
    webContext: params.webContext,
    timelineHighlights: params.timelineHighlights,
    responseMode: params.responseMode,
    execDecision: params.execDecision,
    readingState: params.readingState,
    telemetry: params.telemetry,
  });
  const userContent = params.imageDataUrl
    ? [
        { type: "text" as const, text: payload },
        { type: "image_url" as const, image_url: { url: params.imageDataUrl, detail: "low" as const } },
      ]
    : payload;

  const response = await requestChatCompletion({
    systemMessages,
    history,
    userContent,
    maxCompletionTokens: DIVIN8_CHAT_COMPLETION_TOKENS,
  });
  let message = extractAssistantMessageText(
    response.choices[0]?.message?.content as unknown,
    response.choices[0]?.message?.refusal,
  );

  if (message) {
    return {
      message,
      gptLive: true,
      gptFailed: false,
      verificationTag,
    };
  }

  logger.warn("divin8_chat_empty_completion_retrying_without_reasoning", {
    finishReason: response.choices[0]?.finish_reason ?? null,
    hasRefusal: Boolean(response.choices[0]?.message?.refusal),
    routeType: params.engineSummary ? "engine" : "chat",
    responseMode: params.responseMode,
    tier: params.tier,
    payloadSize: estimatePayloadSize(systemMessages, history, userContent),
  });

  const fallbackResponse = await requestChatCompletion({
    systemMessages,
    history,
    userContent,
    maxCompletionTokens: DIVIN8_CHAT_COMPLETION_TOKENS,
    includeReasoningEffort: false,
  });
  message = extractAssistantMessageText(
    fallbackResponse.choices[0]?.message?.content as unknown,
    fallbackResponse.choices[0]?.message?.refusal,
  );

  if (message) {
    return {
      message,
      gptLive: true,
      gptFailed: false,
      verificationTag,
    };
  }

  logger.error("divin8_chat_empty_completion_unrecoverable", {
    firstFinishReason: response.choices[0]?.finish_reason ?? null,
    fallbackFinishReason: fallbackResponse.choices[0]?.finish_reason ?? null,
    firstHasRefusal: Boolean(response.choices[0]?.message?.refusal),
    fallbackHasRefusal: Boolean(fallbackResponse.choices[0]?.message?.refusal),
    routeType: params.engineSummary ? "engine" : "chat",
    responseMode: params.responseMode,
    tier: params.tier,
  });

  throw divin8UnavailableError();
}

function clipSentence(text: string, limit = 220) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= limit) {
    return normalized;
  }
  return `${normalized.slice(0, limit - 3)}...`;
}

export function buildConversationSummary(params: {
  previousSummary: string | null;
  extracted: Divin8ExtractionResult;
  routingPlan: Divin8RoutingPlan;
  responseText: string;
  memory: Divin8ConversationMemory;
}) {
  const sentences: string[] = [];
  const systems = params.routingPlan.systemsToRun.length > 0 ? params.routingPlan.systemsToRun.join(", ") : "conversation";
  sentences.push(`Current focus: ${clipSentence(params.extracted.intentHints.summary, 120)}.`);
  sentences.push(`Active mode: ${params.routingPlan.conversationState.replace(/_/g, " ")} with ${systems}.`);

  const profile = serializeKnownProfile(params.memory);
  if (profile.birthDate || profile.birthLocation) {
    const parts = [profile.birthDate, profile.birthLocation].filter(Boolean).join(" in ");
    sentences.push(`Confirmed profile context: ${parts}.`);
  } else if (params.previousSummary) {
    sentences.push(clipSentence(params.previousSummary, 120));
  } else {
    sentences.push(`Latest outcome: ${clipSentence(stripVerificationTags(params.responseText), 120)}.`);
  }

  return sentences.slice(0, 3).join(" ");
}

function buildTimelineTags(params: {
  extracted: Divin8ExtractionResult;
  routingPlan: Divin8RoutingPlan;
  profileTags?: string[];
}) {
  return uniqueList([
    ...params.extracted.extractedEntities.themes,
    ...(params.extracted.extractedEntities.timeWindow ? [params.extracted.extractedEntities.timeWindow] : []),
    ...params.routingPlan.systemsToRun,
    ...(params.profileTags ?? []),
  ]);
}

export async function processDivin8Message(params: ProcessDivin8MessageParams): Promise<ProcessDivin8MessageResult> {
  if (!process.env.OPENAI_API_KEY) {
    throw divin8UnavailableError();
  }

  const promptConfig = await getActiveDivin8Prompt();
  const memory = hydrateConversationMemory(params.storedState);
  const extracted = await extractDivin8Observations(params.message);
  const storedMemory = mergeConversationMemory(memory, extracted, params.language);
  const resolvedProfileContext = await resolveDivin8ProfilesForMessage(
    params.app.db,
    params.userId,
    params.message,
    params.profileTags,
  );
  const promptProfiles = resolvedProfileContext.profiles.map(buildPromptProfile);
  let calculationMemory = resolvedProfileContext.profiles[0]
    ? applyResolvedProfileToMemory(storedMemory, resolvedProfileContext.profiles[0])
    : storedMemory;
  let routingPlan = decideNextAction({
    memory: calculationMemory,
    detectedSystems: extracted.detectedSystems,
    extracted,
    hasImage: Boolean(params.imageRef),
  });
  let routeDecision = routeDivin8Request({
    message: params.message,
    detectedSystems: extracted.detectedSystems,
    requestedSystems: routingPlan.systemsToRun,
  });
  const rawSearchPlan = buildSearchExecutionPlan({
    message: params.message,
    routingPlan,
    route: routeDecision,
    memory: calculationMemory,
    extracted,
  });
  const isAstrologyTurn = routeDecision.type === "ASTROLOGY" || routingPlan.systemsToRun.includes("astrology");
  const initialSearchPlan = isAstrologyTurn
    ? {
        ...rawSearchPlan,
        shouldSearch: false,
        query: null,
        purpose: "not_required" as const,
      }
    : rawSearchPlan;
  let webContext: Divin8WebContext | null = null;
  let usedWebSearch = false;
  let searchInputUsed = false;

  if (initialSearchPlan.shouldSearch && initialSearchPlan.query) {
    const searchResponse = await searchWeb(initialSearchPlan.query, {
      warn: (payload, message) => logger.warn(message, payload),
      info: (payload, message) => logger.info(message, payload),
    });
    usedWebSearch = searchResponse.attempts > 0;

    if (searchResponse.results.length > 0) {
      webContext = {
        query: searchResponse.query,
        purpose: initialSearchPlan.purpose,
        results: searchResponse.results,
      };
      searchInputUsed = true;

      if (initialSearchPlan.purpose === "missing_birth_inputs") {
        const inferredBirthData = await extractBirthData(buildWebSearchSummary(searchResponse.results));
        const mergedFromSearch = mergeWebSearchBirthData(calculationMemory, inferredBirthData);

        if (mergedFromSearch.appliedFields.length > 0) {
          calculationMemory = mergedFromSearch.memory;
          routingPlan = decideNextAction({
            memory: calculationMemory,
            detectedSystems: extracted.detectedSystems,
            extracted,
            hasImage: Boolean(params.imageRef),
          });
          routeDecision = routeDivin8Request({
            message: params.message,
            detectedSystems: extracted.detectedSystems,
            requestedSystems: routingPlan.systemsToRun,
          });
        }
      }
    }
  }

  const telemetry: Divin8TurnTelemetry = {
    usedSwissEph: false,
    usedWebSearch,
    searchInputUsed,
    queryType: initialSearchPlan.queryType,
  };
  const orchestrationIn = params.storedState?.orchestration ?? defaultOrchestrationState();
  const exec = buildDivin8Decision({
    threadId: params.threadId,
    routingPlan,
    route: routeDecision,
    memory: calculationMemory,
    extracted,
    orchestration: orchestrationIn,
  });
  const execDecision = exec.decision;
  if (exec.memoryWithAssumptions) {
    calculationMemory.knownProfile = exec.memoryWithAssumptions.knownProfile;
  }

  const shouldRunAstrologyEngine =
    routingPlan.needsEngine
    && routingPlan.systemsToRun.includes("astrology")
    && routeDecision.type === "ASTROLOGY"
    && routeDecision.requiresEngine
    && execDecision.toolType === "astrology"
    && !execDecision.toolBlockedReason
    && (execDecision.action === "proceed"
      || (execDecision.action === "proceed_with_confirmation" && Boolean(exec.orchestration.loopGuardTriggered)));

  const timelineEvents = await listTimelineEvents(params.app.db, params.threadId, params.userId, 12);
  const timelineHighlights = selectTimelineHighlights({
    events: timelineEvents,
    knownProfileFacts: buildKnownProfileFacts(storedMemory),
    systems: routingPlan.systemsToRun,
    themes: extracted.extractedEntities.themes,
    timeWindow: extracted.extractedEntities.timeWindow,
    limit: 6,
  });
  const imageContext = await loadImageContext(params.imageRef ?? params.storedState?.imageRef);
  const audit: Divin8ChatAudit = {
    intent: extracted.intentHints.summary,
    needs_engine: routeDecision.requiresEngine,
    extracted_fields: {
      fullName: extracted.extractedEntities.fullName,
      birthDate: extracted.extractedEntities.birthDate,
      birthTime: extracted.extractedEntities.birthTime,
      birthLocation: extracted.extractedEntities.birthLocation,
    },
    missing_fields: execDecision.missingFields.length > 0 ? execDecision.missingFields : routingPlan.missingFields,
    engine_payload: null,
    engine_called: false,
    engine_success: false,
    engine_result_present: false,
    engine_result_summary_present: false,
    gpt_called: true,
    gpt_response_present: false,
    response_mode: routingPlan.needsEngine ? "engine+gpt" : "gpt_only",
    used_web_search: usedWebSearch,
    search_input_used: searchInputUsed,
    query_type: telemetry.queryType,
  };

  await appendTimelineEvent(params.app.db, {
    threadId: params.threadId,
    userId: params.userId,
    summary: clipSentence(
      resolvedProfileContext.tags.length > 0
        ? `User request: ${params.message} [profiles: ${resolvedProfileContext.tags.join(", ")}]`
        : `User request: ${params.message}`,
      220,
    ),
    systemsUsed: [],
    tags: buildTimelineTags({ extracted, routingPlan, profileTags: resolvedProfileContext.tags }),
    type: "input",
  });

  let engineSummary: NormalizedEngineInterpretationContext | null = null;
  let profileReadings: Divin8ProfileReading[] = [];
  let pipelineStatus: Divin8ChatResponse["meta"]["pipeline_status"] = "ok";
  let engineRun: "SKIPPED" | "SUCCESS" | "FAIL" = "SKIPPED";
  let directResponseMessage: string | null = null;

  if (shouldRunAstrologyEngine) {
    if (resolvedProfileContext.profiles.length === 0) {
      pipelineStatus = "engine_not_called";
      engineRun = "SKIPPED";
      directResponseMessage =
        "Astrology calculations in Divin8 chat now require a saved profile. Add a profile in the sidebar and tag it in your message, for example @JohnSmith, and I’ll run the Swiss Ephemeris reading from that record.";
    } else {
      calculationMemory.conversationState = "engine_running";
      audit.engine_payload = resolvedProfileContext.tags;

      for (const profile of resolvedProfileContext.profiles) {
        const profileMemory = applyResolvedProfileToMemory(storedMemory, profile);
        const coreResult = await runCoreSystem({
          threadId: params.threadId,
          userId: params.userId,
          message: params.message,
          profile: {
            fullName: profileMemory.knownProfile.fullName.value,
            birthDate: profileMemory.knownProfile.birthDate.value,
            birthTime: profileMemory.knownProfile.birthTime.value,
            birthLocation: profileMemory.knownProfile.birthLocation.value,
            timezone: profileMemory.knownProfile.timezone.value,
          },
          route: routeDecision,
          requestIntent: extracted.intentHints.summary,
          focusAreas: extracted.extractedEntities.themes.length > 0 ? extracted.extractedEntities.themes : ["general"],
          comparisonRequested: extracted.intentHints.wantsComparison,
          timingPeriod: extracted.extractedEntities.timeWindow,
          resolvedBirthContext: profileMemory.resolvedBirthContext,
        });

        audit.engine_called = true;
        telemetry.usedSwissEph = coreResult.engineRun === "SUCCESS" || telemetry.usedSwissEph;
        engineRun = coreResult.engineRun;

        if (coreResult.status === "success" && coreResult.data.type === "ASTROLOGY") {
          const nextSummary = getInterpretationContext(coreResult);
          if (!nextSummary) {
            pipelineStatus = "engine_failed";
            engineRun = "FAIL";
            directResponseMessage = "The astrology calculation completed, but the interpretation payload was incomplete. Please try again.";
            break;
          }
          if (!engineSummary) {
            engineSummary = nextSummary;
          }
          profileReadings.push({
            tag: profile.tag,
            profile: buildPromptProfile(profile),
            engineSummary: nextSummary,
          });
          audit.engine_success = true;
          audit.engine_result_present = true;
          audit.engine_result_summary_present = true;
        } else if (coreResult.status === "error") {
          pipelineStatus = coreResult.errorCode === "LOCATION_RESOLUTION_FAILED" ? "engine_not_called" : "engine_failed";
          engineRun = coreResult.errorCode === "LOCATION_RESOLUTION_FAILED" ? "SKIPPED" : "FAIL";
          directResponseMessage = coreResult.userMessage;
          routingPlan.routingNotes.push(coreResult.error);
          break;
        }
      }

      if (profileReadings.length > 0 && !directResponseMessage) {
        await appendTimelineEvent(params.app.db, {
          threadId: params.threadId,
          userId: params.userId,
          summary: clipSentence(
            profileReadings.length === 1
              ? `${profileReadings[0].tag}: ${profileReadings[0].engineSummary.summary}`
              : `Astrology calculations completed for ${profileReadings.map((reading) => reading.tag).join(", ")}.`,
            220,
          ),
          systemsUsed: routingPlan.systemsToRun,
          tags: buildTimelineTags({ extracted, routingPlan, profileTags: resolvedProfileContext.tags }),
          type: "engine",
        });
      }
    }
  } else if (routeDecision.requiresEngine && routingPlan.systemsToRun.includes("astrology")) {
    pipelineStatus = "engine_not_called";
  } else {
    pipelineStatus = "ok";
  }

  storedMemory.conversationState =
    routingPlan.responseMode === "engine" && engineSummary
      ? "interpreting"
      : routingPlan.conversationState;

  const readingState = exec.orchestration.readingState;
  const visibleMessageBase = directResponseMessage
    ? { message: directResponseMessage, gptLive: false, gptFailed: false, verificationTag: null as string | null }
    : await requestStructuredAssistantReply({
        prompt: promptConfig.resolvedPrompt,
        history: params.history,
        message: params.message,
        memory: storedMemory,
        extracted,
        tier: params.tier,
        imageDataUrl: imageContext?.dataUrl ?? null,
        engineSummary,
        profiles: promptProfiles,
        profileReadings,
        webContext,
        timelineHighlights,
        responseMode: engineSummary ? "engine" : "chat",
        execDecision,
        readingState,
        routingPlan,
        telemetry,
      });

  const completion = visibleMessageBase;
  const userVisibleMessage = stripVerificationTags(completion.message);

  audit.gpt_response_present = Boolean(userVisibleMessage);
  audit.response_mode =
    directResponseMessage
      ? (audit.engine_called ? "engine_failed" : "clarification")
      : execDecision.action === "inquiry_required"
      ? "clarification"
      : engineSummary
        ? (completion.gptFailed ? "engine+recovery" : "engine+gpt")
        : (completion.gptFailed ? "gpt_recovery" : "gpt_only");

  if (completion.gptFailed && pipelineStatus === "ok") {
    pipelineStatus = "gpt_failed";
  }

  storedMemory.conversationSummary = buildConversationSummary({
    previousSummary: storedMemory.conversationSummary,
    extracted,
    routingPlan,
    responseText: userVisibleMessage,
    memory: storedMemory,
  });
  storedMemory.extractedFacts.lastResolvedSystems = routingPlan.systemsToRun;
  storedMemory.conversationState = routingPlan.responseMode === "engine" && engineSummary
    ? "interpreting"
    : routingPlan.conversationState;

  await appendTimelineEvent(params.app.db, {
    threadId: params.threadId,
    userId: params.userId,
    summary: clipSentence(userVisibleMessage, 220),
    systemsUsed: routingPlan.systemsToRun,
    tags: buildTimelineTags({ extracted, routingPlan, profileTags: resolvedProfileContext.tags }),
    type: "insight",
  });

  const nextTimeline = await listTimelineEvents(params.app.db, params.threadId, params.userId, 12);
  const pipelineStages = formatPipelineStages({
    route: routeDecision,
    engineRun: engineRun as "SKIPPED" | "SUCCESS" | "FAIL",
  });
  const intentSignal: "inquiry" | "confirmation" | "neutral" =
    execDecision.action === "inquiry_required"
      ? "inquiry"
      : execDecision.action === "proceed_with_confirmation"
        ? "confirmation"
        : "neutral";

  const chatMeta = {
    gpt_live: completion.gptLive,
    engine_triggered: routeDecision.requiresEngine,
    engine_called: audit.engine_called,
    engine_success: audit.engine_success,
    pipeline_status: pipelineStatus,
    route_type: routeDecision.type,
    route_confidence: routeDecision.confidence,
    route_strict: routeDecision.strict,
    system_decision: formatSystemDecisionLabel(routeDecision),
    stages: pipelineStages,
    divin8: {
      action: execDecision.action,
      confidence: execDecision.confidence,
      intent_signal: intentSignal,
      tool_blocked_reason: execDecision.toolBlockedReason ?? null,
    },
    telemetry: {
      used_swiss_eph: telemetry.usedSwissEph,
      used_web_search: telemetry.usedWebSearch,
      search_input_used: telemetry.searchInputUsed,
      query_type: telemetry.queryType,
    },
  };

  return {
    chat: {
      message: userVisibleMessage,
      engine_used: Boolean(engineSummary),
      systems_used: routingPlan.systemsToRun,
      meta: chatMeta,
      ...(params.debugAudit ? { audit } : {}),
    },
    storedState: buildStoredDivin8State(
      storedMemory,
      params.imageRef ?? params.storedState?.imageRef,
      chatMeta as StoredPipelineMeta,
      exec.orchestration,
    ),
    timeline: nextTimeline,
  };
}
