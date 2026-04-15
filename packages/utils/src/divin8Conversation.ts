export interface Divin8UsageResponse {
  month_used: number;
  seeker_limit: number;
  used?: number;
  limit?: number | null;
  period_start?: string;
  period_end?: string;
}

export interface Divin8ConversationSummaryResponse {
  id: string;
  title: string;
  summary: string | null;
  preview: string | null;
  message_count: number;
  created_at: string;
  updated_at: string | null;
}

export interface Divin8TimelineEventResponse {
  id: string;
  summary: string;
  systems_used?: string[] | null;
  tags?: string[] | null;
  type: "input" | "engine" | "insight";
  created_at: string;
}

export interface Divin8MessageMetaResponse {
  engine_used?: boolean;
  systems_used?: string[];
  pipeline_status?: string;
  route_type?: string;
  stages?: {
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
  };
  telemetry?: {
    used_swiss_eph: boolean;
    used_web_search: boolean;
    search_input_used: boolean;
    query_type: "astrology" | "factual" | "hybrid";
  };
}

export interface Divin8ConversationMessageResponse {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
  meta?: Divin8MessageMetaResponse | null;
}

export interface Divin8ChatPayloadResponse {
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
    divin8?: Divin8MessageMetaResponse["divin8"];
    telemetry?: Divin8MessageMetaResponse["telemetry"];
    tier?: "seeker" | "initiate";
    usage?: {
      used: number;
      limit: number | null;
    };
  };
}

export interface Divin8ConversationDetailResponse {
  thread: Divin8ConversationSummaryResponse;
  messages: Divin8ConversationMessageResponse[];
  timeline: Divin8TimelineEventResponse[];
  last_pipeline_meta: {
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
    divin8?: Divin8MessageMetaResponse["divin8"];
    telemetry?: Divin8MessageMetaResponse["telemetry"];
  } | null;
}

export interface Divin8ConversationsResponse {
  threads: Divin8ConversationSummaryResponse[];
  usage: Divin8UsageResponse;
}

export interface Divin8ConversationPostResponse {
  thread: Divin8ConversationSummaryResponse;
  assistant_message: Divin8ConversationMessageResponse;
  chat: Divin8ChatPayloadResponse;
  timeline: Divin8TimelineEventResponse[];
  usage: Divin8UsageResponse;
  meta?: {
    tier: "seeker" | "initiate";
    billing_interval: "monthly" | "annual";
    usage: {
      used: number;
      limit: number | null;
      period_start: string;
      period_end: string;
    };
  };
}
