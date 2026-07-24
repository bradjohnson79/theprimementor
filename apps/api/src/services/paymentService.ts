import Stripe from "stripe";
import { bookingTypes, bookings, mentorTrainingOrders, payments, reports, subscriptions, type Database } from "@wisdom/db";
import { and, desc, eq } from "drizzle-orm";
import {
  DIVIN8_REPORT_PRICE_CENTS_BY_TIER,
  MENTOR_TRAINING_PACKAGES,
  MEMBER_PRICING,
  REGENERATION_OFFER_CURRENCY,
  REGENERATION_OFFER_PRICE_CENTS,
  REGENERATION_OFFER_TITLE,
  getRegenerationOfferPackageMetadata,
  isRegenerationOfferActive,
  getActiveSessionOfferingByBookingTypeId,
  logger,
  REPORT_PRODUCTS,
  isPremiumReportProduct,
  resolveReportProductKey,
  type MentorTrainingPackageType,
  type ReportProductKey,
  type ReportTierId,
} from "@wisdom/utils";
import {
  MEMBERSHIP_CHECKOUT_APP,
  MEMBERSHIP_CHECKOUT_SCHEMA_VERSION,
  getFrontendUrl,
  getMembershipCheckoutEnvironment,
  resolveMembershipPriceId,
} from "../config/membershipBilling.js";
import { getMentorTrainingStripePriceId } from "../config/mentorTrainingPackages.js";
import { getReportCheckoutPath } from "../config/reportCheckout.js";
import { getReportStripePriceId } from "../config/stripeReportPrices.js";
import { getSessionCheckoutPath, type SessionCheckoutType } from "../config/sessionCheckout.js";
import { getBookingTypeStripePriceId } from "../config/stripePrices.js";
import { resolveRegenerationOfferStripePriceId } from "../config/regenerationOfferBilling.js";
import {
  buildResonantDowsingCheckoutLineItem,
  getResonantDowsingStripePriceId,
  verifyResonantDowsingStripePrice,
} from "../config/courseBilling.js";
import { createHttpError } from "./booking/errors.js";
import { RESONANT_DOWSING_COURSE_SLUG } from "./courses/courseEntitlementService.js";
import {
  RESONANT_DOWSING_CURRENCY,
  RESONANT_DOWSING_PRICE_CENTS,
} from "./courses/resonantDowsingCourse.js";
import { ensureStripeCustomerId } from "./payments/stripeCustomerService.js";
import { createPaymentRecordForEntity } from "./payments/paymentsService.js";
import { buildStripeReferenceMetadata } from "./payments/stripeReferenceMetadata.js";
import { createOrReuseMentoringCircleBooking } from "./booking/bookingService.js";
import {
  getActiveMentoringCirclePurchaseEvent,
  getMentoringCircleEventOrThrow,
} from "./mentoringCircleService.js";
import { validatePromoCodeForCheckout } from "./promoCodeService.js";
import {
  mergeStripeMetadata,
  resolveStripeProductNaming,
} from "./stripe/stripeProductNamingService.js";
import {
  attachRegenerationOfferCheckoutSession,
  createPendingRegenerationOfferOrder,
} from "./regenerationOfferService.js";

type CheckoutType = "webinar" | "session" | "report" | "subscription" | "mentor_training" | "mentoring_circle" | "course" | "regeneration_offer";
type CheckoutTier = "seeker" | "initiate";
type CheckoutDiscountConfig = Pick<Stripe.Checkout.SessionCreateParams, "allow_promotion_codes" | "discounts">;

let stripeInstance: Stripe | null = null;

function getStripe(): Stripe {
  if (!stripeInstance) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY not set");
    stripeInstance = new Stripe(key);
  }
  return stripeInstance;
}

function buildCheckoutDiscountConfig(
  promo: { stripePromotionCodeId?: string | null } | null,
): CheckoutDiscountConfig {
  const stripePromotionCodeId = promo?.stripePromotionCodeId?.trim();
  if (stripePromotionCodeId) {
    return {
      discounts: [{ promotion_code: stripePromotionCodeId }],
    };
  }

  return {
    allow_promotion_codes: true,
  };
}

export interface CreateCheckoutSessionInput {
  userId: string;
  userEmail: string;
  clerkId: string;
  type?: CheckoutType;
  tier?: CheckoutTier;
  bookingId?: string;
  reportId?: string;
  membershipId?: string;
  trainingOrderId?: string;
  courseEntitlementId?: string;
  eventId?: string;
  promoCode?: string;
}

