import Stripe from "stripe";
import { desc, eq, or } from "drizzle-orm";
import {
  memberEntitlements,
  regenerationSubscriptions,
  subscriptionAdminAuditEntries,
  subscriptionAdminNotes,
  subscriptions,
  users,
  type Database,
} from "@wisdom/db";
import { logger } from "@wisdom/utils";
import { createHttpError } from "./booking/errors.js";
import { syncEntitlementFromStoredSubscription } from "./divin8/entitlementService.js";

export type AdminSubscriptionKind = "membership" | "regeneration";
export type SubscriptionActorType = "admin" | "system" | "webhook" | "stripe";
export type AdminSubscriptionAction =
  | "cancel_period_end"
  | "cancel_immediately"
  | "reactivate_subscription"
  | "pause_subscription"
  | "resume_subscription"
  | "extend_renewal"
  | "grant_courtesy_month"
  | "retry_payment"
  | "send_manual_invoice"
  | "extend_regeneration_access"
  | "toggle_regeneration_priority_support"
  | "set_regeneration_grace_period"
  | "emergency_reactivate_regeneration"
  | "admin_note_added";

interface ActionInput {
  subscriptionId: string;
  actorUserId: string;
  reason?: string | null;
}

interface DayActionInput extends ActionInput {
  days: number;
}

interface TogglePriorityInput extends ActionInput {
  enabled: boolean;
}

interface PauseInput extends ActionInput {
  resumesAt?: string | null;
}

interface ActorContext {
  actorType: SubscriptionActorType;
  actorUserId: string | null;
  actorLabel: string | null;
}

interface SubscriptionIdentity {
  kind: AdminSubscriptionKind;
  id: string;
  userId: string;
  stripeSubscriptionId: string | null;
  status: string;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: Date | null;
  metadata: Record<string, unknown>;
  regenerationAccessState?: string;
  regenerationPrioritySupport?: boolean;
  regenerationCanceledAt?: Date | null;
  regenerationEndedAt?: Date | null;
  tier?: string | null;
}

export interface SubscriptionTimelineEntry {
  id: string;
  timestamp: string;
  action: string;
  actorType: SubscriptionActorType;
  actorLabel: string | null;
  adminUserId: string | null;
  previousStatus: string | null;
  newStatus: string | null;
  reason: string | null;
  source: "audit" | "note";
}

export interface SubscriptionAdminNoteSummary {
  id: string;
  note: string;
  adminUserId: string | null;
  createdAt: string;
}

let stripeInstance: Stripe | null = null;

function getStripe(): Stripe {
  if (!stripeInstance) {
    const key = process.env.STRIPE_SECRET_KEY?.trim();
    if (!key) {
      throw createHttpError(503, "Stripe is not configured");
    }
    stripeInstance = new Stripe(key);
  }
  return stripeInstance;
}

function parseObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function normalizeReason(reason: string | null | undefined) {
  const trimmed = reason?.trim() ?? "";
  return trimmed ? trimmed : null;
}

