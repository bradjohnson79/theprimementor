import Stripe from "stripe";
import { and, desc, eq } from "drizzle-orm";
import { payments, stripeCustomers, subscriptions, users, type Database } from "@wisdom/db";
import { MEMBER_PRICING, logger, type BillingInterval, type Divin8Tier } from "@wisdom/utils";
import { createHttpError } from "./booking/errors.js";
import { deriveTierFromPriceId, syncEntitlementFromStoredSubscription } from "./divin8/entitlementService.js";
import { createPaymentRecordForEntity, getReusablePaymentForEntity, markPaymentPaidFromWebhook } from "./payments/paymentsService.js";

type MembershipTier = Extract<Divin8Tier, "seeker" | "initiate">;
let stripeInstance: Stripe | null = null;

function getStripe(): Stripe {
  if (!stripeInstance) {
    const key = process.env.STRIPE_SECRET_KEY?.trim();
    if (!key) {
      throw new Error("STRIPE_SECRET_KEY not set");
    }
    stripeInstance = new Stripe(key);
  }

  return stripeInstance;
}

export interface MembershipPurchaseSummary {
  id: string;
  tier: MembershipTier;
  billing_interval: BillingInterval;
  status: string;
  created_at: string;
  updated_at: string | null;
}

function normalizeTier(value: unknown): MembershipTier {
  if (value !== "seeker" && value !== "initiate") {
    throw createHttpError(400, "tier must be one of: seeker, initiate");
  }
  return value;
}

function resolveMembershipAmountCents(tier: MembershipTier, billingInterval: BillingInterval) {
  return Math.round(MEMBER_PRICING[tier][billingInterval].amountCad * 100);
}

function serializeMembershipPurchase(row: {
  id: string;
  tier: string | null;
  status: string;
  metadata: unknown;
  created_at: Date;
  updated_at: Date | null;
}): MembershipPurchaseSummary {
  const metadata = row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
    ? row.metadata as Record<string, unknown>
    : null;
  const billingInterval = metadata?.billingInterval === "annual" ? "annual" : "monthly";
  const tier = normalizeTier(row.tier);
  return {
    id: row.id,
    tier,
    billing_interval: billingInterval,
    status: row.status,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at?.toISOString() ?? null,
  };
}

export async function createOrReuseMembershipPurchase(
  db: Database,
  input: {
    userId: string;
    tier: unknown;
    billingInterval?: BillingInterval;
  },
): Promise<MembershipPurchaseSummary> {
  const tier = normalizeTier(input.tier);
  const billingInterval = input.billingInterval === "annual" ? "annual" : "monthly";

  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, input.userId))
    .limit(1);
  if (!user) {
    throw createHttpError(404, "User not found");
  }

  const existingRows = await db
    .select({
      id: subscriptions.id,
      tier: subscriptions.tier,
      status: subscriptions.status,
      metadata: subscriptions.metadata,
      created_at: subscriptions.created_at,
      updated_at: subscriptions.updated_at,
    })
    .from(subscriptions)
    .where(eq(subscriptions.user_id, input.userId))
    .orderBy(desc(subscriptions.created_at));

  const reusable = existingRows.find((row) =>
    row.tier === tier
    && row.status === "pending_payment"
    && (
      !row.metadata
      || (
        typeof row.metadata === "object"
        && !Array.isArray(row.metadata)
        && (((row.metadata as Record<string, unknown>).billingInterval ?? "monthly") === billingInterval)
      )
    ));

  if (reusable) {
    const existingPayment = await getReusablePaymentForEntity(db, {
      entityType: "subscription",
      entityId: reusable.id,
    });
    if (!existingPayment) {
      await createPaymentRecordForEntity(db, {
        userId: input.userId,
        entityType: "subscription",
        entityId: reusable.id,
        amountCents: resolveMembershipAmountCents(tier, billingInterval),
        currency: "CAD",
        status: "pending",
        metadata: {
          source: "membership_reuse",
          membershipId: reusable.id,
          tier,
          billingInterval,
        },
      });
    }
    return serializeMembershipPurchase(reusable);
  }

  const blocking = existingRows.find((row) =>
    row.tier === tier
    && row.status !== "canceled"
    && row.status !== "cancelled");
  if (blocking) {
    throw createHttpError(409, "This membership already has an active or in-progress purchase.");
  }

  const created = await db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(subscriptions)
      .values({
        user_id: input.userId,
        tier,
        status: "pending_payment",
        metadata: {
          createdFrom: "membership_signup",
          billingInterval,
        },
      })
      .returning({
        id: subscriptions.id,
        tier: subscriptions.tier,
        status: subscriptions.status,
        metadata: subscriptions.metadata,
        created_at: subscriptions.created_at,
        updated_at: subscriptions.updated_at,
      });

    await createPaymentRecordForEntity(tx, {
      userId: input.userId,
      entityType: "subscription",
      entityId: inserted.id,
      amountCents: resolveMembershipAmountCents(tier, billingInterval),
      currency: "CAD",
      status: "pending",
      metadata: {
        source: "membership_create",
        membershipId: inserted.id,
        tier,
        billingInterval,
      },
    });

    return inserted;
  });

  return serializeMembershipPurchase(created);
}

function parseObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function getString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function resolveSubscriptionStatus(status: Stripe.Subscription.Status, fallback: string) {
  return status === "active" || status === "trialing" ? "active" : fallback;
}

