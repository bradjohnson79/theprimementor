const REGENERATION_PRICE_ENV_KEYS = {
  standard: "STRIPE_PRICE_REGENERATION_MONTHLY_PACKAGE",
  live: "STRIPE_LIVE_PRICE_REGENERATION_MONTHLY_PACKAGE",
} as const;

const LIVE_REGENERATION_MONTHLY_PRICE_FALLBACK = "price_1TSOy3Ad5V3LaCqjBkFRd1IL";

export const REGENERATION_PRODUCT_KEY = "regeneration_monthly_package";
export const REGENERATION_PLAN_NAME = "Regeneration Monthly Package";
export const REGENERATION_MANIFESTATION_ENHANCEMENT_KEY = "regeneration_manifestation_enhancement_30_day";
export const REGENERATION_MANIFESTATION_ENHANCEMENT_NAME = "30-Day Manifestation Enhancement";
export const REGENERATION_MANIFESTATION_ENHANCEMENT_PRICE_ID = "price_1TYIg9Ad5V3LaCqjID619B7x";
export const REGENERATION_MANIFESTATION_ENHANCEMENT_AMOUNT_CENTS = 2900;
export const REGENERATION_MANIFESTATION_ENHANCEMENT_DURATION_DAYS = 30;

function isLiveStripeMode() {
  return process.env.STRIPE_SECRET_KEY?.trim().startsWith("sk_live_") ?? false;
}

export function getRegenerationStripePriceId() {
  const livePriceId = process.env[REGENERATION_PRICE_ENV_KEYS.live]?.trim();
  const standardPriceId = process.env[REGENERATION_PRICE_ENV_KEYS.standard]?.trim();
  const priceId = isLiveStripeMode()
    ? livePriceId || LIVE_REGENERATION_MONTHLY_PRICE_FALLBACK
    : standardPriceId;

  if (!priceId) {
    throw new Error(
      `Missing Stripe price ID for ${REGENERATION_PLAN_NAME}. Expected ${isLiveStripeMode() ? REGENERATION_PRICE_ENV_KEYS.live : REGENERATION_PRICE_ENV_KEYS.standard}.`,
    );
  }

  return priceId;
}