function requireReason(reason: string | null | undefined, actionLabel: string) {
  const normalized = normalizeReason(reason);
  if (!normalized) {
    throw createHttpError(400, `${actionLabel} requires an admin action reason.`);
  }
  return normalized;
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function normalizeDays(value: number, actionLabel: string, max = 365) {
  if (!Number.isInteger(value) || value < 1 || value > max) {
    throw createHttpError(400, `${actionLabel} days must be between 1 and ${max}.`);
  }
  return value;
}

function dateToIso(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

function unixToDate(value: number | null | undefined) {
  return value ? new Date(value * 1000) : null;
}

function extractPeriodStart(subscription: Stripe.Subscription) {
  return unixToDate(subscription.items.data[0]?.current_period_start);
}

function extractPeriodEnd(subscription: Stripe.Subscription) {
  return unixToDate(subscription.items.data[0]?.current_period_end);
}

function getPauseCollection(subscription: Stripe.Subscription) {
  return subscription.pause_collection
    ? {
      behavior: subscription.pause_collection.behavior,
      resumesAt: unixToDate(subscription.pause_collection.resumes_at)?.toISOString() ?? null,
    }
    : null;
}

function snapshotStripeSubscription(subscription: Stripe.Subscription | null) {
  if (!subscription) return null;
  return {
    id: subscription.id,
    status: subscription.status,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    canceledAt: unixToDate(subscription.canceled_at)?.toISOString() ?? null,
    currentPeriodStart: dateToIso(extractPeriodStart(subscription)),
    currentPeriodEnd: dateToIso(extractPeriodEnd(subscription)),
    pauseCollection: getPauseCollection(subscription),
    latestInvoice: typeof subscription.latest_invoice === "string"
      ? subscription.latest_invoice
      : subscription.latest_invoice?.id ?? null,
  };
}

function buildMetadata(
  action: AdminSubscriptionAction,
  input: Record<string, unknown>,
  stripeSubscription: Stripe.Subscription | null,
  extra: Record<string, unknown> = {},
) {
  return {
    action,
    payload: input,
    stripeSubscription: snapshotStripeSubscription(stripeSubscription),
    ...extra,
  };
}

async function buildActorContext(db: Database, actorUserId: string): Promise<ActorContext> {
  const [actor] = await db
    .select({ id: users.id, email: users.email, role: users.role })
    .from(users)
    .where(eq(users.id, actorUserId))
    .limit(1);

  return {
    actorType: "admin",
    actorUserId,
    actorLabel: actor?.email ?? actor?.role ?? "Admin",
  };
}

async function resolveSubscription(db: Database, subscriptionId: string): Promise<SubscriptionIdentity> {
  const [membership] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.id, subscriptionId))
    .limit(1);

  if (membership) {
    return {
      kind: "membership",
      id: membership.id,
      userId: membership.user_id,
      stripeSubscriptionId: membership.stripe_subscription_id,
      status: membership.status,
      cancelAtPeriodEnd: membership.cancel_at_period_end,
      currentPeriodEnd: membership.current_period_end,
      metadata: parseObject(membership.metadata),
      tier: membership.tier,
    };
  }

  const [regeneration] = await db
    .select()
    .from(regenerationSubscriptions)
    .where(eq(regenerationSubscriptions.id, subscriptionId))
    .limit(1);

  if (regeneration) {
    return {
      kind: "regeneration",
      id: regeneration.id,
      userId: regeneration.user_id,
      stripeSubscriptionId: regeneration.stripe_subscription_id,
      status: regeneration.status,
      cancelAtPeriodEnd: regeneration.cancel_at_period_end,
      currentPeriodEnd: regeneration.current_period_end,
      metadata: parseObject(regeneration.metadata),
      regenerationAccessState: regeneration.access_state,
      regenerationPrioritySupport: regeneration.priority_support,
      regenerationCanceledAt: regeneration.canceled_at,
      regenerationEndedAt: regeneration.ended_at,
    };
  }

  throw createHttpError(404, "Subscription not found");
}

function requireStripeSubscriptionId(identity: SubscriptionIdentity) {
  if (!identity.stripeSubscriptionId) {
    throw createHttpError(400, "This subscription is not connected to Stripe.");
  }
  return identity.stripeSubscriptionId;
}

function auditIdentity(identity: SubscriptionIdentity) {
  return {
    subscription_kind: identity.kind,
    membership_subscription_id: identity.kind === "membership" ? identity.id : null,
    regeneration_subscription_id: identity.kind === "regeneration" ? identity.id : null,
    stripe_subscription_id: identity.stripeSubscriptionId,
  };
}

async function insertAuditEntry(
  db: Database,
  identity: SubscriptionIdentity,
  actor: ActorContext,
  input: {
    action: AdminSubscriptionAction;
    previousStatus: string | null;
    newStatus: string | null;
    reason?: string | null;
    metadata?: Record<string, unknown>;
  },
) {
  await db.insert(subscriptionAdminAuditEntries).values({
    ...auditIdentity(identity),
    admin_user_id: actor.actorUserId,
    actor_type: actor.actorType,
    actor_label: actor.actorLabel,
    action_type: input.action,
    previous_status: input.previousStatus,
    new_status: input.newStatus,
    reason: normalizeReason(input.reason),
    metadata: input.metadata ?? null,
  });
}

async function syncMembershipEntitlement(db: Database, identity: SubscriptionIdentity) {
  if (identity.kind !== "membership" || !identity.stripeSubscriptionId) {
    return;
  }
  await syncEntitlementFromStoredSubscription(db, identity.stripeSubscriptionId, {
    warn: (payload, message) => logger.warn(message, payload),
    info: (payload, message) => logger.info(message, payload),
  });
}

