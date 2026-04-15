import { logger } from "@wisdom/utils";
import type { SystemName } from "../blueprint/types.js";
import type { Divin8RouteDecision } from "./engine/types.js";
import type { Divin8ConversationMemory, Divin8ExtractionResult } from "./divin8Orchestrator.js";
import type { Divin8RoutingPlan } from "./divin8RoutingTypes.js";

/** Single source of truth for orchestration thresholds — do not scatter literals. */
export const CONFIDENCE_THRESHOLDS = {
  PROCEED: 0.75,
  CONFIRM: 0.5,
  INQUIRY: 0.5,
} as const;

/** Minimum viable data for astrology engine execution (do not wait for perfection). */
export const MINIMUM_ASTRO_DATA = ["birthDate", "birthTime", "locationOrTimezone"] as const;
const FACTUAL_SEARCH_REGEX =
  /\b(who is|who was|when did|when was|where is|where was|timeline|history|latest|current|date of|birth date|birthplace|born|public figure)\b/i;
const PUBLIC_FIGURE_NAME_REGEX = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b/;

export type ReadingSection = "overview" | "career" | "love" | "spiritual";
export type Divin8QueryType = "astrology" | "factual" | "hybrid";
export type Divin8SearchPurpose = "factual_context" | "missing_birth_inputs" | "not_required";

export type ReadingState = {
  currentSection: ReadingSection;
  completedSections: ReadingSection[];
};

export type Divin8Decision = {
  action: "proceed" | "proceed_with_confirmation" | "inquiry_required";
  confidence: number;
  missingFields: string[];
  uncertainFields: string[];
  assumptions?: Record<string, string>;
  inquiry?: { question: string; field: string };
  confirmation?: { message: string; field: string };
  toolRequired: boolean;
  toolType?: "astrology" | "system" | "search" | "hybrid" | "none";
  toolBlockedReason?: "low_confidence" | "not_required" | "missing_minimum_data";
};

export interface Divin8SearchExecutionPlan {
  queryType: Divin8QueryType;
  shouldSearch: boolean;
  query: string | null;
  purpose: Divin8SearchPurpose;
  missingMinimumAstroKeys: MinimumAstroKey[];
}

export type StoredOrchestrationState = {
  inquiryCountByField: Record<string, number>;
  readingState: ReadingState;
  /** When true, last turn used loop guard — engine may run with assumptions. */
  loopGuardTriggered?: boolean;
};

const DEFAULT_READING_STATE: ReadingState = {
  currentSection: "overview",
  completedSections: [],
};

export function defaultOrchestrationState(): StoredOrchestrationState {
  return {
    inquiryCountByField: {},
    readingState: { ...DEFAULT_READING_STATE, completedSections: [...DEFAULT_READING_STATE.completedSections] },
  };
}

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

/** Internal keys for minimum astro data and loop tracking. */
export type MinimumAstroKey = (typeof MINIMUM_ASTRO_DATA)[number];

export function getMissingMinimumAstroKeys(memory: Divin8ConversationMemory): MinimumAstroKey[] {
  const missing: MinimumAstroKey[] = [];
  if (!memory.knownProfile.birthDate.value?.trim()) missing.push("birthDate");
  if (!memory.knownProfile.birthTime.value?.trim()) missing.push("birthTime");
  const hasLoc = Boolean(memory.knownProfile.birthLocation.value?.trim());
  const hasTz = Boolean(memory.knownProfile.timezone.value?.trim());
  if (!hasLoc && !hasTz) missing.push("locationOrTimezone");
  return missing;
}

export function humanizeMinimumKey(key: MinimumAstroKey): string {
  switch (key) {
    case "birthDate":
      return "birth date";
    case "birthTime":
      return "birth time";
    case "locationOrTimezone":
      return "birth location or timezone";
    default:
      return key;
  }
}

function hasLikelyPublicFigureName(value: string) {
  return PUBLIC_FIGURE_NAME_REGEX.test(value);
}

function buildHybridSearchQuery(
  memory: Divin8ConversationMemory,
  extracted: Divin8ExtractionResult,
  missingKeys: MinimumAstroKey[],
) {
  const name = extracted.extractedEntities.fullName?.trim() || memory.knownProfile.fullName.value?.trim();
  if (!name || !hasLikelyPublicFigureName(name)) {
    return null;
  }

  const terms = new Set<string>();
  if (missingKeys.includes("birthDate")) terms.add("birth date");
  if (missingKeys.includes("birthTime")) terms.add("birth time");
  if (missingKeys.includes("locationOrTimezone")) {
    terms.add("birth place");
    terms.add("timezone");
  }

  return `${name} ${[...terms].join(" ")}`.trim();
}