function buildCheckoutMetadata(
  input: CreateCheckoutSessionInput & {
    type: CheckoutType;
    entityId: string;
    sessionType?: SessionCheckoutType;
    sessionDurationMinutes?: number;
    sessionTier?: "entry";
    upgradeEligible?: boolean;
    upgradeTarget?: Array<"mentoring">;
    reportId?: string;
    reportTier?: ReportTierId;
    reportType?: ReportProductKey;
    membershipId?: string;
    trainingOrderId?: string;
    packageType?: MentorTrainingPackageType;
    courseSlug?: string;
    billingInterval?: "monthly" | "annual";
    eventId?: string;
    eventKey?: string;
    orderId?: string;
    promoCode?: string;
    promoCodeId?: string;
    stripePromotionCodeId?: string;
  },
): Record<string, string> {
  const metadata: Record<string, string> = {
    ...buildStripeReferenceMetadata({
      entityType: input.type,
      entityId: input.entityId.trim(),
      userId: input.userId.trim(),
      userEmail: input.userEmail.trim(),
      clerkId: input.clerkId.trim(),
      bookingId: input.bookingId,
      reportId: input.reportId,
      membershipId: input.membershipId,
      environment: getMembershipCheckoutEnvironment(),
      platform: MEMBERSHIP_CHECKOUT_APP,
    }),
    userId: input.userId.trim(),
    userEmail: input.userEmail.trim(),
    clerkId: input.clerkId.trim(),
    type: input.type,
    entityType: input.type,
    entityId: input.entityId.trim(),
    environment: getMembershipCheckoutEnvironment(),
    app: MEMBERSHIP_CHECKOUT_APP,
    version: MEMBERSHIP_CHECKOUT_SCHEMA_VERSION,
  };

  if (input.tier) {
    metadata.tier = input.tier;
  }
  if (input.bookingId?.trim()) {
    metadata.bookingId = input.bookingId.trim();
  }
  if (input.reportId?.trim()) {
    metadata.reportId = input.reportId.trim();
  }
  if (input.reportTier) {
    metadata.reportTier = input.reportTier;
  }
  if (input.reportType) {
    metadata.reportType = input.reportType;
  }
  if (input.membershipId?.trim()) {
    metadata.membershipId = input.membershipId.trim();
  }
  if (input.trainingOrderId?.trim()) {
    metadata.trainingOrderId = input.trainingOrderId.trim();
  }
  if (input.sessionType) {
    metadata.sessionType = input.sessionType;
  }
  if (typeof input.sessionDurationMinutes === "number") {
    metadata.sessionDurationMinutes = String(input.sessionDurationMinutes);
  }
  if (input.sessionTier) {
    metadata.sessionTier = input.sessionTier;
  }
  if (typeof input.upgradeEligible === "boolean") {
    metadata.upgradeEligible = String(input.upgradeEligible);
  }
  if (input.upgradeTarget?.length) {
    metadata.upgradeTarget = input.upgradeTarget.join(",");
  }
  if (input.packageType) {
    metadata.packageType = input.packageType;
  }
  if (input.courseSlug?.trim()) {
    metadata.courseSlug = input.courseSlug.trim();
    metadata.course_slug = input.courseSlug.trim();
    metadata.purchase_type = "course";
  }
  if (input.billingInterval) {
    metadata.billingInterval = input.billingInterval;
  }
  if (input.eventId?.trim()) {
    metadata.eventId = input.eventId.trim();
  }
  if (input.eventKey?.trim()) {
    metadata.eventKey = input.eventKey.trim();
  }
  if (input.orderId?.trim()) {
    metadata.orderId = input.orderId.trim();
  }
  if (input.promoCode?.trim()) {
    metadata.promoCode = input.promoCode.trim();
  }
  if (input.promoCodeId?.trim()) {
    metadata.promoCodeId = input.promoCodeId.trim();
  }
  if (input.stripePromotionCodeId?.trim()) {
    metadata.stripePromotionCodeId = input.stripePromotionCodeId.trim();
  }

  return metadata;
}

async function validatePromoForCheckout(db: Database, input: Parameters<typeof validatePromoCodeForCheckout>[1]) {
  if (!input.code?.trim()) {
    return null;
  }
  const validation = await validatePromoCodeForCheckout(db, input);
  if (!validation.valid || !validation.stripePromotionCodeId || !validation.promoCodeId || !validation.code) {
    throw createHttpError(400, validation.message ?? "This promo code is no longer valid");
  }
  return validation;
}

async function getBookingForSessionCheckout(db: Database, bookingId: string) {
  const [row] = await db
    .select({
      id: bookings.id,
      userId: bookings.user_id,
      sessionType: bookings.session_type,
      status: bookings.status,
      bookingTypeId: bookingTypes.id,
      bookingTypeName: bookingTypes.name,
      durationMinutes: bookingTypes.duration_minutes,
      amountCents: bookingTypes.price_cents,
      currency: bookingTypes.currency,
    })
    .from(bookings)
    .innerJoin(bookingTypes, eq(bookings.booking_type_id, bookingTypes.id))
    .where(eq(bookings.id, bookingId))
    .limit(1);

  if (!row) {
    throw createHttpError(404, "Booking not found");
  }

  return row;
}

async function getReportForCheckout(db: Database, reportId: string) {
  const [row] = await db
    .select({
      id: reports.id,
      userId: reports.user_id,
      tier: reports.interpretation_tier,
      memberStatus: reports.member_status,
    })
    .from(reports)
    .where(eq(reports.id, reportId))
    .limit(1);

  if (!row) {
    throw createHttpError(404, "Report not found");
  }

  return row;
}

async function getMembershipForCheckout(db: Database, membershipId: string) {
  const [row] = await db
    .select({
      id: subscriptions.id,
      userId: subscriptions.user_id,
      tier: subscriptions.tier,
      status: subscriptions.status,
      metadata: subscriptions.metadata,
    })
    .from(subscriptions)
    .where(eq(subscriptions.id, membershipId))
    .limit(1);

  if (!row) {
    throw createHttpError(404, "Membership purchase not found");
  }

  return row;
}

async function getMentorTrainingOrderForCheckout(db: Database, trainingOrderId: string) {
  const [row] = await db
    .select({
      id: mentorTrainingOrders.id,
      userId: mentorTrainingOrders.user_id,
      packageType: mentorTrainingOrders.package_type,
      status: mentorTrainingOrders.status,
    })
    .from(mentorTrainingOrders)
    .where(eq(mentorTrainingOrders.id, trainingOrderId))
    .limit(1);

  if (!row) {
    throw createHttpError(404, "Mentor training order not found");
  }

  return row;
}

async function getLatestPaymentForEntity(
  db: Database,
  input: { entityType: "session" | "report" | "subscription" | "mentor_training" | "mentoring_circle" | "course" | "regeneration_offer"; entityId: string },
) {
  const [row] = await db
    .select({
      id: payments.id,
      entityType: payments.entity_type,
      entityId: payments.entity_id,
      status: payments.status,
      providerPaymentIntentId: payments.provider_payment_intent_id,
      providerCustomerId: payments.provider_customer_id,
      metadata: payments.metadata,
    })
    .from(payments)
    .where(and(
      eq(payments.entity_type, input.entityType),
      eq(payments.entity_id, input.entityId),
    ))
    .orderBy(desc(payments.created_at))
    .limit(1);

  return row ?? null;
}

