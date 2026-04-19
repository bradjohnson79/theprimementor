import { and, desc, eq } from "drizzle-orm";
import { memberEntitlements, stripeCustomers, subscriptions, users, type Database } from "@wisdom/db";
import type Stripe from "stripe";
import { logger, getTierCapabilities, type BillingInterval, type Divin8Tier } from "@wisdom/utils";

interface PriceMapEntry {
  tier: Divin8Tier;
  billingInterval: BillingInterval;
}

export interface MemberEntitlementSnapshot {
  userId: string;
  stripeSubscriptionId: string | null;
  tier: Divin8Tier | null;
  billingInterval: BillingInterval | null;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  isSynced: boolean;
}

export interface ActiveMemberEntitlementSnapshot extends MemberEntitlementSnapshot {
  stripeSubscriptionId: string;
  tier: Divin8Tier;
  billingInterval: BillingInterval;
  isSynced: true;
}

export type ResolvedUserTier = Divin8Tier | "free";

const PRICE_MAP_ENV: Record<string, PriceMapEntry> = {
  STRIPE_PRICE_SEEKER_MONTHLY: { tier: "seeker", billingInterval: "monthly" },
  STRIPE_PRICE_SEEKER_ANNUAL: { tier: "seeker", billingInterval: "annual" },
  STRIPE_PRICE_INITIATE_MONTHLY: { tier: "initiate", billingInterval: "monthly" },
  STRIPE_PRICE_INITIATE_ANNUAL: { tier: "initiate", billingInterval: "annual" },
  STRIPE_LIVE_PRICE_SEEKER_MONTHLY: { tier: "seeker", billingInterval: "monthly" },
  STRIPE_LIVE_PRICE_SEEKER_ANNUAL: { tier: "seeker", billingInterval: "annual" },
  STRIPE_LIVE_PRICE_INITIATE_MONTHLY: { tier: "initiate", billingInterval: "monthly" },
  STRIPE_LIVE_PRICE_INITIATE_ANNUAL: { tier: "initiate", billingInterval: "annual" },
};

const LIVE_MEMBERSHIP_PRICE_FALLBACKS: Array<[string, PriceMapEntry]> = [
  ["price_1TIL1WAd5V3LaCqjim2Zs3x8", { tier: "seeker", billingInterval: "monthly" }],
  ["price_1TILCKAd5V3LaCqj9HDFNWum", { tier: "seeker", billingInterval: "annual" }],
  ["price_1TIL55Ad5V3LaCqjXkESzqeH", { tier: "initiate", billingInterval: "monthly" }],
  ["price_1TILESAd5V3LaCqjLX4fWEd3", { tier: "initiate", billingInterval: "annual" }],
];

function clampTier(value: unknown): Divin8Tier {
  return value === "initiate" ? "initiate" : "seeker";
}

function clampBillingInterval(value: unknown): BillingInterval {
  return value === "annual" ? "annual" : "monthly";
}

function readPriceMap(): Map<string, PriceMapEntry> {
  const map = new Map<string, PriceMapEntry>();
  for (const [key, value] of Object.entries(PRICE_MAP_ENV)) {
    const priceId = process.env[key]?.trim();
    if (priceId) {
      map.set(priceId, value);
    }
  }
  for (const [priceId, value] of LIVE_MEMBERSHIP_PRICE_FALLBACKS) {
    if (!map.has(priceId)) {
      map.set(priceId, value);
    }
  }
  return map;
}

