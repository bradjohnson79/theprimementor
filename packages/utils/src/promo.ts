export const PROMO_TARGETS = {
  QA_SESSION: "qa_session",
  QA_SESSION_30: "qa_session:30",
  QA_SESSION_45: "qa_session:45",
  QA_SESSION_60: "qa_session:60",
  FOCUS_SESSION: "focus",
  MENTORING_SESSION: "mentoring",
  MENTORING_SESSION_45: "mentoring:45",
  MENTORING_SESSION_90: "mentoring:90",
  REGEN_SESSION: "regeneration",
  REPORT_THREE_QUESTIONS: "report:three_questions",
  REPORT_COMPATIBILITY: "report:compatibility",
  REPORT_ANNUAL_12_MONTH: "report:annual_12_month",
  REPORT_INTRO: "report:intro",
  REPORT_DEEP_DIVE: "report:deep_dive",
  REPORT_INITIATE: "report:initiate",
  SUB_SEEKER: "subscription:seeker",
  SUB_INITIATE: "subscription:initiate",
  MENTOR_TRAINING_ENTRY: "mentor_training:entry",
  MENTOR_TRAINING_SEEKER: "mentor_training:seeker",
  MENTOR_TRAINING_INITIATE: "mentor_training:initiate",
  MENTORING_CIRCLE: "mentoring_circle",
  SHOP_REMOTE_SOURCE_BED_KIT: "shop:remote-source-bed-kit",
  SHOP_DIGITAL_SAFEGUARD_KIT: "shop:digital-safeguard-kit",
  SHOP_SOURCE_DECK_BODY_SET: "shop:healing-code-cards-source-deck-body-set",
  SHOP_BODY_DECK: "shop:healing-code-cards-body-deck",
  SHOP_MIND_DECK: "shop:healing-code-cards-mind-deck",
  SHOP_ENERGY_DECK: "shop:healing-code-cards-energy-deck",
} as const;

export type PromoTarget = typeof PROMO_TARGETS[keyof typeof PROMO_TARGETS];

export const PROMO_TARGET_VALUES: PromoTarget[] = Object.values(PROMO_TARGETS);

export const PROMO_TARGET_LABELS: Record<PromoTarget, string> = {
  [PROMO_TARGETS.QA_SESSION]: "Q&A Session",
  [PROMO_TARGETS.QA_SESSION_30]: "30 min Q&A Session",
  [PROMO_TARGETS.QA_SESSION_45]: "45 min Q&A Session",
  [PROMO_TARGETS.QA_SESSION_60]: "60 min Q&A Session",
  [PROMO_TARGETS.FOCUS_SESSION]: "Focus Session (Legacy)",
  [PROMO_TARGETS.MENTORING_SESSION]: "Mentoring Sessions (45 & 90 min)",
  [PROMO_TARGETS.MENTORING_SESSION_45]: "45 min Mentoring Session",
  [PROMO_TARGETS.MENTORING_SESSION_90]: "90 min Mentoring Session",
  [PROMO_TARGETS.REGEN_SESSION]: "Regeneration Monthly Package",
  [PROMO_TARGETS.REPORT_THREE_QUESTIONS]: "3 Questions Report",
  [PROMO_TARGETS.REPORT_COMPATIBILITY]: "Compatibility Report",
  [PROMO_TARGETS.REPORT_ANNUAL_12_MONTH]: "12 Month Annual Report",
  [PROMO_TARGETS.REPORT_INTRO]: "Introductory Report",
  [PROMO_TARGETS.REPORT_DEEP_DIVE]: "Deep Dive Report",
  [PROMO_TARGETS.REPORT_INITIATE]: "Initiate Report",
  [PROMO_TARGETS.SUB_SEEKER]: "Premium Membership",
  [PROMO_TARGETS.SUB_INITIATE]: "Initiate Membership",
  [PROMO_TARGETS.MENTOR_TRAINING_ENTRY]: "Mentor Training Entry Package",
  [PROMO_TARGETS.MENTOR_TRAINING_SEEKER]: "Mentor Training Seeker Package",
  [PROMO_TARGETS.MENTOR_TRAINING_INITIATE]: "Mentor Training Initiate Package",
  [PROMO_TARGETS.MENTORING_CIRCLE]: "Mentoring Circle",
  [PROMO_TARGETS.SHOP_REMOTE_SOURCE_BED_KIT]: "Remote Source Bed Kit",
  [PROMO_TARGETS.SHOP_DIGITAL_SAFEGUARD_KIT]: "Digital Safeguard Kit",
  [PROMO_TARGETS.SHOP_SOURCE_DECK_BODY_SET]: "Healing Code Cards: Source Deck — Body Set",
  [PROMO_TARGETS.SHOP_BODY_DECK]: "Healing Code Cards: Body Deck",
  [PROMO_TARGETS.SHOP_MIND_DECK]: "Healing Code Cards: Mind Deck",
  [PROMO_TARGETS.SHOP_ENERGY_DECK]: "Healing Code Cards: Energy Deck",
};

export const PROMO_BILLING_SCOPES = ["one_time", "recurring"] as const;
export type PromoBillingScope = typeof PROMO_BILLING_SCOPES[number];

export function isPromoTarget(value: unknown): value is PromoTarget {
  return typeof value === "string" && PROMO_TARGET_VALUES.includes(value as PromoTarget);
}

export function buildShopPromoTarget(slug: string): PromoTarget | null {
  const target = `shop:${slug.trim()}`;
  return isPromoTarget(target) ? target : null;
}

export function normalizePromoCode(value: string) {
  return value.trim().toUpperCase();
}

export function isSubscriptionPromoTarget(target: PromoTarget) {
  return target.startsWith("subscription:");
}

export function selectedTargetsIncludeSubscription(targets: PromoTarget[]) {
  return targets.some(isSubscriptionPromoTarget);
}

export function normalizePromoBillingScopeForTargets(
  billingScope: PromoBillingScope | "none",
  targets: PromoTarget[],
): PromoBillingScope | null {
  if (!selectedTargetsIncludeSubscription(targets)) {
    return null;
  }
  return billingScope === "recurring" ? billingScope : null;
}
