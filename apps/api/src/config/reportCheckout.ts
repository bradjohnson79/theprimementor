import { REPORT_PRODUCTS, type ReportProductKey, type ReportTierId } from "@wisdom/utils";

const REPORT_PRODUCT_NAMES: Record<ReportTierId, string[]> = {
  intro: ["Introductory Report", "Introductory", "Divin8 Introductory Report"],
  deep_dive: ["Deep Dive Report", "Deep Dive", "Divin8 Deep Dive Report"],
  initiate: ["Initiate Report", "Initiate", "Divin8 Initiate Report", "Divin8 Initiate's Report"],
};

const LEGACY_REPORT_CHECKOUT_PATHS: Record<ReportTierId, string> = {
  intro: "/dashboard/reports/intro",
  deep_dive: "/dashboard/reports/deep-dive",
  initiate: "/dashboard/reports/initiate",
};

export function getReportCheckoutProductNames(tier: ReportTierId) {
  return REPORT_PRODUCT_NAMES[tier];
}

export function getReportCheckoutPath(reportType: ReportProductKey) {
  return REPORT_PRODUCTS[reportType]?.orderPath ?? LEGACY_REPORT_CHECKOUT_PATHS.intro;
}
