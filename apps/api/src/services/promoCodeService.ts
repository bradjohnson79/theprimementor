import Stripe from "stripe";
import {
  bookingTypes,
  bookings,
  mentorTrainingOrders,
  payments,
  promoCodeChangesLog,
  promoCodes,
  promoCodeUsages,
  reports,
  subscriptions,
  type Database,
} from "@wisdom/db";
import {
  DIVIN8_REPORT_PRICE_CENTS_BY_TIER,
  MEMBER_PRICING,
  MENTOR_TRAINING_PACKAGES,
  PROMO_TARGETS,
  PROMO_TARGET_VALUES,
  normalizePromoCode,
  type MentorTrainingPackageType,
  type PromoBillingScope,
  type PromoTarget,
  type ReportTierId,
} from "@wisdom/utils";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { createHttpError } from "./booking/errors.js";
import { getActiveMentoringCirclePurchaseEvent, getMentoringCircleEventOrThrow } from "./mentoringCircleService.js";

type CheckoutType = "session" | "report" | "subscription" | "mentor_training" | "mentoring_circle";
type SyncDirection = "db_to_stripe" | "stripe_to_db";
type PromoSyncStatus = "synced" | "needs_sync" | "broken";

interface PromoContextInput {
  userId: string;
  type?: CheckoutType;
  bookingId?: string;
  reportId?: string;
  membershipId?: string;
  trainingOrderId?: string;
  eventId?: string;
  sessionType?: string | null;
  reportTier?: ReportTierId | null;
  membershipTier?: "seeker" | "initiate" | null;
  billingInterval?: "monthly" | "annual" | null;
  packageType?: MentorTrainingPackageType | null;
}

interface PromoValidationInput extends PromoContextInput {
  code: string;
}

interface PromoMutationInput {
  code: string;
  discountValue: number;
  active: boolean;
  expiresAt: string | null;
  usageLimit: number | null;
  appliesTo: PromoTarget[] | null;
  appliesToBilling: PromoBillingScope | null;
  minAmountCents: number | null;
  firstTimeOnly: boolean;
  campaign: string | null;
}

interface PromoUpdateInput {
  active?: boolean;
  expiresAt?: string | null;
  usageLimit?: number | null;
  appliesTo?: PromoTarget[] | null;
  appliesToBilling?: PromoBillingScope | null;
  minAmountCents?: number | null;
  firstTimeOnly?: boolean;
  campaign?: string | null;
  archive?: boolean;
}

interface StripePromotionSnapshot {
  coupon: Stripe.Coupon | Stripe.DeletedCoupon | null;
  promotionCode: Stripe.PromotionCode | null;
}

interface StripeValidationResult {
  existsInStripe: boolean;
  couponValid: boolean;
  promotionCodeValid: boolean;
  discountMatch: boolean;
  activeMatch: boolean;
  expiryMatch: boolean;
  usageMatch: boolean;
  issues: string[];
}

interface PromoCheckoutContext {
  type: CheckoutType;
  amountCents: number;
  currency: string;
  targets: PromoTarget[];
  billingScope: PromoBillingScope | null;
  userId: string;
}

type PromoRow = typeof promoCodes.$inferSelect;

export interface PromoCodeListItem {
  id: string;
  code: string;
  discountType: "percentage";
  discountValue: number;
  active: boolean;
  expiresAt: string | null;
  usageLimit: number | null;
  timesUsed: number;
  appliesTo: PromoTarget[] | null;
  appliesToBilling: PromoBillingScope | null;
  minAmountCents: number | null;
  firstTimeOnly: boolean;
  campaign: string | null;
  stripeCouponId: string;
  stripePromotionCodeId: string;
  syncStatus: PromoSyncStatus;
  lastValidatedAt: string | null;
  lastValidationOk: boolean | null;
  lastValidationSnapshot: StripeValidationResult | null;
  validationFailureCode: string | null;
  validationFailureMessage: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string | null;
  lifecycleStatus: "active" | "inactive" | "expired" | "archived";
  performance: {
    usageCount: number;
    revenueImpactedCents: number;
    averageOrderValueCents: number | null;
  };
  syncRecommendation: SyncDirection | null;
}

export interface PromoCodeValidationResponse {
  valid: boolean;
  message?: string;
  code?: string;
  promoCodeId?: string;
  stripePromotionCodeId?: string;
  estimatedDiscount: number | null;
  finalEstimate: number | null;
  estimatedDiscountCents: number | null;
  finalEstimateCents: number | null;
  currency: string | null;
}

let stripeInstance: Stripe | null = null;

