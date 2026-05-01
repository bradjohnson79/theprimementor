export const PROMO_TARGETS = {
  QA_SESSION: "qa_session",
  FOCUS_SESSION: "focus",
  MENTORING_SESSION: "mentoring",
  REGEN_SESSION: "regeneration",
  REPORT_INTRO: "report:intro",
  REPORT_DEEP_DIVE: "report:deep_dive",
  REPORT_INITIATE: "report:initiate",
  SUB_SEEKER: "subscription:seeker",
  SUB_INITIATE: "subscription:initiate",
  MENTOR_TRAINING_ENTRY: "mentor_training:entry",
  MENTOR_TRAINING_SEEKER: "mentor_training:seeker",
  MENTOR_TRAINING_INITIATE: "mentor_training:initiate",
  MENTORING_CIRCLE: "mentoring_circle",
} as const;

export type PromoTarget = typeof PROMO_TARGETS[keyof typeof PROMO_TARGETS];

export const PROMO_TARGET_VALUES: PromoTarget[] = Object.values(PROMO_TARGETS);

export const PROMO_TARGET_LABELS: Record<PromoTarget, string> = {
  [PROMO_TARGETS.QA_SESSION]: "Q&A Session",
  [PROMO_TARGETS.FOCUS_SESSION]: "Focus Session",
  [PROMO_TARGETS.MENTORING_SESSION]: "Mentoring Session",
  [PROMO_TARGETS.REGEN_SESSION]: "Regeneration Session",
  [PROMO_TARGETS.REPORT_INTRO]: "Introductory Report",
  [PROMO_TARGETS.REPORT_DEEP_DIVE]: "Deep Dive Report",
  [PROMO_TARGETS.REPORT_INITIATE]: "Initiate Report",
  [PROMO_TARGETS.SUB_SEEKER]: "Seeker Membership",
  [PROMO_TARGETS.SUB_INITIATE]: "Initiate Membership",
  [PROMO_TARGETS.MENTOR_TRAINING_ENTRY]: "Mentor Training Entry Package",
  [PROMO_TARGETS.MENTOR_TRAINING_SEEKER]: "Mentor Training Seeker Package",
  [PROMO_TARGETS.MENTOR_TRAINING_INITIATE]: "Mentor Training Initiate Package",
  [PROMO_TARGETS.MENTORING_CIRCLE]: "Mentoring Circle",
};

export const PROMO_BILLING_SCOPES = ["one_time", "recurring"] as const;
export type PromoBillingScope = typeof PROMO_BILLING_SCOPES[number];

export function isPromoTarget(value: unknown): value is PromoTarget {
  return typeof value === "string" && PROMO_TARGET_VALUES.includes(value as PromoTarget);
}

export function normalizePromoCode(value: string) {
  return value.trim().toUpperCase();
}