async function updateMembershipFromStripe(
  db: Database,
  identity: SubscriptionIdentity,
  stripeSubscription: Stripe.Subscription,
  patch: {
    status?: string;
    cancelAtPeriodEnd?: boolean;
    metadata?: Record<string, unknown>;
    currentPeriodEnd?: Date | null;
  } = {},
) {
  const currentPeriodEnd = patch.currentPeriodEnd ?? extractPeriodEnd(stripeSubscription) ?? identity.currentPeriodEnd;
  const metadata = {
    ...identity.metadata,
    ...(patch.metadata ?? {}),
    currentPeriodStart: dateToIso(extractPeriodStart(stripeSubscription)),
    currentPeriodEnd: dateToIso(currentPeriodEnd),
    pauseCollection: getPauseCollection(stripeSubscription),
    stripeStatus: stripeSubscription.status,
  };

  await db.update(subscriptions)
    .set({
      status: patch.status ?? (stripeSubscription.status === "active" || stripeSubscription.status === "trialing" ? "active" : stripeSubscription.status),
      cancel_at_period_end: patch.cancelAtPeriodEnd ?? stripeSubscription.cancel_at_period_end,
      current_period_end: currentPeriodEnd,
      metadata,
      updated_at: new Date(),
    })
    .where(eq(subscriptions.id, identity.id));
}

async function updateRegenerationFromStripe(
  db: Database,
  identity: SubscriptionIdentity,
  stripeSubscription: Stripe.Subscription,
  patch: {
    status: string;
    accessState: string;
    prioritySupport: boolean;
    cancelAtPeriodEnd?: boolean;
    currentPeriodEnd?: Date | null;
    canceledAt?: Date | null;
    endedAt?: Date | null;
    metadata?: Record<string, unknown>;
  },
) {
  const currentPeriodEnd = patch.currentPeriodEnd ?? extractPeriodEnd(stripeSubscription) ?? identity.currentPeriodEnd;
  await db.update(regenerationSubscriptions)
    .set({
      status: patch.status,
      access_state: patch.accessState,
      priority_support: patch.prioritySupport,
      cancel_at_period_end: patch.cancelAtPeriodEnd ?? stripeSubscription.cancel_at_period_end,
      current_period_start: extractPeriodStart(stripeSubscription),
      current_period_end: currentPeriodEnd,
      canceled_at: patch.canceledAt,
      ended_at: patch.endedAt,
      metadata: {
        ...identity.metadata,
        ...(patch.metadata ?? {}),
        currentPeriodStart: dateToIso(extractPeriodStart(stripeSubscription)),
        currentPeriodEnd: dateToIso(currentPeriodEnd),
        pauseCollection: getPauseCollection(stripeSubscription),
        stripeStatus: stripeSubscription.status,
      },
      updated_at: new Date(),
    })
    .where(eq(regenerationSubscriptions.id, identity.id));
}

async function applyStripeSubscriptionUpdate(
  db: Database,
  identity: SubscriptionIdentity,
  stripeSubscription: Stripe.Subscription,
  action: AdminSubscriptionAction,
  actor: ActorContext,
  reason: string | null,
  metadata: Record<string, unknown>,
) {
  if (identity.kind === "membership") {
    let status = stripeSubscription.status === "active" || stripeSubscription.status === "trialing" ? "active" : stripeSubscription.status;
    if (action === "pause_subscription") status = "paused";
    if (action === "cancel_immediately") status = "canceled";
    await updateMembershipFromStripe(db, identity, stripeSubscription, {
      status,
      cancelAtPeriodEnd: action === "cancel_immediately" ? false : stripeSubscription.cancel_at_period_end,
      metadata,
    });
    await syncMembershipEntitlement(db, identity);
    await insertAuditEntry(db, identity, actor, {
      action,
      previousStatus: identity.status,
      newStatus: status,
      reason,
      metadata: buildMetadata(action, metadata, stripeSubscription),
    });
    return;
  }

  const now = new Date();
  let status = "active";
  let accessState = "active";
  let prioritySupport = true;
  let canceledAt: Date | null = null;
  let endedAt: Date | null = null;
  let cancelAtPeriodEnd = stripeSubscription.cancel_at_period_end;

  if (action === "cancel_period_end") {
    status = "canceled_pending_expiry";
    accessState = "grace_period";
    cancelAtPeriodEnd = true;
  } else if (action === "cancel_immediately") {
    status = "canceled";
    accessState = "inactive";
    prioritySupport = false;
    cancelAtPeriodEnd = false;
    canceledAt = unixToDate(stripeSubscription.canceled_at) ?? now;
    endedAt = unixToDate(stripeSubscription.ended_at) ?? now;
  } else if (action === "pause_subscription") {
    status = "paused";
    accessState = "inactive";
    prioritySupport = false;
  }

  await updateRegenerationFromStripe(db, identity, stripeSubscription, {
    status,
    accessState,
    prioritySupport,
    cancelAtPeriodEnd,
    canceledAt,
    endedAt,
    metadata,
  });
  await insertAuditEntry(db, identity, actor, {
    action,
    previousStatus: identity.status,
    newStatus: status,
    reason,
    metadata: buildMetadata(action, metadata, stripeSubscription),
  });
}