export function buildSearchExecutionPlan(params: {
  message: string;
  routingPlan: Divin8RoutingPlan;
  route: Divin8RouteDecision;
  memory: Divin8ConversationMemory;
  extracted: Divin8ExtractionResult;
}): Divin8SearchExecutionPlan {
  const message = params.message.trim();
  const missingMinimumAstroKeys = getMissingMinimumAstroKeys(params.memory);
  const hasAstrology = params.routingPlan.systemsToRun.includes("astrology" as SystemName);

  if (hasAstrology) {
    const hybridQuery = buildHybridSearchQuery(params.memory, params.extracted, missingMinimumAstroKeys);
    if (hybridQuery && missingMinimumAstroKeys.length > 0) {
      return {
        queryType: "hybrid",
        shouldSearch: true,
        query: hybridQuery,
        purpose: "missing_birth_inputs",
        missingMinimumAstroKeys,
      };
    }

    return {
      queryType: "astrology",
      shouldSearch: false,
      query: null,
      purpose: "not_required",
      missingMinimumAstroKeys,
    };
  }

  if (FACTUAL_SEARCH_REGEX.test(message)) {
    return {
      queryType: "factual",
      shouldSearch: true,
      query: message,
      purpose: "factual_context",
      missingMinimumAstroKeys: [],
    };
  }

  return {
    queryType: "factual",
    shouldSearch: false,
    query: null,
    purpose: "not_required",
    missingMinimumAstroKeys: [],
  };
}

function computeProfileConfidenceForTools(memory: Divin8ConversationMemory, astroKeys: MinimumAstroKey[]): number {
  if (astroKeys.length === 0) {
    const fields = [
      memory.knownProfile.birthDate,
      memory.knownProfile.birthTime,
      memory.knownProfile.birthLocation,
      memory.knownProfile.timezone,
    ];
    const scores = fields.map((f) => f.confidence).filter((c) => c > 0);
    if (scores.length === 0) return 0.45;
    return clamp01(scores.reduce((a, b) => a + b, 0) / scores.length);
  }
  const scores = astroKeys.map((key) => {
    switch (key) {
      case "birthDate":
        return memory.knownProfile.birthDate.confidence;
      case "birthTime":
        return memory.knownProfile.birthTime.confidence;
      case "locationOrTimezone": {
        const lc = memory.knownProfile.birthLocation.confidence;
        const tz = memory.knownProfile.timezone.confidence;
        return Math.max(lc, tz, 0);
      }
      default:
        return 0;
    }
  });
  return clamp01(scores.reduce((a, b) => a + b, 0) / scores.length);
}

function listUncertainFieldLabels(memory: Divin8ConversationMemory): string[] {
  const out: string[] = [];
  const check = (label: string, field: { confidence: number; value: string | null; accuracy: string }) => {
    if (!field.value?.trim()) return;
    if (field.confidence < CONFIDENCE_THRESHOLDS.PROCEED || field.accuracy === "estimated" || field.accuracy === "partial") {
      out.push(label);
    }
  };
  check("birth date", memory.knownProfile.birthDate);
  check("birth time", memory.knownProfile.birthTime);
  check("birth location", memory.knownProfile.birthLocation);
  check("timezone", memory.knownProfile.timezone);
  return out;
}

function tryInferTimezoneAssumption(memory: Divin8ConversationMemory): Record<string, string> | null {
  const loc = memory.knownProfile.birthLocation.value?.trim();
  if (!loc) return null;
  if (/vancouver|victoria|bc\b|british columbia/i.test(loc)) {
    return {
      timezone:
        "America/Vancouver (Pacific) — inferred from British Columbia location for calculation; confirm if you were born elsewhere.",
    };
  }
  if (/calgary|edmonton|alberta/i.test(loc)) {
    return { timezone: "America/Edmonton (Mountain) — inferred from Alberta location; tell me if that should be different." };
  }
  if (/toronto|ontario|montreal|quebec|ottawa/i.test(loc)) {
    return { timezone: "America/Toronto (Eastern) — inferred from Canada location; say if you need a different zone." };
  }
  return null;
}

function applyAssumptionsToMemory(
  memory: Divin8ConversationMemory,
  assumptions: Record<string, string>,
): Divin8ConversationMemory {
  const next = structuredClone(memory) as Divin8ConversationMemory;
  if (assumptions.timezone && !next.knownProfile.timezone.value) {
    const normalized = assumptions.timezone.split("—")[0]?.trim() ?? assumptions.timezone;
    next.knownProfile.timezone = {
      value: normalized,
      confidence: 0.55,
      source: "inferred",
      accuracy: "estimated",
      updatedAt: new Date().toISOString(),
    };
  }
  return next;
}

