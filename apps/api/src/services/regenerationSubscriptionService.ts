import Stripe from "stripe";
import { and, desc, eq } from "drizzle-orm";
import {
  orders,
  payments,
  regenerationCheckIns,
  regenerationSubscriptions,
  stripeCustomers,
  users,
  type Database,
} from "@wisdom/db";
import { createHttpError } from "./booking/errors.js";
import {
  REGENERATION_PLAN_NAME,
  REGENERATION_PRODUCT_KEY,
  getRegenerationStripePriceId,
} from "../config/regenerationBilling.js";
import { ensureStripeCustomerId } from "./payments/stripeCustomerService.js";
import { createPaymentRecordForEntity, markPaymentPaidFromWebhook } from "./payments/paymentsService.js";

type RegenerationProjectionStatus =
  | "inactive"
  | "pending_checkout"
  | "incomplete"
  | "active"
  | "past_due"
  | "canceled_pending_expiry"
  | "canceled";

type RegenerationAccessState = "inactive" | "active" | "grace_period" | "admin_override";

type ServiceLogger = {
  info?: (payload: unknown, message?: string) => void;
  warn?: (payload: unknown, message?: string) => void;
  error?: (payload: unknown, message?: string) => void;
};

interface RegenerationProjectionRow {
  id: string;
  userId: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  stripePriceId: string | null;
  stripeCheckoutSessionId: string | null;
  status: string;
  accessState: string;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  canceledAt: Date | null;
  endedAt: Date | null;
  prioritySupport: boolean;
  isAdminOverride: boolean;
  overrideExpiresAt: Date | null;
  lastPaymentFailedAt: Date | null;
  lastCheckoutStartedAt: Date | null;
  lastReconciledAt: Date | null;
  metadata: unknown;
  createdAt: Date;
  updatedAt: Date | null;
}

export interface RegenerationSubscriptionSummary {
  id: string;
  status: RegenerationProjectionStatus;
  accessState: RegenerationAccessState;
  hasActiveAccess: boolean;
  prioritySupport: boolean;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  stripeCheckoutSessionId: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  isAdminOverride: boolean;
  overrideExpiresAt: string | null;
  lastPaymentFailedAt: string | null;
  lastCheckoutStartedAt: string | null;
  lastReconciledAt: string | null;
}

export interface RegenerationCheckInSummary {
  id: string;
  weekStart: string;
  weekNumber: number;
  experiences: string | null;
  changesNoticed: string | null;
  challenges: string | null;
  adminNotes: string | null;
  submittedAt: string;
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

function log(logger: ServiceLogger | undefined, level: "info" | "warn" | "error", payload: unknown, message: string) {
  logger?.[level]?.(payload, message);
}

function parseObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function getString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function stripeRef(value: unknown): string | null {
  if (typeof value === "string") {
    return value;
  }
  if (value && typeof value === "object" && "id" in value && typeof value.id === "string") {
    return value.id;
  }
  return null;
}

function unixToDate(value: number | null | undefined) {
  return typeof value === "number" ? new Date(value * 1000) : null;
}

function dateToIso(value: Date | null) {
  return value ? value.toISOString() : null;
}

function hasActiveOverride(row: Pick<RegenerationProjectionRow, "isAdminOverride" | "overrideExpiresAt">, now = new Date()) {
  return row.isAdminOverride && Boolean(row.overrideExpiresAt && row.overrideExpiresAt.getTime() > now.getTime());
}

function normalizeProjectionStatus(value: string): RegenerationProjectionStatus {
  switch (value) {
    case "pending_checkout":
    case "incomplete":
    case "active":
    case "past_due":
    case "canceled_pending_expiry":
    case "canceled":
      return value;
    default:
      return "inactive";
  }
}

function normalizeAccessState(value: string): RegenerationAccessState {
  switch (value) {
    case "active":
    case "grace_period":
    case "admin_override":
      return value;
    default:
      return "inactive";
  }
}

function computeProjectionFromStripe(input: {
  stripeStatus: Stripe.Subscription.Status | null;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: Date | null;
  canceledAt: Date | null;
  isAdminOverride: boolean;
  overrideExpiresAt: Date | null;
}, now = new Date()) {
  let status: RegenerationProjectionStatus = "inactive";

  if (!input.stripeStatus) {
    status = "inactive";
  } else if (input.stripeStatus === "active" || input.stripeStatus === "trialing") {
    status = input.cancelAtPeriodEnd ? "canceled_pending_expiry" : "active";
  } else if (input.stripeStatus === "past_due" || input.stripeStatus === "unpaid") {
    status = "past_due";
  } else if (input.stripeStatus === "incomplete" || input.stripeStatus === "incomplete_expired" || input.stripeStatus === "paused") {
    status = "incomplete";
  } else if (input.stripeStatus === "canceled") {
    status = input.currentPeriodEnd && input.currentPeriodEnd.getTime() > now.getTime()
      ? "canceled_pending_expiry"
      : "canceled";
  }

  let accessState: RegenerationAccessState = "inactive";
  const currentPeriodEndMs = input.currentPeriodEnd?.getTime() ?? 0;
  const hasPaidWindow = currentPeriodEndMs > now.getTime();

  if (input.isAdminOverride && input.overrideExpiresAt && input.overrideExpiresAt.getTime() > now.getTime()) {
    accessState = "admin_override";
  } else if (status === "active") {
    accessState = "active";
  } else if ((status === "past_due" || status === "canceled_pending_expiry") && hasPaidWindow) {
    accessState = "grace_period";
  }

  return {
    status,
    accessState,
    prioritySupport: accessState !== "inactive",
    endedAt: accessState === "inactive" && (status === "canceled" || status === "inactive")
      ? (input.canceledAt ?? now)
      : null,
  };
}

function serializeProjection(row: RegenerationProjectionRow | null): RegenerationSubscriptionSummary | null {
  if (!row) {
    return null;
  }
  const status = normalizeProjectionStatus(row.status);
  const accessState = normalizeAccessState(row.accessState);
  return {
    id: row.id,
    status,
    accessState,
    hasActiveAccess: accessState !== "inactive",
    prioritySupport: row.prioritySupport,
    stripeCustomerId: row.stripeCustomerId,
    stripeSubscriptionId: row.stripeSubscriptionId,
    stripeCheckoutSessionId: row.stripeCheckoutSessionId,
    currentPeriodStart: dateToIso(row.currentPeriodStart),
    currentPeriodEnd: dateToIso(row.currentPeriodEnd),
    cancelAtPeriodEnd: row.cancelAtPeriodEnd,
    isAdminOverride: hasActiveOverride(row),
    overrideExpiresAt: dateToIso(row.overrideExpiresAt),
    lastPaymentFailedAt: dateToIso(row.lastPaymentFailedAt),
    lastCheckoutStartedAt: dateToIso(row.lastCheckoutStartedAt),
    lastReconciledAt: dateToIso(row.lastReconciledAt),
  };
}

function serializeCheckIn(row: typeof regenerationCheckIns.$inferSelect): RegenerationCheckInSummary {
  return {
    id: row.id,
    weekStart: new Date(String(row.week_start)).toISOString(),
    weekNumber: row.week_number,
    experiences: row.experiences ?? null,
    changesNoticed: row.changes_noticed ?? null,
    challenges: row.challenges ?? null,
    adminNotes: row.admin_notes ?? null,
    submittedAt: row.submitted_at.toISOString(),
  };
}

function weekStartUtc(date = new Date()) {
  const value = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = value.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  value.setUTCDate(value.getUTCDate() + diff);
  return value;
}

function resolveWeekNumber(periodStart: Date | null, submittedAt: Date) {
  if (!periodStart) {
    return 1;
  }
  const diffMs = Math.max(0, submittedAt.getTime() - periodStart.getTime());
  return Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000)) + 1;
}