async function updatePaymentCheckoutMetadata(
  db: Database,
  paymentId: string,
  paymentMetadata: unknown,
  nextMetadata: Record<string, unknown>,
) {
  await db
    .update(payments)
    .set({
      metadata: {
        ...(paymentMetadata && typeof paymentMetadata === "object" && !Array.isArray(paymentMetadata)
          ? paymentMetadata as Record<string, unknown>
          : {}),
        ...nextMetadata,
      },
      updated_at: new Date(),
    })
    .where(eq(payments.id, paymentId));
}

async function createSessionCheckoutSession(db: Database, input: CreateCheckoutSessionInput) {
  const bookingId = input.bookingId?.trim();
  if (!bookingId) {
    throw createHttpError(400, "bookingId is required for session checkout.");
  }

  const booking = await getBookingForSessionCheckout(db, bookingId);
  if (booking.userId !== input.userId) {
    throw createHttpError(404, "Booking not found");
  }

  if (booking.status === "cancelled" || booking.status === "completed") {
    throw createHttpError(400, `Booking cannot be paid in status ${booking.status}`);
  }
  if (booking.status === "paid" || booking.status === "scheduled") {
    throw createHttpError(409, "Booking has already been paid.");
  }
  if (booking.status !== "pending_payment") {
    throw createHttpError(400, `Booking is not in a payable state: ${booking.status}`);
  }
  if (
    booking.sessionType !== "focus"
    && booking.sessionType !== "mentoring"
    && booking.sessionType !== "regeneration"
    && booking.sessionType !== "qa_session"
  ) {
    throw createHttpError(400, `Session checkout is not supported for ${booking.sessionType}`);
  }

  const sessionMetadata = booking.sessionType === "qa_session"
    ? {
        sessionTier: "entry" as const,
        upgradeEligible: true,
        upgradeTarget: ["mentoring"] as Array<"mentoring">,
      }
    : undefined;

  let payment = await getLatestPaymentForEntity(db, { entityType: "session", entityId: bookingId });
  if (!payment) {
    const created = await createPaymentRecordForEntity(db, {
      userId: booking.userId,
      entityType: "session",
      entityId: bookingId,
      bookingId,
      amountCents: booking.amountCents,
      currency: booking.currency,
      status: "pending",
      metadata: {
        source: "session_checkout_recovery",
        bookingTypeId: booking.bookingTypeId,
        sessionType: booking.sessionType,
        sessionDurationMinutes: booking.durationMinutes,
        sessionTier: sessionMetadata?.sessionTier,
        upgradeEligible: sessionMetadata?.upgradeEligible,
        upgradeTarget: sessionMetadata?.upgradeTarget,
      },
    });
    payment = await getLatestPaymentForEntity(db, { entityType: "session", entityId: bookingId });
    if (!payment) {
      payment = {
        id: created.id,
        entityType: "session",
        entityId: bookingId,
        status: "pending",
        providerPaymentIntentId: null,
        providerCustomerId: null,
        metadata: null,
      };
    }
  }

  if (payment.status === "paid") {
    throw createHttpError(409, "Booking has already been paid.");
  }
  if (payment.status === "refunded") {
    throw createHttpError(400, "Refunded bookings require manual support before checkout can restart.");
  }

  const stripe = getStripe();
  const offering = getActiveSessionOfferingByBookingTypeId(booking.bookingTypeId);
  if (offering) {
    if (
      booking.sessionType !== offering.sessionType
      || booking.durationMinutes !== (offering.durationMinutes ?? 0)
      || booking.amountCents !== offering.amountCents
      || booking.currency.toUpperCase() !== offering.currency
    ) {
      logger.error("session_checkout_catalog_mismatch", {
        bookingId,
        bookingTypeId: booking.bookingTypeId,
        sessionType: booking.sessionType,
        durationMinutes: booking.durationMinutes,
        amountCents: booking.amountCents,
      });
      throw createHttpError(500, "Selected session is misconfigured. Please contact support.");
    }
  } else if (booking.sessionType === "qa_session" || booking.sessionType === "mentoring") {
    throw createHttpError(400, "Invalid session duration selected");
  }
  let priceId: string;
  try {
    priceId = getBookingTypeStripePriceId(booking.bookingTypeId);
  } catch {
    throw createHttpError(400, `Stripe price is not configured for booking type ${booking.bookingTypeId}`);
  }
  const promo = await validatePromoForCheckout(db, {
    code: input.promoCode ?? "",
    type: "session",
    bookingId,
    userId: input.userId,
  });
  const naming = resolveStripeProductNaming({
    type: "session",
    sessionType: booking.sessionType,
    durationMinutes: booking.durationMinutes,
    fallbackName: booking.bookingTypeName,
  });
  const metadata = mergeStripeMetadata(buildCheckoutMetadata({
    ...input,
    bookingId,
    type: "session",
    entityId: bookingId,
    sessionType: booking.sessionType,
    sessionDurationMinutes: booking.durationMinutes,
    sessionTier: sessionMetadata?.sessionTier,
    upgradeEligible: sessionMetadata?.upgradeEligible,
    upgradeTarget: sessionMetadata?.upgradeTarget,
    promoCode: promo?.code,
    promoCodeId: promo?.promoCodeId,
    stripePromotionCodeId: promo?.stripePromotionCodeId,
  }), naming.metadata, {
    customer_email: input.userEmail,
  });
  const stripeCustomerId = await ensureStripeCustomerId(db, {
    stripe,
    userId: input.userId,
    email: input.userEmail,
    metadata: {
      userId: input.userId,
      clerkId: input.clerkId,
    },
  });
  const frontendUrl = getFrontendUrl();
  const returnPath = getSessionCheckoutPath(booking.sessionType);

  logger.debug("session_checkout_prepared", {
    sessionType: booking.sessionType,
    priceId,
    bookingId,
  });

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    mode: "payment",
    client_reference_id: bookingId,
    line_items: [{ price: priceId, quantity: 1 }],
    ...buildCheckoutDiscountConfig(promo),
    metadata,
    payment_intent_data: {
      description: naming.description,
      metadata,
    },
    success_url: `${frontendUrl}${returnPath}?checkout=success&bookingId=${encodeURIComponent(bookingId)}&checkoutSessionId={CHECKOUT_SESSION_ID}`,
    cancel_url: `${frontendUrl}${returnPath}?checkout=canceled&bookingId=${encodeURIComponent(bookingId)}`,
    customer: stripeCustomerId,
  });

  await updatePaymentCheckoutMetadata(db, payment.id, payment.metadata, {
    source: "session_checkout_create",
    stripeCheckoutSessionId: session.id,
    stripeCheckoutMode: session.mode,
    stripeCheckoutUrl: session.url,
    stripePriceId: priceId,
    stripeProductId: null,
    stripeProductName: naming.productName,
    sessionType: booking.sessionType,
    promoCode: promo?.code,
    promoCodeId: promo?.promoCodeId,
    stripePromotionCodeId: promo?.stripePromotionCodeId,
    environment: metadata.environment,
  });

  logger.info("session_checkout_created", {
    checkoutType: "session",
    bookingId,
    paymentId: payment.id,
    sessionId: session.id,
    sessionType: booking.sessionType,
    priceId,
    productId: null,
    productName: naming.productName,
    userId: input.userId,
    clerkId: input.clerkId,
    customerId: stripeCustomerId,
    environment: metadata.environment,
  });

  return session;
}