export function advanceReadingState(
  state: ReadingState,
  userMessage: string,
  extracted: Divin8ExtractionResult,
): ReadingState {
  const lower = userMessage.toLowerCase();
  const themes = extracted.extractedEntities.themes.map((t) => t.toLowerCase());
  const next: ReadingState = {
    currentSection: state.currentSection,
    completedSections: [...state.completedSections],
  };

  const markComplete = (section: ReadingSection) => {
    if (!next.completedSections.includes(section)) next.completedSections.push(section);
  };

  let target: ReadingSection | null = null;
  if (/career|work|finance|money|job|business/.test(lower) || themes.some((t) => /career|finance|money|work/.test(t))) {
    target = "career";
  } else if (/love|relationship|partner|marriage|romance|dating/.test(lower) || themes.some((t) => /love|relationship/.test(t))) {
    target = "love";
  } else if (/spiritual|growth|soul|path|purpose|healing/.test(lower) || themes.some((t) => /spiritual|growth|purpose/.test(t))) {
    target = "spiritual";
  } else if (/overview|whole|full|general|big picture|start/.test(lower)) {
    target = "overview";
  }

  if (target) {
    markComplete(next.currentSection);
    next.currentSection = target;
  }

  return next;
}

export type BuildDivin8DecisionResult = {
  decision: Divin8Decision;
  orchestration: StoredOrchestrationState;
  /** When loop guard applies assumptions, merged memory for engine run */
  memoryWithAssumptions?: Divin8ConversationMemory;
};

export function logDecision(payload: {
  threadId: string;
  decision: Divin8Decision;
  extractedData: Record<string, unknown>;
  confidence: number;
  routingPlanSummary?: string;
}) {
  logger.info("divin8.decision", {
    threadId: payload.threadId,
    decision: payload.decision,
    extractedData: payload.extractedData,
    confidence: payload.confidence,
    routingPlanSummary: payload.routingPlanSummary,
  });
}

