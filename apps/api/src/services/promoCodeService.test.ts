import assert from "node:assert/strict";
import test from "node:test";
import { PROMO_TARGETS } from "@wisdom/utils";
import {
  buildTargetFromReportTier,
  buildTargetsFromSessionType,
  computeEstimatedDiscountCents,
  deriveSyncStatus,
  sanitizeCreateInput,
  validateBillingScope,
} from "./promoCodeService.js";

test("buildTargetsFromSessionType maps supported session types", () => {
  assert.deepEqual(buildTargetsFromSessionType("qa_session"), [PROMO_TARGETS.QA_SESSION]);
  assert.deepEqual(buildTargetsFromSessionType("focus"), [PROMO_TARGETS.FOCUS_SESSION]);
});

test("buildTargetFromReportTier maps deep dive reports", () => {
  assert.equal(buildTargetFromReportTier("deep_dive"), PROMO_TARGETS.REPORT_DEEP_DIVE);
});

test("computeEstimatedDiscountCents returns rounded preview amounts", () => {
  assert.equal(computeEstimatedDiscountCents(14999, 20), 3000);
  assert.equal(computeEstimatedDiscountCents(19900, 15), 2985);
});

test("deriveSyncStatus distinguishes synced, needs_sync, and broken", () => {
  assert.equal(deriveSyncStatus({
    existsInStripe: true,
    couponValid: true,
    promotionCodeValid: true,
    discountMatch: true,
    activeMatch: true,
    expiryMatch: true,
    usageMatch: true,
    issues: [],
  }), "synced");

  assert.equal(deriveSyncStatus({
    existsInStripe: true,
    couponValid: true,
    promotionCodeValid: true,
    discountMatch: false,
    activeMatch: true,
    expiryMatch: true,
    usageMatch: true,
    issues: ["Discount percentage does not match Stripe."],
  }), "needs_sync");

  assert.equal(deriveSyncStatus({
    existsInStripe: false,
    couponValid: false,
    promotionCodeValid: false,
    discountMatch: false,
    activeMatch: false,
    expiryMatch: false,
    usageMatch: false,
    issues: ["Stripe promotion code is missing or invalid."],
  }), "broken");
});

test("validateBillingScope allows recurring scope only for subscriptions", () => {
  assert.doesNotThrow(() => validateBillingScope("recurring", [PROMO_TARGETS.SUB_SEEKER]));
  assert.throws(
    () => validateBillingScope("recurring", [PROMO_TARGETS.QA_SESSION]),
    /subscription-specific promo targets|only be used for subscription promo targets/i,
  );
});

test("sanitizeCreateInput normalizes promo fields for persistence", () => {
  const sanitized = sanitizeCreateInput({
    code: "  welcome20 ",
    discountValue: 20,
    active: true,
    expiresAt: null,
    usageLimit: 25,
    appliesTo: [PROMO_TARGETS.SUB_SEEKER, PROMO_TARGETS.SUB_SEEKER],
    appliesToBilling: "recurring",
    minAmountCents: 1000,
    firstTimeOnly: true,
    campaign: " launch ",
  });

  assert.equal(sanitized.code, "WELCOME20");
  assert.equal(sanitized.discountValue, 20);
  assert.deepEqual(sanitized.appliesTo, [PROMO_TARGETS.SUB_SEEKER]);
  assert.equal(sanitized.appliesToBilling, "recurring");
  assert.equal(sanitized.minAmountCents, 1000);
  assert.equal(sanitized.firstTimeOnly, true);
  assert.equal(sanitized.campaign, "launch");
});
