import assert from "node:assert/strict";
import test from "node:test";
import { PROMO_TARGETS, formatPromoExpirationPacific, pacificDateTimeToUtcIso } from "@wisdom/utils";
import {
  buildStripePromotionCodeCreateParams,
  buildTargetFromReportProduct,
  buildTargetFromReportTier,
  buildTargetsFromBookingSession,
  buildTargetsFromSessionType,
  computeEstimatedDiscountCents,
  computePromoDiscountCents,
  deriveSyncStatus,
  promoCurrencyMatchesCheckout,
  sanitizeCreateInput,
  shouldCountPromoUsagePaymentStatus,
  shouldVerifyActivePromo,
  validateBillingScope,
} from "./promoCodeService.js";

test("buildTargetsFromSessionType maps supported session types", () => {
  assert.deepEqual(buildTargetsFromSessionType("qa_session"), [PROMO_TARGETS.QA_SESSION]);
  assert.deepEqual(buildTargetsFromSessionType("focus"), [PROMO_TARGETS.FOCUS_SESSION]);
  assert.deepEqual(buildTargetsFromSessionType("mentoring"), [PROMO_TARGETS.MENTORING_SESSION]);
});

test("buildTargetsFromBookingSession includes mentoring duration targets", () => {
  assert.deepEqual(buildTargetsFromBookingSession("focus", "focus-session-45", 45), [
    PROMO_TARGETS.FOCUS_SESSION,
    PROMO_TARGETS.MENTORING_SESSION_45,
  ]);
  assert.deepEqual(buildTargetsFromBookingSession("mentoring", "mentoring-session-45", 45), [
    PROMO_TARGETS.MENTORING_SESSION,
    PROMO_TARGETS.MENTORING_SESSION_45,
  ]);
  assert.deepEqual(buildTargetsFromBookingSession("mentoring", "wisdom-mentoring-90", 90), [
    PROMO_TARGETS.MENTORING_SESSION,
    PROMO_TARGETS.MENTORING_SESSION_90,
  ]);
});

test("buildTargetFromReportTier maps deep dive reports", () => {
  assert.equal(buildTargetFromReportTier("deep_dive"), PROMO_TARGETS.REPORT_DEEP_DIVE);
});

test("buildTargetFromReportProduct maps casual report products", () => {
  assert.equal(buildTargetFromReportProduct("three_questions"), PROMO_TARGETS.REPORT_THREE_QUESTIONS);
  assert.equal(buildTargetFromReportProduct("compatibility"), PROMO_TARGETS.REPORT_COMPATIBILITY);
  assert.equal(buildTargetFromReportProduct("annual_12_month"), PROMO_TARGETS.REPORT_ANNUAL_12_MONTH);
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
    durationMatch: true,
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
    durationMatch: true,
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
    durationMatch: false,
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
    durationMonths: 2,
    appliesTo: [PROMO_TARGETS.SUB_SEEKER, PROMO_TARGETS.SUB_SEEKER],
    appliesToBilling: "recurring",
    minAmountCents: 1000,
    firstTimeOnly: true,
    campaign: " launch ",
  });

  assert.equal(sanitized.code, "WELCOME20");
  assert.equal(sanitized.discountValue, 20);
  assert.equal(sanitized.durationMonths, 2);
  assert.deepEqual(sanitized.appliesTo, [PROMO_TARGETS.SUB_SEEKER]);
  assert.equal(sanitized.appliesToBilling, "recurring");
  assert.equal(sanitized.minAmountCents, 1000);
  assert.equal(sanitized.firstTimeOnly, true);
  assert.equal(sanitized.campaign, "launch");
});

test("sanitizeCreateInput requires recurring billing for duration months", () => {
  assert.throws(
    () => sanitizeCreateInput({
      code: "monthly",
      discountValue: 10,
      durationMonths: 2,
      active: true,
      expiresAt: null,
      usageLimit: null,
      appliesTo: [PROMO_TARGETS.SUB_SEEKER],
      appliesToBilling: "one_time",
      minAmountCents: null,
      firstTimeOnly: false,
      campaign: null,
    }),
    /durationMonths requires recurring billing scope/i,
  );
});

