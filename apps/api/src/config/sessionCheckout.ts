export type SessionCheckoutType = "focus" | "mentoring" | "regeneration";

const SESSION_PRODUCT_NAMES: Record<SessionCheckoutType, string[]> = {
  focus: ["Focus Session"],
  mentoring: ["Mentoring Session"],
  regeneration: ["Regeneration Session", "Offline Regeneration Session"],
};

export function getSessionCheckoutProductNames(sessionType: SessionCheckoutType) {
  return SESSION_PRODUCT_NAMES[sessionType];
}

export function getSessionCheckoutPath(sessionType: SessionCheckoutType) {
  return `/sessions/${sessionType}`;
}
