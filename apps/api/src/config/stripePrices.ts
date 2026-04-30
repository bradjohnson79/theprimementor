import type { SessionCheckoutType } from "./sessionCheckout.js";

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
  qa_session: "price_1TS1mkAd5V3LaCqjBfSoDdZn",
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