export async function cancelSubscriptionAtPeriodEnd(db: Database, input: ActionInput) {
  const identity = await resolveSubscription(db, input.subscriptionId);
  const stripeSubscriptionId = requireStripeSubscriptionId(identity);
  if (identity.cancelAtPeriodEnd) {
    throw createHttpError(409, "Subscription is already scheduled to cancel.");
  }
  const actor = await buildActorContext(db, input.actorUserId);
  const stripeSubscription = await getStripe().subscriptions.update(stripeSubscriptionId, {
    cancel_at_period_end: true,
  });
  await applyStripeSubscriptionUpdate(db, identity, stripeSubscription, "cancel_period_end", actor, normalizeReason(input.reason), {
    cancelRequestedAt: new Date().toISOString(),
    cancelAtPeriodEnd: true,
  });
  return resolveSubscription(db, input.subscriptionId);
}

export async function cancelSubscriptionImmediately(db: Database, input: ActionInput) {
  const reason = requireReason(input.reason, "Immediate cancellation");
  const identity = await resolveSubscription(db, input.subscriptionId);
  const stripeSubscriptionId = requireStripeSubscriptionId(identity);
  const actor = await buildActorContext(db, input.actorUserId);
  const stripeSubscription = await getStripe().subscriptions.cancel(stripeSubscriptionId);
  await applyStripeSubscriptionUpdate(db, identity, stripeSubscription, "cancel_immediately", actor, reason, {
    canceledImmediatelyAt: new Date().toISOString(),
    accessRevokedImmediately: true,
  });
  return resolveSubscription(db, input.subscriptionId);
}

export async function reactivateSubscription(db: Database, input: ActionInput) {
  const identity = await resolveSubscription(db, input.subscriptionId);
  const stripeSubscriptionId = requireStripeSubscriptionId(identity);
  if (!identity.cancelAtPeriodEnd) {
    throw createHttpError(409, "Only subscriptions scheduled to cancel can be reactivated.");
  }
  const actor = await buildActorContext(db, input.actorUserId);
  const stripeSubscription = await getStripe().subscriptions.update(stripeSubscriptionId, {
    cancel_at_period_end: false,
  });
  await applyStripeSubscriptionUpdate(db, identity, stripeSubscription, "reactivate_subscription", actor, normalizeReason(input.reason), {
    reactivatedAt: new Date().toISOString(),
    cancelAtPeriodEnd: false,
  });
  return resolveSubscription(db, input.subscriptionId);
}

export async function pauseSubscription(db: Database, input: PauseInput) {
  const reason = requireReason(input.reason, "Pause subscription");
  const identity = await resolveSubscription(db, input.subscriptionId);
  const stripeSubscriptionId = requireStripeSubscriptionId(identity);
  const actor = await buildActorContext(db, input.actorUserId);
  const resumesAt = input.resumesAt ? Math.floor(new Date(input.resumesAt).getTime() / 1000) : undefined;
  if (input.resumesAt && !Number.isFinite(resumesAt)) {
    throw createHttpError(400, "resumesAt must be a valid date.");
  }
  const stripeSubscription = await getStripe().subscriptions.update(stripeSubscriptionId, {
    pause_collection: {
      behavior: "void",
      ...(resumesAt ? { resumes_at: resumesAt } : {}),
    },
  });
  await applyStripeSubscriptionUpdate(db, identity, stripeSubscription, "pause_subscription", actor, reason, {
    pausedAt: new Date().toISOString(),
    pauseCollection: getPauseCollection(stripeSubscription),
    accessSuspended: true,
  });
  return resolveSubscription(db, input.subscriptionId);
}

