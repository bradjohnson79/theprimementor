const REGENERATION_PRICE_ENV_KEYS = {
  standard: "STRIPE_PRICE_REGENERATION_MONTHLY_PACKAGE",
  live: "STRIPE_LIVE_PRICE_REGENERATION_MONTHLY_PACKAGE",
} as const;

const LIVE_REGENERATION_MONTHLY_PRICE_FALLBACK = "price_1TSOy3Ad5V3LaCqjBkFRd1IL";

export const REGENERATION_PRODUCT_KEY = "regeneration_monthly_package";
export const REGENERATION_PLAN_NAME = "Regeneration Monthly Package";

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
