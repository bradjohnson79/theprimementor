import type { Divin8TimelineRequest } from "@wisdom/utils";

export type Divin8ChatTier = "seeker" | "initiate";

export interface Divin8ServerTimeContext {
  currentDate: string;
  currentTime: string;
  currentDateTime: string;
  timezone: string;
}

export interface Divin8RetryPayload {
  text: string;
  imageRef: string | null;
  imageName: string | null;
  imagePreviewUrl: string | null;
  profileTags: string[];
  timeline: Divin8TimelineRequest | null;
  tier: Divin8ChatTier;
  language: string;
  requestId: string;
}

export interface Divin8ChatMeta {
  gptLive: boolean;
  engineTriggered: boolean;
  engineCalled: boolean;
  engineSuccess: boolean;
  pipelineStatus: "running" | "ok" | "engine_not_called" | "engine_failed" | "gpt_failed";
  routeType?: "ASTROLOGY" | "GENERAL";
  routeConfidence?: number;
  routeStrict?: boolean;
  systemDecision?: string;
  timeContext?: Divin8ServerTimeContext;
  stages?: {
    inputReceived: boolean;
    routed: "ASTROLOGY" | "GENERAL";
    engineRequired: boolean;
    engineRun: "SKIPPED" | "SUCCESS" | "FAIL";
    responseSent: boolean;
  };
  verificationTag?: string | null;
  divin8?: {
    action: "proceed" | "proceed_with_confirmation" | "inquiry_required";
    confidence: number;
    intentSignal: "inquiry" | "confirmation" | "neutral";
  };
  telemetry?: {
    usedSwissEph: boolean;
    usedWebSearch: boolean;
    searchInputUsed: boolean;
    queryType: "astrology" | "factual" | "hybrid";
  };
}

export interface Divin8ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  engineUsed?: boolean;
  systemsUsed?: string[];
  meta?: Divin8ChatMeta;
  imagePreviewUrl?: string | null;
  createdAt: string;
  deliveryState?: "sending" | "failed";
  deliveryError?: string | null;
  retryPayload?: Divin8RetryPayload | null;
}

export interface Divin8ConversationThread {
  id: string;
  title: string;
  summary: string | null;
  preview: string | null;
  messageCount: number;
  createdAt: string;
  updatedAt: string | null;
}

export interface Divin8Profile {
  id: string;
  fullName: string;
  tag: string;
  birthDate: string;
  birthTime: string;
  birthPlace: string;
  lat: number;
  lng: number;
  timezone: string;
  createdAt: string;
}

export interface Divin8TimelineDraft extends Divin8TimelineRequest {}

export interface Divin8TimelineEvent {
  id: string;
  summary: string;
  systemsUsed: string[];
  tags: string[];
  type: "input" | "engine" | "insight";
  createdAt: string;
}