async function getProjectionByUserId(db: Database, userId: string): Promise<RegenerationProjectionRow | null> {
  const [row] = await db
    .select({
      id: regenerationSubscriptions.id,
      userId: regenerationSubscriptions.user_id,
      stripeCustomerId: regenerationSubscriptions.stripe_customer_id,
      stripeSubscriptionId: regenerationSubscriptions.stripe_subscription_id,
      stripePriceId: regenerationSubscriptions.stripe_price_id,
      stripeCheckoutSessionId: regenerationSubscriptions.stripe_checkout_session_id,
      status: regenerationSubscriptions.status,
      accessState: regenerationSubscriptions.access_state,
      currentPeriodStart: regenerationSubscriptions.current_period_start,
      currentPeriodEnd: regenerationSubscriptions.current_period_end,
      cancelAtPeriodEnd: regenerationSubscriptions.cancel_at_period_end,
      canceledAt: regenerationSubscriptions.canceled_at,
      endedAt: regenerationSubscriptions.ended_at,
      prioritySupport: regenerationSubscriptions.priority_support,
      isAdminOverride: regenerationSubscriptions.is_admin_override,
      overrideExpiresAt: regenerationSubscriptions.override_expires_at,
      lastPaymentFailedAt: regenerationSubscriptions.last_payment_failed_at,
      lastCheckoutStartedAt: regenerationSubscriptions.last_checkout_started_at,
      lastReconciledAt: regenerationSubscriptions.last_reconciled_at,
      metadata: regenerationSubscriptions.metadata,
      createdAt: regenerationSubscriptions.created_at,
      updatedAt: regenerationSubscriptions.updated_at,
    })
    .from(regenerationSubscriptions)
    .where(eq(regenerationSubscriptions.user_id, userId))
    .limit(1);
  return row ?? null;
}

async function getProjectionByStripeSubscriptionId(db: Database, stripeSubscriptionId: string) {
  const [row] = await db
    .select({
      id: regenerationSubscriptions.id,
      userId: regenerationSubscriptions.user_id,
      stripeCustomerId: regenerationSubscriptions.stripe_customer_id,
      stripeSubscriptionId: regenerationSubscriptions.stripe_subscription_id,
      stripePriceId: regenerationSubscriptions.stripe_price_id,
      stripeCheckoutSessionId: regenerationSubscriptions.stripe_checkout_session_id,
      status: regenerationSubscriptions.status,
      accessState: regenerationSubscriptions.access_state,
      currentPeriodStart: regenerationSubscriptions.current_period_start,
      currentPeriodEnd: regenerationSubscriptions.current_period_end,
      cancelAtPeriodEnd: regenerationSubscriptions.cancel_at_period_end,
      canceledAt: regenerationSubscriptions.canceled_at,
      endedAt: regenerationSubscriptions.ended_at,
      prioritySupport: regenerationSubscriptions.priority_support,
      isAdminOverride: regenerationSubscriptions.is_admin_override,
      overrideExpiresAt: regenerationSubscriptions.override_expires_at,
      lastPaymentFailedAt: regenerationSubscriptions.last_payment_failed_at,
      lastCheckoutStartedAt: regenerationSubscriptions.last_checkout_started_at,
      lastReconciledAt: regenerationSubscriptions.last_reconciled_at,
      metadata: regenerationSubscriptions.metadata,
      createdAt: regenerationSubscriptions.created_at,
      updatedAt: regenerationSubscriptions.updated_at,
    })
    .from(regenerationSubscriptions)
    .where(eq(regenerationSubscriptions.stripe_subscription_id, stripeSubscriptionId))
    .limit(1);
  return row ?? null;
}

