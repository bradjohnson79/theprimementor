import assert from "node:assert/strict";
import test from "node:test";
import { PROMO_TARGETS } from "@wisdom/utils";
import {
  buildStripePromotionCodeCreateParams,
  buildTargetFromReportTier,
  buildTargetsFromSessionType,
  computeEstimatedDiscountCents,
  computePromoDiscountCents,
  deriveSyncStatus,
  promoCurrencyMatchesCheckout,
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

test("computePromoDiscountCents handles percentage and fixed amount discounts", () => {
  assert.equal(computePromoDiscountCents(14999, "percentage", 20), 3000);
  assert.equal(computePromoDiscountCents(14999, "fixed_amount", 2500), 2500);
  assert.equal(computePromoDiscountCents(2000, "fixed_amount", 2500), 2000);
});

test("promoCurrencyMatchesCheckout enforces fixed amount currency safety", () => {
  assert.equal(promoCurrencyMatchesCheckout("cad", "CAD"), true);
  assert.equal(promoCurrencyMatchesCheckout(null, "USD"), true);
  assert.equal(promoCurrencyMatchesCheckout("cad", "usd"), false);
});

test("buildStripePromotionCodeCreateParams uses Stripe promotion object", () => {
  const params = buildStripePromotionCodeCreateParams({
    couponId: "coupon_123",
    code: "SESSION15",
    active: true,
    expiresAt: new Date("2026-05-01T12:00:00.000Z"),
    usageLimit: 10,
    firstTimeOnly: true,
    campaign: "May",
  });

  assert.deepEqual(params.promotion, {
    type: "coupon",
    coupon: "coupon_123",
  });
  assert.equal("coupon" in params, false);
  assert.equal(params.expires_at, 1777636800);
  assert.deepEqual(params.restrictions, { first_time_transaction: true });
  assert.equal(params.metadata.platform, "prime_mentor");
  assert.equal(params.metadata.promo_code, "SESSION15");
});

test("deriveSyncStatus distinguishes synced, needs_sync, and broken", () => {
  assert.equal(deriveSyncStatus({
    existsInStripe: true,
    couponValid: true,
    promotionCodeValid: true,
    discountMatch: true,
    discountTypeMatch: true,
    currencyMatch: true,
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
    discountTypeMatch: true,
    currencyMatch: true,
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
    discountTypeMatch: false,
    currencyMatch: false,
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

test("sanitizeCreateInput supports fixed amount cents and CAD currency", () => {
  const sanitized = sanitizeCreateInput({
    code: " save25 ",
    discountType: "fixed_amount",
    discountValue: 2500,
    discountCurrency: "CAD",
    active: true,
    expiresAt: null,
    usageLimit: null,
    appliesTo: null,
    appliesToBilling: null,
    minAmountCents: null,
    firstTimeOnly: false,
    campaign: null,
  });

  assert.equal(sanitized.code, "SAVE25");
  assert.equal(sanitized.discountType, "fixed_amount");
  assert.equal(sanitized.discountValue, 2500);
  assert.equal(sanitized.discountCurrency, "cad");
});