function normalizeDate(value: unknown): Date | null {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

function parseObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

export function deriveTierFromPriceId(priceId: string | null | undefined): PriceMapEntry | null {
  if (!priceId) {
    return null;
  }
  return readPriceMap().get(priceId) ?? null;
}

export function getUserTier(
  subscription: { status?: string | null; tier?: string | null } | null | undefined,
): ResolvedUserTier {
  if (!subscription) {
    return "free";
  }
  if (subscription.status !== "active") {
    return "free";
  }
  if (subscription.tier === "seeker" || subscription.tier === "initiate") {
    return subscription.tier;
  }
  return "free";
}

function resolveTier(value: unknown): Divin8Tier | null {
  if (value === "seeker" || value === "initiate") {
    return value;
  }
  return null;
}

function resolveBillingInterval(value: unknown): BillingInterval | null {
  if (value === "monthly" || value === "annual") {
    return value;
  }
  return null;
}

function tierRank(tier: Divin8Tier) {
  return tier === "initiate" ? 2 : 1;
}

type SubscriptionEntitlementCandidate = {
  userId: string;
  stripeSubscriptionId: string;
  tier: Divin8Tier;
  billingInterval: BillingInterval;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  updatedAt: Date | null;
  createdAt: Date;
};

function pickBestEntitlementCandidate(
  candidates: SubscriptionEntitlementCandidate[],
): SubscriptionEntitlementCandidate | null {
  if (!candidates.length) {
    return null;
  }

  return [...candidates].sort((left, right) => {
    const byTier = tierRank(right.tier) - tierRank(left.tier);
    if (byTier !== 0) {
      return byTier;
    }

    const leftPeriodEnd = left.currentPeriodEnd?.getTime() ?? 0;
    const rightPeriodEnd = right.currentPeriodEnd?.getTime() ?? 0;
    if (rightPeriodEnd !== leftPeriodEnd) {
      return rightPeriodEnd - leftPeriodEnd;
    }

    const leftUpdated = left.updatedAt?.getTime() ?? left.createdAt.getTime();
    const rightUpdated = right.updatedAt?.getTime() ?? right.createdAt.getTime();
    return rightUpdated - leftUpdated;
  })[0] ?? null;
}

export async function getCurrentSubscriptionForUser(db: Database, userId: string) {
  const rows = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.user_id, userId))
    .orderBy(desc(subscriptions.updated_at), desc(subscriptions.created_at))
    .limit(10);

  const bestActive = pickBestEntitlementCandidate(rows.flatMap((row) => {
    if (row.status !== "active" || !row.stripe_subscription_id) {
      return [];
    }

    const metadata = parseObject(row.metadata);
    const tier = resolveTier(row.tier);
    const billingInterval = resolveBillingInterval(metadata?.billingInterval);
    if (!tier || !billingInterval) {
      return [];
    }

    return [{
      userId: row.user_id,
      stripeSubscriptionId: row.stripe_subscription_id,
      tier,
      billingInterval,
      currentPeriodStart: normalizeDate(metadata?.currentPeriodStart),
      currentPeriodEnd: normalizeDate(row.current_period_end),
      updatedAt: normalizeDate(row.updated_at),
      createdAt: row.created_at,
    }];
  }));

  return bestActive
    ? rows.find((row) => row.stripe_subscription_id === bestActive.stripeSubscriptionId) ?? rows[0] ?? null
    : rows[0] ?? null;
}

async function resolveUserIdFromSubscription(db: Database, subscription: Stripe.Subscription) {
  const stripeCustomerId = typeof subscription.customer === "string"
    ? subscription.customer
    : subscription.customer?.id ?? "";
  if (stripeCustomerId) {
    const [mapping] = await db
      .select({ userId: stripeCustomers.user_id })
      .from(stripeCustomers)
      .where(eq(stripeCustomers.stripe_customer_id, stripeCustomerId))
      .limit(1);
    if (mapping?.userId) {
      return mapping.userId;
    }
  }

  const metadataUserId = typeof subscription.metadata?.userId === "string" ? subscription.metadata.userId.trim() : "";
  if (metadataUserId) {
    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, metadataUserId))
      .limit(1);
    if (user?.id) {
      return user.id;
    }
  }

  const metadataClerkId = typeof subscription.metadata?.clerkId === "string" ? subscription.metadata.clerkId.trim() : "";
  if (metadataClerkId) {
    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerk_id, metadataClerkId))
      .limit(1);
    if (user?.id) {
      return user.id;
    }
  }

  return null;
}

function isEntitledSubscriptionStatus(status: string) {
  return status === "active";
}

export async function syncEntitlementFromDerivedSubscription(
  db: Database,
  input: {
    userId: string;
    stripeSubscriptionId: string;
    status: string;
    tier: Divin8Tier | null;
    billingInterval: BillingInterval | null;
    currentPeriodStart: Date | null;
    currentPeriodEnd: Date | null;
  },
  logger: {
    warn: (payload: unknown, message: string) => void;
    info?: (payload: unknown, message: string) => void;
  },
) {
  if (!isEntitledSubscriptionStatus(input.status)) {
    await markSubscriptionInactive(db, input.stripeSubscriptionId);
    return;
  }

  if (!input.tier || !input.billingInterval) {
    logger.warn(
      {
        stripeSubscriptionId: input.stripeSubscriptionId,
        tier: input.tier,
        billingInterval: input.billingInterval,
      },
      "stripe_subscription_missing_entitlement_fields",
    );
    await markSubscriptionInactive(db, input.stripeSubscriptionId);
    return;
  }

  await upsertMemberEntitlementSnapshot(db, {
    userId: input.userId,
    stripeSubscriptionId: input.stripeSubscriptionId,
    tier: input.tier,
    billingInterval: input.billingInterval,
    currentPeriodStart: input.currentPeriodStart,
    currentPeriodEnd: input.currentPeriodEnd,
  });
  logger.info?.({
    userId: input.userId,
    stripeSubscriptionId: input.stripeSubscriptionId,
    tier: input.tier,
    billingInterval: input.billingInterval,
    status: input.status,
  }, "membership_entitlement_synced");
}