async function upsertProjection(
  db: Database,
  input: {
    userId: string;
    stripeCustomerId?: string | null;
    stripeSubscriptionId?: string | null;
    stripePriceId?: string | null;
    stripeCheckoutSessionId?: string | null;
    status: RegenerationProjectionStatus;
    accessState: RegenerationAccessState;
    currentPeriodStart?: Date | null;
    currentPeriodEnd?: Date | null;
    cancelAtPeriodEnd?: boolean;
    canceledAt?: Date | null;
    endedAt?: Date | null;
    prioritySupport?: boolean;
    isAdminOverride?: boolean;
    overrideExpiresAt?: Date | null;
    lastPaymentFailedAt?: Date | null;
    lastCheckoutStartedAt?: Date | null;
    lastReconciledAt?: Date | null;
    metadata?: Record<string, unknown> | null;
  },
) {
  const now = new Date();
  await db
    .insert(regenerationSubscriptions)
    .values({
      user_id: input.userId,
      stripe_customer_id: input.stripeCustomerId ?? null,
      stripe_subscription_id: input.stripeSubscriptionId ?? null,
      stripe_price_id: input.stripePriceId ?? null,
      stripe_checkout_session_id: input.stripeCheckoutSessionId ?? null,
      status: input.status,
      access_state: input.accessState,
      current_period_start: input.currentPeriodStart ?? null,
      current_period_end: input.currentPeriodEnd ?? null,
      cancel_at_period_end: input.cancelAtPeriodEnd ?? false,
      canceled_at: input.canceledAt ?? null,
      ended_at: input.endedAt ?? null,
      priority_support: input.prioritySupport ?? false,
      is_admin_override: input.isAdminOverride ?? false,
      override_expires_at: input.overrideExpiresAt ?? null,
      last_payment_failed_at: input.lastPaymentFailedAt ?? null,
      last_checkout_started_at: input.lastCheckoutStartedAt ?? null,
      last_reconciled_at: input.lastReconciledAt ?? null,
      metadata: input.metadata ?? null,
      created_at: now,
      updated_at: now,
    })
    .onConflictDoUpdate({
      target: regenerationSubscriptions.user_id,
      set: {
        stripe_customer_id: input.stripeCustomerId ?? null,
        stripe_subscription_id: input.stripeSubscriptionId ?? null,
        stripe_price_id: input.stripePriceId ?? null,
        stripe_checkout_session_id: input.stripeCheckoutSessionId ?? null,
        status: input.status,
        access_state: input.accessState,
        current_period_start: input.currentPeriodStart ?? null,
        current_period_end: input.currentPeriodEnd ?? null,
        cancel_at_period_end: input.cancelAtPeriodEnd ?? false,
        canceled_at: input.canceledAt ?? null,
        ended_at: input.endedAt ?? null,
        priority_support: input.prioritySupport ?? false,
        is_admin_override: input.isAdminOverride ?? false,
        override_expires_at: input.overrideExpiresAt ?? null,
        last_payment_failed_at: input.lastPaymentFailedAt ?? null,
        last_checkout_started_at: input.lastCheckoutStartedAt ?? null,
        last_reconciled_at: input.lastReconciledAt ?? null,
        metadata: input.metadata ?? null,
        updated_at: now,
      },
    });

  return getProjectionByUserId(db, input.userId);
}

async function getLatestPendingPayment(db: Database, regenerationSubscriptionId: string) {
  const [payment] = await db
    .select({
      id: payments.id,
      status: payments.status,
      metadata: payments.metadata,
    })
    .from(payments)
    .where(and(
      eq(payments.entity_type, "regeneration_subscription"),
      eq(payments.entity_id, regenerationSubscriptionId),
    ))
    .orderBy(desc(payments.created_at))
    .limit(1);
  return payment ?? null;
}

async function ensureLocalUserExists(db: Database, userId: string) {
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user) {
    throw createHttpError(404, "User not found");
  }
}

async function getUserEmail(db: Database, userId: string) {
  const [user] = await db
    .select({ email: users.email, clerkId: users.clerk_id })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user) {
    throw createHttpError(404, "User not found");
  }
  return user;
}

function buildOrderMetadata(input: {
  projection: RegenerationProjectionRow;
  invoiceId: string;
  subscriptionStatus: RegenerationProjectionStatus;
  accessState: RegenerationAccessState;
  paymentStatus: "completed" | "failed";
}) {
  return {
    plan_name: REGENERATION_PLAN_NAME,
    billing_cycle: "monthly",
    renewal_date: dateToIso(input.projection.currentPeriodEnd),
    stripe_subscription_id: input.projection.stripeSubscriptionId,
    subscriptionStatus: input.subscriptionStatus,
    accessState: input.accessState,
    prioritySupport: input.projection.prioritySupport,
    isAdminOverride: hasActiveOverride(input.projection),
    overrideExpiresAt: dateToIso(input.projection.overrideExpiresAt),
    order_variant: REGENERATION_PRODUCT_KEY,
    invoice_label: REGENERATION_PLAN_NAME,
    stripeInvoiceId: input.invoiceId,
    paymentStatus: input.paymentStatus,
  };
}

