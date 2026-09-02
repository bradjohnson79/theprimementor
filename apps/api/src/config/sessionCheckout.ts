export type SessionCheckoutType = "focus" | "mentoring" | "regeneration" | "qa_session" | "prime_body_healing";

const SESSION_PRODUCT_NAMES: Record<SessionCheckoutType, string[]> = {
  focus: ["Focus Session (Legacy)"],
  mentoring: ["Mentoring Session"],
  regeneration: ["Regeneration Monthly Package", "Regeneration Session", "Offline Regeneration Session"],
  qa_session: ["Q&A Session"],
  prime_body_healing: [
    "Prime Body Healing — Level 1 Live",
    "Prime Body Healing — Level 1 Pre-Recorded",
    "Prime Body Healing — Level 2",
  ],
};

export function getSessionCheckoutProductNames(sessionType: SessionCheckoutType) {
  return SESSION_PRODUCT_NAMES[sessionType];
}

export function getSessionCheckoutPath(sessionType: SessionCheckoutType) {
  if (sessionType === "qa_session") {
    return "/sessions/qa";
  }
  if (sessionType === "prime_body_healing") {
    return "/sessions/prime-body-healing";
  }
  return `/sessions/${sessionType}`;
}