async function createMentorTrainingCheckoutSession(db: Database, input: CreateCheckoutSessionInput) {
  const trainingOrderId = input.trainingOrderId?.trim();
  if (!trainingOrderId) {
    throw createHttpError(400, "trainingOrderId is required for mentor training checkout.");
  }

  const trainingOrder = await getMentorTrainingOrderForCheckout(db, trainingOrderId);
  if (trainingOrder.userId !== input.userId) {
    throw createHttpError(404, "Mentor training order not found");
  }
  if (trainingOrder.status === "paid" || trainingOrder.status === "in_progress" || trainingOrder.status === "completed") {
    throw createHttpError(409, "Mentor training has already been purchased.");
  }
  if (trainingOrder.status === "cancelled") {
    throw createHttpError(400, "Cancelled mentor training orders require manual support before checkout can restart.");
  }
  if (trainingOrder.status !== "pending_payment") {
    throw createHttpError(400, `Mentor training order is not in a payable state: ${trainingOrder.status}`);
  }

  const packageDefinition = MENTOR_TRAINING_PACKAGES[trainingOrder.packageType];
  let payment = await getLatestPaymentForEntity(db, { entityType: "mentor_training", entityId: trainingOrderId });
  if (!payment) {
    const created = await createPaymentRecordForEntity(db, {
      userId: input.userId,
      entityType: "mentor_training",
      entityId: trainingOrderId,
      amountCents: packageDefinition.priceCad * 100,
      currency: "CAD",
      status: "pending",
      metadata: {
        source: "mentor_training_checkout_recovery",
        packageType: trainingOrder.packageType,
      },
    });
    payment = await getLatestPaymentForEntity(db, { entityType: "mentor_training", entityId: trainingOrderId });
    if (!payment) {
      payment = {
        id: created.id,
        entityType: "mentor_training",
        entityId: trainingOrderId,
        status: "pending",
        providerPaymentIntentId: null,
        providerCustomerId: null,
        metadata: null,
      };
    }
  }

  if (payment.status === "paid") {
    throw createHttpError(409, "Mentor training has already been paid.");
  }
  if (payment.status === "refunded") {
    throw createHttpError(400, "Refunded mentor training orders require manual support before checkout can restart.");
  }

  const stripe = getStripe();
  const priceId = getMentorTrainingStripePriceId(trainingOrder.packageType);
  const promo = await validatePromoForCheckout(db, {
    code: input.promoCode ?? "",
    type: "mentor_training",
    trainingOrderId,
    userId: input.userId,
  });
  const naming = resolveStripeProductNaming({
    type: "mentor_training",
    packageType: trainingOrder.packageType,
  });
  const metadata = mergeStripeMetadata(buildCheckoutMetadata({
    ...input,
    type: "mentor_training",
    entityId: trainingOrderId,
    trainingOrderId,
    packageType: trainingOrder.packageType,
    promoCode: promo?.code,
    promoCodeId: promo?.promoCodeId,
    stripePromotionCodeId: promo?.stripePromotionCodeId,
  }), naming.metadata, {
    customer_email: input.userEmail,
  });
  const stripeCustomerId = await ensureStripeCustomerId(db, {
    stripe,
    userId: input.userId,
    email: input.userEmail,
    metadata: {
      userId: input.userId,
      clerkId: input.clerkId,
    },
  });
  const frontendUrl = getFrontendUrl();

  logger.debug("mentor_training_checkout_prepared", {
    packageType: trainingOrder.packageType,
    priceId,
    trainingOrderId,
  });

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    mode: "payment",
    client_reference_id: trainingOrderId,
    line_items: [{ price: priceId, quantity: 1 }],
    ...buildCheckoutDiscountConfig(promo),
    metadata,
    payment_intent_data: {
      description: naming.description,
      metadata,
    },
    success_url: `${frontendUrl}/mentor-training?checkout=success&trainingOrderId=${encodeURIComponent(trainingOrderId)}&checkoutSessionId={CHECKOUT_SESSION_ID}`,
    cancel_url: `${frontendUrl}/mentor-training?checkout=canceled&trainingOrderId=${encodeURIComponent(trainingOrderId)}`,
    customer: stripeCustomerId,
  });

  await updatePaymentCheckoutMetadata(db, payment.id, payment.metadata, {
    source: "mentor_training_checkout_create",
    stripeCheckoutSessionId: session.id,
    stripeCheckoutMode: session.mode,
    stripeCheckoutUrl: session.url,
    stripePriceId: priceId,
    stripeProductId: null,
    stripeProductName: naming.productName,
    packageType: trainingOrder.packageType,
    trainingOrderId,
    promoCode: promo?.code,
    promoCodeId: promo?.promoCodeId,
    stripePromotionCodeId: promo?.stripePromotionCodeId,
    environment: metadata.environment,
  });

  logger.info("mentor_training_checkout_created", {
    checkoutType: "mentor_training",
    trainingOrderId,
    packageType: trainingOrder.packageType,
    paymentId: payment.id,
    sessionId: session.id,
    priceId,
    productId: null,
    productName: naming.productName,
    userId: input.userId,
    clerkId: input.clerkId,
    customerId: stripeCustomerId,
    environment: metadata.environment,
  });

  return session;
}