export async function resumeSubscription(db: Database, input: ActionInput) {
  const identity = await resolveSubscription(db, input.subscriptionId);
  const stripeSubscriptionId = requireStripeSubscriptionId(identity);
  const actor = await buildActorContext(db, input.actorUserId);
  const stripeSubscription = await getStripe().subscriptions.update(stripeSubscriptionId, {
    pause_collection: "",
  });
  await applyStripeSubscriptionUpdate(db, identity, stripeSubscription, "resume_subscription", actor, normalizeReason(input.reason), {
    resumedAt: new Date().toISOString(),
    pauseCollection: null,
  });
  return resolveSubscription(db, input.subscriptionId);
}

async function updateLocalPeriodExtension(
  db: Database,
  input: DayActionInput,
  action: AdminSubscriptionAction,
  actionLabel: string,
) {
  const days = normalizeDays(input.days, actionLabel);
  const reason = requireReason(input.reason, actionLabel);
  const identity = await resolveSubscription(db, input.subscriptionId);
  const actor = await buildActorContext(db, input.actorUserId);
  const base = identity.currentPeriodEnd && identity.currentPeriodEnd.getTime() > Date.now()
    ? identity.currentPeriodEnd
    : new Date();
  const nextPeriodEnd = addDays(base, days);
  const metadata = {
    ...identity.metadata,
    adminExtension: {
      action,
      days,
      previousPeriodEnd: dateToIso(identity.currentPeriodEnd),
      nextPeriodEnd: nextPeriodEnd.toISOString(),
      updatedAt: new Date().toISOString(),
    },
  };

  if (identity.kind === "membership") {
    await db.update(subscriptions)
      .set({
        status: "active",
        current_period_end: nextPeriodEnd,
        metadata,
        updated_at: new Date(),
      })
      .where(eq(subscriptions.id, identity.id));
    await syncMembershipEntitlement(db, identity);
  } else {
    await db.update(regenerationSubscriptions)
      .set({
        status: action === "set_regeneration_grace_period" ? "canceled_pending_expiry" : "active",
        access_state: action === "set_regeneration_grace_period" ? "grace_period" : "active",
        priority_support: true,
        current_period_end: nextPeriodEnd,
        metadata,
        updated_at: new Date(),
      })
      .where(eq(regenerationSubscriptions.id, identity.id));
  }

  await insertAuditEntry(db, identity, actor, {
    action,
    previousStatus: identity.status,
    newStatus: identity.kind === "regeneration" && action === "set_regeneration_grace_period" ? "grace_period" : "active",
    reason,
    metadata: buildMetadata(action, { days, nextPeriodEnd: nextPeriodEnd.toISOString() }, null, {
      localSupportAction: true,
    }),
  });
  return resolveSubscription(db, input.subscriptionId);
}

export async function extendRenewalDate(db: Database, input: DayActionInput) {
  return updateLocalPeriodExtension(db, input, "extend_renewal", "Extend renewal date");
}

export async function grantCourtesyMonth(db: Database, input: ActionInput) {
  return updateLocalPeriodExtension(db, { ...input, days: 30 }, "grant_courtesy_month", "Grant courtesy month");
}

export async function extendRegenerationAccess(db: Database, input: DayActionInput) {
  const identity = await resolveSubscription(db, input.subscriptionId);
  if (identity.kind !== "regeneration") {
    throw createHttpError(400, "This action is only available for Regeneration subscriptions.");
  }
  return updateLocalPeriodExtension(db, input, "extend_regeneration_access", "Extend Regeneration access");
}

export async function setRegenerationGracePeriod(db: Database, input: DayActionInput) {
  const identity = await resolveSubscription(db, input.subscriptionId);
  if (identity.kind !== "regeneration") {
    throw createHttpError(400, "This action is only available for Regeneration subscriptions.");
  }
  return updateLocalPeriodExtension(db, input, "set_regeneration_grace_period", "Manual grace period");
}