async function clearMemberEntitlementForUser(db: Database, userId: string) {
  await db
    .delete(memberEntitlements)
    .where(eq(memberEntitlements.user_id, userId));
}

async function reconcileMemberEntitlementForUser(
  db: Database,
  userId: string,
  logger: {
    warn: (payload: unknown, message: string) => void;
    info?: (payload: unknown, message: string) => void;
  },
) {
  const rows = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.user_id, userId))
    .orderBy(desc(subscriptions.updated_at), desc(subscriptions.created_at));

  const best = pickBestEntitlementCandidate(rows.flatMap((row) => {
    if (row.status !== "active" || !row.stripe_subscription_id) {
      return [];
    }

    const metadata = parseObject(row.metadata);
    const tier = resolveTier(row.tier);
    const billingInterval = resolveBillingInterval(metadata?.billingInterval);
    if (!tier || !billingInterval) {
      logger.warn(
        {
          userId,
          stripeSubscriptionId: row.stripe_subscription_id,
          tier: row.tier,
          billingInterval: metadata?.billingInterval ?? null,
        },
        "stripe_subscription_missing_entitlement_fields",
      );
      return [];
    }

    return [{
      userId: row.user_id,
      stripeSubscriptionId: row.stripe_subscription_id,
      tier,
      billingInterval,
      currentPeriodStart: normalizeDate(metadata?.currentPeriodStart),
      currentPeriodEnd: normalizeDate(row.current_period_end),
      updatedAt: normalizeDate(row.updated_at),
      createdAt: row.created_at,
    }];
  }));

  if (!best) {
    await clearMemberEntitlementForUser(db, userId);
    logger.info?.({ userId }, "membership_entitlement_cleared_for_user");
    return;
  }

  await upsertMemberEntitlementSnapshot(db, {
    userId,
    stripeSubscriptionId: best.stripeSubscriptionId,
    tier: best.tier,
    billingInterval: best.billingInterval,
    currentPeriodStart: best.currentPeriodStart,
    currentPeriodEnd: best.currentPeriodEnd,
  });
  logger.info?.({
    userId,
    stripeSubscriptionId: best.stripeSubscriptionId,
    tier: best.tier,
    billingInterval: best.billingInterval,
  }, "membership_entitlement_reconciled");
}

export async function syncEntitlementFromStoredSubscription(
  db: Database,
  stripeSubscriptionId: string,
  logger: {
    warn: (payload: unknown, message: string) => void;
    info?: (payload: unknown, message: string) => void;
  },
) {
  const [subscription] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.stripe_subscription_id, stripeSubscriptionId))
    .limit(1);

  if (!subscription) {
    logger.warn({ stripeSubscriptionId }, "stripe_subscription_missing_local_record");
    await markSubscriptionInactive(db, stripeSubscriptionId);
    return;
  }

  await reconcileMemberEntitlementForUser(db, subscription.user_id, logger);
}

export async function getMemberEntitlementSnapshot(
  db: Database,
  userId: string,
): Promise<MemberEntitlementSnapshot> {
  const [snapshot] = await db
    .select()
    .from(memberEntitlements)
    .where(eq(memberEntitlements.user_id, userId))
    .limit(1);

  if (!snapshot) {
    return {
      userId,
      stripeSubscriptionId: null,
      tier: null,
      billingInterval: null,
      currentPeriodStart: null,
      currentPeriodEnd: null,
      isSynced: false,
    };
  }

  return {
    userId,
    stripeSubscriptionId: snapshot.stripe_subscription_id ?? null,
    tier: clampTier(snapshot.tier),
    billingInterval: clampBillingInterval(snapshot.billing_interval),
    currentPeriodStart: normalizeDate(snapshot.current_period_start),
    currentPeriodEnd: normalizeDate(snapshot.current_period_end),
    isSynced: true,
  };
}

export async function upsertMemberEntitlementSnapshot(
  db: Database,
  input: {
    userId: string;
    stripeSubscriptionId: string;
    tier: Divin8Tier;
    billingInterval: BillingInterval;
    currentPeriodStart: Date | null;
    currentPeriodEnd: Date | null;
  },
) {
  const now = new Date();
  await db
    .insert(memberEntitlements)
    .values({
      user_id: input.userId,
      stripe_subscription_id: input.stripeSubscriptionId,
      tier: input.tier,
      billing_interval: input.billingInterval,
      current_period_start: input.currentPeriodStart,
      current_period_end: input.currentPeriodEnd,
      last_synced_at: now,
      updated_at: now,
    })
    .onConflictDoUpdate({
      target: memberEntitlements.user_id,
      set: {
        stripe_subscription_id: input.stripeSubscriptionId,
        tier: input.tier,
        billing_interval: input.billingInterval,
        current_period_start: input.currentPeriodStart,
        current_period_end: input.currentPeriodEnd,
        last_synced_at: now,
        updated_at: now,
      },
    });
}