async function createCourseCheckoutSession(db: Database, input: CreateCheckoutSessionInput) {
  const courseEntitlementId = input.courseEntitlementId?.trim();
  if (!courseEntitlementId) {
    throw createHttpError(400, "courseEntitlementId is required for course checkout.");
  }

  let payment = await getLatestPaymentForEntity(db, { entityType: "course", entityId: courseEntitlementId });
  if (!payment) {
    const created = await createPaymentRecordForEntity(db, {
      userId: input.userId,
      entityType: "course",
      entityId: courseEntitlementId,
      amountCents: RESONANT_DOWSING_PRICE_CENTS,
      currency: RESONANT_DOWSING_CURRENCY,
      status: "pending",
      metadata: {
        source: "resonant_dowsing_checkout_recovery",
        purchase_type: "course",
        course_slug: RESONANT_DOWSING_COURSE_SLUG,
        courseSlug: RESONANT_DOWSING_COURSE_SLUG,
        courseEntitlementId,
      },
    });
    payment = await getLatestPaymentForEntity(db, { entityType: "course", entityId: courseEntitlementId });
    if (!payment) {
      payment = {
        id: created.id,
        entityType: "course",
        entityId: courseEntitlementId,
        status: "pending",
        providerPaymentIntentId: null,
        providerCustomerId: null,
        metadata: null,
      };
    }
  }

  if (payment.status === "paid") {
    throw createHttpError(409, "The Resonant Dowsing Course has already been purchased.");
  }
  if (payment.status === "refunded") {
    throw createHttpError(400, "Refunded course purchases require manual support before checkout can restart.");
  }

  const stripe = getStripe();
  await verifyResonantDowsingStripePrice(stripe, { logger });
  const priceId = getResonantDowsingStripePriceId();
  const metadata = buildCheckoutMetadata({
    ...input,
    type: "course",
    entityId: courseEntitlementId,
    courseSlug: RESONANT_DOWSING_COURSE_SLUG,
  });
  metadata.customer_email = input.userEmail;
  metadata.courseEntitlementId = courseEntitlementId;
  const stripeCustomerId = await ensureStripeCustomerId(db, {
    stripe,
    userId: input.userId,
    email: input.userEmail,
    metadata: {
      userId: input.userId,
      clerkId: input.clerkId,
    },
  });
  const frontendUrl = getFrontendUrl();
  const coursePath = "/dashboard/courses/resonant-dowsing";
  const productName = "The Resonant Dowsing Course";
  const description = "Lifetime access to The Resonant Dowsing Course by Brad Johnson.";

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    mode: "payment",
    client_reference_id: courseEntitlementId,
    line_items: [buildResonantDowsingCheckoutLineItem()],
    metadata,
    payment_intent_data: {
      description,
      metadata,
    },
    success_url: `${frontendUrl}${coursePath}?checkout=success&checkoutSessionId={CHECKOUT_SESSION_ID}`,
    cancel_url: `${frontendUrl}${coursePath}?checkout=canceled`,
    customer: stripeCustomerId,
  });

  await updatePaymentCheckoutMetadata(db, payment.id, payment.metadata, {
    source: "resonant_dowsing_checkout_create",
    stripeCheckoutSessionId: session.id,
    stripeCheckoutMode: session.mode,
    stripeCheckoutUrl: session.url,
    stripePriceId: priceId,
    stripeProductId: null,
    stripeProductName: productName,
    purchase_type: "course",
    course_slug: RESONANT_DOWSING_COURSE_SLUG,
    courseSlug: RESONANT_DOWSING_COURSE_SLUG,
    courseEntitlementId,
    environment: metadata.environment,
  });

  logger.info("course_checkout_created", {
    checkoutType: "course",
    courseSlug: RESONANT_DOWSING_COURSE_SLUG,
    courseEntitlementId,
    paymentId: payment.id,
    sessionId: session.id,
    priceId,
    productName,
    userId: input.userId,
    clerkId: input.clerkId,
    customerId: stripeCustomerId,
    environment: metadata.environment,
  });

  return session;
}