export async function confirmMembershipPurchase(
  db: Database,
  input: {
    membershipId: string;
    userId: string;
  },
): Promise<MembershipPurchaseSummary> {
  const [membership] = await db
    .select({
      id: subscriptions.id,
      userId: subscriptions.user_id,
      tier: subscriptions.tier,
      status: subscriptions.status,
      metadata: subscriptions.metadata,
      stripeSubscriptionId: subscriptions.stripe_subscription_id,
      stripeCustomerId: subscriptions.stripe_customer_id,
      created_at: subscriptions.created_at,
      updated_at: subscriptions.updated_at,
    })
    .from(subscriptions)
    .where(eq(subscriptions.id, input.membershipId))
    .limit(1);

  if (!membership || membership.userId !== input.userId) {
    throw createHttpError(404, "Membership purchase not found");
  }

  const [payment] = await db
    .select({
      id: payments.id,
      status: payments.status,
      metadata: payments.metadata,
    })
    .from(payments)
    .where(and(
      eq(payments.entity_type, "subscription"),
      eq(payments.entity_id, input.membershipId),
    ))
    .orderBy(desc(payments.created_at))
    .limit(1);

  const paymentMetadata = parseObject(payment?.metadata);
  const stripeCheckoutSessionId = getString(paymentMetadata?.stripeCheckoutSessionId);
  if (!stripeCheckoutSessionId) {
    return serializeMembershipPurchase(membership);
  }

  const stripe = getStripe();
  const checkoutSession = await stripe.checkout.sessions.retrieve(stripeCheckoutSessionId, {
    expand: ["subscription"],
  });

  const sessionSubscription = checkoutSession.subscription;
  const stripeSubscription = typeof sessionSubscription === "string"
    ? await stripe.subscriptions.retrieve(sessionSubscription)
    : sessionSubscription;

  if (!stripeSubscription) {
    return serializeMembershipPurchase(membership);
  }

  const stripeCustomerId = typeof stripeSubscription.customer === "string"
    ? stripeSubscription.customer
    : stripeSubscription.customer?.id
      ?? (typeof checkoutSession.customer === "string" ? checkoutSession.customer : checkoutSession.customer?.id)
      ?? null;
  const resolved = deriveTierFromPriceId(stripeSubscription.items.data[0]?.price?.id ?? null);
  const activeItem = stripeSubscription.items.data[0];
  const currentPeriodEnd = activeItem?.current_period_end ? new Date(activeItem.current_period_end * 1000) : null;
  const currentPeriodStart = activeItem?.current_period_start ? new Date(activeItem.current_period_start * 1000) : null;
  const billingInterval = resolved?.billingInterval
    ?? (parseObject(membership.metadata)?.billingInterval === "annual" ? "annual" : "monthly");
  const nextTier = resolved?.tier ?? (membership.tier === "initiate" ? "initiate" : "seeker");

  await db
    .update(subscriptions)
    .set({
      stripe_subscription_id: stripeSubscription.id,
      stripe_customer_id: stripeCustomerId,
      tier: nextTier,
      status: resolveSubscriptionStatus(stripeSubscription.status, membership.status),
      cancel_at_period_end: stripeSubscription.cancel_at_period_end,
      current_period_end: currentPeriodEnd,
      metadata: {
        ...(parseObject(membership.metadata) ?? {}),
        checkoutCompletedAt: new Date().toISOString(),
        billingInterval,
        currentPeriodStart: currentPeriodStart?.toISOString() ?? null,
        stripeCheckoutSessionId,
        stripeCustomerId,
        stripeSubscriptionId: stripeSubscription.id,
        source: "membership_success_reconcile",
      },
      updated_at: new Date(),
    })
    .where(eq(subscriptions.id, input.membershipId));

  if (stripeCustomerId) {
    await db
      .insert(stripeCustomers)
      .values({
        user_id: input.userId,
        stripe_customer_id: stripeCustomerId,
      })
      .onConflictDoUpdate({
        target: stripeCustomers.user_id,
        set: {
          stripe_customer_id: stripeCustomerId,
        },
      });
  }

  if (payment && payment.status !== "paid") {
    await markPaymentPaidFromWebhook(db, {
      paymentId: payment.id,
      providerPaymentIntentId: typeof checkoutSession.payment_intent === "string"
        ? checkoutSession.payment_intent
        : checkoutSession.payment_intent?.id ?? null,
      providerCustomerId: stripeCustomerId,
      metadata: {
        ...(paymentMetadata ?? {}),
        stripeCheckoutSessionId,
        stripeSubscriptionId: stripeSubscription.id,
        source: "membership_success_reconcile",
      },
    });
  }

  await syncEntitlementFromStoredSubscription(db, stripeSubscription.id, {
    warn: (payload, message) => logger.warn(message, payload),
    info: (payload, message) => logger.info(message, payload),
  });

  const [refreshed] = await db
    .select({
      id: subscriptions.id,
      tier: subscriptions.tier,
      status: subscriptions.status,
      metadata: subscriptions.metadata,
      created_at: subscriptions.created_at,
      updated_at: subscriptions.updated_at,
    })
    .from(subscriptions)
    .where(eq(subscriptions.id, input.membershipId))
    .limit(1);

  if (!refreshed) {
    throw createHttpError(500, "Membership purchase could not be reloaded");
  }

  return serializeMembershipPurchase(refreshed);
}
