import { and, desc, eq, sql } from "drizzle-orm";
import {
  invoices,
  mentorTrainingOrders,
  payments,
  stripeCustomers,
  subscriptions,
  users,
  webhookEvents,
  type Database,
} from "@wisdom/db";
import type { BillingInterval, Divin8Tier } from "@wisdom/utils";
import { toUtcIsoString } from "@wisdom/utils";
import type Stripe from "stripe";
import {
  deriveTierFromPriceId,
  syncEntitlementFromStoredSubscription,
} from "../divin8/entitlementService.js";
import { dispatchOrderExecution } from "../divin8ExecutionDispatcher.js";
import { sendNotification } from "../notifications/notificationService.js";
import {
  sendAdminNewBookingNotification,
  sendBookingConfirmedNotification,
} from "../booking/notificationService.js";
import { confirmMentoringCircleBooking } from "../booking/bookingService.js";
import {
  getMentoringCircleEventOrThrow,
  upsertMentoringCircleRegistrationProjection,
} from "../mentoringCircleService.js";
import {
  createPersistedOrderFromInvoice,
  getInvoiceBySubscriptionId,
  markInvoiceFailed,
  markInvoicePaid,
  maybeExpireInvoice,
  resolveInvoiceByStripeReferences,
  syncInvoiceSubscriptionState,
  toPersistedOrderStatus,
  touchInvoiceSubscriptionCheckout,
  updatePersistedOrderFailure,
} from "./invoiceService.js";
import { ensurePersistedSessionOrder } from "../orderRecordingService.js";
import { markPaymentPaidFromWebhook } from "./paymentsService.js";
import { normalizePaymentFailure } from "./paymentErrorNormalizer.js";

type DbExecutor = {
  select: Database["select"];
  insert: Database["insert"];
  update: Database["update"];
  execute: Database["execute"];
};

type WebhookLogger = {
  info: (payload: unknown, message?: string) => void;
  warn: (payload: unknown, message?: string) => void;
  error: (payload: unknown, message?: string) => void;
};

type StripePaymentType = "webinar" | "session" | "report" | "subscription" | "mentor_training" | "mentoring_circle";

interface StandardStripeMetadata {
  userId: string | null;
  userEmail: string | null;
  clerkId: string | null;
  type: StripePaymentType | null;
  tier: Divin8Tier | null;
  bookingId: string | null;
  reportId: string | null;
  membershipId: string | null;
  trainingOrderId: string | null;
  packageType: string | null;
  version: string | null;
  entityId: string | null;
  eventId: string | null;
  eventKey: string | null;
  raw: Record<string, string>;
}