test("sanitizeCreateInput supports fixed amount cents and CAD currency", () => {
  const sanitized = sanitizeCreateInput({
    code: " save25 ",
    discountType: "fixed_amount",
    discountValue: 2500,
    discountCurrency: "CAD",
    durationMonths: null,
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

test("pacificDateTimeToUtcIso converts winter PST expiration", () => {
  assert.equal(pacificDateTimeToUtcIso("2026-01-05", "13:00"), "2026-01-05T21:00:00.000Z");
});

test("pacificDateTimeToUtcIso converts summer PDT expiration", () => {
  assert.equal(pacificDateTimeToUtcIso("2026-07-31", "23:59"), "2026-08-01T06:59:00.000Z");
});

test("pacificDateTimeToUtcIso handles near-midnight Pacific values", () => {
  assert.equal(pacificDateTimeToUtcIso("2026-03-01", "00:05"), "2026-03-01T08:05:00.000Z");
});

test("pacificDateTimeToUtcIso rejects nonexistent spring-forward local time", () => {
  assert.throws(
    () => pacificDateTimeToUtcIso("2026-03-08", "02:30"),
    /valid Pacific time/i,
  );
});

test("formatPromoExpirationPacific displays stored UTC in Pacific time", () => {
  assert.equal(formatPromoExpirationPacific("2026-08-01T06:59:00.000Z"), "Jul 31, 2026 at 11:59 PM PDT");
  assert.equal(formatPromoExpirationPacific(null), "No expiration");
});

test("sanitizeCreateInput defaults oncePerCustomer to false", () => {
  const sanitized = sanitizeCreateInput({
    code: "defaultonce",
    discountValue: 10,
    active: true,
    expiresAt: null,
    usageLimit: null,
    appliesTo: null,
    appliesToBilling: null,
    minAmountCents: null,
    firstTimeOnly: false,
    campaign: null,
  });
  assert.equal(sanitized.oncePerCustomer, false);
});

test("sanitizeCreateInput accepts valid oncePerCustomer boolean", () => {
  const sanitized = sanitizeCreateInput({
    code: "once",
    discountValue: 10,
    active: true,
    expiresAt: null,
    usageLimit: null,
    appliesTo: null,
    appliesToBilling: null,
    minAmountCents: null,
    firstTimeOnly: false,
    oncePerCustomer: true,
    campaign: null,
  });
  assert.equal(sanitized.oncePerCustomer, true);
});

test("sanitizeCreateInput rejects malformed oncePerCustomer values", () => {
  assert.throws(
    () => sanitizeCreateInput({
      code: "badonce",
      discountValue: 10,
      active: true,
      expiresAt: null,
      usageLimit: null,
      appliesTo: null,
      appliesToBilling: null,
      minAmountCents: null,
      firstTimeOnly: false,
      oncePerCustomer: "true",
      campaign: null,
    }),
    /oncePerCustomer must be a boolean/i,
  );
});

test("shouldCountPromoUsagePaymentStatus only counts successful payments", () => {
  assert.equal(shouldCountPromoUsagePaymentStatus("paid"), true);
  assert.equal(shouldCountPromoUsagePaymentStatus("pending"), false);
  assert.equal(shouldCountPromoUsagePaymentStatus("failed"), false);
});

test("shouldVerifyActivePromo selects only active non-expired promos", () => {
  const now = new Date("2026-07-01T12:00:00.000Z");
  assert.equal(shouldVerifyActivePromo({ active: true, archived_at: null, expires_at: null }, now), true);
  assert.equal(shouldVerifyActivePromo({ active: true, archived_at: null, expires_at: new Date("2026-07-01T12:01:00.000Z") }, now), true);
  assert.equal(shouldVerifyActivePromo({ active: false, archived_at: null, expires_at: null }, now), false);
  assert.equal(shouldVerifyActivePromo({ active: true, archived_at: new Date("2026-06-01T12:00:00.000Z"), expires_at: null }, now), false);
  assert.equal(shouldVerifyActivePromo({ active: true, archived_at: null, expires_at: new Date("2026-07-01T11:59:00.000Z") }, now), false);
});
