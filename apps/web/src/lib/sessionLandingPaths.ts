export type SessionLandingType = "regeneration" | "focus" | "mentoring";

export const SESSION_LANDING_PATHS: Record<SessionLandingType, string> = {
  regeneration: "/sessions/regeneration",
  focus: "/sessions/focus",
  mentoring: "/sessions/mentoring",
};

export const SESSION_BOOKING_PATHS: Record<SessionLandingType, string> = {
  regeneration: "/sessions/regeneration/book",
  focus: "/sessions/focus/book",
  mentoring: "/sessions/mentoring/book",
};

export const REGENERATION_LANDING_PATH = SESSION_LANDING_PATHS.regeneration;
export const FOCUS_LANDING_PATH = SESSION_LANDING_PATHS.focus;
export const MENTORING_LANDING_PATH = SESSION_LANDING_PATHS.mentoring;

export const REGENERATION_BOOKING_PATH = SESSION_BOOKING_PATHS.regeneration;
export const FOCUS_BOOKING_PATH = SESSION_BOOKING_PATHS.focus;
export const MENTORING_BOOKING_PATH = SESSION_BOOKING_PATHS.mentoring;

export function sessionBookingPath(type: SessionLandingType) {
  return SESSION_BOOKING_PATHS[type];
}

export function sessionLandingPath(type: SessionLandingType) {
  return SESSION_LANDING_PATHS[type];
}