interface SubscriptionRecord {
  userId: string;
  stripeCustomerId: string | null;
  tier: Divin8Tier | null;
  status: string;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: Date | null;
  metadata: Record<string, unknown> | null;
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

function clampTier(value: unknown): Divin8Tier | null {
  return value === "seeker" || value === "initiate" ? value : null;
}

function clampBillingInterval(value: unknown): BillingInterval | null {
  return value === "monthly" || value === "annual" ? value : null;
}

function unixToDate(value: number | null | undefined): Date | null {
  return typeof value === "number" ? new Date(value * 1000) : null;
}

function parseObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function mergeMetadata(...parts: Array<Record<string, unknown> | null | undefined>) {
  const merged = Object.assign({}, ...parts.filter(Boolean));
  return Object.keys(merged).length > 0 ? merged : null;
}

function getString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function correlationId(invoiceId: string | null | undefined, stripeEventId: string) {
  return invoiceId ?? stripeEventId;
}

function getMetadataField(metadata: StandardStripeMetadata, key: string) {
  return getString(metadata.raw[key]);
}

function getInvoiceMetadataId(metadata: StandardStripeMetadata) {
  return getMetadataField(metadata, "invoice_id");
}

function getInvoiceBillingMode(metadata: StandardStripeMetadata) {
  const raw = getMetadataField(metadata, "billing_mode");
  return raw === "subscription" ? "subscription" : raw === "one_time" ? "one_time" : null;
}

function getInvoiceProductType(metadata: StandardStripeMetadata) {
  return getMetadataField(metadata, "product_type");
}

function isManagedInvoiceMetadata(metadata: StandardStripeMetadata) {
  return Boolean(getInvoiceMetadataId(metadata) || getInvoiceProductType(metadata) || getInvoiceBillingMode(metadata));
}

async function resolveManagedInvoice(
  db: DbExecutor,
  metadata: StandardStripeMetadata,
  refs: {
    stripePaymentIntentId?: string | null;
    stripeCheckoutSessionId?: string | null;
    stripeSubscriptionId?: string | null;
  },
) {
  const invoice = await resolveInvoiceByStripeReferences(db, {
    invoiceId: getInvoiceMetadataId(metadata),
    stripePaymentIntentId: refs.stripePaymentIntentId ?? null,
    stripeCheckoutSessionId: refs.stripeCheckoutSessionId ?? null,
    stripeSubscriptionId: refs.stripeSubscriptionId ?? null,
  });
  return maybeExpireInvoice(db, invoice);
}

function resolveAutoExecutionOrderId(metadata: StandardStripeMetadata): string | null {
  const productType = getString(metadata.raw.product_type)
    ?? getString(metadata.raw.order_type)
    ?? getString(metadata.raw.type);
  const normalizedType = productType?.toLowerCase() ?? "";
  if (normalizedType !== "report") {
    return null;
  }

  const reportId = getString(metadata.raw.reportId) ?? getString(metadata.raw.report_id);
  return reportId ? `report_${reportId}` : null;
}

function queueAutoExecution(
  db: Database,
  logger: WebhookLogger,
  orderId: string | null,
  context: Record<string, unknown>,
) {
  if (!orderId) {
    return;
  }

  void dispatchOrderExecution(db, orderId, {
    trigger: "webhook",
    logger,
    retryDelaysMs: [500, 1000, 2000],
  }).catch((error) => {
    logger.error({ ...context, orderId, error }, "divin8_auto_dispatch_failed");
  });
}

async function getUserEmail(db: DbExecutor, userId: string | null | undefined) {
  if (!userId) {
    return null;
  }

  const [user] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return user?.email ?? null;
}

function queueNotification(
  db: Database,
  logger: WebhookLogger,
  input: Parameters<typeof sendNotification>[1],
  context: Record<string, unknown>,
) {
  void sendNotification(db, input).catch((error) => {
    logger.error({
      ...context,
      event: input.event,
      entityId: input.payload.entityId,
      error: error instanceof Error ? error.message : error,
    }, "notification_dispatch_failed");
  });
}

async function emitPaymentSucceededNotifications(
  db: DbExecutor,
  logger: WebhookLogger,
  input: {
    userId: string | null;
    userEmail?: string | null;
    entityId: string;
    paymentId: string;
    amount: number;
    currency: string;
    product: string;
    orderId?: string | null;
  },
) {
  if (!input.userId) {
    return;
  }

  const userEmail = input.userEmail ?? await getUserEmail(db, input.userId);
  queueNotification(db as Database, logger, {
    event: "payment.succeeded",
    userId: input.userId,
    payload: {
      entityId: input.entityId,
      paymentId: input.paymentId,
      amount: input.amount,
      currency: input.currency,
      product: input.product,
      orderId: input.orderId ?? null,
    },
  }, { paymentId: input.paymentId });

  queueNotification(db as Database, logger, {
    event: "admin.payment.received",
    payload: {
      entityId: input.entityId,
      paymentId: input.paymentId,
      amount: input.amount,
      currency: input.currency,
      product: input.product,
      userEmail,
    },
  }, { paymentId: input.paymentId });
}

function emitPaymentFailedNotification(
  db: DbExecutor,
  logger: WebhookLogger,
  input: {
    userId: string | null;
    entityId: string;
    paymentId: string;
    amount: number;
    currency: string;
    product: string;
    reason: string;
    orderId?: string | null;
  },
) {
  if (!input.userId) {
    return;
  }

  queueNotification(db as Database, logger, {
    event: "payment.failed",
    userId: input.userId,
    payload: {
      entityId: input.entityId,
      paymentId: input.paymentId,
      amount: input.amount,
      currency: input.currency,
      product: input.product,
      reason: input.reason,
      orderId: input.orderId ?? null,
    },
  }, { paymentId: input.paymentId });
}

function serializeWebhookPayload(event: Stripe.Event): Record<string, unknown> {
  return {
    id: event.id,
    type: event.type,
    created: event.created,
    livemode: event.livemode,
    api_version: event.api_version ?? null,
    data: {
      object: event.data.object,
    },
  };
}

function parseMetadata(
  metadata: Stripe.Metadata | null | undefined,
  logger: WebhookLogger,
  context: Record<string, unknown>,
): StandardStripeMetadata {
  const raw = metadata
    ? Object.fromEntries(Object.entries(metadata).map(([key, value]) => [key, String(value)]))
    : {};

  const parsed: StandardStripeMetadata = {
    userId: typeof raw.userId === "string" && raw.userId.trim() ? raw.userId.trim() : null,
    userEmail: typeof raw.userEmail === "string" && raw.userEmail.trim() ? raw.userEmail.trim() : null,
    clerkId: typeof raw.clerkId === "string" && raw.clerkId.trim() ? raw.clerkId.trim() : null,
    type: raw.type === "webinar"
      || raw.type === "session"
      || raw.type === "report"
      || raw.type === "subscription"
      || raw.type === "mentor_training"
      || raw.type === "mentoring_circle"
      ? raw.type
      : null,
    tier: clampTier(raw.tier),
    bookingId: typeof raw.bookingId === "string" && raw.bookingId.trim() ? raw.bookingId.trim() : null,
    reportId: typeof raw.reportId === "string" && raw.reportId.trim() ? raw.reportId.trim() : null,
    membershipId: typeof raw.membershipId === "string" && raw.membershipId.trim() ? raw.membershipId.trim() : null,
    trainingOrderId: typeof raw.trainingOrderId === "string" && raw.trainingOrderId.trim() ? raw.trainingOrderId.trim() : null,
    packageType: typeof raw.packageType === "string" && raw.packageType.trim() ? raw.packageType.trim() : null,
    version: typeof raw.version === "string" && raw.version.trim() ? raw.version.trim() : null,
    entityId: typeof raw.entityId === "string" && raw.entityId.trim() ? raw.entityId.trim() : null,
    eventId: typeof raw.eventId === "string" && raw.eventId.trim() ? raw.eventId.trim() : null,
    eventKey: typeof raw.eventKey === "string" && raw.eventKey.trim() ? raw.eventKey.trim() : null,
    raw,
  };

  if (!parsed.userId && !parsed.clerkId && !parsed.userEmail) {
    logger.warn(context, "stripe_metadata_missing_user_identifiers");
  }
  if (!parsed.type) {
    logger.warn(context, "stripe_metadata_missing_type");
  }
  if (parsed.type === "subscription" && !parsed.tier) {
    logger.warn(context, "stripe_metadata_missing_tier");
  }

  return parsed;
}

function resolvePaymentEntity(
  metadata: StandardStripeMetadata,
): { entityType: "session" | "report" | "subscription" | "mentor_training" | "mentoring_circle"; entityId: string } | null {
  if (metadata.type === "session") {
    const entityId = metadata.entityId ?? metadata.bookingId;
    return entityId ? { entityType: "session", entityId } : null;
  }
  if (metadata.type === "mentoring_circle") {
    const entityId = metadata.entityId ?? metadata.bookingId;
    return entityId ? { entityType: "mentoring_circle", entityId } : null;
  }
  if (metadata.type === "report") {
    const entityId = metadata.entityId ?? metadata.reportId;
    return entityId ? { entityType: "report", entityId } : null;
  }
  if (metadata.type === "subscription") {
    const entityId = metadata.entityId ?? metadata.membershipId;
    return entityId ? { entityType: "subscription", entityId } : null;
  }
  if (metadata.type === "mentor_training") {
    const entityId = metadata.entityId ?? metadata.trainingOrderId;
    return entityId ? { entityType: "mentor_training", entityId } : null;
  }
  return null;
}

async function resolveUserIdFromMetadata(
  db: DbExecutor,
  metadata: Record<string, string>,
): Promise<string | null> {
  const userId = typeof metadata.userId === "string" ? metadata.userId.trim() : "";
  if (userId) {
    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (user?.id) {
      return user.id;
    }
  }

  const clerkId = typeof metadata.clerkId === "string" ? metadata.clerkId.trim() : "";
  if (clerkId) {
    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerk_id, clerkId))
      .limit(1);
    if (user?.id) {
      return user.id;
    }
  }

  const email = typeof metadata.userEmail === "string" ? metadata.userEmail.trim().toLowerCase() : "";
  if (email) {
    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    if (user?.id) {
      return user.id;
    }
  }

  return null;
}

async function getStripeCustomerMapping(db: DbExecutor, stripeCustomerId: string) {
  const [mapping] = await db
    .select({
      id: stripeCustomers.id,
      userId: stripeCustomers.user_id,
      stripeCustomerId: stripeCustomers.stripe_customer_id,
    })
    .from(stripeCustomers)
    .where(eq(stripeCustomers.stripe_customer_id, stripeCustomerId))
    .limit(1);
  return mapping ?? null;
}

async function resolveUserIdByStripeCustomerId(db: DbExecutor, stripeCustomerId: string): Promise<string | null> {
  const mapping = await getStripeCustomerMapping(db, stripeCustomerId);
  return mapping?.userId ?? null;
}

async function upsertStripeCustomerMapping(
  db: DbExecutor,
  input: { userId: string; stripeCustomerId: string },
  logger: WebhookLogger,
  context: Record<string, unknown>,
) {
  const existingByCustomer = await getStripeCustomerMapping(db, input.stripeCustomerId);
  if (existingByCustomer) {
    if (existingByCustomer.userId !== input.userId) {
      logger.warn(
        {
          ...context,
          stripeCustomerId: input.stripeCustomerId,
          existingUserId: existingByCustomer.userId,
          incomingUserId: input.userId,
        },
        "stripe_customer_already_mapped_to_different_user",
      );
    }
    return existingByCustomer;
  }

  await db
    .insert(stripeCustomers)
    .values({
      user_id: input.userId,
      stripe_customer_id: input.stripeCustomerId,
    })
    .onConflictDoUpdate({
      target: stripeCustomers.user_id,
      set: {
        stripe_customer_id: input.stripeCustomerId,
      },
    });

  return getStripeCustomerMapping(db, input.stripeCustomerId);
}

async function resolveSubscriptionOwner(db: DbExecutor, stripeSubscriptionId: string): Promise<string | null> {
  const [row] = await db
    .select({ userId: subscriptions.user_id })
    .from(subscriptions)
    .where(eq(subscriptions.stripe_subscription_id, stripeSubscriptionId))
    .limit(1);
  return row?.userId ?? null;
}

