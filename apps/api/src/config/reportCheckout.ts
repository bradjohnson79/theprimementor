import type { ReportTierId } from "@wisdom/utils";

const REPORT_PRODUCT_NAMES: Record<ReportTierId, string[]> = {
  intro: ["Introductory Report", "Introductory", "Divin8 Introductory Report"],
  deep_dive: ["Deep Dive Report", "Deep Dive", "Divin8 Deep Dive Report"],
  initiate: ["Initiate Report", "Initiate", "Divin8 Initiate Report", "Divin8 Initiate's Report"],
};

const REPORT_CHECKOUT_PATHS: Record<ReportTierId, string> = {
  intro: "/reports",
  deep_dive: "/reports/deep-dive",
  initiate: "/reports/initiate",
};

export function getReportCheckoutProductNames(tier: ReportTierId) {
  return REPORT_PRODUCT_NAMES[tier];
}

export function getReportCheckoutPath(tier: ReportTierId) {
  return REPORT_CHECKOUT_PATHS[tier];
}
