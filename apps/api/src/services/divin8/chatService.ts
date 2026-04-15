import type { FastifyInstance } from "fastify";
import {
  DIVIN8_LIMITS,
  MAX_DIVIN8_PROFILES_PER_MESSAGE,
  MAX_DIVIN8_TIMELINES_PER_MESSAGE,
  extractDivin8TimelineTags,
  normalizeLanguage,
  validateDivin8TimelineRequest,
  type LanguageCode,
  type Divin8TimelineRequest,
} from "@wisdom/utils";

export type Divin8ChatTier = "seeker" | "initiate";

export interface Divin8ChatRequest {
  message: string;
  image_ref?: string;
  profile_tags?: string[];
  timeline?: Divin8TimelineRequest;
  tier: Divin8ChatTier;
  language?: LanguageCode;
  debugAudit?: boolean;
}

export interface Divin8MemberMessageRequest {
  message: string;
  image_ref?: string;
  profile_tags?: string[];
  timeline?: Divin8TimelineRequest;
  language?: LanguageCode;
  debugAudit?: boolean;
  request_id?: string;
}

export interface Divin8ChatAudit {
  intent: string;
  needs_engine: boolean;
  extracted_fields: {
    fullName: string | null;
    birthDate: string | null;
    birthTime: string | null;
    birthLocation: string | null;
  };
  missing_fields: string[];
  engine_payload: unknown | null;
  engine_called: boolean;
  engine_success: boolean;
  engine_result_present: boolean;
  engine_result_summary_present: boolean;
  gpt_called: boolean;
  gpt_response_present: boolean;
  used_web_search?: boolean;
  search_input_used?: boolean;
  query_type?: "astrology" | "factual" | "hybrid";
  response_mode:
    | "gpt_only"
    | "clarification"
    | "engine+gpt"
    | "engine+recovery"
    | "engine_failed"
    | "gpt_recovery";
}

export interface Divin8ChatResponse {
  message: string;
  engine_used: boolean;
  systems_used: string[];
  meta: {
    gpt_live: boolean;
    engine_triggered: boolean;
    engine_called: boolean;
    engine_success: boolean;
    pipeline_status: "ok" | "engine_not_called" | "engine_failed" | "gpt_failed";
    route_type: "ASTROLOGY" | "GENERAL";
    route_confidence: number;
    route_strict: boolean;
    system_decision: string;
    stages: {
      input_received: boolean;
      routed: "ASTROLOGY" | "GENERAL";
      engine_required: boolean;
      engine_run: "SKIPPED" | "SUCCESS" | "FAIL";
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
      query_type: "astrology" | "factual" | "hybrid";
    };
    tier?: Divin8ChatTier;
    usage?: {
      used: number;
      limit: number | null;
    };
  };
  audit?: Divin8ChatAudit;
}

export interface SessionHistoryItem {
  role: "user" | "assistant";
  content: string;
}

export const MAX_HISTORY = 10;
export const GPT_LIVE_TAG_REGEX = /\[DIVIN8_GPT_LIVE_[^\]]+\]/g;

export function stripVerificationTags(text: string) {
  return text.replace(GPT_LIVE_TAG_REGEX, "").trim();
}

function validateTimelineInput(message: string, rawTimeline: unknown) {
  const timelineTags = extractDivin8TimelineTags(message);
  if (timelineTags.length > MAX_DIVIN8_TIMELINES_PER_MESSAGE) {
    throw new Error("Only one timeline range can be used per reading.");
  }

  if (rawTimeline == null) {
    if (timelineTags.length > 0) {
      throw new Error("Timeline tags must be created with the calendar selector so the system and date range are preserved.");
    }
    return undefined;
  }

  const timeline = validateDivin8TimelineRequest(rawTimeline);
  if (!message.includes(timeline.tag)) {
    throw new Error("Timeline payload must match the visible timeline tag in the message.");
  }
  return timeline;
}

export function validateDivin8ChatRequest(body: unknown): Divin8ChatRequest {
  if (!body || typeof body !== "object") {
    throw new Error("Request body is required.");
  }

  const input = body as Record<string, unknown>;
  const message = typeof input.message === "string" ? input.message.trim() : "";
  const tier = input.tier;
  const imageRef = input.image_ref;
  const profileTags = Array.isArray(input.profile_tags)
    ? input.profile_tags.filter((value): value is string => typeof value === "string" && value.trim().startsWith("@")).map((value) => value.trim())
    : [];
  const timeline = validateTimelineInput(message, input.timeline);
  const language = normalizeLanguage(input.language);
  const debugAudit = input.debugAudit === true;

  if (!message) {
    throw new Error("message is required.");
  }

  if (tier !== "seeker" && tier !== "initiate") {
    throw new Error("tier must be seeker or initiate.");
  }

  if (imageRef !== undefined && imageRef !== null && typeof imageRef !== "string") {
    throw new Error("image_ref must be a string when provided.");
  }

  if (profileTags.length > MAX_DIVIN8_PROFILES_PER_MESSAGE) {
    throw new Error(`A maximum of ${MAX_DIVIN8_PROFILES_PER_MESSAGE} profiles may be sent per reading.`);
  }

  if (tier === "seeker" && timeline) {
    throw new Error("Timeline readings are available for Initiate members only.");
  }

  return {
    message,
    tier,
    image_ref: typeof imageRef === "string" && imageRef.trim() ? imageRef.trim() : undefined,
    profile_tags: profileTags,
    timeline,
    language,
    debugAudit,
  };
}

export function validateDivin8MemberMessageRequest(body: unknown): Divin8MemberMessageRequest {
  if (!body || typeof body !== "object") {
    throw new Error("Request body is required.");
  }

  const input = body as Record<string, unknown>;
  const message = typeof input.message === "string" ? input.message.trim() : "";
  const imageRef = input.image_ref;
  const profileTags = Array.isArray(input.profile_tags)
    ? input.profile_tags.filter((value): value is string => typeof value === "string" && value.trim().startsWith("@")).map((value) => value.trim())
    : [];
  const timeline = validateTimelineInput(message, input.timeline);
  const language = normalizeLanguage(input.language);
  const debugAudit = input.debugAudit === true;
  const requestId = typeof input.request_id === "string" ? input.request_id.trim() : "";

  if (!message) {
    throw new Error("message is required.");
  }

  if (imageRef !== undefined && imageRef !== null && typeof imageRef !== "string") {
    throw new Error("image_ref must be a string when provided.");
  }

  if (profileTags.length > MAX_DIVIN8_PROFILES_PER_MESSAGE) {
    throw new Error(`A maximum of ${MAX_DIVIN8_PROFILES_PER_MESSAGE} profiles may be sent per reading.`);
  }

  return {
    message,
    image_ref: typeof imageRef === "string" && imageRef.trim() ? imageRef.trim() : undefined,
    profile_tags: profileTags,
    timeline,
    language,
    debugAudit,
    request_id: requestId || undefined,
  };
}

export function getTierPromptLimit(tier: Divin8ChatTier) {
  return DIVIN8_LIMITS[tier];
}

export function createDeprecatedDivin8ChatError() {
  const error = new Error(
    "POST /api/divin8/chat is deprecated. Create or reuse a conversation thread and use POST /api/divin8/conversations/:id/message instead.",
  ) as Error & { statusCode?: number };
  error.statusCode = 410;
  return error;
}

export async function runDivin8Chat(
  _app: FastifyInstance,
  _sessionKey: string,
  _request: Divin8ChatRequest,
): Promise<Divin8ChatResponse> {
  throw createDeprecatedDivin8ChatError();
}