async function getSubscriptionRecord(
  db: DbExecutor,
  stripeSubscriptionId: string,
): Promise<SubscriptionRecord | null> {
  const [row] = await db
    .select({
      userId: subscriptions.user_id,
      stripeCustomerId: subscriptions.stripe_customer_id,
      tier: subscriptions.tier,
      status: subscriptions.status,
      cancelAtPeriodEnd: subscriptions.cancel_at_period_end,
      currentPeriodEnd: subscriptions.current_period_end,
      metadata: subscriptions.metadata,
    })
    .from(subscriptions)
    .where(eq(subscriptions.stripe_subscription_id, stripeSubscriptionId))
    .limit(1);

  if (!row) {
    return null;
  }

  return {
    userId: row.userId,
    stripeCustomerId: row.stripeCustomerId,
    tier: clampTier(row.tier),
    status: row.status,
    cancelAtPeriodEnd: row.cancelAtPeriodEnd,
    currentPeriodEnd: row.currentPeriodEnd,
    metadata: parseObject(row.metadata),
  };
}

async function resolveUserForStripeObject(
  db: DbExecutor,
  input: {
    stripeCustomerId: string | null;
    stripeSubscriptionId: string | null;
    metadata: StandardStripeMetadata;
  },
  logger: WebhookLogger,
  context: Record<string, unknown>,
): Promise<string | null> {
  if (input.stripeCustomerId) {
    const userId = await resolveUserIdByStripeCustomerId(db, input.stripeCustomerId);
    if (userId) {
      return userId;
    }
    logger.warn({ ...context, stripeCustomerId: input.stripeCustomerId }, "stripe_customer_mapping_missing");
  }

  if (input.stripeSubscriptionId) {
    const owner = await resolveSubscriptionOwner(db, input.stripeSubscriptionId);
    if (owner) {
      return owner;
    }
  }

  const fallback = await resolveUserIdFromMetadata(db, input.metadata.raw);
  if (fallback) {
    logger.warn(context, "stripe_user_resolution_fell_back_to_metadata");
  }
  return fallback;
}

async function findExistingPayment(
  db: DbExecutor,
  input: {
    providerPaymentIntentId: string | null;
    entityType: "session" | "report" | "subscription" | "mentor_training" | "mentoring_circle" | null;
    entityId: string | null;
    bookingId: string | null;
  },
) {
  if (input.providerPaymentIntentId) {
    const [byIntent] = await db
      .select({
        id: payments.id,
        entityType: payments.entity_type,
        entityId: payments.entity_id,
        bookingId: payments.booking_id,
        status: payments.status,
        metadata: payments.metadata,
      })
      .from(payments)
      .where(eq(payments.provider_payment_intent_id, input.providerPaymentIntentId))
      .limit(1);
    if (byIntent) {
      return byIntent;
    }
  }

  if (input.entityType && input.entityId) {
    const [byEntity] = await db
      .select({
        id: payments.id,
        entityType: payments.entity_type,
        entityId: payments.entity_id,
        bookingId: payments.booking_id,
        status: payments.status,
        metadata: payments.metadata,
      })
      .from(payments)
      .where(and(
        eq(payments.entity_type, input.entityType),
        eq(payments.entity_id, input.entityId),
      ))
      .orderBy(desc(payments.created_at))
      .limit(1);
    if (byEntity) {
      return byEntity;
    }
  }

  if (input.bookingId) {
    const [byBooking] = await db
      .select({
        id: payments.id,
        entityType: payments.entity_type,
        entityId: payments.entity_id,
        bookingId: payments.booking_id,
        status: payments.status,
        metadata: payments.metadata,
      })
      .from(payments)
      .where(eq(payments.booking_id, input.bookingId))
      .orderBy(desc(payments.created_at))
      .limit(1);
    if (byBooking) {
      return byBooking;
    }
  }

  return null;
}

async function getMentorTrainingOrderState(db: DbExecutor, trainingOrderId: string) {
  const [row] = await db
    .select({
      id: mentorTrainingOrders.id,
      status: mentorTrainingOrders.status,
    })
    .from(mentorTrainingOrders)
    .where(eq(mentorTrainingOrders.id, trainingOrderId))
    .limit(1);

  return row ?? null;
}

function extractSubscriptionPeriodStart(subscription: Stripe.Subscription): Date | null {
  const item = subscription.items.data[0];
  return unixToDate(item?.current_period_start);
}

function extractSubscriptionPeriodEnd(subscription: Stripe.Subscription): Date | null {
  const item = subscription.items.data[0];
  return unixToDate(item?.current_period_end);
}

function deriveSubscriptionTier(subscription: Stripe.Subscription, metadata: StandardStripeMetadata): Divin8Tier | null {
  return deriveTierFromPriceId(subscription.items.data[0]?.price?.id ?? null)?.tier ?? metadata.tier;
}

function deriveBillingIntervalFromSubscription(
  subscription: Stripe.Subscription,
  existing: SubscriptionRecord | null,
): BillingInterval | null {
  const resolved = deriveTierFromPriceId(subscription.items.data[0]?.price?.id ?? null);
  return resolved?.billingInterval ?? clampBillingInterval(existing?.metadata?.billingInterval);
}

function deriveTierFromInvoice(invoice: Stripe.Invoice, existing: SubscriptionRecord | null): Divin8Tier | null {
  const firstLine = invoice.lines.data[0] as unknown as { price?: { id?: string | null } } | undefined;
  return deriveTierFromPriceId(firstLine?.price?.id ?? null)?.tier ?? clampTier(existing?.tier);
}

function deriveBillingIntervalFromInvoice(
  invoice: Stripe.Invoice,
  existing: SubscriptionRecord | null,
): BillingInterval | null {
  const firstLine = invoice.lines.data[0] as unknown as { price?: { id?: string | null } } | undefined;
  return deriveTierFromPriceId(firstLine?.price?.id ?? null)?.billingInterval
    ?? clampBillingInterval(existing?.metadata?.billingInterval);
}

function normalizeSubscriptionStatusFromSubscriptionEvent(
  stripeStatus: Stripe.Subscription.Status,
  existingStatus: string | null,
): string {
  if (stripeStatus === "canceled") return "canceled";
  if (stripeStatus === "past_due") return "past_due";
  if (stripeStatus === "unpaid") return "past_due";
  if (stripeStatus === "incomplete" || stripeStatus === "incomplete_expired") {
    return existingStatus === "active" ? existingStatus : stripeStatus;
  }
  if (stripeStatus === "trialing") return "trialing";
  if (stripeStatus === "paused") return "paused";

  // `invoice.paid` is the source of truth for an active subscription. Subscription
  // create/update events still refresh metadata and lifecycle flags, but they do not
  // promote access to active on their own.
  return existingStatus ?? "incomplete";
}

function normalizeManagedInvoiceSubscriptionState(stripeStatus: Stripe.Subscription.Status): string {
  if (stripeStatus === "canceled") return "canceled";
  if (stripeStatus === "past_due" || stripeStatus === "unpaid") return "past_due";
  if (stripeStatus === "incomplete" || stripeStatus === "incomplete_expired") return "incomplete";
  return "active";
}

async function upsertSubscriptionRecord(
  db: DbExecutor,
  input: {
    userId: string;
    stripeSubscriptionId: string;
    stripeCustomerId: string;
    tier: Divin8Tier | null;
    status: string;
    cancelAtPeriodEnd: boolean;
    currentPeriodEnd: Date | null;
    metadata?: Record<string, unknown> | null;
  },
) {
  const now = new Date();
  await db
    .insert(subscriptions)
    .values({
      user_id: input.userId,
      stripe_subscription_id: input.stripeSubscriptionId,
      stripe_customer_id: input.stripeCustomerId,
      tier: input.tier,
      status: input.status,
      cancel_at_period_end: input.cancelAtPeriodEnd,
      current_period_end: input.currentPeriodEnd,
      metadata: input.metadata ?? null,
      created_at: now,
      updated_at: now,
    })
    .onConflictDoUpdate({
      target: subscriptions.stripe_subscription_id,
      set: {
        user_id: input.userId,
        stripe_customer_id: input.stripeCustomerId,
        tier: input.tier,
        status: input.status,
        cancel_at_period_end: input.cancelAtPeriodEnd,
        current_period_end: input.currentPeriodEnd,
        metadata: input.metadata ?? null,
        updated_at: now,
      },
    });
}

