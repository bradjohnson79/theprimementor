import type { SessionCheckoutType } from "./sessionCheckout.js";

const SESSION_PRICE_MAP: Record<SessionCheckoutType, string | undefined> = {
  focus: process.env.STRIPE_PRICE_FOCUS,
  mentoring: process.env.STRIPE_PRICE_MENTORING,
  regeneration: process.env.STRIPE_PRICE_REGENERATION,
};

export function getSessionStripePriceId(sessionType: SessionCheckoutType) {
  const priceId = SESSION_PRICE_MAP[sessionType]?.trim();
  if (!priceId) {
    throw new Error(`Missing Stripe price ID for session type: ${sessionType}`);
  }

  return priceId;
}
