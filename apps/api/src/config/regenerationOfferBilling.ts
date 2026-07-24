import { createHttpError } from "../services/booking/errors.js";

export const REGENERATION_OFFER_PRICE_ENV_KEY = "STRIPE_PRICE_REGENERATION_OFFER";
export const REGENERATION_OFFER_LIVE_PRICE_ENV_KEY = "STRIPE_LIVE_PRICE_REGENERATION_OFFER";

function isLiveStripeMode() {
  return process.env.STRIPE_SECRET_KEY?.trim().startsWith("sk_live_") ?? false;
}

export function resolveRegenerationOfferStripePriceId() {
  const envKey = isLiveStripeMode()
    ? REGENERATION_OFFER_LIVE_PRICE_ENV_KEY
    : REGENERATION_OFFER_PRICE_ENV_KEY;
  const priceId = process.env[envKey]?.trim();

  if (!priceId) {
    throw createHttpError(
      500,
      `Stripe price is not configured for the Regeneration Q&A Package. Missing ${envKey}.`,
    );
  }

  return { priceId, envKey };
}

export function assertRegenerationOfferStripeConfig() {
  if (!process.env.STRIPE_SECRET_KEY?.trim()) {
    return;
  }
  resolveRegenerationOfferStripePriceId();
}