async function updateMembershipPurchaseCheckoutState(
  db: DbExecutor,
  input: {
    membershipId: string;
    stripeSubscriptionId: string | null;
    stripeCustomerId: string | null;
    tier: Divin8Tier | null;
    metadata?: Record<string, unknown> | null;
  },
) {
  await db
    .update(subscriptions)
    .set({
      stripe_subscription_id: input.stripeSubscriptionId,
      stripe_customer_id: input.stripeCustomerId,
      tier: input.tier,
      status: "active",
      cancel_at_period_end: false,
      metadata: input.metadata ?? null,
      updated_at: new Date(),
    })
    .where(eq(subscriptions.id, input.membershipId));
}

async function handleManagedInvoiceCheckoutSessionCompleted(
  db: DbExecutor,
  session: Stripe.Checkout.Session,
  metadata: StandardStripeMetadata,
  logger: WebhookLogger,
) {
  const invoice = await resolveManagedInvoice(db, metadata, {
    stripePaymentIntentId: stripeRef(session.payment_intent),
    stripeCheckoutSessionId: session.id,
    stripeSubscriptionId: stripeRef(session.subscription),
  });

  if (!invoice) {
    logger.warn(
      {
        correlation_id: correlationId(getInvoiceMetadataId(metadata), session.id),
        checkoutSessionId: session.id,
      },
      "invoice_checkout_session_unresolved",
    );
    return true;
  }

  if (invoice.status === "paid" && invoice.consumed_at) {
    logger.info(
      {
        correlation_id: correlationId(invoice.id, session.id),
        invoiceId: invoice.id,
        checkoutSessionId: session.id,
      },
      "invoice_consumed_checkout_ignored",
    );
    return true;
  }

  if (invoice.billing_mode === "subscription") {
    await touchInvoiceSubscriptionCheckout(db, invoice, {
      stripeCheckoutSessionId: session.id,
      stripePaymentIntentId: stripeRef(session.payment_intent),
      stripeSubscriptionId: stripeRef(session.subscription),
      subscriptionStatus: "incomplete",
    });
    logger.info(
      {
        correlation_id: correlationId(invoice.id, session.id),
        invoiceId: invoice.id,
        checkoutSessionId: session.id,
        billingMode: invoice.billing_mode,
      },
      "payment_success",
    );
    return true;
  }

  const updatedInvoice = await markInvoicePaid(db, invoice, {
    stripeCheckoutSessionId: session.id,
    stripePaymentIntentId: stripeRef(session.payment_intent),
    stripeSubscriptionId: stripeRef(session.subscription),
  });

  await createPersistedOrderFromInvoice(db, {
    invoice: updatedInvoice,
    paymentReference: session.id,
    stripePaymentIntentId: stripeRef(session.payment_intent),
    stripeSubscriptionId: stripeRef(session.subscription),
    status: toPersistedOrderStatus(updatedInvoice.status),
    metadata: {
      source: "checkout.session.completed",
      billing_mode: updatedInvoice.billing_mode,
    },
  });

  logger.info(
    {
      correlation_id: correlationId(updatedInvoice.id, session.id),
      invoiceId: updatedInvoice.id,
      checkoutSessionId: session.id,
      billingMode: updatedInvoice.billing_mode,
      productType: updatedInvoice.product_type,
    },
    "payment_success",
  );
  logger.info(
    {
      correlation_id: correlationId(updatedInvoice.id, session.id),
      invoiceId: updatedInvoice.id,
      paymentReference: session.id,
    },
    "order_created",
  );
  await emitPaymentSucceededNotifications(db, logger, {
    userId: updatedInvoice.user_id,
    entityId: updatedInvoice.id,
    paymentId: stripeRef(session.payment_intent) ?? session.id,
    amount: updatedInvoice.amount,
    currency: updatedInvoice.currency,
    product: updatedInvoice.label,
    orderId: updatedInvoice.id,
  });
  return true;
}

async function handleManagedInvoiceRecurringStatus(
  db: DbExecutor,
  invoiceEvent: Stripe.Invoice,
  metadata: StandardStripeMetadata,
  status: "paid" | "failed",
  logger: WebhookLogger,
) {
  const stripeSubscriptionId = stripeRef(
    (invoiceEvent as Stripe.Invoice & { subscription?: string | Stripe.Subscription | null }).subscription ?? null,
  );
  const resolvedInvoice = await resolveManagedInvoice(db, metadata, {
    stripeSubscriptionId,
    stripePaymentIntentId: stripeRef((invoiceEvent as Stripe.Invoice & { payment_intent?: unknown }).payment_intent),
  });

  if (!resolvedInvoice) {
    logger.warn(
      {
        correlation_id: correlationId(getInvoiceMetadataId(metadata), invoiceEvent.id),
        stripeInvoiceId: invoiceEvent.id,
        stripeSubscriptionId,
      },
      status === "paid" ? "invoice_paid_unresolved" : "invoice_failed_unresolved",
    );
    return true;
  }

  if (resolvedInvoice.status === "paid" && status === "failed") {
    logger.info(
      {
        correlation_id: correlationId(resolvedInvoice.id, invoiceEvent.id),
        invoiceId: resolvedInvoice.id,
        stripeInvoiceId: invoiceEvent.id,
      },
      "invoice_paid_failure_ignored",
    );
    return true;
  }

  const paymentReference = invoiceEvent.id;
  const paymentIntentId = stripeRef((invoiceEvent as Stripe.Invoice & { payment_intent?: unknown }).payment_intent);

  if (status === "paid") {
    const updatedInvoice = await markInvoicePaid(db, resolvedInvoice, {
      stripePaymentIntentId: paymentIntentId,
      stripeSubscriptionId,
    });
    await syncInvoiceSubscriptionState(
      db,
      updatedInvoice,
      "active",
      stripeSubscriptionId ?? updatedInvoice.stripe_subscription_id ?? "",
    );

    const metadataValue = updatedInvoice.metadata && typeof updatedInvoice.metadata === "object" && !Array.isArray(updatedInvoice.metadata)
      ? updatedInvoice.metadata as Record<string, unknown>
      : {};
    const existingInitial = typeof metadataValue.initialInvoicePaid === "boolean" ? metadataValue.initialInvoicePaid : false;
    await createPersistedOrderFromInvoice(db, {
      invoice: updatedInvoice,
      paymentReference,
      stripePaymentIntentId: paymentIntentId,
      stripeSubscriptionId,
      orderType: existingInitial ? "subscription_renewal" : "subscription_initial",
      status: "completed",
      metadata: {
        source: "invoice.paid",
        initialInvoicePaid: true,
      },
    });
    await db
      .update(invoices)
      .set({
        metadata: {
          ...metadataValue,
          initialInvoicePaid: true,
          subscriptionStatus: "active",
        },
        updated_at: new Date(),
      })
      .where(eq(invoices.id, updatedInvoice.id));

    logger.info(
      {
        correlation_id: correlationId(updatedInvoice.id, invoiceEvent.id),
        invoiceId: updatedInvoice.id,
        stripeInvoiceId: invoiceEvent.id,
        stripeSubscriptionId,
      },
      "payment_success",
    );
    logger.info(
      {
        correlation_id: correlationId(updatedInvoice.id, invoiceEvent.id),
        invoiceId: updatedInvoice.id,
        paymentReference,
      },
      "order_created",
    );
    await emitPaymentSucceededNotifications(db, logger, {
      userId: updatedInvoice.user_id,
      entityId: updatedInvoice.id,
      paymentId: paymentIntentId ?? invoiceEvent.id,
      amount: updatedInvoice.amount,
      currency: updatedInvoice.currency,
      product: updatedInvoice.label,
      orderId: updatedInvoice.id,
    });
    return true;
  }

  const failedInvoice = await markInvoiceFailed(db, resolvedInvoice, {
    stripePaymentIntentId: paymentIntentId,
    stripeSubscriptionId,
    failureCode: "invoice_payment_failed",
    failureMessage: "Subscription invoice payment failed.",
  });
  await updatePersistedOrderFailure(db, {
    invoice: failedInvoice,
    paymentReference,
    stripePaymentIntentId: paymentIntentId,
    stripeSubscriptionId,
    failureCode: "invoice_payment_failed",
    failureMessage: "Subscription invoice payment failed.",
  });

  logger.warn(
    {
      correlation_id: correlationId(failedInvoice.id, invoiceEvent.id),
      invoiceId: failedInvoice.id,
      stripeInvoiceId: invoiceEvent.id,
      stripeSubscriptionId,
    },
    "payment_failed",
  );
  emitPaymentFailedNotification(db, logger, {
    userId: failedInvoice.user_id,
    entityId: failedInvoice.id,
    paymentId: paymentIntentId ?? invoiceEvent.id,
    amount: failedInvoice.amount,
    currency: failedInvoice.currency,
    product: failedInvoice.label,
    reason: "Subscription invoice payment failed.",
    orderId: failedInvoice.id,
  });
  return true;
}

