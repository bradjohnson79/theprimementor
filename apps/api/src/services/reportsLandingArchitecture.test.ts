import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { REPORT_PRODUCTS } from "@wisdom/utils";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../");

function read(rel: string) {
  return readFileSync(path.join(repoRoot, rel), "utf8");
}

const PROTECTED_REDIRECTS = [
  '<Route path="/reports/intro" element={<Navigate to="/dashboard/reports/intro" replace />} />',
  '<Route path="/reports/deep-dive" element={<Navigate to="/dashboard/reports/deep-dive" replace />} />',
  '<Route path="/reports/initiate" element={<Navigate to="/dashboard/reports/initiate" replace />} />',
] as const;

describe("Reports landing architecture", () => {
  it("does not hard-code report prices, Stripe IDs, or a second product catalogue", () => {
    const landing = read("apps/web/src/routes/ReportsLanding.tsx");
    const productLanding = read("apps/web/src/routes/ReportProductLanding.tsx");
    const overlay = read("apps/web/src/data/reportLanding.ts");
    const source = `${landing}\n${productLanding}\n${overlay}`;

    assert.match(landing, /divin8ReportProductListPrice/);
    assert.match(landing, /REPORT_PRODUCTS/);
    assert.match(productLanding, /divin8ReportProductListPrice/);
    assert.equal(source.includes("price_1TTljNAd5V3LaCqjN48BQLs0"), false);
    assert.equal(source.includes("price_1TKY26Ad5V3LaCqjgSS36qtr"), false);
    assert.equal(/\$69 CAD/.test(source), false);
    assert.equal(/\$199 CAD/.test(source), false);
    assert.equal(overlay.includes("stripePriceId"), false);
  });

  it("reuses the approved Deep Dive report testimonial and omits session quotes", () => {
    const landing = read("apps/web/src/routes/ReportsLanding.tsx");
    const testimonials = read("apps/web/src/data/homeTestimonials.ts");
    assert.match(landing, /HOME_TESTIMONIALS/);
    assert.match(landing, /item\.id === "7"/);
    assert.match(testimonials, /Craig Stickler/);
    assert.match(testimonials, /The Deep dive report is certainly well titled/);
    assert.equal(landing.includes("Bibi Tinsley"), false);
    assert.equal(landing.includes("Nicola Bourne"), false);
    assert.equal(landing.includes("Gregory Hudson"), false);
  });

  it("preserves existing purchase paths and attribution on order links", () => {
    const landing = read("apps/web/src/routes/ReportsLanding.tsx");
    const orderLink = read("apps/web/src/components/reports/ReportOrderLink.tsx");
    const attribution = read("apps/web/src/lib/reportAttribution.ts");
    assert.match(landing, /ReportOrderLink/);
    assert.match(orderLink, /product\.orderPath/);
    assert.match(orderLink, /product\.ctaLabel/);
    assert.match(orderLink, /withCurrentSearch\(product\.orderPath, search\)/);
    assert.match(attribution, /export function withCurrentSearch/);
    for (const product of Object.values(REPORT_PRODUCTS)) {
      assert.ok(product.orderPath.startsWith("/dashboard/reports/"));
    }
  });

  it("keeps the protected checkout redirects exact and forbids a public slug catch-all", () => {
    const app = read("apps/web/src/App.tsx");
    const rootLayout = read("apps/web/src/layouts/RootLayout.tsx");
    const marketingPaths = read("apps/web/src/lib/reportMarketingPaths.ts");

    for (const route of PROTECTED_REDIRECTS) {
      assert.equal(app.includes(route), true, `missing ${route}`);
    }
    assert.equal(app.includes('path="/reports/:slug"'), false);
    assert.equal(app.includes('path="/reports/:'), false);
    assert.equal(app.includes('path="/reports/introductory"'), true);
    assert.equal(app.includes('path="/reports/compatibility"'), true);
    assert.equal(rootLayout.includes('pathname.startsWith("/reports/")'), false);
    assert.equal(marketingPaths.includes('startsWith("/reports/")'), false);
    assert.match(marketingPaths, /\/reports\/introductory/);
    assert.match(marketingPaths, /\/reports\/compatibility/);
  });

  it("wires five anonymized sample PDFs and leaves Compatibility unpublished", () => {
    const overlay = read("apps/web/src/data/reportLanding.ts");
    assert.match(overlay, /\/samples\/divin8-introductory-report-sample\.pdf/);
    assert.match(overlay, /\/samples\/divin8-3-questions-report-sample\.pdf/);
    assert.match(overlay, /\/samples\/divin8-deep-dive-report-sample\.pdf/);
    assert.match(overlay, /\/samples\/divin8-initiate-report-sample\.pdf/);
    assert.match(overlay, /\/samples\/divin8-12-month-annual-report-sample\.pdf/);
    assert.match(overlay, /compatibility: \{ samplePdfUrl: null/);
    assert.equal(/Janet|Elisa|Robert|Sylvia|Steven/.test(overlay), false);
  });

  it("uses the exact delivery sentence and once-per-transition report analytics", () => {
    const overlay = read("apps/web/src/data/reportLanding.ts");
    const landing = read("apps/web/src/routes/ReportsLanding.tsx");
    const productLanding = read("apps/web/src/routes/ReportProductLanding.tsx");
    const analytics = read("apps/web/src/lib/analytics.ts");
    const reportAnalytics = read("apps/web/src/lib/reportLandingAnalytics.ts");
    const order = read("apps/web/src/routes/ReportOrder.tsx");
    const marketing = `${overlay}\n${landing}\n${productLanding}`;

    assert.match(overlay, /Your report is delivered within 24 hours Monday–Friday\./);
    assert.match(overlay, /answer: REPORT_DELIVERY_SENTENCE/);
    assert.match(landing, /REPORT_DELIVERY_SENTENCE/);
    assert.match(productLanding, /REPORT_DELIVERY_SENTENCE/);
    assert.equal(/48 hours|48-hour/i.test(marketing), false);
    assert.equal(/usually|same-day|instant|faster/i.test(landing), false);
    assert.match(analytics, /report_view: "report_view"/);
    assert.match(analytics, /sample_view: "sample_view"/);
    assert.match(analytics, /report_order_click: "report_order_click"/);
    assert.match(analytics, /report_checkout_start: "report_checkout_start"/);
    assert.match(reportAnalytics, /trackEventOnce/);
    assert.match(reportAnalytics, /price: DIVIN8_REPORT_PRICE_CENTS_BY_PRODUCT\[reportType\] \/ 100/);
    assert.match(reportAnalytics, /currency: "CAD"/);
    assert.match(order, /trackReportCheckoutStart/);
  });
});