async function createMentoringCircleCheckoutSession(db: Database, input: CreateCheckoutSessionInput) {
  const activeEvent = getActiveMentoringCirclePurchaseEvent();
  if (!activeEvent) {
    throw createHttpError(409, "No Mentoring Circle event is currently available for purchase.");
  }
  const requestedEventId = input.eventId?.trim();
  const event = requestedEventId ? getMentoringCircleEventOrThrow(requestedEventId) : activeEvent;
  if (event.eventId !== activeEvent.eventId) {
    throw createHttpError(409, `Mentoring Circle sales are now open for ${activeEvent.eventId}.`);
  }
  const booking = await createOrReuseMentoringCircleBooking(db, {
    userId: input.userId,
    eventId: event.eventId,
  });

  if (booking.status === "paid" || booking.status === "scheduled" || booking.status === "completed") {
    throw createHttpError(409, "Mentoring Circle has already been purchased.");
  }

  let payment = await getLatestPaymentForEntity(db, { entityType: "mentoring_circle", entityId: booking.id });
  if (!payment) {
    const created = await createPaymentRecordForEntity(db, {
      userId: input.userId,
      entityType: "mentoring_circle",
      entityId: booking.id,
      bookingId: booking.id,
      amountCents: event.priceCents,
      currency: event.currency,
      status: "pending",
      metadata: {
        source: "mentoring_circle_checkout_recovery",
        eventId: event.eventId,
        eventKey: event.eventKey,
      },
    });
    payment = await getLatestPaymentForEntity(db, { entityType: "mentoring_circle", entityId: booking.id });
    if (!payment) {
      payment = {
        id: created.id,
        entityType: "mentoring_circle",
        entityId: booking.id,
        status: "pending",
        providerPaymentIntentId: null,
        providerCustomerId: null,
        metadata: null,
      };
    }
  }

  if (payment.status === "paid") {
    throw createHttpError(409, "Mentoring Circle has already been paid.");
  }
  if (payment.status === "refunded") {
    throw createHttpError(400, "Refunded Mentoring Circle purchases require manual support before checkout can restart.");
  }

  const stripe = getStripe();
  const promo = await validatePromoForCheckout(db, {
    code: input.promoCode ?? "",
    type: "mentoring_circle",
    eventId: event.eventId,
    userId: input.userId,
  });
  const naming = resolveStripeProductNaming({
    type: "event",
    eventType: "mentoring_circle",
    eventName: event.eventTitle,
  });
  const metadata = mergeStripeMetadata(buildCheckoutMetadata({
    ...input,
    type: "mentoring_circle",
    entityId: booking.id,
    bookingId: booking.id,
    eventId: event.eventId,
    eventKey: event.eventKey,
    promoCode: promo?.code,
    promoCodeId: promo?.promoCodeId,
    stripePromotionCodeId: promo?.stripePromotionCodeId,
  }), naming.metadata, {
    customer_email: input.userEmail,
  });
  const stripeCustomerId = await ensureStripeCustomerId(db, {
    stripe,
    userId: input.userId,
    email: input.userEmail,
    metadata: {
      userId: input.userId,
      clerkId: input.clerkId,
    },
  });
  const frontendUrl = getFrontendUrl();

  logger.debug("mentoring_circle_checkout_prepared", {
    eventId: event.eventId,
    bookingId: booking.id,
    paymentId: payment.id,
  });

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    mode: "payment",
    client_reference_id: booking.id,
    line_items: [{
      price_data: {
        currency: event.currency.toLowerCase(),
        product_data: {
          name: naming.productName,
          description: naming.description,
          metadata,
        },
        unit_amount: event.priceCents,
      },
      quantity: 1,
    }],
    ...buildCheckoutDiscountConfig(promo),
    metadata,
    payment_intent_data: {
      description: naming.description,
      metadata,
    },
    success_url: `${frontendUrl}/mentoring-circle?checkout=success&eventId=${encodeURIComponent(event.eventId)}&checkoutSessionId={CHECKOUT_SESSION_ID}`,
    cancel_url: `${frontendUrl}/mentoring-circle?checkout=canceled&eventId=${encodeURIComponent(event.eventId)}`,
    customer: stripeCustomerId,
  });

  await updatePaymentCheckoutMetadata(db, payment.id, payment.metadata, {
    source: "mentoring_circle_checkout_create",
    stripeCheckoutSessionId: session.id,
    stripeCheckoutMode: session.mode,
    stripeCheckoutUrl: session.url,
    stripePriceId: null,
    stripeProductId: null,
    stripeProductName: naming.productName,
    eventId: event.eventId,
    eventKey: event.eventKey,
    bookingId: booking.id,
    promoCode: promo?.code,
    promoCodeId: promo?.promoCodeId,
    stripePromotionCodeId: promo?.stripePromotionCodeId,
    environment: metadata.environment,
  });

  logger.info("mentoring_circle_checkout_created", {
    checkoutType: "mentoring_circle",
    eventId: event.eventId,
    bookingId: booking.id,
    paymentId: payment.id,
    sessionId: session.id,
    productName: naming.productName,
    userId: input.userId,
    clerkId: input.clerkId,
    customerId: stripeCustomerId,
    environment: metadata.environment,
  });

  return session;
}

async function createRegenerationOfferCheckoutSession(db: Database, input: CreateCheckoutSessionInput) {
  if (!isRegenerationOfferActive()) {
    logger.warn("regeneration_offer_checkout_expired", {
      userId: input.userId,
      clerkId: input.clerkId,
    });
    throw createHttpError(409, "The Regeneration Q&A Package offer has expired.");
  }

  const { priceId, envKey } = resolveRegenerationOfferStripePriceId();
  const pending = await createPendingRegenerationOfferOrder(db, {
    userId: input.userId,
    userEmail: input.userEmail,
  });
  const stripe = getStripe();
  const metadata = buildCheckoutMetadata({
    ...input,
    type: "regeneration_offer",
    entityId: pending.orderId,
    orderId: pending.orderId,
  });
  metadata.customer_email = input.userEmail;
  metadata.offerCode = getRegenerationOfferPackageMetadata().offerCode;
  metadata.priceCents = String(REGENERATION_OFFER_PRICE_CENTS);
  metadata.currency = REGENERATION_OFFER_CURRENCY;
  metadata.product_name = REGENERATION_OFFER_TITLE;

  const stripeCustomerId = await ensureStripeCustomerId(db, {
    stripe,
    userId: input.userId,
    email: input.userEmail,
    metadata: {
      userId: input.userId,
      clerkId: input.clerkId,
    },
  });
  const frontendUrl = getFrontendUrl();

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    mode: "payment",
    client_reference_id: pending.orderId,
    line_items: [{ price: priceId, quantity: 1 }],
    metadata,
    payment_intent_data: {
      description: REGENERATION_OFFER_TITLE,
      metadata,
    },
    success_url: `${frontendUrl}/regeneration-offer/success?checkoutSessionId={CHECKOUT_SESSION_ID}`,
    cancel_url: `${frontendUrl}/regeneration-offer?checkout=canceled`,
    customer: stripeCustomerId,
  });

  await attachRegenerationOfferCheckoutSession(db, {
    orderId: pending.orderId,
    paymentId: pending.paymentId,
    checkoutSessionId: session.id,
    checkoutUrl: session.url,
    stripePriceId: priceId,
    stripePriceEnvKey: envKey,
    stripeCustomerId,
  });

  logger.info("regeneration_offer_checkout_created", {
    checkoutType: "regeneration_offer",
    orderId: pending.orderId,
    paymentId: pending.paymentId,
    sessionId: session.id,
    priceId,
    userId: input.userId,
    clerkId: input.clerkId,
  });

  return session;
}