async function handleManagedInvoicePaymentIntentFailed(
  db: DbExecutor,
  intent: Stripe.PaymentIntent,
  logger: WebhookLogger,
  stripeEventId: string,
) {
  const metadata = parseMetadata(intent.metadata, logger, {
    eventType: "payment_intent.payment_failed",
    paymentIntentId: intent.id,
  });
  const invoice = await resolveManagedInvoice(db, metadata, {
    stripePaymentIntentId: intent.id,
  });
  if (!invoice) return false;
  if (invoice.status === "paid") {
    logger.info(
      { correlation_id: correlationId(invoice.id, stripeEventId), invoiceId: invoice.id, paymentIntentId: intent.id },
      "invoice_paid_failure_ignored",
    );
    return true;
  }

  const normalized = normalizePaymentFailure(
    intent.last_payment_error?.code ?? null,
    intent.last_payment_error?.message ?? null,
  );
  const updatedInvoice = await markInvoiceFailed(db, invoice, {
    stripePaymentIntentId: intent.id,
    failureCode: normalized.code,
    failureMessage: normalized.rawMessage,
  });
  await updatePersistedOrderFailure(db, {
    invoice: updatedInvoice,
    paymentReference: intent.id,
    stripePaymentIntentId: intent.id,
    failureCode: normalized.code,
    failureMessage: normalized.rawMessage,
  });
  logger.warn(
    {
      correlation_id: correlationId(updatedInvoice.id, stripeEventId),
      invoiceId: updatedInvoice.id,
      paymentIntentId: intent.id,
      code: normalized.code,
      message: normalized.rawMessage,
    },
    "payment_failed",
  );
  emitPaymentFailedNotification(db, logger, {
    userId: updatedInvoice.user_id,
    entityId: updatedInvoice.id,
    paymentId: intent.id,
    amount: updatedInvoice.amount,
    currency: updatedInvoice.currency,
    product: updatedInvoice.label,
    reason: normalized.rawMessage ?? "Payment failed.",
    orderId: updatedInvoice.id,
  });
  return true;
}

async function handleManagedInvoiceChargeFailed(
  db: DbExecutor,
  charge: Stripe.Charge,
  logger: WebhookLogger,
  stripeEventId: string,
) {
  const metadata = parseMetadata(charge.metadata, logger, {
    eventType: "charge.failed",
    chargeId: charge.id,
  });
  const invoice = await resolveManagedInvoice(db, metadata, {
    stripePaymentIntentId: stripeRef(charge.payment_intent),
  });
  if (!invoice) return false;
  if (invoice.status === "paid") {
    logger.info(
      { correlation_id: correlationId(invoice.id, stripeEventId), invoiceId: invoice.id, chargeId: charge.id },
      "invoice_paid_failure_ignored",
    );
    return true;
  }

  const normalized = normalizePaymentFailure(charge.failure_code, charge.failure_message);
  const updatedInvoice = await markInvoiceFailed(db, invoice, {
    stripePaymentIntentId: stripeRef(charge.payment_intent),
    failureCode: normalized.code,
    failureMessage: normalized.rawMessage,
  });
  await updatePersistedOrderFailure(db, {
    invoice: updatedInvoice,
    paymentReference: charge.id,
    stripePaymentIntentId: stripeRef(charge.payment_intent),
    failureCode: normalized.code,
    failureMessage: normalized.rawMessage,
  });
  logger.warn(
    {
      correlation_id: correlationId(updatedInvoice.id, stripeEventId),
      invoiceId: updatedInvoice.id,
      chargeId: charge.id,
      code: normalized.code,
      message: normalized.rawMessage,
    },
    "payment_failed",
  );
  emitPaymentFailedNotification(db, logger, {
    userId: updatedInvoice.user_id,
    entityId: updatedInvoice.id,
    paymentId: stripeRef(charge.payment_intent) ?? charge.id,
    amount: updatedInvoice.amount,
    currency: updatedInvoice.currency,
    product: updatedInvoice.label,
    reason: normalized.rawMessage ?? "Payment failed.",
    orderId: updatedInvoice.id,
  });
  return true;
}

async function handleManagedInvoiceAsyncCheckoutFailed(
  db: DbExecutor,
  session: Stripe.Checkout.Session,
  logger: WebhookLogger,
  stripeEventId: string,
) {
  const metadata = parseMetadata(session.metadata, logger, {
    eventType: "checkout.session.async_payment_failed",
    checkoutSessionId: session.id,
  });
  const invoice = await resolveManagedInvoice(db, metadata, {
    stripeCheckoutSessionId: session.id,
    stripePaymentIntentId: stripeRef(session.payment_intent),
    stripeSubscriptionId: stripeRef(session.subscription),
  });
  if (!invoice) return false;
  if (invoice.status === "paid") {
    logger.info(
      { correlation_id: correlationId(invoice.id, stripeEventId), invoiceId: invoice.id, checkoutSessionId: session.id },
      "invoice_paid_failure_ignored",
    );
    return true;
  }

  const updatedInvoice = await markInvoiceFailed(db, invoice, {
    stripeCheckoutSessionId: session.id,
    stripePaymentIntentId: stripeRef(session.payment_intent),
    stripeSubscriptionId: stripeRef(session.subscription),
    failureCode: "checkout_async_failed",
    failureMessage: "Checkout session payment failed.",
  });
  await updatePersistedOrderFailure(db, {
    invoice: updatedInvoice,
    paymentReference: session.id,
    stripePaymentIntentId: stripeRef(session.payment_intent),
    stripeSubscriptionId: stripeRef(session.subscription),
    failureCode: "checkout_async_failed",
    failureMessage: "Checkout session payment failed.",
  });
  logger.warn(
    {
      correlation_id: correlationId(updatedInvoice.id, stripeEventId),
      invoiceId: updatedInvoice.id,
      checkoutSessionId: session.id,
    },
    "payment_failed",
  );
  emitPaymentFailedNotification(db, logger, {
    userId: updatedInvoice.user_id,
    entityId: updatedInvoice.id,
    paymentId: stripeRef(session.payment_intent) ?? session.id,
    amount: updatedInvoice.amount,
    currency: updatedInvoice.currency,
    product: updatedInvoice.label,
    reason: "Checkout session payment failed.",
    orderId: updatedInvoice.id,
  });
  return true;
}

