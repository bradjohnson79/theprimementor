import type { ReportTierId, TierReasoningEffort } from "@wisdom/utils";

export const DIVIN8_CHAT_MODEL = "gpt-5.1";
export const DIVIN8_CHAT_REASONING_EFFORT = "medium" as const;

export const DIVIN8_REPORT_MODEL = "gpt-5.1";

export const DIVIN8_REPORT_REASONING_BY_TIER: Record<ReportTierId, TierReasoningEffort> = {
  intro: "low",
  deep_dive: "medium",
  initiate: "high",
};

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
