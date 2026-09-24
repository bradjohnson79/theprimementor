import {
  DIVIN8_REPORT_PRICE_CENTS_BY_PRODUCT,
  type ReportProductKey,
} from "@wisdom/utils";
import { trackEvent, trackEventOnce } from "./analytics";

export type ReportLandingPageSource =
  | "reports_catalogue"
  | "reports_introductory"
  | "reports_compatibility";

function reportPayload(reportType: ReportProductKey, pageSource: ReportLandingPageSource) {
  return {
    report_type: reportType,
    price: DIVIN8_REPORT_PRICE_CENTS_BY_PRODUCT[reportType] / 100,
    currency: "CAD",
    page_source: pageSource,
  };
}

export function trackReportView(reportType: ReportProductKey, pageSource: ReportLandingPageSource) {
  trackEventOnce(`analytics:report_view:${pageSource}:${reportType}`, "report_view", reportPayload(reportType, pageSource));
}

export function trackReportSampleView(
  reportType: ReportProductKey,
  pageSource: ReportLandingPageSource,
) {
  trackEvent("sample_view", reportPayload(reportType, pageSource));
}

export function trackReportOrderClick(
  reportType: ReportProductKey,
  pageSource: ReportLandingPageSource,
) {
  trackEvent("report_order_click", reportPayload(reportType, pageSource));
}

export function trackReportCheckoutStart(reportType: ReportProductKey) {
  trackEventOnce(`analytics:report_checkout_start:${reportType}`, "report_checkout_start", {
    report_type: reportType,
    price: DIVIN8_REPORT_PRICE_CENTS_BY_PRODUCT[reportType] / 100,
    currency: "CAD",
  });
}