async function upsertOrderFromInvoice(
  db: Database,
  input: {
    projection: RegenerationProjectionRow;
    invoice: Stripe.Invoice;
    status: "completed" | "failed";
    subscriptionStatus: RegenerationProjectionStatus;
    accessState: RegenerationAccessState;
  },
) {
  const paymentReference = input.invoice.id;
  const paymentIntentId = stripeRef((input.invoice as Stripe.Invoice & { payment_intent?: unknown }).payment_intent);
  const existing = await db
    .select({ id: orders.id })
    .from(orders)
    .where(eq(orders.payment_reference, paymentReference))
    .limit(1);

  const orderType = input.invoice.billing_reason === "subscription_cycle" ? "subscription_renewal" : "subscription_initial";
  const metadata = buildOrderMetadata({
    projection: input.projection,
    invoiceId: input.invoice.id,
    subscriptionStatus: input.subscriptionStatus,
    accessState: input.accessState,
    paymentStatus: input.status,
  });

  if (existing[0]?.id) {
    await db
      .update(orders)
      .set({
        subscription_id: input.projection.id,
        type: orderType,
        label: REGENERATION_PLAN_NAME,
        amount: input.invoice.amount_paid || input.invoice.amount_due || 9900,
        currency: (input.invoice.currency ?? "cad").toUpperCase(),
        status: input.status,
        stripe_payment_intent_id: paymentIntentId,
        stripe_subscription_id: input.projection.stripeSubscriptionId,
        metadata,
        updated_at: new Date(),
      })
      .where(eq(orders.id, existing[0].id));
    return;
  }

  await db.insert(orders).values({
    user_id: input.projection.userId,
    subscription_id: input.projection.id,
    type: orderType,
    label: REGENERATION_PLAN_NAME,
    amount: input.invoice.amount_paid || input.invoice.amount_due || 9900,
    currency: (input.invoice.currency ?? "cad").toUpperCase(),
    status: input.status,
    payment_reference: paymentReference,
    stripe_payment_intent_id: paymentIntentId,
    stripe_subscription_id: input.projection.stripeSubscriptionId,
    metadata,
  });
}

async function ensureStripeCustomerMapping(db: Database, userId: string, stripeCustomerId: string) {
  await db
    .insert(stripeCustomers)
    .values({
      user_id: userId,
      stripe_customer_id: stripeCustomerId,
    })
    .onConflictDoUpdate({
      target: stripeCustomers.user_id,
      set: {
        stripe_customer_id: stripeCustomerId,
      },
    });
}

async function resolveProjectionForMetadata(
  db: Database,
  input: {
    userId: string | null;
    stripeSubscriptionId: string | null;
    regenerationSubscriptionId: string | null;
  },
) {
  if (input.userId) {
    const row = await getProjectionByUserId(db, input.userId);
    if (row) {
      return row;
    }
  }
  if (input.stripeSubscriptionId) {
    const row = await getProjectionByStripeSubscriptionId(db, input.stripeSubscriptionId);
    if (row) {
      return row;
    }
  }
  if (input.regenerationSubscriptionId) {
    const [row] = await db
      .select({
        id: regenerationSubscriptions.id,
        userId: regenerationSubscriptions.user_id,
        stripeCustomerId: regenerationSubscriptions.stripe_customer_id,
        stripeSubscriptionId: regenerationSubscriptions.stripe_subscription_id,
        stripePriceId: regenerationSubscriptions.stripe_price_id,
        stripeCheckoutSessionId: regenerationSubscriptions.stripe_checkout_session_id,
        status: regenerationSubscriptions.status,
        accessState: regenerationSubscriptions.access_state,
        currentPeriodStart: regenerationSubscriptions.current_period_start,
        currentPeriodEnd: regenerationSubscriptions.current_period_end,
        cancelAtPeriodEnd: regenerationSubscriptions.cancel_at_period_end,
        canceledAt: regenerationSubscriptions.canceled_at,
        endedAt: regenerationSubscriptions.ended_at,
        prioritySupport: regenerationSubscriptions.priority_support,
        isAdminOverride: regenerationSubscriptions.is_admin_override,
        overrideExpiresAt: regenerationSubscriptions.override_expires_at,
        lastPaymentFailedAt: regenerationSubscriptions.last_payment_failed_at,
        lastCheckoutStartedAt: regenerationSubscriptions.last_checkout_started_at,
        lastReconciledAt: regenerationSubscriptions.last_reconciled_at,
        metadata: regenerationSubscriptions.metadata,
        createdAt: regenerationSubscriptions.created_at,
        updatedAt: regenerationSubscriptions.updated_at,
      })
      .from(regenerationSubscriptions)
      .where(eq(regenerationSubscriptions.id, input.regenerationSubscriptionId))
      .limit(1);
    return row ?? null;
  }
  return null;
}

export function isRegenerationSubscriptionMetadata(metadata: Record<string, string> | Stripe.Metadata | null | undefined) {
  const type = typeof metadata?.type === "string" ? metadata.type.trim() : "";
  const productKey = typeof metadata?.productKey === "string" ? metadata.productKey.trim() : "";
  return type === "regeneration_subscription" || productKey === REGENERATION_PRODUCT_KEY;
}

export async function getRegenerationSubscriptionSummary(db: Database, userId: string) {
  return serializeProjection(await getProjectionByUserId(db, userId));
}

