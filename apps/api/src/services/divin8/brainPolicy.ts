import type { ReportTierId, TierReasoningEffort } from "@wisdom/utils";

export const DIVIN8_CHAT_MODEL = "gpt-5.1";
export const DIVIN8_CHAT_REASONING_EFFORT = "medium" as const;

export const DIVIN8_REPORT_MODEL = "gpt-5.1";

export interface Divin8ReasoningConfig {
  effort: TierReasoningEffort;
  deepThinking: boolean;
}

export const DIVIN8_GENERATION_MODEL = "gpt-5.1";
export const DIVIN8_GENERATION_REASONING_CONFIG: Divin8ReasoningConfig = {
  effort: "high",
  deepThinking: true,
};

export const DIVIN8_REPORT_REASONING_BY_TIER: Record<ReportTierId, TierReasoningEffort> = {
  intro: "medium",
  deep_dive: "high",
  initiate: "high",
};

export const DIVIN8_REPORT_REASONING_CONFIG_BY_TIER: Record<ReportTierId, Divin8ReasoningConfig> = {
  intro: { effort: "medium", deepThinking: false },
  deep_dive: { effort: "high", deepThinking: false },
  initiate: { effort: "high", deepThinking: true },
};

export function buildDeepThinkingInstruction(enabled: boolean) {
  if (!enabled) {
    return "Maintain disciplined structure and specific cross-system synthesis.";
  }
  return [
    "Before generating the response, internally analyze cross-pattern relationships, timeline implications, and root versus surface patterns.",
    "Then write with deeper synthesis that reflects those layered connections without exposing chain-of-thought.",
  ].join(" ");
}

export class Divin8SystemError extends Error {
  statusCode: number;

  code: string;

  constructor(code: string, message: string, statusCode = 503) {
    super(message);
    this.name = "Divin8SystemError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

export function divin8UnavailableError() {
  return new Divin8SystemError(
    "DIVIN8_UNAVAILABLE",
    "Divin8 is temporarily unavailable. Please try again.",
    503,
  );
}
