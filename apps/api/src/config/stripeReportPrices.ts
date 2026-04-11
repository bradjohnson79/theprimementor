import type { ReportTierId } from "@wisdom/utils";

/**
 * Stripe Checkout must use Price IDs from the Dashboard — never hardcode amounts.
 * Map each configured price ID to product slug + interpretation tier for webhooks / fulfillment.
 */
const STRIPE_REPORT_PRICE_ENTRIES: Array<{
  tier: ReportTierId;
  envKey: string;
  product: string;
}> = [
  {
    tier: "intro",
    envKey: "STRIPE_PRICE_DIVIN8_INTRO_REPORT",
    product: "divin8_introductory_report",
  },
  {
    tier: "deep_dive",
    envKey: "STRIPE_PRICE_DIVIN8_DEEP_DIVE_REPORT",
    product: "divin8_deep_dive_report",
  },
  {
    tier: "initiate",
    envKey: "STRIPE_PRICE_DIVIN8_INITIATE_REPORT",
    product: "divin8_initiate_report",
  },
];

export type StripeReportPriceMapEntry = {
  product: string;
  tier: ReportTierId;
};

const REPORT_TIER_TO_ENV_KEY: Record<ReportTierId, string> = {
  intro: "STRIPE_PRICE_DIVIN8_INTRO_REPORT",
  deep_dive: "STRIPE_PRICE_DIVIN8_DEEP_DIVE_REPORT",
  initiate: "STRIPE_PRICE_DIVIN8_INITIATE_REPORT",
};

/** priceId → { product, tier } for all env-configured report prices */
export function getStripeReportPriceMap(): Record<string, StripeReportPriceMapEntry> {
  const map: Record<string, StripeReportPriceMapEntry> = {};
  for (const { tier, envKey, product } of STRIPE_REPORT_PRICE_ENTRIES) {
    const priceId = process.env[envKey]?.trim();
    if (priceId) {
      map[priceId] = { product, tier };
    }
  }
  return map;
}

/**
 * Snapshot at module load: Stripe Price ID → product slug + report tier.
 * Prefer `getStripeReportPriceMap()` when `process.env` may change (e.g. tests). Do not use Stripe amounts for UI — use `@wisdom/utils` report pricing.
 */
export const STRIPE_REPORT_PRICE_MAP: Record<string, StripeReportPriceMapEntry> = getStripeReportPriceMap();

export function resolveReportTierFromStripePriceId(priceId: string): StripeReportPriceMapEntry | null {
  return getStripeReportPriceMap()[priceId] ?? null;
}

export function getReportStripePriceId(tier: ReportTierId) {
  const envKey = REPORT_TIER_TO_ENV_KEY[tier];
  const priceId = process.env[envKey]?.trim();
  if (!priceId) {
    throw new Error(`Missing Stripe price ID for report tier: ${tier}`);
  }

  return priceId;
}

export { STRIPE_REPORT_PRICE_ENTRIES };
