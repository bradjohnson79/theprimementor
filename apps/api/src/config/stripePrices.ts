import type { SessionCheckoutType } from "./sessionCheckout.js";

type BookingTypeStripePriceConfig = {
  standard: string;
  live: string;
  legacyStandard?: string;
  legacyLive?: string;
  liveFallback?: string;
};

const SESSION_PRICE_ENV_KEYS: Record<SessionCheckoutType, { standard: string; live: string }> = {
  focus: {
    standard: "STRIPE_PRICE_FOCUS",
    live: "STRIPE_LIVE_PRICE_FOCUS",
  },
  mentoring: {
    standard: "STRIPE_PRICE_MENTORING",
    live: "STRIPE_LIVE_PRICE_MENTORING",
  },
  regeneration: {
    standard: "STRIPE_PRICE_REGENERATION",
    live: "STRIPE_LIVE_PRICE_REGENERATION",
  },
  qa_session: {
    standard: "STRIPE_PRICE_QA_SESSION",
    live: "STRIPE_LIVE_PRICE_QA_SESSION",
  },
};

const LIVE_SESSION_PRICE_FALLBACKS: Record<SessionCheckoutType, string> = {
  focus: "price_1TILliAd5V3LaCqjidvbVLrl",
  mentoring: "price_1TILnFAd5V3LaCqjkR9tAMuC",
  regeneration: "price_1TKj0yAd5V3LaCqjQC6LV0k2",
  qa_session: "price_1Te0tkAd5V3LaCqjaF1A19RZ",
};

const BOOKING_TYPE_PRICE_ENV_KEYS: Record<string, BookingTypeStripePriceConfig> = {
  "focus-session-45": {
    standard: "STRIPE_PRICE_FOCUS_45",
    live: "STRIPE_LIVE_PRICE_FOCUS_45",
    legacyStandard: "STRIPE_PRICE_FOCUS",
    legacyLive: "STRIPE_LIVE_PRICE_FOCUS",
    liveFallback: LIVE_SESSION_PRICE_FALLBACKS.focus,
  },
  "qa-session-30": {
    standard: "STRIPE_PRICE_QA_SESSION_30",
    live: "STRIPE_LIVE_PRICE_QA_SESSION_30",
    legacyStandard: "STRIPE_PRICE_QA_SESSION",
    legacyLive: "STRIPE_LIVE_PRICE_QA_SESSION",
    liveFallback: LIVE_SESSION_PRICE_FALLBACKS.qa_session,
  },
  "qa-session-45": {
    standard: "STRIPE_PRICE_QA_SESSION_45",
    live: "STRIPE_LIVE_PRICE_QA_SESSION_45",
    liveFallback: "price_1Te0uFAd5V3LaCqjT7Cf7Gmg",
  },
  "qa-session-60": {
    standard: "STRIPE_PRICE_QA_SESSION_60",
    live: "STRIPE_LIVE_PRICE_QA_SESSION_60",
    liveFallback: "price_1Te0ukAd5V3LaCqjDpn9oY0w",
  },
  "mentoring-session-45": {
    standard: "STRIPE_PRICE_MENTORING_45",
    live: "STRIPE_LIVE_PRICE_MENTORING_45",
    liveFallback: LIVE_SESSION_PRICE_FALLBACKS.focus,
  },
  "wisdom-mentoring-90": {
    standard: "STRIPE_PRICE_MENTORING_90",
    live: "STRIPE_LIVE_PRICE_MENTORING_90",
    legacyStandard: "STRIPE_PRICE_MENTORING",
    legacyLive: "STRIPE_LIVE_PRICE_MENTORING",
    liveFallback: LIVE_SESSION_PRICE_FALLBACKS.mentoring,
  },
  "regeneration-session": {
    standard: "STRIPE_PRICE_REGENERATION",
    live: "STRIPE_LIVE_PRICE_REGENERATION",
    liveFallback: LIVE_SESSION_PRICE_FALLBACKS.regeneration,
  },
};

function isLiveStripeMode() {
  return process.env.STRIPE_SECRET_KEY?.trim().startsWith("sk_live_") ?? false;
}

export function getSessionStripePriceId(sessionType: SessionCheckoutType) {
  const envKeys = SESSION_PRICE_ENV_KEYS[sessionType];
  const livePriceId = process.env[envKeys.live]?.trim();
  const standardPriceId = process.env[envKeys.standard]?.trim();
  const priceId = isLiveStripeMode()
    ? livePriceId || LIVE_SESSION_PRICE_FALLBACKS[sessionType]
    : standardPriceId;

  if (!priceId) {
    throw new Error(`Missing Stripe price ID for session type: ${sessionType}`);
  }

  return priceId;
}

export function getBookingTypeStripePriceId(bookingTypeId: string) {
  const normalizedBookingTypeId = bookingTypeId.trim();
  const envKeys = BOOKING_TYPE_PRICE_ENV_KEYS[normalizedBookingTypeId];
  if (!envKeys) {
    throw new Error(`Missing Stripe price mapping for booking type: ${normalizedBookingTypeId}`);
  }

  const livePriceId = process.env[envKeys.live]?.trim()
    || envKeys.liveFallback
    || (envKeys.legacyLive ? process.env[envKeys.legacyLive]?.trim() : "");
  const standardPriceId = process.env[envKeys.standard]?.trim()
    || (envKeys.legacyStandard ? process.env[envKeys.legacyStandard]?.trim() : "");
  const priceId = isLiveStripeMode()
    ? livePriceId
    : standardPriceId;

  if (!priceId) {
    throw new Error(`Missing Stripe price ID for booking type: ${normalizedBookingTypeId}`);
  }

  return priceId;
}
