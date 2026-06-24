export type SessionOfferingSessionType = "qa_session" | "mentoring" | "regeneration";
export type SessionOfferingBillingType = "one_time" | "subscription";
export type SessionOfferingIntakeFlow = "guided_session" | "regeneration";

export interface SessionOffering {
  productKey: string;
  bookingTypeId: string;
  sessionType: SessionOfferingSessionType;
  displayName: string;
  durationMinutes: number | null;
  billingType: SessionOfferingBillingType;
  currency: "CAD";
  amountCents: number;
  stripePriceEnvKey?: string;
  stripeLivePriceEnvKey?: string;
  stripeLivePriceFallback?: string;
  active: boolean;
  intakeFlow: SessionOfferingIntakeFlow;
  schedulingRequired: boolean;
  description: string;
  tooltip?: string;
}

export const CANONICAL_SESSION_OFFERINGS = [
  {
    productKey: "qa-session-30",
    bookingTypeId: "qa-session-30",
    sessionType: "qa_session",
    displayName: "Q&A Session",
    durationMinutes: 30,
    billingType: "one_time",
    currency: "CAD",
    amountCents: 13900,
    stripePriceEnvKey: "STRIPE_PRICE_QA_SESSION_30",
    stripeLivePriceEnvKey: "STRIPE_LIVE_PRICE_QA_SESSION_30",
    stripeLivePriceFallback: "price_1Te0tkAd5V3LaCqjaF1A19RZ",
    active: true,
    intakeFlow: "guided_session",
    schedulingRequired: true,
    tooltip: "This session allows you to ask any questions you want and receive direct clarity from Brad Johnson.",
    description: "An open, low-friction session for questions, clarity, and direct perspective when you want to lead the conversation.",
  },
  {
    productKey: "qa-session-45",
    bookingTypeId: "qa-session-45",
    sessionType: "qa_session",
    displayName: "Q&A Session",
    durationMinutes: 45,
    billingType: "one_time",
    currency: "CAD",
    amountCents: 18900,
    stripePriceEnvKey: "STRIPE_PRICE_QA_SESSION_45",
    stripeLivePriceEnvKey: "STRIPE_LIVE_PRICE_QA_SESSION_45",
    stripeLivePriceFallback: "price_1Te0uFAd5V3LaCqjT7Cf7Gmg",
    active: true,
    intakeFlow: "guided_session",
    schedulingRequired: true,
    tooltip: "This session allows you to ask any questions you want and receive direct clarity from Brad Johnson.",
    description: "An open, low-friction session for questions, clarity, and direct perspective when you want to lead the conversation.",
  },
  {
    productKey: "qa-session-60",
    bookingTypeId: "qa-session-60",
    sessionType: "qa_session",
    displayName: "Q&A Session",
    durationMinutes: 60,
    billingType: "one_time",
    currency: "CAD",
    amountCents: 23900,
    stripePriceEnvKey: "STRIPE_PRICE_QA_SESSION_60",
    stripeLivePriceEnvKey: "STRIPE_LIVE_PRICE_QA_SESSION_60",
    stripeLivePriceFallback: "price_1Te0ukAd5V3LaCqjDpn9oY0w",
    active: true,
    intakeFlow: "guided_session",
    schedulingRequired: true,
    tooltip: "This session allows you to ask any questions you want and receive direct clarity from Brad Johnson.",
    description: "An open, low-friction session for questions, clarity, and direct perspective when you want to lead the conversation.",
  },
  {
    productKey: "mentoring-session-45",
    bookingTypeId: "mentoring-session-45",
    sessionType: "mentoring",
    displayName: "Mentoring Session",
    durationMinutes: 45,
    billingType: "one_time",
    currency: "CAD",
    amountCents: 19900,
    stripePriceEnvKey: "STRIPE_PRICE_MENTORING_45",
    stripeLivePriceEnvKey: "STRIPE_LIVE_PRICE_MENTORING_45",
    stripeLivePriceFallback: "price_1TILliAd5V3LaCqjidvbVLrl",
    active: true,
    intakeFlow: "guided_session",
    schedulingRequired: true,
    tooltip: "A focused mentoring session for blueprint insight, goal alignment, and practical direction.",
    description: "A deeper guided session for blueprint insight, goal alignment, and practical mentoring through the Divin8 system.",
  },
  {
    productKey: "wisdom-mentoring-90",
    bookingTypeId: "wisdom-mentoring-90",
    sessionType: "mentoring",
    displayName: "Mentoring Session",
    durationMinutes: 90,
    billingType: "one_time",
    currency: "CAD",
    amountCents: 29900,
    stripePriceEnvKey: "STRIPE_PRICE_MENTORING_90",
    stripeLivePriceEnvKey: "STRIPE_LIVE_PRICE_MENTORING_90",
    stripeLivePriceFallback: "price_1TILnFAd5V3LaCqjkR9tAMuC",
    active: true,
    intakeFlow: "guided_session",
    schedulingRequired: true,
    tooltip: "A full mentoring session for deeper blueprint insight, goal alignment, and practical direction.",
    description: "A deeper guided session for blueprint insight, goal alignment, and practical mentoring through the Divin8 system.",
  },
  {
    productKey: "regeneration-session",
    bookingTypeId: "regeneration-session",
    sessionType: "regeneration",
    displayName: "Regeneration Monthly Package",
    durationMinutes: null,
    billingType: "subscription",
    currency: "CAD",
    amountCents: 9900,
    stripePriceEnvKey: "STRIPE_PRICE_REGENERATION_MONTHLY_PACKAGE",
    stripeLivePriceEnvKey: "STRIPE_LIVE_PRICE_REGENERATION_MONTHLY_PACKAGE",
    stripeLivePriceFallback: "price_1TSOy3Ad5V3LaCqjBkFRd1IL",
    active: true,
    intakeFlow: "regeneration",
    schedulingRequired: true,
    description:
      "A $99 CAD/month subscription with one 15-minute Zoom consultation, safeguarded manifestation work, offline anti-goal clearing, personalized MP3 clearing exercises, and 30-day priority email support.",
  },
] as const satisfies readonly SessionOffering[];