export async function toggleRegenerationPrioritySupport(db: Database, input: TogglePriorityInput) {
  const reason = requireReason(input.reason, "Priority support override");
  const identity = await resolveSubscription(db, input.subscriptionId);
  if (identity.kind !== "regeneration") {
    throw createHttpError(400, "This action is only available for Regeneration subscriptions.");
  }
  const actor = await buildActorContext(db, input.actorUserId);
  await db.update(regenerationSubscriptions)
    .set({
      priority_support: input.enabled,
      metadata: {
        ...identity.metadata,
        prioritySupportOverride: {
          enabled: input.enabled,
          updatedAt: new Date().toISOString(),
        },
      },
      updated_at: new Date(),
    })
    .where(eq(regenerationSubscriptions.id, identity.id));
  await insertAuditEntry(db, identity, actor, {
    action: "toggle_regeneration_priority_support",
    previousStatus: identity.regenerationPrioritySupport ? "priority_support_enabled" : "priority_support_disabled",
    newStatus: input.enabled ? "priority_support_enabled" : "priority_support_disabled",
    reason,
    metadata: buildMetadata("toggle_regeneration_priority_support", { enabled: input.enabled }, null, {
      localSupportAction: true,
    }),
  });
  return resolveSubscription(db, input.subscriptionId);
}

export async function emergencyReactivateRegeneration(db: Database, input: ActionInput) {
  const reason = requireReason(input.reason, "Emergency reactivation");
  const identity = await resolveSubscription(db, input.subscriptionId);
  if (identity.kind !== "regeneration") {
    throw createHttpError(400, "This action is only available for Regeneration subscriptions.");
  }
  const actor = await buildActorContext(db, input.actorUserId);
  await db.update(regenerationSubscriptions)
    .set({
      status: "active",
      access_state: "active",
      priority_support: true,
      ended_at: null,
      metadata: {
        ...identity.metadata,
        emergencyReactivatedAt: new Date().toISOString(),
      },
      updated_at: new Date(),
    })
    .where(eq(regenerationSubscriptions.id, identity.id));
  await insertAuditEntry(db, identity, actor, {
    action: "emergency_reactivate_regeneration",
    previousStatus: identity.status,
    newStatus: "active",
    reason,
    metadata: buildMetadata("emergency_reactivate_regeneration", { accessRestored: true }, null, {
      localSupportAction: true,
    }),
  });
  return resolveSubscription(db, input.subscriptionId);
}

async function getLatestInvoiceForSubscription(stripe: Stripe, stripeSubscriptionId: string) {
  const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId, {
    expand: ["latest_invoice"],
  });
  const invoice = typeof subscription.latest_invoice === "string"
    ? await stripe.invoices.retrieve(subscription.latest_invoice)
    : subscription.latest_invoice;
  if (!invoice) {
    throw createHttpError(409, "No Stripe invoice is available for this subscription.");
  }
  return { subscription, invoice };
}

export async function retryPayment(db: Database, input: ActionInput) {
  const identity = await resolveSubscription(db, input.subscriptionId);
  const stripeSubscriptionId = requireStripeSubscriptionId(identity);
  const actor = await buildActorContext(db, input.actorUserId);
  const stripe = getStripe();
  const { subscription, invoice } = await getLatestInvoiceForSubscription(stripe, stripeSubscriptionId);
  if (invoice.status !== "open") {
    throw createHttpError(409, "The latest Stripe invoice is not open for retry.");
  }
  const paidInvoice = await stripe.invoices.pay(invoice.id);
  await insertAuditEntry(db, identity, actor, {
    action: "retry_payment",
    previousStatus: identity.status,
    newStatus: identity.status,
    reason: normalizeReason(input.reason),
    metadata: buildMetadata("retry_payment", { invoiceId: invoice.id }, subscription, {
      stripeInvoice: {
        id: paidInvoice.id,
        status: paidInvoice.status,
        hostedInvoiceUrl: paidInvoice.hosted_invoice_url,
      },
    }),
  });
  return resolveSubscription(db, input.subscriptionId);
}