async function createReportCheckoutSession(db: Database, input: CreateCheckoutSessionInput) {
  const reportId = input.reportId?.trim();
  if (!reportId) {
    throw createHttpError(400, "reportId is required for report checkout.");
  }

  const report = await getReportForCheckout(db, reportId);
  if (report.userId !== input.userId) {
    throw createHttpError(404, "Report not found");
  }
  if (report.memberStatus === "fulfilled" || report.memberStatus === "paid") {
    throw createHttpError(409, "Report has already been paid.");
  }
  if (report.memberStatus !== "pending_payment") {
    throw createHttpError(400, `Report is not in a payable state: ${report.memberStatus}`);
  }

  const reportType = resolveReportProductKey(report.tier);
  if (!reportType) {
    throw createHttpError(400, "Report type is invalid for checkout.");
  }
  const product = REPORT_PRODUCTS[reportType];
  const amountCents = isPremiumReportProduct(product) ? DIVIN8_REPORT_PRICE_CENTS_BY_TIER[product.tier] : 0;
  const currency = "CAD";

  let payment = await getLatestPaymentForEntity(db, { entityType: "report", entityId: reportId });
  if (!payment) {
    const created = await createPaymentRecordForEntity(db, {
      userId: input.userId,
      entityType: "report",
      entityId: reportId,
      amountCents,
      currency,
      status: "pending",
      metadata: {
        source: "report_checkout_recovery",
        reportId,
        reportType,
        tier: isPremiumReportProduct(product) ? product.tier : reportType,
      },
    });
    payment = await getLatestPaymentForEntity(db, { entityType: "report", entityId: reportId });
    if (!payment) {
      payment = {
        id: created.id,
        entityType: "report",
        entityId: reportId,
        status: "pending",
        providerPaymentIntentId: null,
        providerCustomerId: null,
        metadata: null,
      };
    }
  }

  if (payment.status === "paid") {
    throw createHttpError(409, "Report has already been paid.");
  }
  if (payment.status === "refunded") {
    throw createHttpError(400, "Refunded reports require manual support before checkout can restart.");
  }

  const stripe = getStripe();
  const priceId = getReportStripePriceId(reportType);
  const promo = await validatePromoForCheckout(db, {
    code: input.promoCode ?? "",
    type: "report",
    reportId,
    userId: input.userId,
  });
  const naming = resolveStripeProductNaming({
    type: "report",
    reportType,
  });
  const metadata = mergeStripeMetadata(buildCheckoutMetadata({
    ...input,
    type: "report",
    entityId: reportId,
    reportId,
    reportType,
    reportTier: isPremiumReportProduct(product) ? product.tier : undefined,
    promoCode: promo?.code,
    promoCodeId: promo?.promoCodeId,
    stripePromotionCodeId: promo?.stripePromotionCodeId,
  }), naming.metadata, {
    customer_email: input.userEmail,
  });
  const stripeCustomerId = await ensureStripeCustomerId(db, {
    stripe,
    userId: input.userId,
    email: input.userEmail,
    metadata: {
      userId: input.userId,
      clerkId: input.clerkId,
    },
  });
  const frontendUrl = getFrontendUrl();
  const returnPath = getReportCheckoutPath(reportType);

  logger.debug("report_checkout_prepared", {
    reportType,
    priceId,
    reportId,
  });

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    mode: "payment",
    client_reference_id: reportId,
    line_items: [{ price: priceId, quantity: 1 }],
    ...buildCheckoutDiscountConfig(promo),
    metadata,
    payment_intent_data: {
      description: naming.description,
      metadata,
    },
    success_url: `${frontendUrl}${returnPath}?checkout=success&reportId=${encodeURIComponent(reportId)}&checkoutSessionId={CHECKOUT_SESSION_ID}`,
    cancel_url: `${frontendUrl}${returnPath}?checkout=canceled&reportId=${encodeURIComponent(reportId)}`,
    customer: stripeCustomerId,
  });

  await updatePaymentCheckoutMetadata(db, payment.id, payment.metadata, {
    source: "report_checkout_create",
    stripeCheckoutSessionId: session.id,
    stripeCheckoutMode: session.mode,
    stripeCheckoutUrl: session.url,
    stripePriceId: priceId,
    stripeProductId: null,
    stripeProductName: naming.productName,
    reportId,
    reportType,
    tier: isPremiumReportProduct(product) ? product.tier : reportType,
    promoCode: promo?.code,
    promoCodeId: promo?.promoCodeId,
    stripePromotionCodeId: promo?.stripePromotionCodeId,
    environment: metadata.environment,
  });

  logger.info("report_checkout_created", {
    checkoutType: "report",
    reportId,
    paymentId: payment.id,
    sessionId: session.id,
    reportType,
    priceId,
    productId: null,
    productName: naming.productName,
    userId: input.userId,
    clerkId: input.clerkId,
    customerId: stripeCustomerId,
    environment: metadata.environment,
  });

  return session;
}