export async function createRegenerationCheckoutSession(
  db: Database,
  input: {
    userId: string;
    clerkId: string;
  },
) {
  await ensureLocalUserExists(db, input.userId);
  const existing = await getProjectionByUserId(db, input.userId);
  if (existing && normalizeAccessState(existing.accessState) !== "inactive") {
    throw createHttpError(409, "Your regeneration access is already active.");
  }

  const stripe = getStripe();
  const user = await getUserEmail(db, input.userId);
  const stripeCustomerId = await ensureStripeCustomerId(db, {
    stripe,
    userId: input.userId,
    email: user.email,
    metadata: {
      userId: input.userId,
      clerkId: input.clerkId,
      productKey: REGENERATION_PRODUCT_KEY,
    },
  });
  const priceId = getRegenerationStripePriceId();
  const frontendUrl = process.env.FRONTEND_URL?.trim() || process.env.APP_URL?.trim() || "http://localhost:3000";
  const lastCheckoutStartedAt = new Date();
  const createdOrUpdated = await upsertProjection(db, {
    userId: input.userId,
    stripeCustomerId,
    stripeSubscriptionId: existing?.stripeSubscriptionId ?? null,
    stripePriceId: priceId,
    stripeCheckoutSessionId: null,
    status: "pending_checkout",
    accessState: "inactive",
    currentPeriodStart: existing?.currentPeriodStart ?? null,
    currentPeriodEnd: existing?.currentPeriodEnd ?? null,
    cancelAtPeriodEnd: existing?.cancelAtPeriodEnd ?? false,
    canceledAt: existing?.canceledAt ?? null,
    endedAt: existing?.endedAt ?? null,
    prioritySupport: existing ? hasActiveOverride(existing) : false,
    isAdminOverride: existing?.isAdminOverride ?? false,
    overrideExpiresAt: existing?.overrideExpiresAt ?? null,
    lastPaymentFailedAt: existing?.lastPaymentFailedAt ?? null,
    lastCheckoutStartedAt,
    lastReconciledAt: existing?.lastReconciledAt ?? null,
    metadata: {
      ...(parseObject(existing?.metadata) ?? {}),
      productKey: REGENERATION_PRODUCT_KEY,
      planName: REGENERATION_PLAN_NAME,
      checkoutSource: "regeneration_monthly_landing",
    },
  });

  if (!createdOrUpdated) {
    throw createHttpError(500, "Regeneration checkout could not be prepared");
  }

  const payment = await getLatestPendingPayment(db, createdOrUpdated.id);
  if (!payment || payment.status === "failed" || payment.status === "refunded") {
    await createPaymentRecordForEntity(db, {
      userId: input.userId,
      entityType: "regeneration_subscription",
      entityId: createdOrUpdated.id,
      amountCents: 9900,
      currency: "CAD",
      status: "pending",
      metadata: {
        source: "regeneration_checkout_create",
        planName: REGENERATION_PLAN_NAME,
        productKey: REGENERATION_PRODUCT_KEY,
      },
    });
  }

  const metadata = {
    userId: input.userId,
    userEmail: user.email,
    clerkId: input.clerkId,
    type: "regeneration_subscription",
    entityType: "regeneration_subscription",
    entityId: createdOrUpdated.id,
    regenerationSubscriptionId: createdOrUpdated.id,
    productKey: REGENERATION_PRODUCT_KEY,
    planName: REGENERATION_PLAN_NAME,
  };

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    mode: "subscription",
    client_reference_id: createdOrUpdated.id,
    line_items: [{ price: priceId, quantity: 1 }],
    metadata,
    subscription_data: { metadata },
    success_url: `${frontendUrl}/dashboard?success=regeneration&regenerationSubscriptionId=${encodeURIComponent(createdOrUpdated.id)}&checkoutSessionId={CHECKOUT_SESSION_ID}`,
    cancel_url: `${frontendUrl}/sessions/regeneration?checkout=canceled`,
    customer: stripeCustomerId,
  });

  await upsertProjection(db, {
    userId: input.userId,
    stripeCustomerId,
    stripeSubscriptionId: createdOrUpdated.stripeSubscriptionId,
    stripePriceId: priceId,
    stripeCheckoutSessionId: session.id,
    status: "pending_checkout",
    accessState: "inactive",
    currentPeriodStart: createdOrUpdated.currentPeriodStart,
    currentPeriodEnd: createdOrUpdated.currentPeriodEnd,
    cancelAtPeriodEnd: createdOrUpdated.cancelAtPeriodEnd,
    canceledAt: createdOrUpdated.canceledAt,
    endedAt: createdOrUpdated.endedAt,
    prioritySupport: createdOrUpdated.prioritySupport,
    isAdminOverride: createdOrUpdated.isAdminOverride,
    overrideExpiresAt: createdOrUpdated.overrideExpiresAt,
    lastPaymentFailedAt: createdOrUpdated.lastPaymentFailedAt,
    lastCheckoutStartedAt,
    lastReconciledAt: createdOrUpdated.lastReconciledAt,
    metadata: {
      ...(parseObject(createdOrUpdated.metadata) ?? {}),
      stripeCheckoutSessionId: session.id,
      stripePriceId: priceId,
      planName: REGENERATION_PLAN_NAME,
      productKey: REGENERATION_PRODUCT_KEY,
    },
  });

  const refreshedPayment = await getLatestPendingPayment(db, createdOrUpdated.id);
  if (refreshedPayment?.id) {
    await db
      .update(payments)
      .set({
        metadata: {
          ...(parseObject(refreshedPayment.metadata) ?? {}),
          stripeCheckoutSessionId: session.id,
          stripeCheckoutMode: session.mode,
          stripeCheckoutUrl: session.url,
          stripePriceId: priceId,
          planName: REGENERATION_PLAN_NAME,
          productKey: REGENERATION_PRODUCT_KEY,
        },
        updated_at: new Date(),
      })
      .where(eq(payments.id, refreshedPayment.id));
  }

  return {
    sessionId: session.id,
    url: session.url,
    subscription: serializeProjection(await getProjectionByUserId(db, input.userId)),
  };
}