export async function markSubscriptionInactive(db: Database, stripeSubscriptionId: string) {
  await db
    .delete(memberEntitlements)
    .where(eq(memberEntitlements.stripe_subscription_id, stripeSubscriptionId));
  logger.info("membership_entitlement_cleared", { stripeSubscriptionId });
}

export function hasActiveMemberEntitlement(
  snapshot: MemberEntitlementSnapshot,
): snapshot is ActiveMemberEntitlementSnapshot {
  return Boolean(snapshot.isSynced && snapshot.stripeSubscriptionId && snapshot.tier && snapshot.billingInterval);
}

export function getEntitlementTier(snapshot: MemberEntitlementSnapshot): ResolvedUserTier {
  return hasActiveMemberEntitlement(snapshot) ? snapshot.tier : "free";
}

export function getEntitlementCapabilities(snapshot: ActiveMemberEntitlementSnapshot) {
  return getTierCapabilities(snapshot.tier);
}

export async function syncEntitlementFromStripeSubscription(
  db: Database,
  subscription: Stripe.Subscription,
  logger: {
    warn: (payload: unknown, message: string) => void;
    info?: (payload: unknown, message: string) => void;
  },
) {
  const stripeSubscriptionId = subscription.id;
  const activeItem = subscription.items.data[0];
  const resolved = deriveTierFromPriceId(activeItem?.price?.id ?? null);
  if (!resolved && subscription.status === "active") {
    logger.warn(
      {
        stripeSubscriptionId,
        priceId: activeItem?.price?.id ?? null,
      },
      "stripe_subscription_price_not_mapped",
    );
  }

  const userId = await resolveUserIdFromSubscription(db, subscription);
  if (!userId) {
    logger.warn(
      {
        stripeSubscriptionId,
      },
      "stripe_subscription_missing_user_metadata",
    );
    return;
  }

  const periodStart = activeItem?.current_period_start
    ? new Date(activeItem.current_period_start * 1000)
    : null;
  const periodEnd = activeItem?.current_period_end
    ? new Date(activeItem.current_period_end * 1000)
    : null;

  await syncEntitlementFromDerivedSubscription(db, {
    userId,
    stripeSubscriptionId,
    status: subscription.status,
    tier: resolved?.tier ?? null,
    billingInterval: resolved?.billingInterval ?? null,
    currentPeriodStart: periodStart,
    currentPeriodEnd: periodEnd,
  }, logger);
}

export async function handleStripeEntitlementWebhookEvent(
  db: Database,
  event: Stripe.Event,
  logger: {
    warn: (payload: unknown, message: string) => void;
    info?: (payload: unknown, message: string) => void;
  },
) {
  if (
    event.type !== "customer.subscription.created"
    && event.type !== "customer.subscription.updated"
    && event.type !== "customer.subscription.deleted"
  ) {
    return;
  }

  const subscription = event.data.object as Stripe.Subscription;
  if (event.type === "customer.subscription.deleted") {
    await markSubscriptionInactive(db, subscription.id);
    return;
  }

  await syncEntitlementFromStripeSubscription(db, subscription, logger);
}

export function belongsToUser(snapshot: MemberEntitlementSnapshot, userId: string) {
  return snapshot.userId === userId;
}

export function buildStripePriceMappingDebug() {
  return {
    seekerMonthly: process.env.STRIPE_PRICE_SEEKER_MONTHLY ?? null,
    seekerAnnual: process.env.STRIPE_PRICE_SEEKER_ANNUAL ?? null,
    initiateMonthly: process.env.STRIPE_PRICE_INITIATE_MONTHLY ?? null,
    initiateAnnual: process.env.STRIPE_PRICE_INITIATE_ANNUAL ?? null,
  };
}

export function hasSubscriptionPeriod(snapshot: MemberEntitlementSnapshot) {
  return Boolean(snapshot.currentPeriodStart && snapshot.currentPeriodEnd);
}

export async function getEntitlementSnapshotBySubscriptionId(db: Database, stripeSubscriptionId: string) {
  const [row] = await db
    .select()
    .from(memberEntitlements)
    .where(and(eq(memberEntitlements.stripe_subscription_id, stripeSubscriptionId)))
    .limit(1);
  return row ?? null;
}
