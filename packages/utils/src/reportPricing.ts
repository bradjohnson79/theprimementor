import type { ReportTierId } from "./reportTiers.js";

/** Canonical Divin8 report list prices (CAD cents). Single source for UI + backend display logic. */
export const DIVIN8_REPORT_PRICING_CENTS = {
  INTRODUCTORY: 6900,
  DEEP_DIVE: 12900,
  INITIATE: 19900,
} as const;

export const DIVIN8_REPORT_PRICE_CENTS_BY_TIER: Record<ReportTierId, number> = {
  intro: DIVIN8_REPORT_PRICING_CENTS.INTRODUCTORY,
  deep_dive: DIVIN8_REPORT_PRICING_CENTS.DEEP_DIVE,
  initiate: DIVIN8_REPORT_PRICING_CENTS.INITIATE,
};

/** Display format: `$69 CAD`, `$129 CAD`, `$199 CAD` */
export function formatDivin8ReportPriceCad(cents: number): string {
  const dollars = cents / 100;
  return Number.isInteger(dollars) ? `$${dollars} CAD` : `$${dollars.toFixed(2)} CAD`;
}

export function divin8ReportTierListPrice(tier: ReportTierId): string {
  return formatDivin8ReportPriceCad(DIVIN8_REPORT_PRICE_CENTS_BY_TIER[tier]);
}