export async function reconcileRegenerationSubscriptionFromStripeObject(
  db: Database,
  subscription: Stripe.Subscription,
  logger?: ServiceLogger,
) {
  const stripeSubscriptionId = subscription.id;
  const stripeCustomerId = stripeRef(subscription.customer);
  if (!stripeCustomerId) {
    throw createHttpError(400, "Stripe subscription is missing a customer");
  }

  const existing = await getProjectionByStripeSubscriptionId(db, stripeSubscriptionId);
  const metadataUserId = getString(subscription.metadata?.userId);
  const targetUserId = existing?.userId ?? metadataUserId;
  if (!targetUserId) {
    throw createHttpError(404, "No local user is associated with this regeneration subscription");
  }

  const activeItem = subscription.items.data[0];
  const currentPeriodStart = unixToDate(activeItem?.current_period_start);
  const currentPeriodEnd = unixToDate(activeItem?.current_period_end);
  const canceledAt = unixToDate(subscription.canceled_at);
  const projection = computeProjectionFromStripe({
    stripeStatus: subscription.status,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    currentPeriodEnd,
    canceledAt,
    isAdminOverride: existing?.isAdminOverride ?? false,
    overrideExpiresAt: existing?.overrideExpiresAt ?? null,
  });

  const updated = await upsertProjection(db, {
    userId: targetUserId,
    stripeCustomerId,
    stripeSubscriptionId,
    stripePriceId: activeItem?.price?.id ?? existing?.stripePriceId ?? null,
    stripeCheckoutSessionId: existing?.stripeCheckoutSessionId ?? null,
    status: projection.status,
    accessState: projection.accessState,
    currentPeriodStart,
    currentPeriodEnd,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    canceledAt,
    endedAt: projection.endedAt,
    prioritySupport: projection.prioritySupport,
    isAdminOverride: existing?.isAdminOverride ?? false,
    overrideExpiresAt: existing?.overrideExpiresAt ?? null,
    lastPaymentFailedAt: existing?.lastPaymentFailedAt ?? null,
    lastCheckoutStartedAt: existing?.lastCheckoutStartedAt ?? null,
    lastReconciledAt: new Date(),
    metadata: {
      ...(parseObject(existing?.metadata) ?? {}),
      latestStripeStatus: subscription.status,
      productKey: REGENERATION_PRODUCT_KEY,
      planName: REGENERATION_PLAN_NAME,
    },
  });

  await ensureStripeCustomerMapping(db, targetUserId, stripeCustomerId);
  log(logger, "info", { userId: targetUserId, stripeSubscriptionId, status: projection.status }, "regeneration_subscription_reconciled");
  return updated;
}

export async function reconcileRegenerationSubscriptionFromStripeId(
  db: Database,
  stripeSubscriptionId: string,
  logger?: ServiceLogger,
) {
  const stripe = getStripe();
  const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
  return reconcileRegenerationSubscriptionFromStripeObject(db, subscription, logger);
}

export async function confirmRegenerationCheckoutSession(
  db: Database,
  input: {
    userId: string;
    checkoutSessionId: string;
  },
  logger?: ServiceLogger,
) {
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(input.checkoutSessionId, { expand: ["subscription"] });
  const metadataUserId = getString(session.metadata?.userId);
  if (metadataUserId && metadataUserId !== input.userId) {
    throw createHttpError(403, "This checkout session does not belong to the authenticated user");
  }
  const subscription = session.subscription;
  if (subscription && typeof subscription !== "string") {
    await reconcileRegenerationSubscriptionFromStripeObject(db, subscription, logger);
  } else if (typeof subscription === "string") {
    await reconcileRegenerationSubscriptionFromStripeId(db, subscription, logger);
  }
  return {
    sessionId: session.id,
    paymentStatus: session.payment_status ?? null,
    mode: session.mode ?? null,
    subscription: await getRegenerationSubscriptionSummary(db, input.userId),
  };
}

