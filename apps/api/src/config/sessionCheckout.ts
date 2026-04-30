export type SessionCheckoutType = "focus" | "mentoring" | "regeneration" | "qa_session";

const SESSION_PRODUCT_NAMES: Record<SessionCheckoutType, string[]> = {
  focus: ["Focus Session"],
  mentoring: ["Mentoring Session"],
  regeneration: ["Regeneration Session", "Offline Regeneration Session"],
  qa_session: ["Q&A Session"],
};

export function getSessionCheckoutProductNames(sessionType: SessionCheckoutType) {
  return SESSION_PRODUCT_NAMES[sessionType];
}

export function getSessionCheckoutPath(sessionType: SessionCheckoutType) {
  if (sessionType === "qa_session") {
    return "/sessions/qa";
  }
  return `/sessions/${sessionType}`;
}
