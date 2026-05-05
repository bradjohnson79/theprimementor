import assert from "node:assert/strict";
import test from "node:test";
import { getReportStripePriceId, getReportTypeFromPriceId } from "./stripeReportPrices.js";

test("getReportStripePriceId prefers live report prices with a live Stripe key", () => {
  const originalSecret = process.env.STRIPE_SECRET_KEY;
  const originalIntro = process.env.STRIPE_PRICE_DIVIN8_INTRO_REPORT;
  const originalLiveIntro = process.env.STRIPE_LIVE_PRICE_DIVIN8_INTRO_REPORT;

  try {
    process.env.STRIPE_SECRET_KEY = "sk_live_example";
    process.env.STRIPE_PRICE_DIVIN8_INTRO_REPORT = "price_test_intro_report";
    delete process.env.STRIPE_LIVE_PRICE_DIVIN8_INTRO_REPORT;

    assert.equal(getReportStripePriceId("intro"), "price_1TKY26Ad5V3LaCqjgSS36qtr");
  } finally {
    process.env.STRIPE_SECRET_KEY = originalSecret;
    if (originalIntro === undefined) delete process.env.STRIPE_PRICE_DIVIN8_INTRO_REPORT;
    else process.env.STRIPE_PRICE_DIVIN8_INTRO_REPORT = originalIntro;
    if (originalLiveIntro === undefined) delete process.env.STRIPE_LIVE_PRICE_DIVIN8_INTRO_REPORT;
    else process.env.STRIPE_LIVE_PRICE_DIVIN8_INTRO_REPORT = originalLiveIntro;
  }
});

test("casual report price IDs are registry-backed and reverse-resolvable", () => {
  assert.equal(getReportStripePriceId("three_questions"), "price_1TTljNAd5V3LaCqjN48BQLs0");
  assert.equal(getReportStripePriceId("compatibility"), "price_1TTllrAd5V3LaCqjz1oi4ta4");
  assert.equal(getReportStripePriceId("annual_12_month"), "price_1TTlobAd5V3LaCqjXh5Y5CcS");
  assert.equal(getReportTypeFromPriceId("price_1TTljNAd5V3LaCqjN48BQLs0"), "three_questions");
  assert.equal(getReportTypeFromPriceId("price_1TTllrAd5V3LaCqjz1oi4ta4"), "compatibility");
  assert.equal(getReportTypeFromPriceId("price_1TTlobAd5V3LaCqjXh5Y5CcS"), "annual_12_month");
});

test("getReportStripePriceId uses configured test price with a non-live Stripe key", () => {
  const originalSecret = process.env.STRIPE_SECRET_KEY;
  const originalIntro = process.env.STRIPE_PRICE_DIVIN8_INTRO_REPORT;

  try {
    process.env.STRIPE_SECRET_KEY = "sk_test_example";
    process.env.STRIPE_PRICE_DIVIN8_INTRO_REPORT = "price_test_intro_report";

    assert.equal(getReportStripePriceId("intro"), "price_test_intro_report");
  } finally {
    process.env.STRIPE_SECRET_KEY = originalSecret;
    if (originalIntro === undefined) delete process.env.STRIPE_PRICE_DIVIN8_INTRO_REPORT;
    else process.env.STRIPE_PRICE_DIVIN8_INTRO_REPORT = originalIntro;
  }
});