export async function handleRegenerationCheckoutSessionCompleted(
  db: Database,
  session: Stripe.Checkout.Session,
  logger?: ServiceLogger,
) {
  if (!isRegenerationSubscriptionMetadata(session.metadata)) {
    return false;
  }

  const userId = getString(session.metadata?.userId);
  const regenerationSubscriptionId = getString(session.metadata?.regenerationSubscriptionId);
  const stripeCustomerId = stripeRef(session.customer);
  const stripeSubscriptionId = stripeRef(session.subscription);

  if (!userId) {
    log(logger, "warn", { checkoutSessionId: session.id }, "regeneration_checkout_missing_user");
    return true;
  }

  const existing = await resolveProjectionForMetadata(db, {
    userId,
    stripeSubscriptionId,
    regenerationSubscriptionId,
  });
  const updated = await upsertProjection(db, {
    userId,
    stripeCustomerId: stripeCustomerId ?? existing?.stripeCustomerId ?? null,
    stripeSubscriptionId: stripeSubscriptionId ?? existing?.stripeSubscriptionId ?? null,
    stripePriceId: getString(session.metadata?.stripePriceId) ?? existing?.stripePriceId ?? null,
    stripeCheckoutSessionId: session.id,
    status: existing ? normalizeProjectionStatus(existing.status) : "pending_checkout",
    accessState: existing ? normalizeAccessState(existing.accessState) : "inactive",
    currentPeriodStart: existing?.currentPeriodStart ?? null,
    currentPeriodEnd: existing?.currentPeriodEnd ?? null,
    cancelAtPeriodEnd: existing?.cancelAtPeriodEnd ?? false,
    canceledAt: existing?.canceledAt ?? null,
    endedAt: existing?.endedAt ?? null,
    prioritySupport: existing?.prioritySupport ?? false,
    isAdminOverride: existing?.isAdminOverride ?? false,
    overrideExpiresAt: existing?.overrideExpiresAt ?? null,
    lastPaymentFailedAt: existing?.lastPaymentFailedAt ?? null,
    lastCheckoutStartedAt: existing?.lastCheckoutStartedAt ?? new Date(),
    lastReconciledAt: existing?.lastReconciledAt ?? null,
    metadata: {
      ...(parseObject(existing?.metadata) ?? {}),
      stripeCheckoutSessionId: session.id,
      productKey: REGENERATION_PRODUCT_KEY,
      planName: REGENERATION_PLAN_NAME,
    },
  });

  if (!updated) {
    return true;
  }

  if (stripeCustomerId) {
    await ensureStripeCustomerMapping(db, userId, stripeCustomerId);
  }

  const payment = await getLatestPendingPayment(db, updated.id);
  if (payment?.id && payment.status !== "paid") {
    await markPaymentPaidFromWebhook(db, {
      paymentId: payment.id,
      providerPaymentIntentId: stripeRef(session.payment_intent),
      providerCustomerId: stripeCustomerId,
      metadata: {
        ...(parseObject(payment.metadata) ?? {}),
        stripeCheckoutSessionId: session.id,
        stripeSubscriptionId,
        source: "regeneration_checkout_completed",
      },
    });
  }

  log(logger, "info", {
    checkoutSessionId: session.id,
    userId,
    stripeCustomerId,
    stripeSubscriptionId,
  }, "regeneration_checkout_session_recorded");

  return true;
}

export async function handleRegenerationInvoicePaid(
  db: Database,
  invoice: Stripe.Invoice,
  logger?: ServiceLogger,
) {
  const stripeSubscriptionId = stripeRef((invoice as Stripe.Invoice & { subscription?: unknown }).subscription);
  if (!stripeSubscriptionId) {
    return false;
  }
  const updated = await reconcileRegenerationSubscriptionFromStripeId(db, stripeSubscriptionId, logger);
  if (!updated) {
    return true;
  }
  const projection = computeProjectionFromStripe({
    stripeStatus: "active",
    cancelAtPeriodEnd: updated.cancelAtPeriodEnd,
    currentPeriodEnd: updated.currentPeriodEnd,
    canceledAt: updated.canceledAt,
    isAdminOverride: updated.isAdminOverride,
    overrideExpiresAt: updated.overrideExpiresAt,
  });
  await upsertOrderFromInvoice(db, {
    projection: updated,
    invoice,
    status: "completed",
    subscriptionStatus: projection.status,
    accessState: projection.accessState,
  });
  return true;
}

export async function handleRegenerationInvoicePaymentFailed(
  db: Database,
  invoice: Stripe.Invoice,
  logger?: ServiceLogger,
) {
  const stripeSubscriptionId = stripeRef((invoice as Stripe.Invoice & { subscription?: unknown }).subscription);
  if (!stripeSubscriptionId) {
    return false;
  }
  const updated = await reconcileRegenerationSubscriptionFromStripeId(db, stripeSubscriptionId, logger);
  if (!updated) {
    return true;
  }
  await upsertProjection(db, {
    userId: updated.userId,
    stripeCustomerId: updated.stripeCustomerId,
    stripeSubscriptionId: updated.stripeSubscriptionId,
    stripePriceId: updated.stripePriceId,
    stripeCheckoutSessionId: updated.stripeCheckoutSessionId,
    status: normalizeProjectionStatus(updated.status),
    accessState: normalizeAccessState(updated.accessState),
    currentPeriodStart: updated.currentPeriodStart,
    currentPeriodEnd: updated.currentPeriodEnd,
    cancelAtPeriodEnd: updated.cancelAtPeriodEnd,
    canceledAt: updated.canceledAt,
    endedAt: updated.endedAt,
    prioritySupport: updated.prioritySupport,
    isAdminOverride: updated.isAdminOverride,
    overrideExpiresAt: updated.overrideExpiresAt,
    lastPaymentFailedAt: new Date(),
    lastCheckoutStartedAt: updated.lastCheckoutStartedAt,
    lastReconciledAt: new Date(),
    metadata: {
      ...(parseObject(updated.metadata) ?? {}),
      lastFailedInvoiceId: invoice.id,
    },
  });
  const refreshed = await getProjectionByUserId(db, updated.userId);
  if (!refreshed) {
    return true;
  }
  await upsertOrderFromInvoice(db, {
    projection: refreshed,
    invoice,
    status: "failed",
    subscriptionStatus: normalizeProjectionStatus(refreshed.status),
    accessState: normalizeAccessState(refreshed.accessState),
  });
  return true;
}

export async function handleRegenerationSubscriptionUpdated(
  db: Database,
  subscription: Stripe.Subscription,
  logger?: ServiceLogger,
) {
  if (!isRegenerationSubscriptionMetadata(subscription.metadata)) {
    const existing = await getProjectionByStripeSubscriptionId(db, subscription.id);
    if (!existing) {
      return false;
    }
  }
  await reconcileRegenerationSubscriptionFromStripeObject(db, subscription, logger);
  return true;
}