export async function sendManualInvoice(db: Database, input: ActionInput) {
  const identity = await resolveSubscription(db, input.subscriptionId);
  const stripeSubscriptionId = requireStripeSubscriptionId(identity);
  const actor = await buildActorContext(db, input.actorUserId);
  const stripe = getStripe();
  const { subscription, invoice } = await getLatestInvoiceForSubscription(stripe, stripeSubscriptionId);
  if (invoice.status !== "open" && invoice.status !== "draft") {
    throw createHttpError(409, "The latest Stripe invoice cannot be sent manually.");
  }
  const sentInvoice = invoice.status === "draft"
    ? await stripe.invoices.sendInvoice(invoice.id)
    : invoice;
  await insertAuditEntry(db, identity, actor, {
    action: "send_manual_invoice",
    previousStatus: identity.status,
    newStatus: identity.status,
    reason: normalizeReason(input.reason),
    metadata: buildMetadata("send_manual_invoice", { invoiceId: invoice.id }, subscription, {
      stripeInvoice: {
        id: sentInvoice.id,
        status: sentInvoice.status,
        hostedInvoiceUrl: sentInvoice.hosted_invoice_url,
      },
    }),
  });
  return resolveSubscription(db, input.subscriptionId);
}

export async function addSubscriptionAdminNote(
  db: Database,
  input: {
    subscriptionId: string;
    actorUserId: string;
    note: string;
  },
) {
  const note = input.note.trim();
  if (!note) {
    throw createHttpError(400, "Note is required.");
  }
  const identity = await resolveSubscription(db, input.subscriptionId);
  const actor = await buildActorContext(db, input.actorUserId);
  await db.insert(subscriptionAdminNotes).values({
    ...auditIdentity(identity),
    admin_user_id: input.actorUserId,
    note,
  });
  await insertAuditEntry(db, identity, actor, {
    action: "admin_note_added",
    previousStatus: identity.status,
    newStatus: identity.status,
    metadata: buildMetadata("admin_note_added", { notePreview: note.slice(0, 80) }, null, {
      internalOnly: true,
    }),
  });
  return getSubscriptionAdminNotes(db, identity);
}

function buildIdentityWhere(identity: Pick<SubscriptionIdentity, "kind" | "id" | "stripeSubscriptionId">) {
  const primary = identity.kind === "membership"
    ? eq(subscriptionAdminAuditEntries.membership_subscription_id, identity.id)
    : eq(subscriptionAdminAuditEntries.regeneration_subscription_id, identity.id);
  return identity.stripeSubscriptionId
    ? or(primary, eq(subscriptionAdminAuditEntries.stripe_subscription_id, identity.stripeSubscriptionId))
    : primary;
}

function buildNotesWhere(identity: Pick<SubscriptionIdentity, "kind" | "id" | "stripeSubscriptionId">) {
  const primary = identity.kind === "membership"
    ? eq(subscriptionAdminNotes.membership_subscription_id, identity.id)
    : eq(subscriptionAdminNotes.regeneration_subscription_id, identity.id);
  return identity.stripeSubscriptionId
    ? or(primary, eq(subscriptionAdminNotes.stripe_subscription_id, identity.stripeSubscriptionId))
    : primary;
}

export async function getSubscriptionAdminTimeline(
  db: Database,
  identity: Pick<SubscriptionIdentity, "kind" | "id" | "stripeSubscriptionId">,
): Promise<SubscriptionTimelineEntry[]> {
  const rows = await db
    .select()
    .from(subscriptionAdminAuditEntries)
    .where(buildIdentityWhere(identity))
    .orderBy(desc(subscriptionAdminAuditEntries.created_at));

  return rows.map((row) => ({
    id: row.id,
    timestamp: row.created_at.toISOString(),
    action: row.action_type,
    actorType: row.actor_type as SubscriptionActorType,
    actorLabel: row.actor_label,
    adminUserId: row.admin_user_id,
    previousStatus: row.previous_status,
    newStatus: row.new_status,
    reason: row.reason,
    source: "audit",
  }));
}

export async function getSubscriptionAdminNotes(
  db: Database,
  identity: Pick<SubscriptionIdentity, "kind" | "id" | "stripeSubscriptionId">,
): Promise<SubscriptionAdminNoteSummary[]> {
  const rows = await db
    .select()
    .from(subscriptionAdminNotes)
    .where(buildNotesWhere(identity))
    .orderBy(desc(subscriptionAdminNotes.created_at));

  return rows.map((row) => ({
    id: row.id,
    note: row.note,
    adminUserId: row.admin_user_id,
    createdAt: row.created_at.toISOString(),
  }));
}

export async function clearMembershipEntitlementForUser(db: Database, userId: string) {
  await db.delete(memberEntitlements).where(eq(memberEntitlements.user_id, userId));
}