async function createMembershipCheckoutSession(db: Database, input: CreateCheckoutSessionInput) {
  const membershipId = input.membershipId?.trim();
  if (!membershipId) {
    throw createHttpError(400, "membershipId is required for subscription checkout.");
  }

  const membership = await getMembershipForCheckout(db, membershipId);
  if (membership.userId !== input.userId) {
    throw createHttpError(404, "Membership purchase not found");
  }
  if (membership.status === "active" || membership.status === "trialing") {
    throw createHttpError(409, "Membership has already been paid.");
  }
  if (membership.status !== "pending_payment") {
    throw createHttpError(400, `Membership is not in a payable state: ${membership.status}`);
  }
  if (membership.tier !== "seeker" && membership.tier !== "initiate") {
    throw createHttpError(400, "Membership tier is invalid for checkout.");
  }

  const metadataValue = membership.metadata && typeof membership.metadata === "object" && !Array.isArray(membership.metadata)
    ? membership.metadata as Record<string, unknown>
    : {};
  const billingInterval = metadataValue.billingInterval === "annual" ? "annual" : "monthly";
  const amountCents = Math.round(MEMBER_PRICING[membership.tier][billingInterval].amountCad * 100);
  const { priceId } = resolveMembershipPriceId(membership.tier, billingInterval);

  let payment = await getLatestPaymentForEntity(db, { entityType: "subscription", entityId: membershipId });
  if (!payment) {
    const created = await createPaymentRecordForEntity(db, {
      userId: input.userId,
      entityType: "subscription",
      entityId: membershipId,
      amountCents,
      currency: "CAD",
      status: "pending",
      metadata: {
        source: "membership_checkout_recovery",
        membershipId,
        tier: membership.tier,
        billingInterval,
      },
    });
    payment = await getLatestPaymentForEntity(db, { entityType: "subscription", entityId: membershipId });
    if (!payment) {
      payment = {
        id: created.id,
        entityType: "subscription",
        entityId: membershipId,
        status: "pending",
        providerPaymentIntentId: null,
        providerCustomerId: null,
        metadata: null,
      };
    }
  }

  if (payment.status === "paid") {
    throw createHttpError(409, "Membership has already been paid.");
  }
  if (payment.status === "refunded") {
    throw createHttpError(400, "Refunded memberships require manual support before checkout can restart.");
  }

  const stripe = getStripe();
  const promo = await validatePromoForCheckout(db, {
    code: input.promoCode ?? "",
    type: "subscription",
    membershipId,
    userId: input.userId,
  });
  const naming = resolveStripeProductNaming({
    type: "subscription",
    subscriptionType: "membership",
    tier: membership.tier,
    billingInterval,
  });
  const metadata = mergeStripeMetadata(buildCheckoutMetadata({
    ...input,
    type: "subscription",
    entityId: membershipId,
    membershipId,
    tier: membership.tier,
    billingInterval,
    promoCode: promo?.code,
    promoCodeId: promo?.promoCodeId,
    stripePromotionCodeId: promo?.stripePromotionCodeId,
  }), naming.metadata, {
    customer_email: input.userEmail,
  });
  const stripeCustomerId = await ensureStripeCustomerId(db, {
    stripe,
    userId: input.userId,
    email: input.userEmail,
    metadata: {
      userId: input.userId,
      clerkId: input.clerkId,
    },
  });
  const frontendUrl = getFrontendUrl();
  const returnPath = `/subscriptions/${membership.tier}`;

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    mode: "subscription",
    client_reference_id: membershipId,
    line_items: [{ price: priceId, quantity: 1 }],
    ...buildCheckoutDiscountConfig(promo),
    metadata,
    subscription_data: {
      metadata,
      description: naming.description,
    },
    success_url: `${frontendUrl}${returnPath}?checkout=success&membershipId=${encodeURIComponent(membershipId)}&checkoutSessionId={CHECKOUT_SESSION_ID}`,
    cancel_url: `${frontendUrl}${returnPath}?checkout=canceled&membershipId=${encodeURIComponent(membershipId)}`,
    customer: stripeCustomerId,
  });

  await updatePaymentCheckoutMetadata(db, payment.id, payment.metadata, {
    source: "membership_checkout_create",
    stripeCheckoutSessionId: session.id,
    stripeCheckoutMode: session.mode,
    stripeCheckoutUrl: session.url,
    membershipId,
    tier: membership.tier,
    billingInterval,
    promoCode: promo?.code,
    promoCodeId: promo?.promoCodeId,
    stripePromotionCodeId: promo?.stripePromotionCodeId,
    environment: metadata.environment,
  });

  logger.info("membership_checkout_created", {
    checkoutType: "subscription",
    membershipId,
    tier: membership.tier,
    paymentId: payment.id,
    userId: input.userId,
    clerkId: input.clerkId,
    customerId: stripeCustomerId,
    sessionId: session.id,
    environment: metadata.environment,
  });

  return session;
}

export async function createCheckoutSession(
  db: Database,
  input: CreateCheckoutSessionInput,
) {
  const type = input.type ?? "session";
  if (type === "subscription") {
    return createMembershipCheckoutSession(db, input);
  }
  if (type === "report") {
    return createReportCheckoutSession(db, input);
  }
  if (type === "session") {
    return createSessionCheckoutSession(db, input);
  }
  if (type === "mentor_training") {
    return createMentorTrainingCheckoutSession(db, input);
  }
  if (type === "course") {
    return createCourseCheckoutSession(db, input);
  }
  if (type === "mentoring_circle") {
    return createMentoringCircleCheckoutSession(db, input);
  }
  if (type === "regeneration_offer") {
    return createRegenerationOfferCheckoutSession(db, input);
  }

  throw createHttpError(
    400,
    `Unsupported checkout type: ${type}. Membership checkout must use Stripe subscription price IDs and no placeholder fallback is permitted.`,
  );
}