async function finalizeMentoringCircleAccess(
  db: DbExecutor,
  logger: WebhookLogger,
  input: {
    bookingId: string;
    userId: string;
    eventId?: string | null;
  },
) {
  const event = getMentoringCircleEventOrThrow(input.eventId);
  const booking = await confirmMentoringCircleBooking(db as Database, {
    bookingId: input.bookingId,
    eventId: event.eventId,
  });
  await upsertMentoringCircleRegistrationProjection(db as Database, { bookingId: booking.id });

  void sendBookingConfirmedNotification(db as Database, {
    bookingId: booking.id,
    userId: input.userId,
    bookingType: event.eventTitle,
    timezone: event.timezone,
    startTimeUtc: booking.start_time_utc ?? toUtcIsoString(new Date(event.eventStartAt)),
    endTimeUtc: booking.end_time_utc
      ?? toUtcIsoString(new Date(new Date(event.eventStartAt).getTime() + event.durationMinutes * 60_000)),
    eventId: event.eventId,
    eventTitle: event.eventTitle,
    joinUrl: event.zoomLink,
    accessPagePath: "/mentoring-circle",
  }).catch((error) => {
    logger.error({
      bookingId: booking.id,
      userId: input.userId,
      eventId: event.eventId,
      error: error instanceof Error ? error.message : error,
    }, "mentoring_circle_booking_confirmation_notification_failed");
  });

  void sendAdminNewBookingNotification(db as Database, {
    bookingId: booking.id,
    userId: input.userId,
    bookingType: event.eventTitle,
    timezone: event.timezone,
    startTimeUtc: booking.start_time_utc ?? undefined,
    eventId: event.eventId,
    eventTitle: event.eventTitle,
  }).catch((error) => {
    logger.error({
      bookingId: booking.id,
      userId: input.userId,
      eventId: event.eventId,
      error: error instanceof Error ? error.message : error,
    }, "mentoring_circle_admin_notification_failed");
  });

  return { booking, event };
}

async function handleCheckoutSessionCompleted(
  db: DbExecutor,
  session: Stripe.Checkout.Session,
  logger: WebhookLogger,
) {
  const stripeCustomerId = stripeRef(session.customer);
  const stripeSubscriptionId = stripeRef(session.subscription);
  const metadata = parseMetadata(session.metadata, logger, {
    eventType: "checkout.session.completed",
    checkoutSessionId: session.id,
    customerId: stripeCustomerId,
    subscriptionId: stripeSubscriptionId,
  });
  if (isManagedInvoiceMetadata(metadata)) {
    const handled = await handleManagedInvoiceCheckoutSessionCompleted(db, session, metadata, logger);
    if (handled) {
      return;
    }
  }

  const userId = await resolveUserForStripeObject(db, {
    stripeCustomerId,
    stripeSubscriptionId,
    metadata,
  }, logger, {
    eventType: "checkout.session.completed",
    checkoutSessionId: session.id,
    customerId: stripeCustomerId,
    subscriptionId: stripeSubscriptionId,
  });

  if (!userId) {
    logger.warn(
      { checkoutSessionId: session.id, customerId: stripeCustomerId, subscriptionId: stripeSubscriptionId },
      "stripe_checkout_session_missing_user_mapping",
    );
    return;
  }

  if (stripeCustomerId) {
    await upsertStripeCustomerMapping(db, {
      userId,
      stripeCustomerId,
    }, logger, { checkoutSessionId: session.id, eventType: "checkout.session.completed" });
  }

  const providerPaymentIntentId = stripeRef(session.payment_intent);
  const entity = resolvePaymentEntity(metadata);
  const autoExecutionOrderId = resolveAutoExecutionOrderId(metadata);
  const bookingId = entity?.entityType === "session" || entity?.entityType === "mentoring_circle"
    ? entity.entityId
    : metadata.bookingId;

  if (!entity) {
    logger.warn(
      {
        checkoutSessionId: session.id,
        providerPaymentIntentId,
        metadata: metadata.raw,
      },
      "stripe_checkout_session_missing_entity_reference",
    );
    return;
  }

  const existingPayment = await findExistingPayment(db, {
    providerPaymentIntentId,
    entityType: entity.entityType,
    entityId: entity.entityId,
    bookingId,
  });
  const nextMetadata = mergeMetadata(
    parseObject(existingPayment?.metadata),
    metadata.raw,
    {
      source: "stripe_webhook",
      stripeCheckoutSessionId: session.id,
      stripeCheckoutMode: session.mode,
      stripePaymentStatus: session.payment_status,
    },
  );

  if (!existingPayment) {
    logger.warn(
      {
        checkoutSessionId: session.id,
        providerPaymentIntentId,
        entityType: entity.entityType,
        entityId: entity.entityId,
      },
      "stripe_payment_missing_local_entity_payment",
    );
    return;
  }

  if (entity.entityType === "mentor_training") {
    const trainingOrder = await getMentorTrainingOrderState(db, entity.entityId);
    if (!trainingOrder || trainingOrder.status !== "pending_payment") {
      logger.warn(
        {
          checkoutSessionId: session.id,
          trainingOrderId: entity.entityId,
          orderStatus: trainingOrder?.status ?? null,
        },
        "stripe_mentor_training_order_not_pending_ignored",
      );
      return;
    }
  }

  if (existingPayment?.status === "paid") {
    if (entity.entityType === "mentoring_circle" && bookingId) {
      await finalizeMentoringCircleAccess(db, logger, {
        bookingId,
        userId,
        eventId: metadata.eventId ?? metadata.eventKey,
      });
    }
    logger.info(
      {
        checkoutSessionId: session.id,
        paymentId: existingPayment.id,
        entityType: existingPayment.entityType ?? entity.entityType,
        entityId: existingPayment.entityId ?? entity.entityId,
      },
      "stripe_payment_already_paid_ignored",
    );
    return;
  }

  const paidPayment = await markPaymentPaidFromWebhook(db as Database, {
    paymentId: existingPayment.id,
    providerPaymentIntentId,
    providerCustomerId: stripeCustomerId,
    metadata: nextMetadata,
  });

  if (entity.entityType === "session" && bookingId) {
    await ensurePersistedSessionOrder(db, bookingId);
  }

  if (entity.entityType === "mentoring_circle" && bookingId) {
    const finalized = await finalizeMentoringCircleAccess(db, logger, {
      bookingId,
      userId,
      eventId: metadata.eventId ?? metadata.eventKey,
    });

    await emitPaymentSucceededNotifications(db, logger, {
      userId,
      userEmail: metadata.userEmail,
      entityId: bookingId,
      paymentId: paidPayment.id,
      amount: paidPayment.amount_cents,
      currency: paidPayment.currency,
      product: finalized.event.eventTitle,
      orderId: bookingId,
    });
    return;
  }

  if (entity.entityType === "subscription") {
    await updateMembershipPurchaseCheckoutState(db, {
      membershipId: entity.entityId,
      stripeSubscriptionId,
      stripeCustomerId,
      tier: metadata.tier,
      metadata: mergeMetadata(nextMetadata, {
        checkoutCompletedAt: new Date().toISOString(),
      }),
    });

    if (stripeSubscriptionId) {
      logger.info({
        eventType: "checkout.session.completed",
        checkoutSessionId: session.id,
        stripeSubscriptionId,
        stripeCustomerId,
        membershipId: entity.entityId,
        userId,
        tier: metadata.tier,
        status: "active",
      }, "stripe_subscription_checkout_recorded");
      await syncEntitlementFromStoredSubscription(db as Database, stripeSubscriptionId, logger);
    }
    await emitPaymentSucceededNotifications(db, logger, {
      userId,
      userEmail: metadata.userEmail,
      entityId: entity.entityId,
      paymentId: paidPayment.id,
      amount: paidPayment.amount_cents,
      currency: paidPayment.currency,
      product: "subscription",
      orderId: entity.entityId,
    });
    return;
  }

  await emitPaymentSucceededNotifications(db, logger, {
    userId,
    userEmail: metadata.userEmail,
    entityId: entity.entityId,
    paymentId: paidPayment.id,
    amount: paidPayment.amount_cents,
    currency: paidPayment.currency,
    product: entity.entityType,
    orderId: autoExecutionOrderId,
  });

  if (entity.entityType === "report") {
    queueAutoExecution(db as Database, logger, autoExecutionOrderId, {
      eventType: "checkout.session.completed",
      checkoutSessionId: session.id,
      userId,
      providerPaymentIntentId,
      reportId: entity.entityId,
    });
  }
}

