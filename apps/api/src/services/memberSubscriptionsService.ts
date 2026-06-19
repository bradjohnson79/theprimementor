import Stripe from "stripe";
import { desc, eq } from "drizzle-orm";
import { regenerationSubscriptions, subscriptions, users, type Database } from "@wisdom/db";
import { MEMBER_PRICING } from "@wisdom/utils";
import { createHttpError } from "./booking/errors.js";

export type MemberSubscriptionStatus = "active" | "paused" | "cancelling" | "past_due" | "canceled";
export type MemberSubscriptionKind = "membership" | "regeneration";

export interface MemberRecurringSubscriptionSummary {
  id: string;
  kind: MemberSubscriptionKind;
  name: string;
  amountCents: number;
  currency: "CAD";
  billingInterval: "monthly" | "annual";
  status: MemberSubscriptionStatus;
  renewsOn: string | null;
  accessEndsOn: string | null;
  cancelAtPeriodEnd: boolean;
  cancelable: boolean;
  pauseable: boolean;
  pausedUntil: string | null;
  detail: string | null;
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

function parseObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function dateToIso(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

function addMonths(value: Date, months: number) {
  const next = new Date(value);
  next.setUTCMonth(next.getUTCMonth() + months);
  return next;
}

function extractPauseUntil(metadata: Record<string, unknown> | null) {
  const pauseCollection = parseObject(metadata?.pauseCollection);
  const resumesAt = pauseCollection?.resumesAt;
  return typeof resumesAt === "string" && resumesAt.trim() ? resumesAt : null;
}

function getStripeCurrentPeriodEnd(subscription: Stripe.Subscription, fallback: Date | null | undefined) {
  const item = subscription.items.data[0];
  return item?.current_period_end ? new Date(item.current_period_end * 1000) : fallback ?? null;
}

function getStripePauseCollection(subscription: Stripe.Subscription) {
  return subscription.pause_collection
    ? {
      behavior: subscription.pause_collection.behavior,
      resumesAt: subscription.pause_collection.resumes_at
        ? new Date(subscription.pause_collection.resumes_at * 1000).toISOString()
        : null,
    }
    : null;
}

function normalizeMembershipStatus(value: string, cancelAtPeriodEnd: boolean): MemberSubscriptionStatus | null {
  if (value === "active") {
    return cancelAtPeriodEnd ? "cancelling" : "active";
  }
  if (value === "paused") {
    return "paused";
  }
  if (value === "past_due" || value === "unpaid") {
    return "past_due";
  }
  if (value === "canceled" || value === "cancelled") {
    return "canceled";
  }
  return null;
}

function normalizeRegenerationStatus(value: string, cancelAtPeriodEnd: boolean): MemberSubscriptionStatus | null {
  if (value === "active") {
    return cancelAtPeriodEnd ? "cancelling" : "active";
  }
  if (value === "canceled_pending_expiry") {
    return "cancelling";
  }
  if (value === "paused") {
    return "paused";
  }
  if (value === "past_due") {
    return "past_due";
  }
  if (value === "canceled") {
    return "canceled";
  }
  return null;
}

async function ensureUserExists(db: Database, userId: string) {
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    throw createHttpError(404, "User not found");
  }
}

export async function listMemberRecurringSubscriptions(
  db: Database,
  userId: string,
): Promise<MemberRecurringSubscriptionSummary[]> {
  await ensureUserExists(db, userId);

  const [membershipRows, regenerationRows] = await Promise.all([
    db
      .select({
        id: subscriptions.id,
        tier: subscriptions.tier,
        status: subscriptions.status,
        cancelAtPeriodEnd: subscriptions.cancel_at_period_end,
        currentPeriodEnd: subscriptions.current_period_end,
        stripeSubscriptionId: subscriptions.stripe_subscription_id,
        metadata: subscriptions.metadata,
        archived: subscriptions.archived,
        createdAt: subscriptions.created_at,
      })
      .from(subscriptions)
      .where(eq(subscriptions.user_id, userId))
      .orderBy(desc(subscriptions.created_at)),
    db
      .select({
        id: regenerationSubscriptions.id,
        status: regenerationSubscriptions.status,
        cancelAtPeriodEnd: regenerationSubscriptions.cancel_at_period_end,
        currentPeriodEnd: regenerationSubscriptions.current_period_end,
        stripeSubscriptionId: regenerationSubscriptions.stripe_subscription_id,
        metadata: regenerationSubscriptions.metadata,
        createdAt: regenerationSubscriptions.created_at,
      })
      .from(regenerationSubscriptions)
      .where(eq(regenerationSubscriptions.user_id, userId))
      .orderBy(desc(regenerationSubscriptions.created_at)),
  ]);

  const memberships = membershipRows
    .filter((row) => !row.archived && row.stripeSubscriptionId && row.tier)
    .map((row) => {
      const metadata = parseObject(row.metadata);
      const billingInterval: "monthly" | "annual" = metadata?.billingInterval === "annual" ? "annual" : "monthly";
      const normalizedStatus = normalizeMembershipStatus(row.status, row.cancelAtPeriodEnd);
      if (!normalizedStatus || (row.tier !== "seeker" && row.tier !== "initiate")) {
        return null;
      }

      return {
        id: row.id,
        kind: "membership" as const,
        name: "Prime Mentor Membership",
        amountCents: Math.round(MEMBER_PRICING[row.tier][billingInterval].amountCad * 100),
        currency: "CAD" as const,
        billingInterval,
        status: normalizedStatus,
        renewsOn: normalizedStatus === "active" ? dateToIso(row.currentPeriodEnd) : null,
        accessEndsOn: normalizedStatus === "cancelling" ? dateToIso(row.currentPeriodEnd) : null,
        cancelAtPeriodEnd: row.cancelAtPeriodEnd,
        cancelable: normalizedStatus === "active" || normalizedStatus === "past_due" || normalizedStatus === "paused",
        pauseable: normalizedStatus === "active" && !row.cancelAtPeriodEnd,
        pausedUntil: normalizedStatus === "paused" ? extractPauseUntil(metadata) : null,
        detail: row.tier === "initiate" ? "Initiate tier" : "Premium tier",
        createdAt: row.createdAt,
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));

  const regeneration = regenerationRows
    .filter((row) => row.stripeSubscriptionId)
    .map((row) => {
      const metadata = parseObject(row.metadata);
      const normalizedStatus = normalizeRegenerationStatus(row.status, row.cancelAtPeriodEnd);
      if (!normalizedStatus) {
        return null;
      }

      return {
        id: row.id,
        kind: "regeneration" as const,
        name: "Regeneration Monthly Package",
        amountCents: 9900,
        currency: "CAD" as const,
        billingInterval: "monthly" as const,
        status: normalizedStatus,
        renewsOn: normalizedStatus === "active" ? dateToIso(row.currentPeriodEnd) : null,
        accessEndsOn: normalizedStatus === "cancelling" ? dateToIso(row.currentPeriodEnd) : null,
        cancelAtPeriodEnd: row.cancelAtPeriodEnd,
        cancelable: normalizedStatus === "active" || normalizedStatus === "past_due" || normalizedStatus === "paused",
        pauseable: normalizedStatus === "active" && !row.cancelAtPeriodEnd,
        pausedUntil: normalizedStatus === "paused" ? extractPauseUntil(metadata) : null,
        detail: null,
        createdAt: row.createdAt,
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));

  return [...regeneration, ...memberships]
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
    .map(({ createdAt: _createdAt, ...row }) => row);
}

export async function cancelMemberRecurringSubscription(
  db: Database,
  input: {
    userId: string;
    subscriptionType: MemberSubscriptionKind;
    subscriptionId: string;
    reason?: string | null;
    details?: string | null;
    retentionAccepted?: boolean;
  },
): Promise<MemberRecurringSubscriptionSummary> {
  await ensureUserExists(db, input.userId);
  const stripe = getStripe();

  if (input.subscriptionType === "membership") {
    const [membership] = await db
      .select({
        id: subscriptions.id,
        userId: subscriptions.user_id,
        stripeSubscriptionId: subscriptions.stripe_subscription_id,
        tier: subscriptions.tier,
        status: subscriptions.status,
        cancelAtPeriodEnd: subscriptions.cancel_at_period_end,
        currentPeriodEnd: subscriptions.current_period_end,
        metadata: subscriptions.metadata,
      })
      .from(subscriptions)
      .where(eq(subscriptions.id, input.subscriptionId))
      .limit(1);

    if (!membership || membership.userId !== input.userId) {
      throw createHttpError(404, "Subscription not found");
    }
    if (!membership.stripeSubscriptionId) {
      throw createHttpError(400, "This subscription is not connected to Stripe yet.");
    }
    if (membership.cancelAtPeriodEnd) {
      throw createHttpError(409, "This subscription is already scheduled to cancel.");
    }

    const cancelFeedback = normalizeMemberCancellationFeedback(input);
    const stripeSubscription = await stripe.subscriptions.update(membership.stripeSubscriptionId, {
      cancel_at_period_end: true,
    });
    const currentPeriodEnd = getStripeCurrentPeriodEnd(stripeSubscription, membership.currentPeriodEnd);

    await db
      .update(subscriptions)
      .set({
        status: stripeSubscription.status === "active" || stripeSubscription.status === "trialing" ? "active" : membership.status,
        cancel_at_period_end: true,
        current_period_end: currentPeriodEnd ?? null,
        metadata: {
          ...(parseObject(membership.metadata) ?? {}),
          cancelRequestedAt: new Date().toISOString(),
          cancellationFeedback: cancelFeedback,
        },
        updated_at: new Date(),
      })
      .where(eq(subscriptions.id, membership.id));
  } else {
    const [regeneration] = await db
      .select({
        id: regenerationSubscriptions.id,
        userId: regenerationSubscriptions.user_id,
        stripeSubscriptionId: regenerationSubscriptions.stripe_subscription_id,
        status: regenerationSubscriptions.status,
        cancelAtPeriodEnd: regenerationSubscriptions.cancel_at_period_end,
        currentPeriodEnd: regenerationSubscriptions.current_period_end,
        metadata: regenerationSubscriptions.metadata,
      })
      .from(regenerationSubscriptions)
      .where(eq(regenerationSubscriptions.id, input.subscriptionId))
      .limit(1);

    if (!regeneration || regeneration.userId !== input.userId) {
      throw createHttpError(404, "Subscription not found");
    }
    if (!regeneration.stripeSubscriptionId) {
      throw createHttpError(400, "This subscription is not connected to Stripe yet.");
    }
    if (regeneration.cancelAtPeriodEnd) {
      throw createHttpError(409, "This subscription is already scheduled to cancel.");
    }

    const cancelFeedback = normalizeMemberCancellationFeedback(input);
    const stripeSubscription = await stripe.subscriptions.update(regeneration.stripeSubscriptionId, {
      cancel_at_period_end: true,
    });
    const currentPeriodEnd = getStripeCurrentPeriodEnd(stripeSubscription, regeneration.currentPeriodEnd);

    await db
      .update(regenerationSubscriptions)
      .set({
        status: "canceled_pending_expiry",
        access_state: "grace_period",
        cancel_at_period_end: true,
        current_period_end: currentPeriodEnd ?? null,
        metadata: {
          ...(parseObject(regeneration.metadata) ?? {}),
          cancelRequestedAt: new Date().toISOString(),
          cancellationFeedback: cancelFeedback,
        },
        updated_at: new Date(),
      })
      .where(eq(regenerationSubscriptions.id, regeneration.id));
  }

  const refreshed = await listMemberRecurringSubscriptions(db, input.userId);
  const updated = refreshed.find((item) =>
    item.id === input.subscriptionId && item.kind === input.subscriptionType,
  );

  if (!updated) {
    throw createHttpError(500, "Subscription was updated but could not be reloaded.");
  }

  return updated;
}

function normalizeMemberCancellationFeedback(input: {
  reason?: string | null;
  details?: string | null;
  retentionAccepted?: boolean;
}) {
  return {
    reason: input.reason?.trim() || "not_provided",
    details: input.details?.trim() || null,
    retentionAccepted: input.retentionAccepted === true,
    submittedAt: new Date().toISOString(),
  };
}

export async function pauseMemberRecurringSubscription(
  db: Database,
  input: {
    userId: string;
    subscriptionType: MemberSubscriptionKind;
    subscriptionId: string;
  },
): Promise<MemberRecurringSubscriptionSummary> {
  await ensureUserExists(db, input.userId);
  const stripe = getStripe();
  const resumesAtDate = addMonths(new Date(), 1);
  const resumesAt = Math.floor(resumesAtDate.getTime() / 1000);

  if (input.subscriptionType === "membership") {
    const [membership] = await db
      .select({
        id: subscriptions.id,
        userId: subscriptions.user_id,
        stripeSubscriptionId: subscriptions.stripe_subscription_id,
        status: subscriptions.status,
        cancelAtPeriodEnd: subscriptions.cancel_at_period_end,
        currentPeriodEnd: subscriptions.current_period_end,
        metadata: subscriptions.metadata,
      })
      .from(subscriptions)
      .where(eq(subscriptions.id, input.subscriptionId))
      .limit(1);

    if (!membership || membership.userId !== input.userId) {
      throw createHttpError(404, "Subscription not found");
    }
    if (!membership.stripeSubscriptionId) {
      throw createHttpError(400, "This subscription is not connected to Stripe yet.");
    }
    if (membership.cancelAtPeriodEnd) {
      throw createHttpError(409, "Subscriptions scheduled to cancel cannot be paused.");
    }
    if (membership.status === "paused") {
      throw createHttpError(409, "This subscription is already paused.");
    }

    const stripeSubscription = await stripe.subscriptions.update(membership.stripeSubscriptionId, {
      pause_collection: {
        behavior: "void",
        resumes_at: resumesAt,
      },
    });

    await db
      .update(subscriptions)
      .set({
        status: "paused",
        cancel_at_period_end: false,
        current_period_end: getStripeCurrentPeriodEnd(stripeSubscription, membership.currentPeriodEnd),
        metadata: {
          ...(parseObject(membership.metadata) ?? {}),
          pauseRequestedAt: new Date().toISOString(),
          pauseCollection: getStripePauseCollection(stripeSubscription) ?? {
            behavior: "void",
            resumesAt: resumesAtDate.toISOString(),
          },
        },
        updated_at: new Date(),
      })
      .where(eq(subscriptions.id, membership.id));
  } else {
    const [regeneration] = await db
      .select({
        id: regenerationSubscriptions.id,
        userId: regenerationSubscriptions.user_id,
        stripeSubscriptionId: regenerationSubscriptions.stripe_subscription_id,
        status: regenerationSubscriptions.status,
        cancelAtPeriodEnd: regenerationSubscriptions.cancel_at_period_end,
        currentPeriodEnd: regenerationSubscriptions.current_period_end,
        metadata: regenerationSubscriptions.metadata,
      })
      .from(regenerationSubscriptions)
      .where(eq(regenerationSubscriptions.id, input.subscriptionId))
      .limit(1);

    if (!regeneration || regeneration.userId !== input.userId) {
      throw createHttpError(404, "Subscription not found");
    }
    if (!regeneration.stripeSubscriptionId) {
      throw createHttpError(400, "This subscription is not connected to Stripe yet.");
    }
    if (regeneration.cancelAtPeriodEnd) {
      throw createHttpError(409, "Subscriptions scheduled to cancel cannot be paused.");
    }
    if (regeneration.status === "paused") {
      throw createHttpError(409, "This subscription is already paused.");
    }

    const stripeSubscription = await stripe.subscriptions.update(regeneration.stripeSubscriptionId, {
      pause_collection: {
        behavior: "void",
        resumes_at: resumesAt,
      },
    });

    await db
      .update(regenerationSubscriptions)
      .set({
        status: "paused",
        access_state: "inactive",
        priority_support: false,
        cancel_at_period_end: false,
        current_period_end: getStripeCurrentPeriodEnd(stripeSubscription, regeneration.currentPeriodEnd),
        metadata: {
          ...(parseObject(regeneration.metadata) ?? {}),
          pauseRequestedAt: new Date().toISOString(),
          pauseCollection: getStripePauseCollection(stripeSubscription) ?? {
            behavior: "void",
            resumesAt: resumesAtDate.toISOString(),
          },
        },
        updated_at: new Date(),
      })
      .where(eq(regenerationSubscriptions.id, regeneration.id));
  }

  const refreshed = await listMemberRecurringSubscriptions(db, input.userId);
  const updated = refreshed.find((item) =>
    item.id === input.subscriptionId && item.kind === input.subscriptionType,
  );

  if (!updated) {
    throw createHttpError(500, "Subscription was paused but could not be reloaded.");
  }

  return updated;
}