export type CanonicalSessionOffering = typeof CANONICAL_SESSION_OFFERINGS[number];
export type CanonicalSessionBookingTypeId = CanonicalSessionOffering["bookingTypeId"];

export const GUIDED_SESSION_OFFERINGS = CANONICAL_SESSION_OFFERINGS.filter(
  (offering) => offering.intakeFlow === "guided_session" && offering.active,
);

export const CANONICAL_SESSION_BOOKING_TYPE_IDS = CANONICAL_SESSION_OFFERINGS.map(
  (offering) => offering.bookingTypeId,
);

export function getSessionOfferingByBookingTypeId(bookingTypeId: string | null | undefined) {
  const normalized = bookingTypeId?.trim();
  if (!normalized) return null;
  return CANONICAL_SESSION_OFFERINGS.find((offering) => offering.bookingTypeId === normalized) ?? null;
}

export function getActiveSessionOfferingByBookingTypeId(bookingTypeId: string | null | undefined) {
  const offering = getSessionOfferingByBookingTypeId(bookingTypeId);
  return offering?.active ? offering : null;
}

export function isCanonicalSessionBookingTypeId(bookingTypeId: string | null | undefined) {
  return Boolean(getSessionOfferingByBookingTypeId(bookingTypeId));
}

export function isGuidedSessionBookingTypeId(bookingTypeId: string | null | undefined) {
  const offering = getActiveSessionOfferingByBookingTypeId(bookingTypeId);
  return offering?.intakeFlow === "guided_session";
}

export function getGuidedSessionOfferingsBySessionType(sessionType: SessionOfferingSessionType) {
  return GUIDED_SESSION_OFFERINGS.filter((offering) => offering.sessionType === sessionType);
}