export async function syncCheckoutSessionCompleted(
  db: DbExecutor,
  session: Stripe.Checkout.Session,
  logger: WebhookLogger,
) {
  if (session.payment_status !== "paid" && session.payment_status !== "no_payment_required") {
    logger.info({
      checkoutSessionId: session.id,
      paymentStatus: session.payment_status,
      mode: session.mode,
    }, "stripe_checkout_session_sync_skipped_unpaid");
    return {
      synchronized: false,
      paymentStatus: session.payment_status ?? null,
      mode: session.mode ?? null,
    };
  }

  await handleCheckoutSessionCompleted(db, session, logger);
  return {
    synchronized: true,
    paymentStatus: session.payment_status ?? null,
    mode: session.mode ?? null,
  };
}

async function handleSubscriptionCreatedOrUpdated(
  db: DbExecutor,
  event: Stripe.Event,
  subscription: Stripe.Subscription,
  logger: WebhookLogger,
) {
  const stripeSubscriptionId = subscription.id;
  const stripeCustomerId = stripeRef(subscription.customer);
  const metadata = parseMetadata(subscription.metadata, logger, {
    eventType: event.type,
    subscriptionId: stripeSubscriptionId,
    customerId: stripeCustomerId,
  });
  const linkedInvoice = await getInvoiceBySubscriptionId(db, stripeSubscriptionId);
  if (linkedInvoice) {
    await syncInvoiceSubscriptionState(
      db,
      linkedInvoice,
      normalizeManagedInvoiceSubscriptionState(subscription.status),
      stripeSubscriptionId,
    );
    logger.info({
      correlation_id: correlationId(linkedInvoice.id, event.id),
      invoiceId: linkedInvoice.id,
      stripeSubscriptionId,
      status: subscription.status,
    }, "invoice_subscription_state_synced");
    return;
  }

  if (!stripeCustomerId) {
    logger.warn({ stripeSubscriptionId, eventType: event.type }, "stripe_subscription_missing_customer");
    return;
  }

  const userId = await resolveUserForStripeObject(db, {
    stripeCustomerId,
    stripeSubscriptionId,
    metadata,
  }, logger, {
    eventType: event.type,
    subscriptionId: stripeSubscriptionId,
    customerId: stripeCustomerId,
  });

  if (!userId) {
    logger.warn(
      { stripeSubscriptionId, stripeCustomerId, eventType: event.type },
      "stripe_subscription_missing_user_mapping",
    );
    return;
  }

  await upsertStripeCustomerMapping(db, {
    userId,
    stripeCustomerId,
  }, logger, { eventType: event.type, subscriptionId: stripeSubscriptionId });

  const existing = await getSubscriptionRecord(db, stripeSubscriptionId);
  const derivedTier = deriveSubscriptionTier(subscription, metadata) ?? existing?.tier ?? null;
  const billingInterval = deriveBillingIntervalFromSubscription(subscription, existing);

  await upsertSubscriptionRecord(db, {
    userId,
    stripeSubscriptionId,
    stripeCustomerId,
    tier: derivedTier,
    status: normalizeSubscriptionStatusFromSubscriptionEvent(subscription.status, existing?.status ?? null),
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    currentPeriodEnd: extractSubscriptionPeriodEnd(subscription),
    metadata: mergeMetadata(existing?.metadata, metadata.raw, {
      source: "stripe_webhook",
      eventType: event.type,
      billingInterval,
      currentPeriodStart: extractSubscriptionPeriodStart(subscription)?.toISOString() ?? null,
    }),
  });

  logger.info({
    eventType: event.type,
    stripeSubscriptionId,
    stripeCustomerId,
    userId,
    tier: derivedTier,
    status: normalizeSubscriptionStatusFromSubscriptionEvent(subscription.status, existing?.status ?? null),
  }, "stripe_subscription_record_updated");
  await syncEntitlementFromStoredSubscription(db as Database, stripeSubscriptionId, logger);
}

async function handleSubscriptionDeleted(
  db: DbExecutor,
  event: Stripe.Event,
  subscription: Stripe.Subscription,
  logger: WebhookLogger,
) {
  const stripeSubscriptionId = subscription.id;
  const stripeCustomerId = stripeRef(subscription.customer);
  const metadata = parseMetadata(subscription.metadata, logger, {
    eventType: event.type,
    subscriptionId: stripeSubscriptionId,
    customerId: stripeCustomerId,
  });
  const linkedInvoice = await getInvoiceBySubscriptionId(db, stripeSubscriptionId);
  if (linkedInvoice) {
    await syncInvoiceSubscriptionState(db, linkedInvoice, "canceled", stripeSubscriptionId);
    logger.info({
      correlation_id: correlationId(linkedInvoice.id, event.id),
      invoiceId: linkedInvoice.id,
      stripeSubscriptionId,
      status: "canceled",
    }, "invoice_subscription_state_synced");
    return;
  }
  const existing = await getSubscriptionRecord(db, stripeSubscriptionId);
  const userId = await resolveUserForStripeObject(db, {
    stripeCustomerId,
    stripeSubscriptionId,
    metadata,
  }, logger, {
    eventType: event.type,
    subscriptionId: stripeSubscriptionId,
    customerId: stripeCustomerId,
  });

  if (userId && stripeCustomerId) {
    await upsertStripeCustomerMapping(db, {
      userId,
      stripeCustomerId,
    }, logger, { eventType: event.type, subscriptionId: stripeSubscriptionId });
    await upsertSubscriptionRecord(db, {
      userId,
      stripeSubscriptionId,
      stripeCustomerId,
      tier: existing?.tier ?? metadata.tier ?? null,
      status: "canceled",
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      currentPeriodEnd: extractSubscriptionPeriodEnd(subscription),
      metadata: mergeMetadata(existing?.metadata, metadata.raw, {
        source: "stripe_webhook",
        eventType: event.type,
      }),
    });
  } else {
    logger.warn({ stripeSubscriptionId, stripeCustomerId }, "stripe_subscription_delete_missing_local_owner");
  }

  logger.info({
    eventType: event.type,
    stripeSubscriptionId,
    stripeCustomerId,
    userId,
    status: "canceled",
  }, "stripe_subscription_deleted");
  await syncEntitlementFromStoredSubscription(db as Database, stripeSubscriptionId, logger);
}

