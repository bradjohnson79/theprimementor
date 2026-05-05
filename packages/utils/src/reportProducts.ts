import type { ReportTierId } from "./reportTiers.js";

export type ReportProductKey =
  | "three_questions"
  | "compatibility"
  | "annual_12_month"
  | ReportTierId;

export type ReportProductCategory = "casual" | "premium";
export type ReportIntakeSchemaKey = "premium" | "three_questions" | "compatibility" | "annual";

interface BaseReportProduct {
  key: ReportProductKey;
  id: string;
  type: ReportProductCategory;
  displayName: string;
  routeSlug: string;
  orderPath: string;
  ctaLabel: string;
  shortDescription: string;
  active: boolean;
}

export interface CasualReportProduct extends BaseReportProduct {
  type: "casual";
  stripePriceId: string;
  intakeSchema: Exclude<ReportIntakeSchemaKey, "premium">;
  generationType: Exclude<ReportProductKey, ReportTierId>;
}

export interface PremiumReportProduct extends BaseReportProduct {
  type: "premium";
  tier: ReportTierId;
  intakeSchema: "premium";
}

export type ReportProduct = CasualReportProduct | PremiumReportProduct;

export const REPORT_PRODUCTS = {
  three_questions: {
    key: "three_questions",
    id: "divin8-3-questions",
    type: "casual",
    stripePriceId: "price_1TTljNAd5V3LaCqjN48BQLs0",
    intakeSchema: "three_questions",
    generationType: "three_questions",
    displayName: "Divin8 3 Questions Report",
    routeSlug: "three-questions",
    orderPath: "/dashboard/reports/three-questions",
    ctaLabel: "Order 3 Questions Report",
    shortDescription:
      "Ask three meaningful questions and receive a focused Divin8 synthesis based on your chart information and metaphysical profile.",
    active: true,
  },
  compatibility: {
    key: "compatibility",
    id: "divin8-compatibility",
    type: "casual",
    stripePriceId: "price_1TTllrAd5V3LaCqjz1oi4ta4",
    intakeSchema: "compatibility",
    generationType: "compatibility",
    displayName: "Divin8 Compatibility Report",
    routeSlug: "compatibility",
    orderPath: "/dashboard/reports/compatibility",
    ctaLabel: "Order Compatibility Report",
    shortDescription:
      "Explore the deeper dynamic between yourself and another person through chart comparison and metaphysical compatibility analysis.",
    active: true,
  },
  annual_12_month: {
    key: "annual_12_month",
    id: "divin8-12-month-annual",
    type: "casual",
    stripePriceId: "price_1TTlobAd5V3LaCqjXh5Y5CcS",
    intakeSchema: "annual",
    generationType: "annual_12_month",
    displayName: "Divin8 12 Month Annual Report",
    routeSlug: "annual-12-month",
    orderPath: "/dashboard/reports/annual-12-month",
    ctaLabel: "Order 12 Month Report",
    shortDescription:
      "Look ahead through the next twelve calendar months with a month-by-month Divin8 synthesis of timing, themes, and opportunities.",
    active: true,
  },
  intro: {
    key: "intro",
    id: "divin8-introductory-report",
    type: "premium",
    tier: "intro",
    intakeSchema: "premium",
    displayName: "Introductory Divin8 Report",
    routeSlug: "intro",
    orderPath: "/dashboard/reports/intro",
    ctaLabel: "Order Introductory Report",
    shortDescription:
      "A clear entry-level Divin8 Report that introduces your core identity, energetic patterns, strengths, challenges, and life direction.",
    active: true,
  },
  deep_dive: {
    key: "deep_dive",
    id: "divin8-deep-dive-report",
    type: "premium",
    tier: "deep_dive",
    intakeSchema: "premium",
    displayName: "Deep Dive Divin8 Report",
    routeSlug: "deep-dive",
    orderPath: "/dashboard/reports/deep-dive",
    ctaLabel: "Order Deep Dive Report",
    shortDescription:
      "A comprehensive Divin8 Report exploring your deeper metaphysical profile, karmic patterns, relationships, career, and spiritual development.",
    active: true,
  },
  initiate: {
    key: "initiate",
    id: "divin8-initiate-report",
    type: "premium",
    tier: "initiate",
    intakeSchema: "premium",
    displayName: "Initiate Divin8 Report",
    routeSlug: "initiate",
    orderPath: "/dashboard/reports/initiate",
    ctaLabel: "Order Initiate Report",
    shortDescription:
      "The most advanced Divin8 Report, offering an initiate-level synthesis of your charts, timing, karmic indicators, and deeper spiritual architecture.",
    active: true,
  },
} as const satisfies Record<ReportProductKey, ReportProduct>;

export const REPORT_PRODUCT_ORDER: ReportProductKey[] = [
  "three_questions",
  "compatibility",
  "annual_12_month",
  "intro",
  "deep_dive",
  "initiate",
];

export const CASUAL_REPORT_PRODUCT_KEYS: ReportProductKey[] = [
  "three_questions",
  "compatibility",
  "annual_12_month",
];

export const PREMIUM_REPORT_PRODUCT_KEYS: ReportProductKey[] = ["intro", "deep_dive", "initiate"];

const REPORT_PRODUCT_ALIASES: Record<string, ReportProductKey> = {
  "three-questions": "three_questions",
  "3-questions": "three_questions",
  "divin8-3-questions": "three_questions",
  compatibility: "compatibility",
  "divin8-compatibility": "compatibility",
  "annual-12-month": "annual_12_month",
  "12-month-annual": "annual_12_month",
  "twelve-month-annual": "annual_12_month",
  "divin8-12-month-annual": "annual_12_month",
  intro: "intro",
  introductory: "intro",
  "deep-dive": "deep_dive",
  deep_dive: "deep_dive",
  initiate: "initiate",
};

export function isReportProductKey(value: unknown): value is ReportProductKey {
  return typeof value === "string" && value in REPORT_PRODUCTS;
}

export function getReportProduct(key: ReportProductKey): ReportProduct {
  return REPORT_PRODUCTS[key];
}

export function resolveReportProductKey(value: unknown): ReportProductKey | null {
  if (isReportProductKey(value)) {
    return value;
  }
  if (typeof value !== "string") {
    return null;
  }
  return REPORT_PRODUCT_ALIASES[value.trim().toLowerCase()] ?? null;
}

export function resolveReportProductFromRouteSlug(slug: string): ReportProduct | null {
  const key = resolveReportProductKey(slug);
  return key ? getReportProduct(key) : null;
}

export function isPremiumReportProduct(product: ReportProduct): product is PremiumReportProduct {
  return product.type === "premium";
}

export function isCasualReportProduct(product: ReportProduct): product is CasualReportProduct {
  return product.type === "casual";
}

export function getReportOrderPath(key: ReportProductKey): string {
  return REPORT_PRODUCTS[key].orderPath;
}
