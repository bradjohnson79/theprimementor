export type SessionLandingType = "regeneration" | "qa" | "focus" | "mentoring" | "prime_body_healing";

export const SESSION_LANDING_PATHS: Record<SessionLandingType, string> = {
  regeneration: "/sessions/regeneration",
  qa: "/sessions/qa",
  focus: "/sessions/focus",
  mentoring: "/sessions/mentoring",
  prime_body_healing: "/sessions/prime-body-healing",
};

export const SESSION_BOOKING_PATHS: Record<SessionLandingType, string> = {
  regeneration: "/sessions/regeneration/book",
  qa: "/sessions/qa/book",
  focus: "/sessions/focus/book",
  mentoring: "/sessions/mentoring/book",
  prime_body_healing: "/sessions/prime-body-healing/book",
};

export const REGENERATION_LANDING_PATH = SESSION_LANDING_PATHS.regeneration;
export const QA_LANDING_PATH = SESSION_LANDING_PATHS.qa;
export const FOCUS_LANDING_PATH = SESSION_LANDING_PATHS.focus;
export const MENTORING_LANDING_PATH = SESSION_LANDING_PATHS.mentoring;

export const REGENERATION_BOOKING_PATH = SESSION_BOOKING_PATHS.regeneration;
export const QA_BOOKING_PATH = SESSION_BOOKING_PATHS.qa;
export const FOCUS_BOOKING_PATH = SESSION_BOOKING_PATHS.focus;
export const MENTORING_BOOKING_PATH = SESSION_BOOKING_PATHS.mentoring;
export const PRIME_BODY_HEALING_LANDING_PATH = SESSION_LANDING_PATHS.prime_body_healing;
export const PRIME_BODY_HEALING_BOOKING_PATH = SESSION_BOOKING_PATHS.prime_body_healing;

export function sessionBookingPath(type: SessionLandingType) {
  return SESSION_BOOKING_PATHS[type];
}

export function sessionLandingPath(type: SessionLandingType) {
  return SESSION_LANDING_PATHS[type];
}