function invoicePeriodEnd(invoice: Stripe.Invoice): Date | null {
  const periodEnd = invoice.lines.data[0]?.period?.end;
  return unixToDate(periodEnd);
}

async function handleInvoiceStatus(
  db: DbExecutor,
  invoice: Stripe.Invoice,
  status: "active" | "past_due",
  logger: WebhookLogger,
) {
  const stripeSubscriptionId = stripeRef(
    (invoice as Stripe.Invoice & { subscription?: string | Stripe.Subscription | null }).subscription ?? null,
  );
  const stripeCustomerId = stripeRef(invoice.customer);
  const metadata = parseMetadata(
    (invoice.parent as { subscription_details?: { metadata?: Stripe.Metadata } } | null | undefined)?.subscription_details?.metadata,
    logger,
    {
      eventType: status === "active" ? "invoice.paid" : "invoice.payment_failed",
      invoiceId: invoice.id,
      customerId: stripeCustomerId,
      subscriptionId: stripeSubscriptionId,
    },
  );
  if (isManagedInvoiceMetadata(metadata)) {
    const handled = await handleManagedInvoiceRecurringStatus(
      db,
      invoice,
      metadata,
      status === "active" ? "paid" : "failed",
      logger,
    );
    if (handled) {
      return;
    }
  }
  const autoExecutionOrderId = resolveAutoExecutionOrderId(metadata);

  if (!stripeSubscriptionId || !stripeCustomerId) {
    logger.warn({ invoiceId: invoice.id, status }, "stripe_invoice_missing_subscription_or_customer");
    return;
  }

  const existing = await getSubscriptionRecord(db, stripeSubscriptionId);
  const userId = await resolveUserForStripeObject(db, {
    stripeCustomerId,
    stripeSubscriptionId,
    metadata,
  }, logger, {
    eventType: status === "active" ? "invoice.paid" : "invoice.payment_failed",
    invoiceId: invoice.id,
    customerId: stripeCustomerId,
    subscriptionId: stripeSubscriptionId,
  });

  if (!userId) {
    logger.warn({ stripeSubscriptionId, invoiceId: invoice.id, status }, "stripe_invoice_missing_local_subscription");
    return;
  }

  await upsertSubscriptionRecord(db, {
    userId,
    stripeSubscriptionId,
    stripeCustomerId,
    tier: deriveTierFromInvoice(invoice, existing),
    status,
    cancelAtPeriodEnd: existing?.cancelAtPeriodEnd ?? false,
    currentPeriodEnd: invoicePeriodEnd(invoice),
    metadata: mergeMetadata(existing?.metadata, metadata.raw, {
      source: "stripe_webhook",
      invoiceId: invoice.id,
      billingReason: invoice.billing_reason ?? null,
      billingInterval: deriveBillingIntervalFromInvoice(invoice, existing),
    }),
  });

  logger.info({
    eventType: status === "active" ? "invoice.paid" : "invoice.payment_failed",
    stripeSubscriptionId,
    stripeCustomerId,
    userId,
    tier: deriveTierFromInvoice(invoice, existing),
    status,
  }, "stripe_subscription_invoice_status_applied");
  await syncEntitlementFromStoredSubscription(db as Database, stripeSubscriptionId, logger);
  queueAutoExecution(db as Database, logger, autoExecutionOrderId, {
    eventType: status === "active" ? "invoice.paid" : "invoice.payment_failed",
    invoiceId: invoice.id,
    stripeSubscriptionId,
    userId,
  });
}

async function processEventByType(db: DbExecutor, event: Stripe.Event, logger: WebhookLogger) {
  switch (event.type) {
    case "checkout.session.completed":
      await handleCheckoutSessionCompleted(db, event.data.object as Stripe.Checkout.Session, logger);
      return;
    case "checkout.session.async_payment_failed":
      await handleManagedInvoiceAsyncCheckoutFailed(
        db,
        event.data.object as Stripe.Checkout.Session,
        logger,
        event.id,
      );
      return;
    case "invoice.paid":
      // Invoice success is the authoritative indicator that a subscription is genuinely billable.
      await handleInvoiceStatus(db, event.data.object as Stripe.Invoice, "active", logger);
      return;
    case "invoice.payment_failed":
      await handleInvoiceStatus(db, event.data.object as Stripe.Invoice, "past_due", logger);
      return;
    case "payment_intent.payment_failed":
      await handleManagedInvoicePaymentIntentFailed(
        db,
        event.data.object as Stripe.PaymentIntent,
        logger,
        event.id,
      );
      return;
    case "charge.failed":
      await handleManagedInvoiceChargeFailed(
        db,
        event.data.object as Stripe.Charge,
        logger,
        event.id,
      );
      return;
    case "customer.subscription.created":
    case "customer.subscription.updated":
      await handleSubscriptionCreatedOrUpdated(db, event, event.data.object as Stripe.Subscription, logger);
      return;
    case "customer.subscription.deleted":
      await handleSubscriptionDeleted(db, event, event.data.object as Stripe.Subscription, logger);
      return;
    default:
      return;
  }
}

export async function processStripeWebhookEvent(
  db: Database,
  event: Stripe.Event,
  logger: WebhookLogger,
): Promise<{ duplicate: boolean }> {
  const eventObject = event.data.object as { customer?: unknown; subscription?: unknown; id?: string };
  logger.info({
    eventId: event.id,
    eventType: event.type,
    customerId: stripeRef(eventObject.customer),
    subscriptionId: stripeRef(eventObject.subscription),
    objectId: typeof eventObject.id === "string" ? eventObject.id : null,
  }, "stripe_webhook_event_received");

  // Stripe retries deliveries until it receives a 2xx response. Recording each event ID
  // prevents duplicate side effects, and all downstream writes are upserts/updates so a
  // retried event remains safe even if it is re-processed during a race.
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${event.id}), 0)`);

    const [existing] = await tx
      .select({
        id: webhookEvents.id,
        processedAt: webhookEvents.processed_at,
      })
      .from(webhookEvents)
      .where(eq(webhookEvents.stripe_event_id, event.id))
      .limit(1);

    if (existing?.processedAt) {
      logger.info({ eventId: event.id, eventType: event.type }, "stripe_webhook_duplicate_ignored");
      return { duplicate: true };
    }

    if (!existing) {
      await tx
        .insert(webhookEvents)
        .values({
          provider: "stripe",
          stripe_event_id: event.id,
          stripe_event_type: event.type,
          payload: serializeWebhookPayload(event),
        })
        .onConflictDoNothing({ target: webhookEvents.stripe_event_id });
    }

    const [afterClaim] = await tx
      .select({
        id: webhookEvents.id,
        processedAt: webhookEvents.processed_at,
      })
      .from(webhookEvents)
      .where(eq(webhookEvents.stripe_event_id, event.id))
      .limit(1);

    if (afterClaim?.processedAt) {
      logger.info({ eventId: event.id, eventType: event.type }, "stripe_webhook_duplicate_ignored");
      return { duplicate: true };
    }

    await processEventByType(tx, event, logger);

    await tx
      .update(webhookEvents)
      .set({
        stripe_event_type: event.type,
        payload: serializeWebhookPayload(event),
        processed_at: new Date(),
        updated_at: new Date(),
      })
      .where(eq(webhookEvents.stripe_event_id, event.id));

    return { duplicate: false };
  });
}
