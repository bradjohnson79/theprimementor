import type { ReportTierId } from "@wisdom/utils";

/**
 * Stripe Checkout must use Price IDs from the Dashboard — never hardcode amounts.
 * Map each configured price ID to product slug + interpretation tier for webhooks / fulfillment.
 *
 * With `sk_live_*`, prefers `STRIPE_LIVE_PRICE_DIVIN8_*` then built-in live fallbacks (same pattern as
 * `stripePrices.ts` / `membershipBilling.ts`). Test keys use `STRIPE_PRICE_DIVIN8_*` only.
 */
const REPORT_TIER_STRIPE_CONFIG: Record<
  ReportTierId,
  { standardEnvKey: string; liveEnvKey: string; product: string }
> = {
  intro: {
    standardEnvKey: "STRIPE_PRICE_DIVIN8_INTRO_REPORT",
    liveEnvKey: "STRIPE_LIVE_PRICE_DIVIN8_INTRO_REPORT",
    product: "divin8_introductory_report",
  },
  deep_dive: {
    standardEnvKey: "STRIPE_PRICE_DIVIN8_DEEP_DIVE_REPORT",
    liveEnvKey: "STRIPE_LIVE_PRICE_DIVIN8_DEEP_DIVE_REPORT",
    product: "divin8_deep_dive_report",
  },
  initiate: {
    standardEnvKey: "STRIPE_PRICE_DIVIN8_INITIATE_REPORT",
    liveEnvKey: "STRIPE_LIVE_PRICE_DIVIN8_INITIATE_REPORT",
    product: "divin8_initiate_report",
  },
};

/** Live-mode Price IDs (Products: Divin8 Introductory / Deep Dive / Initiate Report in Stripe). */
const LIVE_DIVIN8_REPORT_PRICE_FALLBACKS: Record<ReportTierId, string> = {
  intro: "price_1TKY26Ad5V3LaCqjgSS36qtr",
  deep_dive: "price_1TKY3FAd5V3LaCqjhkqTPo59",
  initiate: "price_1TKY4GAd5V3LaCqjK2TjZMyp",
};

export type StripeReportPriceMapEntry = {
  product: string;
  tier: ReportTierId;
};

export const STRIPE_REPORT_PRICE_ENTRIES: Array<{
  tier: ReportTierId;
  envKey: string;
  liveEnvKey: string;
  product: string;
}> = (Object.entries(REPORT_TIER_STRIPE_CONFIG) as Array<
  [ReportTierId, (typeof REPORT_TIER_STRIPE_CONFIG)[ReportTierId]]
>).map(([tier, cfg]) => ({
  tier,
  envKey: cfg.standardEnvKey,
  liveEnvKey: cfg.liveEnvKey,
  product: cfg.product,
}));

function isLiveStripeMode() {
  return process.env.STRIPE_SECRET_KEY?.trim().startsWith("sk_live_") ?? false;
}

/** priceId → { product, tier } for test env, live env, and live fallbacks (webhook / fulfillment). */
export function getStripeReportPriceMap(): Record<string, StripeReportPriceMapEntry> {
  const map: Record<string, StripeReportPriceMapEntry> = {};
  for (const tier of Object.keys(REPORT_TIER_STRIPE_CONFIG) as ReportTierId[]) {
    const cfg = REPORT_TIER_STRIPE_CONFIG[tier];
    const entry: StripeReportPriceMapEntry = { product: cfg.product, tier };
    const standard = process.env[cfg.standardEnvKey]?.trim();
    const live = process.env[cfg.liveEnvKey]?.trim();
    const fallback = LIVE_DIVIN8_REPORT_PRICE_FALLBACKS[tier];
    if (standard) {
      map[standard] = entry;
    }
    if (live) {
      map[live] = entry;
    }
    if (fallback) {
      map[fallback] = entry;
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
  const cfg = REPORT_TIER_STRIPE_CONFIG[tier];
  const livePriceId = process.env[cfg.liveEnvKey]?.trim();
  const standardPriceId = process.env[cfg.standardEnvKey]?.trim();
  const priceId = isLiveStripeMode()
    ? livePriceId || LIVE_DIVIN8_REPORT_PRICE_FALLBACKS[tier]
    : standardPriceId;

  if (!priceId) {
    throw new Error(`Missing Stripe price ID for report tier: ${tier}`);
  }

  return priceId;
}