function getStripe() {
  if (!stripeInstance) {
    const key = process.env.STRIPE_SECRET_KEY?.trim();
    if (!key) {
      throw new Error("STRIPE_SECRET_KEY not set");
    }
    stripeInstance = new Stripe(key);
  }
  return stripeInstance;
}

function isPromoTargetArray(value: unknown): value is PromoTarget[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string" && PROMO_TARGET_VALUES.includes(entry as PromoTarget));
}

function normalizeOptionalText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizePromoTargets(value: PromoTarget[] | null | undefined) {
  if (!value || value.length === 0) {
    return null;
  }
  const unique = Array.from(new Set(value.filter((entry) => PROMO_TARGET_VALUES.includes(entry))));
  return unique.length > 0 ? unique : null;
}

function normalizeExpiresAt(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw createHttpError(400, "expiresAt must be a valid datetime");
  }
  return date;
}

function normalizeDiscountValue(value: number) {
  if (!Number.isInteger(value) || value <= 0 || value > 100) {
    throw createHttpError(400, "discountValue must be an integer between 1 and 100");
  }
  return value;
}

function normalizeUsageLimit(value: number | null | undefined) {
  if (value == null) return null;
  if (!Number.isInteger(value) || value <= 0) {
    throw createHttpError(400, "usageLimit must be a positive integer");
  }
  return value;
}

function normalizeMinAmountCents(value: number | null | undefined) {
  if (value == null) return null;
  if (!Number.isInteger(value) || value <= 0) {
    throw createHttpError(400, "minAmountCents must be a positive integer");
  }
  return value;
}

export function validateBillingScope(appliesToBilling: PromoBillingScope | null, appliesTo: PromoTarget[] | null) {
  if (!appliesToBilling) {
    return;
  }
  if (!appliesTo || appliesTo.length === 0) {
    throw createHttpError(400, "appliesToBilling requires subscription-specific promo targets");
  }
  const nonSubscriptionTarget = appliesTo.some((target) => !target.startsWith("subscription:"));
  if (nonSubscriptionTarget) {
    throw createHttpError(400, "appliesToBilling can only be used for subscription promo targets");
  }
}

