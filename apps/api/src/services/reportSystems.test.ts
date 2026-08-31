import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  REPORT_PRODUCTS,
  getPublicSystemLabelsForReport,
  getSystemsForReportType,
  isValidSamplePdfUrl,
} from "@wisdom/utils";

describe("Divin8 report systems mapping", () => {
  it("matches the verified calculation coverage for each product", () => {
    assert.deepEqual(getSystemsForReportType("intro"), ["astrology", "numerology", "rune"]);
    assert.deepEqual(getSystemsForReportType("three_questions"), [
      "astrology",
      "numerology",
      "rune",
    ]);
    assert.deepEqual(getSystemsForReportType("compatibility"), ["astrology", "numerology", "rune"]);
    assert.deepEqual(getSystemsForReportType("deep_dive"), [
      "astrology",
      "numerology",
      "humanDesign",
      "chinese",
      "rune",
    ]);
    assert.deepEqual(getSystemsForReportType("annual_12_month"), [
      "astrology",
      "numerology",
      "humanDesign",
      "chinese",
      "rune",
    ]);
    assert.deepEqual(getSystemsForReportType("initiate"), [
      "astrology",
      "numerology",
      "humanDesign",
      "chinese",
      "kabbalah",
      "rune",
    ]);
  });

  it("uses public labels that do not claim Western astrology", () => {
    for (const key of Object.keys(REPORT_PRODUCTS) as Array<keyof typeof REPORT_PRODUCTS>) {
      const labels = getPublicSystemLabelsForReport(key).join(" ");
      assert.match(labels, /Vedic Astrology/);
      assert.match(labels, /Pythagorean Numerology/);
      assert.equal(labels.includes("Western"), false);
      assert.equal(labels.includes("Tarot"), false);
      assert.equal(labels.includes("I Ching"), false);
    }
    assert.deepEqual(getPublicSystemLabelsForReport("initiate"), [
      "Vedic Astrology",
      "Pythagorean Numerology",
      "Human Design",
      "Chinese BaZi Astrology",
      "Kabbalah",
      "Runes",
    ]);
  });

  it("keeps Initiate Divin8 Report as the canonical public name", () => {
    assert.equal(REPORT_PRODUCTS.initiate.displayName, "Initiate Divin8 Report");
    assert.equal(REPORT_PRODUCTS.initiate.ctaLabel, "Order Initiate Report");
  });
});

describe("sample PDF URL gating", () => {
  it("accepts only http(s) or site-relative PDF paths", () => {
    assert.equal(isValidSamplePdfUrl(null), false);
    assert.equal(isValidSamplePdfUrl(""), false);
    assert.equal(isValidSamplePdfUrl("not-a-url"), false);
    assert.equal(isValidSamplePdfUrl("javascript:alert(1)"), false);
    assert.equal(isValidSamplePdfUrl("/samples/intro.pdf"), true);
    assert.equal(isValidSamplePdfUrl("https://theprimementor.com/samples/intro.pdf"), true);
    assert.equal(isValidSamplePdfUrl("https://theprimementor.com/samples/intro"), false);
  });
});