export async function handleRegenerationSubscriptionDeleted(
  db: Database,
  subscription: Stripe.Subscription,
  logger?: ServiceLogger,
) {
  const existing = await getProjectionByStripeSubscriptionId(db, subscription.id);
  if (!existing && !isRegenerationSubscriptionMetadata(subscription.metadata)) {
    return false;
  }
  await reconcileRegenerationSubscriptionFromStripeObject(db, {
    ...subscription,
    status: "canceled",
  }, logger);
  return true;
}

export async function setRegenerationAdminOverride(
  db: Database,
  input: {
    userId: string;
    enabled: boolean;
    durationDays?: number;
  },
) {
  const existing = await getProjectionByUserId(db, input.userId);
  const now = new Date();
  const overrideExpiresAt = input.enabled
    ? new Date(now.getTime() + Math.max(1, Math.min(input.durationDays ?? 7, 90)) * 24 * 60 * 60 * 1000)
    : null;
  const nextBase = computeProjectionFromStripe({
    stripeStatus: existing?.status === "active"
      ? "active"
      : existing?.status === "past_due"
        ? "past_due"
        : existing?.status === "canceled_pending_expiry"
          ? "canceled"
          : null,
    cancelAtPeriodEnd: existing?.cancelAtPeriodEnd ?? false,
    currentPeriodEnd: existing?.currentPeriodEnd ?? null,
    canceledAt: existing?.canceledAt ?? null,
    isAdminOverride: input.enabled,
    overrideExpiresAt,
  });
  const updated = await upsertProjection(db, {
    userId: input.userId,
    stripeCustomerId: existing?.stripeCustomerId ?? null,
    stripeSubscriptionId: existing?.stripeSubscriptionId ?? null,
    stripePriceId: existing?.stripePriceId ?? null,
    stripeCheckoutSessionId: existing?.stripeCheckoutSessionId ?? null,
    status: existing ? normalizeProjectionStatus(existing.status) : "inactive",
    accessState: nextBase.accessState,
    currentPeriodStart: existing?.currentPeriodStart ?? null,
    currentPeriodEnd: existing?.currentPeriodEnd ?? null,
    cancelAtPeriodEnd: existing?.cancelAtPeriodEnd ?? false,
    canceledAt: existing?.canceledAt ?? null,
    endedAt: existing?.endedAt ?? null,
    prioritySupport: nextBase.prioritySupport,
    isAdminOverride: input.enabled,
    overrideExpiresAt,
    lastPaymentFailedAt: existing?.lastPaymentFailedAt ?? null,
    lastCheckoutStartedAt: existing?.lastCheckoutStartedAt ?? null,
    lastReconciledAt: existing?.lastReconciledAt ?? null,
    metadata: {
      ...(parseObject(existing?.metadata) ?? {}),
      adminOverrideUpdatedAt: now.toISOString(),
    },
  });
  return serializeProjection(updated);
}

export async function reconcileRegenerationSubscriptionForUser(
  db: Database,
  userId: string,
  logger?: ServiceLogger,
) {
  const existing = await getProjectionByUserId(db, userId);
  if (!existing?.stripeSubscriptionId) {
    throw createHttpError(404, "No Stripe regeneration subscription is linked to this user yet");
  }
  const updated = await reconcileRegenerationSubscriptionFromStripeId(db, existing.stripeSubscriptionId, logger);
  return serializeProjection(updated);
}

export async function listRegenerationCheckIns(db: Database, userId: string) {
  const rows = await db
    .select()
    .from(regenerationCheckIns)
    .where(eq(regenerationCheckIns.user_id, userId))
    .orderBy(desc(regenerationCheckIns.week_start), desc(regenerationCheckIns.created_at))
    .limit(12);
  return rows.map(serializeCheckIn);
}

export async function submitRegenerationCheckIn(
  db: Database,
  input: {
    userId: string;
    experiences?: string | null;
    changesNoticed?: string | null;
    challenges?: string | null;
  },
) {
  const projection = await getProjectionByUserId(db, input.userId);
  if (!projection || normalizeAccessState(projection.accessState) === "inactive") {
    throw createHttpError(403, "Active regeneration access is required before submitting a weekly check-in");
  }
  const submittedAt = new Date();
  const weekStart = weekStartUtc(submittedAt);
  const weekNumber = resolveWeekNumber(projection.currentPeriodStart, submittedAt);
  await db
    .insert(regenerationCheckIns)
    .values({
      subscription_id: projection.id,
      user_id: input.userId,
      week_start: weekStart.toISOString().slice(0, 10),
      week_number: weekNumber,
      experiences: getString(input.experiences) ?? null,
      changes_noticed: getString(input.changesNoticed) ?? null,
      challenges: getString(input.challenges) ?? null,
      submitted_at: submittedAt,
      created_at: submittedAt,
      updated_at: submittedAt,
    })
    .onConflictDoUpdate({
      target: [regenerationCheckIns.user_id, regenerationCheckIns.week_start],
      set: {
        subscription_id: projection.id,
        week_number: weekNumber,
        experiences: getString(input.experiences) ?? null,
        changes_noticed: getString(input.changesNoticed) ?? null,
        challenges: getString(input.challenges) ?? null,
        submitted_at: submittedAt,
        updated_at: submittedAt,
      },
    });

  const [saved] = await db
    .select()
    .from(regenerationCheckIns)
    .where(and(
      eq(regenerationCheckIns.user_id, input.userId),
      eq(regenerationCheckIns.week_start, weekStart.toISOString().slice(0, 10)),
    ))
    .limit(1);

  if (!saved) {
    throw createHttpError(500, "Weekly check-in could not be saved");
  }
  return serializeCheckIn(saved);
}