function toIso(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

function toUnixTimestamp(value: Date | null) {
  return value ? Math.floor(value.getTime() / 1000) : undefined;
}

export function buildStripePromotionCodeCreateParams(input: {
  couponId: string;
  code: string;
  active: boolean;
  expiresAt: Date | null;
  usageLimit: number | null;
  firstTimeOnly: boolean;
  campaign: string | null;
}) {
  return {
    promotion: {
      type: "coupon",
      coupon: input.couponId,
    },
    code: input.code,
    active: input.active,
    expires_at: toUnixTimestamp(input.expiresAt),
    max_redemptions: input.usageLimit ?? undefined,
    restrictions: input.firstTimeOnly ? { first_time_transaction: true } : undefined,
    metadata: {
      promoCode: input.code,
      campaign: input.campaign ?? "",
    },
  };
}

export function computeEstimatedDiscountCents(amountCents: number, percentage: number) {
  return Math.round(amountCents * (percentage / 100));
}

function centsToAmount(value: number | null) {
  return value == null ? null : Number((value / 100).toFixed(2));
}

function deriveLifecycleStatus(row: PromoRow): PromoCodeListItem["lifecycleStatus"] {
  if (row.archived_at) return "archived";
  if (row.expires_at && row.expires_at.getTime() <= Date.now()) return "expired";
  if (!row.active) return "inactive";
  return "active";
}

export function deriveSyncStatus(validation: StripeValidationResult): PromoSyncStatus {
  if (!validation.existsInStripe || !validation.couponValid || !validation.promotionCodeValid) {
    return "broken";
  }
  if (validation.issues.length > 0) {
    return "needs_sync";
  }
  return "synced";
}

function deriveFixSyncRecommendation(validation: StripeValidationResult | null): SyncDirection | null {
  if (!validation) return null;
  if (!validation.existsInStripe || !validation.couponValid || !validation.promotionCodeValid) {
    return "db_to_stripe";
  }
  if (validation.issues.length > 0) {
    return "db_to_stripe";
  }
  return null;
}

async function getPromoById(db: Database, promoCodeId: string) {
  const [row] = await db
    .select()
    .from(promoCodes)
    .where(eq(promoCodes.id, promoCodeId))
    .limit(1);
  if (!row) {
    throw createHttpError(404, "Promo code not found");
  }
  return row;
}

async function getPromoByCode(db: Database, code: string) {
  const normalizedCode = normalizePromoCode(code);
  const [row] = await db
    .select()
    .from(promoCodes)
    .where(eq(promoCodes.code, normalizedCode))
    .limit(1);
  return row ?? null;
}

export function buildTargetsFromSessionType(sessionType: string): PromoTarget[] {
  switch (sessionType) {
    case "qa_session":
      return [PROMO_TARGETS.QA_SESSION];
    case "focus":
      return [PROMO_TARGETS.FOCUS_SESSION];
    case "mentoring":
      return [PROMO_TARGETS.MENTORING_SESSION];
    case "regeneration":
      return [PROMO_TARGETS.REGEN_SESSION];
    default:
      throw createHttpError(400, "Unsupported session type for promo validation");
  }
}

export function buildTargetFromReportTier(tier: ReportTierId): PromoTarget {
  switch (tier) {
    case "intro":
      return PROMO_TARGETS.REPORT_INTRO;
    case "deep_dive":
      return PROMO_TARGETS.REPORT_DEEP_DIVE;
    case "initiate":
      return PROMO_TARGETS.REPORT_INITIATE;
  }
}

function buildTargetFromMembershipTier(tier: "seeker" | "initiate"): PromoTarget {
  return tier === "seeker" ? PROMO_TARGETS.SUB_SEEKER : PROMO_TARGETS.SUB_INITIATE;
}

function buildTargetFromTrainingPackage(packageType: MentorTrainingPackageType): PromoTarget {
  switch (packageType) {
    case "entry":
      return PROMO_TARGETS.MENTOR_TRAINING_ENTRY;
    case "seeker":
      return PROMO_TARGETS.MENTOR_TRAINING_SEEKER;
    case "initiate":
      return PROMO_TARGETS.MENTOR_TRAINING_INITIATE;
  }
}

async function resolvePromoCheckoutContext(db: Database, input: PromoContextInput): Promise<PromoCheckoutContext> {
  const type = input.type ?? "session";

  if (type === "session") {
    if (input.bookingId?.trim()) {
      const [row] = await db
        .select({
          userId: bookings.user_id,
          sessionType: bookings.session_type,
          amountCents: bookingTypes.price_cents,
          currency: bookingTypes.currency,
        })
        .from(bookings)
        .innerJoin(bookingTypes, eq(bookings.booking_type_id, bookingTypes.id))
        .where(eq(bookings.id, input.bookingId.trim()))
        .limit(1);
      if (!row || row.userId !== input.userId) {
        throw createHttpError(404, "Booking not found");
      }
      return {
        type,
        amountCents: row.amountCents,
        currency: row.currency,
        targets: buildTargetsFromSessionType(row.sessionType),
        billingScope: "one_time",
        userId: input.userId,
      };
    }

    if (!input.sessionType?.trim()) {
      throw createHttpError(400, "sessionType is required");
    }
    const [row] = await db
      .select({
        priceCents: bookingTypes.price_cents,
        currency: bookingTypes.currency,
      })
      .from(bookingTypes)
      .where(and(
        eq(bookingTypes.session_type, input.sessionType.trim() as typeof bookingTypes.$inferSelect.session_type),
        eq(bookingTypes.is_active, true),
      ))
      .limit(1);
    if (!row) {
      throw createHttpError(404, "Session type not found");
    }
    return {
      type,
      amountCents: row.priceCents,
      currency: row.currency,
      targets: buildTargetsFromSessionType(input.sessionType.trim()),
      billingScope: "one_time",
      userId: input.userId,
    };
  }

  if (type === "report") {
    const tier = input.reportTier ?? await (async () => {
      if (!input.reportId?.trim()) {
        throw createHttpError(400, "reportId or reportTier is required");
      }
      const [row] = await db
        .select({
          userId: reports.user_id,
          tier: reports.interpretation_tier,
        })
        .from(reports)
        .where(eq(reports.id, input.reportId.trim()))
        .limit(1);
      if (!row || row.userId !== input.userId) {
        throw createHttpError(404, "Report not found");
      }
      if (row.tier !== "intro" && row.tier !== "deep_dive" && row.tier !== "initiate") {
        throw createHttpError(400, "Invalid report tier");
      }
      return row.tier as ReportTierId;
    })();
    return {
      type,
      amountCents: DIVIN8_REPORT_PRICE_CENTS_BY_TIER[tier],
      currency: "CAD",
      targets: [buildTargetFromReportTier(tier)],
      billingScope: "one_time",
      userId: input.userId,
    };
  }

  if (type === "subscription") {
    let tier = input.membershipTier ?? null;
    let billingInterval = input.billingInterval ?? null;
    if (!tier || !billingInterval) {
      if (!input.membershipId?.trim()) {
        throw createHttpError(400, "membershipId or membership tier details are required");
      }
      const [row] = await db
        .select({
          userId: subscriptions.user_id,
          tier: subscriptions.tier,
          metadata: subscriptions.metadata,
        })
        .from(subscriptions)
        .where(eq(subscriptions.id, input.membershipId.trim()))
        .limit(1);
      if (!row || row.userId !== input.userId) {
        throw createHttpError(404, "Membership not found");
      }
      if (row.tier !== "seeker" && row.tier !== "initiate") {
        throw createHttpError(400, "Invalid membership tier");
      }
      tier = row.tier;
      const metadata = row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
        ? row.metadata as Record<string, unknown>
        : {};
      billingInterval = metadata.billingInterval === "annual" ? "annual" : "monthly";
    }
    return {
      type,
      amountCents: Math.round(MEMBER_PRICING[tier][billingInterval].amountCad * 100),
      currency: "CAD",
      targets: [buildTargetFromMembershipTier(tier)],
      billingScope: billingInterval === "annual" || billingInterval === "monthly" ? "recurring" : null,
      userId: input.userId,
    };
  }

  if (type === "mentor_training") {
    const packageType = input.packageType ?? await (async () => {
      if (!input.trainingOrderId?.trim()) {
        throw createHttpError(400, "trainingOrderId or packageType is required");
      }
      const [row] = await db
        .select({
          userId: mentorTrainingOrders.user_id,
          packageType: mentorTrainingOrders.package_type,
        })
        .from(mentorTrainingOrders)
        .where(eq(mentorTrainingOrders.id, input.trainingOrderId.trim()))
        .limit(1);
      if (!row || row.userId !== input.userId) {
        throw createHttpError(404, "Mentor training order not found");
      }
      return row.packageType;
    })();
    return {
      type,
      amountCents: Math.round(MENTOR_TRAINING_PACKAGES[packageType].priceCad * 100),
      currency: "CAD",
      targets: [buildTargetFromTrainingPackage(packageType)],
      billingScope: "one_time",
      userId: input.userId,
    };
  }

  const event = input.eventId?.trim()
    ? getMentoringCircleEventOrThrow(input.eventId.trim())
    : getActiveMentoringCirclePurchaseEvent();
  if (!event) {
    throw createHttpError(409, "No Mentoring Circle event is currently available for purchase.");
  }
  return {
    type: "mentoring_circle",
    amountCents: event.priceCents,
    currency: event.currency,
    targets: [PROMO_TARGETS.MENTORING_CIRCLE],
    billingScope: "one_time",
    userId: input.userId,
  };
}

async function userHasPriorPaidPurchase(db: Database, userId: string) {
  const [row] = await db
    .select({ id: payments.id })
    .from(payments)
    .where(and(
      eq(payments.user_id, userId),
      eq(payments.status, "paid"),
    ))
    .limit(1);
  return Boolean(row);
}

async function fetchStripePromotionSnapshot(promo: PromoRow): Promise<StripePromotionSnapshot> {
  const stripe = getStripe();
  const [couponResult, promotionResult] = await Promise.allSettled([
    stripe.coupons.retrieve(promo.stripe_coupon_id),
    stripe.promotionCodes.retrieve(promo.stripe_promotion_code_id),
  ]);

  const coupon = couponResult.status === "fulfilled" ? couponResult.value : null;
  const promotionCode = promotionResult.status === "fulfilled" ? promotionResult.value : null;
  return { coupon, promotionCode };
}

function compareExpiry(dbValue: Date | null, stripeValue: number | null | undefined) {
  if (!dbValue && !stripeValue) return true;
  if (!dbValue || !stripeValue) return false;
  return Math.floor(dbValue.getTime() / 1000) === stripeValue;
}

function compareUsageLimit(dbValue: number | null, stripeValue: number | null | undefined) {
  return (dbValue ?? null) === (stripeValue ?? null);
}

export async function verifyPromoCodeWithStripe(db: Database, promoCodeId: string) {
  const promo = await getPromoById(db, promoCodeId);
  const snapshot = await fetchStripePromotionSnapshot(promo);
  const coupon = snapshot.coupon;
  const promotionCode = snapshot.promotionCode;

  const couponDeleted = coupon && "deleted" in coupon && coupon.deleted;
  const existsInStripe = Boolean(coupon && !couponDeleted && promotionCode);
  const couponValid = Boolean(coupon && !couponDeleted);
  const promotionCodeValid = Boolean(promotionCode);
  const discountMatch = Boolean(coupon && !couponDeleted && coupon.percent_off === promo.discount_value);
  const activeMatch = Boolean(promotionCode && promotionCode.active === promo.active);
  const expiryMatch = Boolean(promotionCode && compareExpiry(promo.expires_at, promotionCode.expires_at));
  const usageMatch = Boolean(promotionCode && compareUsageLimit(promo.usage_limit, promotionCode.max_redemptions));

  const issues: string[] = [];
  if (!existsInStripe) issues.push("Promo code resources could not be found in Stripe.");
  if (!couponValid) issues.push("Stripe coupon is missing or invalid.");
  if (!promotionCodeValid) issues.push("Stripe promotion code is missing or invalid.");
  if (couponValid && !discountMatch) issues.push("Discount percentage does not match Stripe.");
  if (promotionCodeValid && !activeMatch) issues.push("Active status does not match Stripe.");
  if (promotionCodeValid && !expiryMatch) issues.push("Expiration date does not match Stripe.");
  if (promotionCodeValid && !usageMatch) issues.push("Usage limit does not match Stripe.");

  const validation: StripeValidationResult = {
    existsInStripe,
    couponValid,
    promotionCodeValid,
    discountMatch,
    activeMatch,
    expiryMatch,
    usageMatch,
    issues,
  };

  const syncStatus = deriveSyncStatus(validation);
  await db
    .update(promoCodes)
    .set({
      sync_status: syncStatus,
      last_validated_at: new Date(),
      last_validation_ok: issues.length === 0,
      last_validation_snapshot: validation,
      validation_failure_code: issues.length > 0 ? syncStatus : null,
      validation_failure_message: issues.length > 0 ? issues.join(" ") : null,
      updated_at: new Date(),
    })
    .where(eq(promoCodes.id, promoCodeId));

  return validation;
}

async function createStripeResources(input: {
  code: string;
  discountValue: number;
  active: boolean;
  expiresAt: Date | null;
  usageLimit: number | null;
  appliesToBilling: PromoBillingScope | null;
  firstTimeOnly: boolean;
  campaign: string | null;
}) {
  const stripe = getStripe();
  const coupon = await stripe.coupons.create({
    duration: input.appliesToBilling === "recurring" ? "forever" : "once",
    percent_off: input.discountValue,
    metadata: {
      promoCode: input.code,
      campaign: input.campaign ?? "",
    },
  });

  const promotionCode = await stripe.promotionCodes.create(buildStripePromotionCodeCreateParams({
    couponId: coupon.id,
    code: input.code,
    active: input.active,
    expiresAt: input.expiresAt,
    usageLimit: input.usageLimit,
    firstTimeOnly: input.firstTimeOnly,
    campaign: input.campaign,
  }) as any);

  return {
    stripeCouponId: coupon.id,
    stripePromotionCodeId: promotionCode.id,
  };
}

async function recordPromoChange(
  db: Database,
  input: {
    promoCodeId: string;
    fieldChanged: string;
    oldValue: unknown;
    newValue: unknown;
    changedBy: string | null;
  },
) {
  await db.insert(promoCodeChangesLog).values({
    promo_code_id: input.promoCodeId,
    field_changed: input.fieldChanged,
    old_value: input.oldValue,
    new_value: input.newValue,
    changed_by: input.changedBy,
  });
}

export function sanitizeCreateInput(input: PromoMutationInput) {
  const code = normalizePromoCode(input.code);
  if (!code) {
    throw createHttpError(400, "code is required");
  }
  const appliesTo = normalizePromoTargets(input.appliesTo);
  const appliesToBilling = input.appliesToBilling ?? null;
  validateBillingScope(appliesToBilling, appliesTo);
  return {
    code,
    discountValue: normalizeDiscountValue(input.discountValue),
    active: input.active !== false,
    expiresAt: normalizeExpiresAt(input.expiresAt),
    usageLimit: normalizeUsageLimit(input.usageLimit),
    appliesTo,
    appliesToBilling,
    minAmountCents: normalizeMinAmountCents(input.minAmountCents),
    firstTimeOnly: input.firstTimeOnly === true,
    campaign: normalizeOptionalText(input.campaign),
  };
}

export async function createPromoCode(db: Database, input: PromoMutationInput, actorUserId: string) {
  const normalized = sanitizeCreateInput(input);
  const existing = await getPromoByCode(db, normalized.code);
  if (existing) {
    throw createHttpError(409, "Promo code already exists");
  }

  const stripeIds = await createStripeResources(normalized);
  const [created] = await db
    .insert(promoCodes)
    .values({
      code: normalized.code,
      discount_type: "percentage",
      discount_value: normalized.discountValue,
      active: normalized.active,
      expires_at: normalized.expiresAt,
      usage_limit: normalized.usageLimit,
      times_used: 0,
      applies_to: normalized.appliesTo,
      applies_to_billing: normalized.appliesToBilling,
      min_amount_cents: normalized.minAmountCents,
      first_time_only: normalized.firstTimeOnly,
      campaign: normalized.campaign,
      stripe_coupon_id: stripeIds.stripeCouponId,
      stripe_promotion_code_id: stripeIds.stripePromotionCodeId,
      sync_status: "needs_sync",
    })
    .returning();

  await recordPromoChange(db, {
    promoCodeId: created.id,
    fieldChanged: "created",
    oldValue: null,
    newValue: { code: created.code, discountValue: created.discount_value },
    changedBy: actorUserId,
  });

  await verifyPromoCodeWithStripe(db, created.id);
  return getPromoCodeDetail(db, created.id);
}

function sanitizeUpdateInput(input: PromoUpdateInput) {
  const patch: Record<string, unknown> = {};
  if (typeof input.active === "boolean") patch.active = input.active;
  if ("expiresAt" in input) patch.expires_at = normalizeExpiresAt(input.expiresAt ?? null);
  if ("usageLimit" in input) patch.usage_limit = normalizeUsageLimit(input.usageLimit ?? null);
  if ("appliesTo" in input) patch.applies_to = normalizePromoTargets(input.appliesTo ?? null);
  if ("appliesToBilling" in input) patch.applies_to_billing = input.appliesToBilling ?? null;
  if ("minAmountCents" in input) patch.min_amount_cents = normalizeMinAmountCents(input.minAmountCents ?? null);
  if ("firstTimeOnly" in input && typeof input.firstTimeOnly === "boolean") patch.first_time_only = input.firstTimeOnly;
  if ("campaign" in input) patch.campaign = normalizeOptionalText(input.campaign ?? null);
  if (input.archive === true) {
    patch.archived_at = new Date();
    patch.active = false;
  }
  validateBillingScope(
    ("applies_to_billing" in patch ? patch.applies_to_billing : null) as PromoBillingScope | null,
    ("applies_to" in patch ? patch.applies_to : null) as PromoTarget[] | null,
  );
  return patch;
}

export async function updatePromoCode(db: Database, promoCodeId: string, input: PromoUpdateInput, actorUserId: string) {
  const current = await getPromoById(db, promoCodeId);
  const patch = sanitizeUpdateInput(input);
  if (Object.keys(patch).length === 0) {
    return getPromoCodeDetail(db, promoCodeId);
  }

  const nextValues = { ...current, ...patch, updated_at: new Date(), sync_status: "needs_sync" as PromoSyncStatus };
  await db
    .update(promoCodes)
    .set({
      ...patch,
      sync_status: "needs_sync",
      updated_at: new Date(),
    })
    .where(eq(promoCodes.id, promoCodeId));

  for (const [fieldChanged, newValue] of Object.entries(patch)) {
    const currentValue = current[fieldChanged as keyof PromoRow] ?? null;
    await recordPromoChange(db, {
      promoCodeId,
      fieldChanged,
      oldValue: currentValue,
      newValue,
      changedBy: actorUserId,
    });
  }

  await verifyPromoCodeWithStripe(db, promoCodeId);
  return getPromoCodeDetail(db, promoCodeId);
}

export async function getPromoCodeDetail(db: Database, promoCodeId: string): Promise<PromoCodeListItem> {
  const promo = await getPromoById(db, promoCodeId);
  const usageRows = await db
    .select({
      paymentAmountCents: payments.amount_cents,
    })
    .from(promoCodeUsages)
    .innerJoin(payments, eq(promoCodeUsages.payment_id, payments.id))
    .where(eq(promoCodeUsages.promo_code_id, promo.id));

  const usageCount = usageRows.length;
  const revenueImpactedCents = usageRows.reduce(
    (sum, row) => sum + computeEstimatedDiscountCents(row.paymentAmountCents, promo.discount_value),
    0,
  );
  const averageOrderValueCents = usageCount > 0
    ? Math.round(usageRows.reduce((sum, row) => sum + row.paymentAmountCents, 0) / usageCount)
    : null;
  const validation = (promo.last_validation_snapshot as StripeValidationResult | null) ?? null;

  return {
    id: promo.id,
    code: promo.code,
    discountType: promo.discount_type,
    discountValue: promo.discount_value,
    active: promo.active,
    expiresAt: toIso(promo.expires_at),
    usageLimit: promo.usage_limit,
    timesUsed: promo.times_used,
    appliesTo: (promo.applies_to as PromoTarget[] | null) ?? null,
    appliesToBilling: promo.applies_to_billing,
    minAmountCents: promo.min_amount_cents,
    firstTimeOnly: promo.first_time_only,
    campaign: promo.campaign,
    stripeCouponId: promo.stripe_coupon_id,
    stripePromotionCodeId: promo.stripe_promotion_code_id,
    syncStatus: promo.sync_status,
    lastValidatedAt: toIso(promo.last_validated_at),
    lastValidationOk: promo.last_validation_ok,
    lastValidationSnapshot: validation,
    validationFailureCode: promo.validation_failure_code,
    validationFailureMessage: promo.validation_failure_message,
    archivedAt: toIso(promo.archived_at),
    createdAt: promo.created_at.toISOString(),
    updatedAt: toIso(promo.updated_at),
    lifecycleStatus: deriveLifecycleStatus(promo),
    performance: {
      usageCount,
      revenueImpactedCents,
      averageOrderValueCents,
    },
    syncRecommendation: deriveFixSyncRecommendation(validation),
  };
}

export async function listPromoCodes(db: Database): Promise<PromoCodeListItem[]> {
  const rows = await db
    .select()
    .from(promoCodes)
    .orderBy(desc(promoCodes.created_at));
  return Promise.all(rows.map((row) => getPromoCodeDetail(db, row.id)));
}

export async function validatePromoCodeForCheckout(db: Database, input: PromoValidationInput): Promise<PromoCodeValidationResponse> {
  const promo = await getPromoByCode(db, input.code);
  if (!promo) {
    return {
      valid: false,
      message: "Promo code not found",
      estimatedDiscount: null,
      finalEstimate: null,
      estimatedDiscountCents: null,
      finalEstimateCents: null,
      currency: null,
    };
  }

  if (promo.archived_at) {
    return { valid: false, message: "This promo code is no longer active", estimatedDiscount: null, finalEstimate: null, estimatedDiscountCents: null, finalEstimateCents: null, currency: null };
  }
  if (!promo.active) {
    return { valid: false, message: "This promo code is no longer active", estimatedDiscount: null, finalEstimate: null, estimatedDiscountCents: null, finalEstimateCents: null, currency: null };
  }
  if (promo.expires_at && promo.expires_at.getTime() <= Date.now()) {
    return { valid: false, message: "This promo code has expired", estimatedDiscount: null, finalEstimate: null, estimatedDiscountCents: null, finalEstimateCents: null, currency: null };
  }
  if (promo.usage_limit != null && promo.times_used >= promo.usage_limit) {
    return { valid: false, message: "This promo code has reached its usage limit", estimatedDiscount: null, finalEstimate: null, estimatedDiscountCents: null, finalEstimateCents: null, currency: null };
  }

  const context = await resolvePromoCheckoutContext(db, input);
  const appliesTo = (promo.applies_to as PromoTarget[] | null) ?? null;
  if (appliesTo && !context.targets.some((target) => appliesTo.includes(target))) {
    return { valid: false, message: "This code does not apply to this purchase", estimatedDiscount: null, finalEstimate: null, estimatedDiscountCents: null, finalEstimateCents: null, currency: context.currency };
  }
  if (promo.applies_to_billing && context.billingScope !== promo.applies_to_billing) {
    return { valid: false, message: "This promo code does not apply to this subscription", estimatedDiscount: null, finalEstimate: null, estimatedDiscountCents: null, finalEstimateCents: null, currency: context.currency };
  }
  if (promo.min_amount_cents != null && context.amountCents < promo.min_amount_cents) {
    return { valid: false, message: "This promo code does not apply to this purchase", estimatedDiscount: null, finalEstimate: null, estimatedDiscountCents: null, finalEstimateCents: null, currency: context.currency };
  }
  if (promo.first_time_only && await userHasPriorPaidPurchase(db, input.userId)) {
    return { valid: false, message: "This promo code is only valid for first-time purchases", estimatedDiscount: null, finalEstimate: null, estimatedDiscountCents: null, finalEstimateCents: null, currency: context.currency };
  }

  let stripeSnapshot: StripePromotionSnapshot;
  try {
    stripeSnapshot = await fetchStripePromotionSnapshot(promo);
  } catch {
    throw createHttpError(503, "Unable to verify with Stripe");
  }

  const promotionCode = stripeSnapshot.promotionCode;
  const coupon = stripeSnapshot.coupon;
  const couponDeleted = coupon && "deleted" in coupon && coupon.deleted;
  if (!promotionCode || !coupon || couponDeleted) {
    return { valid: false, message: "This promo code is no longer valid", estimatedDiscount: null, finalEstimate: null, estimatedDiscountCents: null, finalEstimateCents: null, currency: context.currency };
  }
  if (!promotionCode.active) {
    return { valid: false, message: "This promo code is no longer valid", estimatedDiscount: null, finalEstimate: null, estimatedDiscountCents: null, finalEstimateCents: null, currency: context.currency };
  }

  const estimatedDiscountCents = computeEstimatedDiscountCents(context.amountCents, promo.discount_value);
  const finalEstimateCents = Math.max(0, context.amountCents - estimatedDiscountCents);
  return {
    valid: true,
    code: promo.code,
    promoCodeId: promo.id,
    stripePromotionCodeId: promo.stripe_promotion_code_id,
    estimatedDiscount: centsToAmount(estimatedDiscountCents),
    finalEstimate: centsToAmount(finalEstimateCents),
    estimatedDiscountCents,
    finalEstimateCents,
    currency: context.currency,
  };
}

export async function applyPromoFixSync(
  db: Database,
  promoCodeId: string,
  direction: SyncDirection,
  actorUserId: string,
) {
  const promo = await getPromoById(db, promoCodeId);
  const validation = await verifyPromoCodeWithStripe(db, promoCodeId);

  if (direction === "stripe_to_db") {
    const snapshot = await fetchStripePromotionSnapshot(promo);
    const coupon = snapshot.coupon;
    const promotionCode = snapshot.promotionCode;
    const couponDeleted = coupon && "deleted" in coupon && coupon.deleted;
    if (!coupon || !promotionCode || couponDeleted) {
      throw createHttpError(400, "Stripe data is missing and cannot be copied into the database");
    }
    const patch = {
      active: promotionCode.active,
      expires_at: promotionCode.expires_at ? new Date(promotionCode.expires_at * 1000) : null,
      usage_limit: promotionCode.max_redemptions ?? null,
      discount_value: coupon.percent_off ?? promo.discount_value,
      sync_status: "needs_sync" as PromoSyncStatus,
      updated_at: new Date(),
    };
    await db.update(promoCodes).set(patch).where(eq(promoCodes.id, promoCodeId));
    await recordPromoChange(db, {
      promoCodeId,
      fieldChanged: "fix_sync_stripe_to_db",
      oldValue: {
        active: promo.active,
        expiresAt: promo.expires_at,
        usageLimit: promo.usage_limit,
        discountValue: promo.discount_value,
      },
      newValue: patch,
      changedBy: actorUserId,
    });
    await verifyPromoCodeWithStripe(db, promoCodeId);
    return getPromoCodeDetail(db, promoCodeId);
  }

  const stripeIds = await createStripeResources({
    code: promo.code,
    discountValue: promo.discount_value,
    active: promo.active,
    expiresAt: promo.expires_at,
    usageLimit: promo.usage_limit,
    appliesToBilling: promo.applies_to_billing,
    firstTimeOnly: promo.first_time_only,
    campaign: promo.campaign,
  });
  await db.update(promoCodes).set({
    stripe_coupon_id: stripeIds.stripeCouponId,
    stripe_promotion_code_id: stripeIds.stripePromotionCodeId,
    sync_status: "needs_sync",
    updated_at: new Date(),
  }).where(eq(promoCodes.id, promoCodeId));
  await recordPromoChange(db, {
    promoCodeId,
    fieldChanged: "fix_sync_db_to_stripe",
    oldValue: {
      stripeCouponId: promo.stripe_coupon_id,
      stripePromotionCodeId: promo.stripe_promotion_code_id,
      validation,
    },
    newValue: stripeIds,
    changedBy: actorUserId,
  });
  await verifyPromoCodeWithStripe(db, promoCodeId);
  return getPromoCodeDetail(db, promoCodeId);
}

export async function recordPromoUsage(
  db: Database,
  input: {
    paymentId: string;
    promoCodeId: string;
  },
) {
  const inserted = await db.execute(sql`
    INSERT INTO promo_code_usages (id, promo_code_id, payment_id, created_at)
    VALUES (gen_random_uuid(), ${input.promoCodeId}::uuid, ${input.paymentId}::uuid, now())
    ON CONFLICT (promo_code_id, payment_id) DO NOTHING
    RETURNING id
  `);

  const created = Array.isArray(inserted.rows) && inserted.rows.length > 0;
  if (!created) {
    return false;
  }

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(promoCodeUsages)
    .where(eq(promoCodeUsages.promo_code_id, input.promoCodeId));

  await db.update(promoCodes).set({
    times_used: count,
    updated_at: new Date(),
  }).where(eq(promoCodes.id, input.promoCodeId));
  return true;
}
