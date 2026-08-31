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

describe("Reports landing architecture", () => {
  it("does not hard-code report prices, Stripe IDs, or a second product catalogue", () => {
    const landing = read("apps/web/src/routes/ReportsLanding.tsx");
    const overlay = read("apps/web/src/data/reportLanding.ts");
    const source = `${landing}\n${overlay}`;

    assert.match(landing, /divin8ReportProductListPrice/);
    assert.match(landing, /REPORT_PRODUCTS/);
    assert.match(landing, /product\.orderPath/);
    assert.match(landing, /product\.ctaLabel/);
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

  it("preserves existing purchase paths for every report product", () => {
    const landing = read("apps/web/src/routes/ReportsLanding.tsx");
    for (const product of Object.values(REPORT_PRODUCTS)) {
      assert.match(landing, /to=\{product\.orderPath\}/);
      assert.ok(product.orderPath.startsWith("/dashboard/reports/"));
    }
  });
});
