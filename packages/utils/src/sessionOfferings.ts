export type SessionOfferingSessionType = "qa_session" | "mentoring" | "regeneration" | "prime_body_healing";
export type SessionOfferingBillingType = "one_time" | "subscription";
export type SessionOfferingIntakeFlow = "guided_session" | "regeneration" | "prime_body_healing";

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

const QA_SESSION_45_DESCRIPTION = [
  "A 45-minute Q&A Session gives us more room to move beyond the surface of a question and into the patterns underneath it. This is ideal when you have a few connected topics to explore, want greater clarity around a decision, or need time to unpack a situation without rushing through it.",
  "You can bring questions around spiritual direction, relationships, life changes, personal challenges, manifestation, work, creativity, or anything else presently asking for clearer perspective. The format remains open and conversational, while allowing enough time for deeper reflection, practical insight, and a more complete response.",
  "This is not a structured Divin8 reading or full Mentoring Session. It is a flexible space for focused questions, meaningful dialogue, and direct guidance when you want more than a quick answer but do not require a full blueprint-level session.",
].join("\n\n");

const QA_SESSION_60_DESCRIPTION = [
  "The 60-minute Q&A Session is a longer open-format conversation for when you want to explore a larger situation from several angles. It is well suited for periods of transition, important choices, multiple connected questions, or a deeper discussion that benefits from time, context, and a more spacious pace.",
  "This session allows us to move through the heart of what you are facing, examine the perspectives around it, and give your questions the attention they deserve. You may bring personal, spiritual, relational, career, creative, or life-direction concerns and use the hour as an open container for clarity, insight, and grounded next steps.",
  "This is still not a formal Divin8 reading or the full structured Mentoring Session. Think of it as an extended direct-access conversation: more room to ask, explore, reflect, and leave with a clearer sense of where you are and what matters next.",
].join("\n\n");

const MENTORING_SESSION_45_DESCRIPTION = [
  "The 45-minute Mentoring Session is a focused guided session for when you want meaningful support around one primary area of your life. It is designed to help you identify the core pattern at work, clarify the desired direction, and begin shifting your relationship with the challenge through Prime Mind principles and practical spiritual insight.",
  "This is a strong choice when you have a specific goal, obstacle, emotional pattern, relationship issue, or life decision that needs concentrated attention. We work directly with the material that is most alive for you, bringing clarity to what is creating friction and what inner orientation better supports movement forward.",
  "While shorter than the 90-minute Mentoring Session, this is still a true mentoring experience rather than an open Q&A. It is best for a focused reset, a single priority, or a targeted course correction.",
].join("\n\n");

const MENTORING_SESSION_90_DESCRIPTION = [
  "The 90-minute Mentoring Session is the most comprehensive private session for deeper transformation, expanded self-understanding, and sustained movement in a chosen area of life. This longer format gives us room to explore your current circumstances, core patterns, personal blueprint, goals, and the deeper assumptions shaping your experience.",
  "Together, we can work through multiple layers of a situation rather than stopping at the first answer. This may include exploring natal-chart or Divin8-informed themes, recurring emotional or behavioral patterns, manifestation goals, relationship dynamics, life direction, and practical ways to enter greater harmony with your preferred state of being.",
  "This session is ideal when you are ready to go further: to understand not only what is happening, but why it continues, what must shift internally, and how to establish a more stable foundation for meaningful change. It is structured, personal, and designed to support real long-term movement rather than a quick insight alone.",
].join("\n\n");

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
    description: QA_SESSION_45_DESCRIPTION,
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
    description: QA_SESSION_60_DESCRIPTION,
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
    description: MENTORING_SESSION_45_DESCRIPTION,
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
    description: MENTORING_SESSION_90_DESCRIPTION,
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
  {
    productKey: "regeneration-qa-package",
    bookingTypeId: "regeneration-qa-package",
    sessionType: "regeneration",
    displayName: "Regeneration Q&A Package",
    durationMinutes: null,
    billingType: "one_time",
    currency: "CAD",
    amountCents: 14900,
    stripePriceEnvKey: "STRIPE_PRICE_REGENERATION_OFFER",
    stripeLivePriceEnvKey: "STRIPE_LIVE_PRICE_REGENERATION_OFFER",
    stripeLivePriceFallback: "price_1Twl2LAd5V3LaCqjCuljQ7Xk",
    active: true,
    intakeFlow: "regeneration",
    schedulingRequired: true,
    description:
      "A limited-time $149 CAD one-time package with one Regeneration Session, 30 days of priority email support, and one private 30-minute Q&A that must be used within the same 30-day support window.",
  },
  {
    productKey: "prime-body-healing-level-1-live",
    bookingTypeId: "prime-body-healing-level-1-live",
    sessionType: "prime_body_healing",
    displayName: "Prime Body Healing — Level 1 Live",
    durationMinutes: 15,
    billingType: "one_time",
    currency: "CAD",
    amountCents: 7900,
    stripePriceEnvKey: "STRIPE_PRICE_PRIME_BODY_HEALING_LEVEL_1",
    stripeLivePriceEnvKey: "STRIPE_LIVE_PRICE_PRIME_BODY_HEALING_LEVEL_1",
    active: true,
    intakeFlow: "prime_body_healing",
    schedulingRequired: false,
    description:
      "A focused 15-minute live Prime Body Healing session for up to five selected areas of energetic rejuvenation.",
  },
  {
    productKey: "prime-body-healing-level-1-prerecorded",
    bookingTypeId: "prime-body-healing-level-1-prerecorded",
    sessionType: "prime_body_healing",
    displayName: "Prime Body Healing — Level 1 Pre-Recorded",
    durationMinutes: null,
    billingType: "one_time",
    currency: "CAD",
    amountCents: 7900,
    stripePriceEnvKey: "STRIPE_PRICE_PRIME_BODY_HEALING_LEVEL_1",
    stripeLivePriceEnvKey: "STRIPE_LIVE_PRICE_PRIME_BODY_HEALING_LEVEL_1",
    active: true,
    intakeFlow: "prime_body_healing",
    schedulingRequired: false,
    description:
      "A personalized pre-recorded Prime Body Healing MP3 for up to five selected areas of energetic rejuvenation.",
  },
  {
    productKey: "prime-body-healing-level-2",
    bookingTypeId: "prime-body-healing-level-2",
    sessionType: "prime_body_healing",
    displayName: "Prime Body Healing — Level 2",
    durationMinutes: null,
    billingType: "one_time",
    currency: "CAD",
    amountCents: 17900,
    stripePriceEnvKey: "STRIPE_PRICE_PRIME_BODY_HEALING_LEVEL_2",
    stripeLivePriceEnvKey: "STRIPE_LIVE_PRICE_PRIME_BODY_HEALING_LEVEL_2",
    active: true,
    intakeFlow: "prime_body_healing",
    schedulingRequired: false,
    description:
      "A comprehensive Prime Body Healing scan and rejuvenation with personalized MP3 recording and PDF scan report.",
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