export function buildDivin8Decision(params: {
  threadId: string;
  routingPlan: Divin8RoutingPlan;
  route: Divin8RouteDecision;
  memory: Divin8ConversationMemory;
  extracted: Divin8ExtractionResult;
  orchestration: StoredOrchestrationState | undefined;
}): BuildDivin8DecisionResult {
  const orch = params.orchestration ?? defaultOrchestrationState();
  const routingPlan = params.routingPlan;
  const route = params.route;
  const memory = params.memory;
  const uncertainFields = listUncertainFieldLabels(memory);
  const missingFields = [...routingPlan.missingFields];

  const isSystemDisambiguation =
    Boolean(routingPlan.unsupportedReason)
    || (routingPlan.systemsToRun.length === 0 && routingPlan.missingFields.length === 0 && Boolean(routingPlan.clarificationPrompt));

  if (isSystemDisambiguation) {
    const unsupported = Boolean(routingPlan.unsupportedReason);
    const d: Divin8Decision = {
      action: "inquiry_required",
      confidence: 0.55,
      missingFields: [],
      uncertainFields,
      inquiry: {
        field: "system",
        question: unsupported
          ? "Would you like a Vedic-style calculated chart, or a conversational walkthrough without a full engine run?"
          : "Which thread do you want to pull on first—so we can go deep in one place?",
      },
      toolRequired: false,
      toolType: "none",
      toolBlockedReason: "not_required",
    };
    logDecision({
      threadId: params.threadId,
      decision: d,
      extractedData: serializeProfileSnapshot(memory),
      confidence: d.confidence,
      routingPlanSummary: "system_disambiguation",
    });
    return { decision: d, orchestration: { ...orch, loopGuardTriggered: false } };
  }

  const hasAstrology = routingPlan.systemsToRun.includes("astrology" as SystemName);
  const hasDeterministicSystems = routingPlan.systemsToRun.length > 0;
  if (routingPlan.systemsToRun.length === 0 || (!hasDeterministicSystems && !routingPlan.needsEngine)) {
    const d: Divin8Decision = {
      action: "proceed",
      confidence: clamp01(route.confidence),
      missingFields: [],
      uncertainFields,
      toolRequired: false,
      toolType: "none",
      toolBlockedReason: "not_required",
    };
    logDecision({
      threadId: params.threadId,
      decision: d,
      extractedData: serializeProfileSnapshot(memory),
      confidence: d.confidence,
      routingPlanSummary: "general_or_non_tool",
    });
    return {
      decision: d,
      orchestration: {
        ...orch,
        readingState: advanceReadingState(orch.readingState, params.extracted.rawText, params.extracted),
        loopGuardTriggered: false,
      },
    };
  }

  const wantsAstrologyTools =
    routingPlan.systemsToRun.includes("astrology" as SystemName)
    && route.type === "ASTROLOGY"
    && route.requiresEngine;

  const wantsDeterministicTools =
    routingPlan.systemsToRun.length > 0
    && route.type === "ASTROLOGY"
    && route.requiresEngine;

  if (!wantsDeterministicTools) {
    const conf = clamp01(0.7 + route.confidence * 0.15);
    const d: Divin8Decision = {
      action: conf >= CONFIDENCE_THRESHOLDS.PROCEED ? "proceed" : "proceed_with_confirmation",
      confidence: conf,
      missingFields,
      uncertainFields,
      toolRequired: false,
      toolType: "none",
      toolBlockedReason: "not_required",
      confirmation:
        conf < CONFIDENCE_THRESHOLDS.PROCEED
          ? {
              field: "approach",
              message: "I’ll stay conversational for this part and keep things grounded—tell me if you want a different angle.",
            }
          : undefined,
    };
    logDecision({
      threadId: params.threadId,
      decision: d,
      extractedData: serializeProfileSnapshot(memory),
      confidence: conf,
      routingPlanSummary: "non_astrology_engine_request",
    });
    return {
      decision: d,
      orchestration: {
        ...orch,
        readingState: advanceReadingState(orch.readingState, params.extracted.rawText, params.extracted),
        loopGuardTriggered: false,
      },
    };
  }

  if (!wantsAstrologyTools && wantsDeterministicTools) {
    const conf = clamp01(Math.max(0.78, route.confidence));
    const d: Divin8Decision = {
      action: "proceed",
      confidence: conf,
      missingFields,
      uncertainFields,
      toolRequired: true,
      toolType: "system",
      toolBlockedReason: undefined,
    };
    logDecision({
      threadId: params.threadId,
      decision: d,
      extractedData: serializeProfileSnapshot(memory),
      confidence: conf,
      routingPlanSummary: "deterministic_multi_system",
    });
    return {
      decision: d,
      orchestration: {
        ...orch,
        readingState: advanceReadingState(orch.readingState, params.extracted.rawText, params.extracted),
        loopGuardTriggered: false,
      },
    };
  }

  const astroMissingKeys = getMissingMinimumAstroKeys(memory);
  const profileConf = computeProfileConfidenceForTools(memory, astroMissingKeys);

  const primaryMissingKey = astroMissingKeys[0];
  const askCount = primaryMissingKey ? orch.inquiryCountByField[primaryMissingKey] ?? 0 : 0;
  const loopGuard = Boolean(primaryMissingKey && askCount >= 1);

  let assumptions: Record<string, string> | undefined;
  let memoryWithAssumptions: Divin8ConversationMemory | undefined;
  let loopGuardTriggered = false;

  if (loopGuard && primaryMissingKey === "locationOrTimezone") {
    const inferred = tryInferTimezoneAssumption(memory);
    if (inferred) {
      assumptions = inferred;
      memoryWithAssumptions = applyAssumptionsToMemory(memory, inferred);
      loopGuardTriggered = true;
    } else {
      assumptions = {
        timezone: "UTC+0 (approximate placeholder so we can proceed—share your birth place or zone when you can and I’ll refine).",
      };
      memoryWithAssumptions = applyAssumptionsToMemory(memory, { timezone: assumptions.timezone });
      loopGuardTriggered = true;
    }
  }

  const effectiveMemory = memoryWithAssumptions ?? memory;
  const effectiveMissing = getMissingMinimumAstroKeys(effectiveMemory);

  if (effectiveMissing.length > 0 && !loopGuardTriggered) {
    const field = effectiveMissing[0];
    const nextCounts = { ...orch.inquiryCountByField, [field]: (orch.inquiryCountByField[field] ?? 0) + 1 };
    const d: Divin8Decision = {
      action: "inquiry_required",
      confidence: profileConf,
      missingFields: effectiveMissing.map(humanizeMinimumKey),
      uncertainFields,
      inquiry: {
        field,
        question:
          field === "locationOrTimezone"
            ? "Where were you born—or if it’s easier, which timezone should I use for your birth time?"
            : field === "birthTime"
              ? "What time were you born (as precisely as you know it)?"
              : "What is your birth date (month, day, year)?",
      },
      toolRequired: true,
      toolType: "astrology",
      toolBlockedReason: "missing_minimum_data",
    };
    logDecision({ threadId: params.threadId, decision: d, extractedData: serializeProfileSnapshot(memory), confidence: profileConf });
    return {
      decision: d,
      orchestration: {
        ...orch,
        inquiryCountByField: nextCounts,
        loopGuardTriggered: false,
        readingState: orch.readingState,
      },
    };
  }

  if (effectiveMissing.length > 0 && loopGuardTriggered) {
    const d: Divin8Decision = {
      action: "proceed_with_confirmation",
      confidence: Math.max(profileConf, CONFIDENCE_THRESHOLDS.CONFIRM),
      missingFields: effectiveMissing.map(humanizeMinimumKey),
      uncertainFields,
      assumptions,
      confirmation: {
        field: primaryMissingKey ?? "locationOrTimezone",
        message:
          "I’m using a workable default for the missing piece so we can move forward—tell me if you want to adjust it and I’ll refine.",
      },
      toolRequired: true,
      toolType: "astrology",
      toolBlockedReason: undefined,
    };
    logDecision({ threadId: params.threadId, decision: d, extractedData: serializeProfileSnapshot(effectiveMemory), confidence: d.confidence });
    return {
      decision: d,
      orchestration: {
        ...orch,
        inquiryCountByField: orch.inquiryCountByField,
        loopGuardTriggered: true,
        readingState: advanceReadingState(orch.readingState, params.extracted.rawText, params.extracted),
      },
      memoryWithAssumptions: effectiveMemory,
    };
  }

  const confAfterData = computeProfileConfidenceForTools(effectiveMemory, []);

  if (confAfterData < CONFIDENCE_THRESHOLDS.INQUIRY) {
    const d: Divin8Decision = {
      action: "inquiry_required",
      confidence: confAfterData,
      missingFields,
      uncertainFields,
      inquiry: {
        field: "confidence",
        question: "I want to stay aligned with you—could you confirm your birth details once more in your own words?",
      },
      toolRequired: true,
      toolType: "astrology",
      toolBlockedReason: "low_confidence",
    };
    logDecision({ threadId: params.threadId, decision: d, extractedData: serializeProfileSnapshot(effectiveMemory), confidence: confAfterData });
    return {
      decision: d,
      orchestration: { ...orch, loopGuardTriggered: false },
    };
  }

  if (confAfterData < CONFIDENCE_THRESHOLDS.PROCEED) {
    const tz = effectiveMemory.knownProfile.timezone.value;
    const loc = effectiveMemory.knownProfile.birthLocation.value;
    const d: Divin8Decision = {
      action: "proceed_with_confirmation",
      confidence: confAfterData,
      missingFields,
      uncertainFields,
      assumptions:
        tz || loc
          ? {
              ...(tz ? { timezone: tz } : {}),
              ...(loc ? { birthLocation: loc } : {}),
            }
          : undefined,
      confirmation: {
        field: "timezone",
        message: `I’m working with ${loc ? `“${loc}”` : "your location"}${tz ? ` and ${tz} for timing` : ""}—say the word if any of that should shift.`,
      },
      toolRequired: true,
      toolType: "astrology",
      toolBlockedReason: "low_confidence",
    };
    logDecision({ threadId: params.threadId, decision: d, extractedData: serializeProfileSnapshot(effectiveMemory), confidence: confAfterData });
    return {
      decision: d,
      orchestration: {
        ...orch,
        loopGuardTriggered: false,
        readingState: advanceReadingState(orch.readingState, params.extracted.rawText, params.extracted),
      },
      memoryWithAssumptions: effectiveMemory,
    };
  }

  const d: Divin8Decision = {
    action: "proceed",
    confidence: confAfterData,
    missingFields: [],
    uncertainFields,
    assumptions: undefined,
    toolRequired: true,
    toolType: "astrology",
    toolBlockedReason: undefined,
  };
  logDecision({ threadId: params.threadId, decision: d, extractedData: serializeProfileSnapshot(effectiveMemory), confidence: confAfterData });
  return {
    decision: d,
    orchestration: {
      ...orch,
      inquiryCountByField: {},
      loopGuardTriggered: false,
      readingState: advanceReadingState(orch.readingState, params.extracted.rawText, params.extracted),
    },
    memoryWithAssumptions: effectiveMemory,
  };
}

function serializeProfileSnapshot(memory: Divin8ConversationMemory) {
  return {
    birthDate: memory.knownProfile.birthDate.value,
    birthTime: memory.knownProfile.birthTime.value,
    birthLocation: memory.knownProfile.birthLocation.value,
    timezone: memory.knownProfile.timezone.value,
  };
}
