import Stripe from "stripe";
import {
  bookings,
  bookingTypes,
  orders as persistedOrdersTable,
  users,
  type Database,
} from "@wisdom/db";
import { logger } from "@wisdom/utils";
import { and, eq, or, sql } from "drizzle-orm";
import { createHttpError } from "./booking/errors.js";
import { getAdminOrderById, parseOrderId } from "./ordersService.js";
import { ensureStripeCustomerId } from "./payments/stripeCustomerService.js";
import {
  mergeStripeMetadata,
  resolveStripeProductNaming,
} from "./stripe/stripeProductNamingService.js";

let stripeSingleton: Stripe | null = null;

function getStripe(): Stripe {
  if (!stripeSingleton) {
    const key = process.env.STRIPE_SECRET_KEY?.trim();
    if (!key) {
      throw new Error("STRIPE_SECRET_KEY not set");
    }
    stripeSingleton = new Stripe(key);
  }
  return stripeSingleton;
}

function logInvoice(level: "info" | "warn" | "error", message: string, context: Record<string, unknown>) {
  if (level === "error") {
    logger.error(message, context);
    return;
  }
  if (level === "warn") {
    logger.warn(message, context);
    return;
  }
  logger.info(message, context);
}

type InvoiceOrigin =
  | "admin_manual_recovery"
  | "automated_retry"
  | "abandoned_checkout"
  | "payment_failure_recovery"
  | "client_requested"
  | "subscription_reactivation";
type InvoiceActorType = "admin" | "system" | "webhook" | "stripe";

const ADMIN_MANUAL_INVOICE_ORIGIN: InvoiceOrigin = "admin_manual_recovery";

interface InvoiceTimelineEvent {
  timestamp: string;
  type: string;
  actor_type: InvoiceActorType;
  actor_label: string | null;
  admin_user_id: string | null;
  stripe_invoice_id: string;
  invoice_origin: InvoiceOrigin;
  status: string | null;
}

type MetadataRecord = Record<string, unknown>;

function isRecord(value: unknown): value is MetadataRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeMetadata(value: unknown): MetadataRecord {
  return isRecord(value) ? { ...value } : {};
}

function getInvoiceTimeline(value: unknown): InvoiceTimelineEvent[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is InvoiceTimelineEvent => isRecord(entry) && typeof entry.type === "string");
}

export function resolveInvoicePriceSnapshot(input: {
  orderMetadata?: unknown;
  bookingIntakeSnapshot?: unknown;
  fallbackAmountCents: number;
  fallbackCurrency: string;
}) {
  const orderMetadata = isRecord(input.orderMetadata) ? input.orderMetadata : null;
  const bookingSnapshot = isRecord(input.bookingIntakeSnapshot) ? input.bookingIntakeSnapshot : null;
  const snapshotAmount = getNumber(orderMetadata?.price_snapshot_cents)
    ?? getNumber(orderMetadata?.priceSnapshotCents)
    ?? getNumber(bookingSnapshot?.price_snapshot_cents)
    ?? getNumber(bookingSnapshot?.priceSnapshotCents);
  const snapshotCurrency = getString(orderMetadata?.price_snapshot_currency)
    ?? getString(orderMetadata?.priceSnapshotCurrency)
    ?? getString(bookingSnapshot?.price_snapshot_currency)
    ?? getString(bookingSnapshot?.priceSnapshotCurrency);

  if (snapshotAmount !== null && Number.isInteger(snapshotAmount) && snapshotAmount > 0) {
    return {
      amountCents: snapshotAmount,
      currency: snapshotCurrency ?? input.fallbackCurrency,
      source: "snapshot" as const,
    };
  }

  return {
    amountCents: input.fallbackAmountCents,
    currency: input.fallbackCurrency,
    source: "booking_type_fallback" as const,
  };
}

export function buildInvoiceTimelineEvents(input: {
  timestamp: string;
  stripeInvoiceId: string;
  stripeInvoiceStatus: string;
  invoiceOrigin?: InvoiceOrigin;
  actorLabel?: string | null;
  adminUserId?: string | null;
}): InvoiceTimelineEvent[] {
  const base = {
    timestamp: input.timestamp,
    actor_type: "admin" as const,
    actor_label: input.actorLabel ?? "Admin",
    admin_user_id: input.adminUserId ?? null,
    stripe_invoice_id: input.stripeInvoiceId,
    invoice_origin: input.invoiceOrigin ?? ADMIN_MANUAL_INVOICE_ORIGIN,
    status: input.stripeInvoiceStatus,
  };

  return [
    { ...base, type: "invoice_created" },
    { ...base, type: "invoice_emailed_to_customer" },
  ];
}

export function appendInvoiceTimelineEvents(metadata: unknown, events: InvoiceTimelineEvent[]) {
  const base = normalizeMetadata(metadata);
  return {
    ...base,
    invoice_timeline: [...getInvoiceTimeline(base.invoice_timeline), ...events],
  };
}

function isPersistedOrderTypeMatch(orderType: string, parsedType: ReturnType<typeof parseOrderId>["type"]) {
  if (parsedType === "subscription") {
    return orderType === "subscription" || orderType === "subscription_initial" || orderType === "subscription_renewal";
  }
  return orderType === parsedType;
}

function isRegenerationSubscriptionMetadata(metadata: Awaited<ReturnType<typeof getAdminOrderById>>["metadata"]) {
  return metadata.order_variant === "regeneration_monthly_package"
    || metadata.plan_name === "Regeneration Monthly Package"
    || metadata.invoice_label === "Regeneration Monthly Package"
    || metadata.product_name === "Regeneration Monthly Package";
}

export function assertOrderCanCreateInvoice(order: Pick<Awaited<ReturnType<typeof getAdminOrderById>>, "type" | "status" | "metadata">) {
  const isSupportedMembershipSubscription = order.type === "subscription"
    && !isRegenerationSubscriptionMetadata(order.metadata);
  if (order.type !== "session" && !isSupportedMembershipSubscription) {
    throw createHttpError(400, "Manual invoice creation is currently only supported for session orders and recurring membership subscriptions.");
  }

  if (["paid", "completed", "refunded", "cancelled"].includes(order.status)) {
    throw createHttpError(409, "Invoice cannot be created for an order that is already paid or closed.");
  }

  if (order.metadata.stripe_invoice_id) {
    throw createHttpError(409, "Invoice already exists for this order.");
  }
}

function normalizeStripeInvoiceStatus(status: Stripe.Invoice.Status | null | undefined) {
  return status ?? "open";
}

export interface CreateAdminOrderInvoiceResult {
  success: true;
  invoiceId: string;
  invoiceUrl: string | null;
  invoiceStatus: string;
  order: Awaited<ReturnType<typeof getAdminOrderById>>;
}

export async function createAdminOrderInvoice(
  db: Database,
  input: {
    orderId: string;
    adminUserId?: string | null;
    adminActorLabel?: string | null;
  },
): Promise<CreateAdminOrderInvoiceResult> {
  const parsed = parseOrderId(input.orderId);
  const order = await getAdminOrderById(db, input.orderId);
  assertOrderCanCreateInvoice(order);

  logInvoice("info", "admin_order_invoice_create_attempt", {
    orderId: input.orderId,
    parsedType: parsed.type,
    sourceId: parsed.sourceId,
    localOrderType: order.type,
    localOrderStatus: order.status,
    invoiceOrigin: ADMIN_MANUAL_INVOICE_ORIGIN,
  });

  const persistedRows = await db
    .select({
      id: persistedOrdersTable.id,
      userId: persistedOrdersTable.user_id,
      type: persistedOrdersTable.type,
      label: persistedOrdersTable.label,
      amount: persistedOrdersTable.amount,
      currency: persistedOrdersTable.currency,
      stripeInvoiceId: persistedOrdersTable.stripe_invoice_id,
      metadata: persistedOrdersTable.metadata,
      email: users.email,
    })
    .from(persistedOrdersTable)
    .innerJoin(users, eq(persistedOrdersTable.user_id, users.id))
    .where(and(
      eq(persistedOrdersTable.archived, false),
      or(
        eq(persistedOrdersTable.id, parsed.sourceId),
        eq(persistedOrdersTable.subscription_id, parsed.sourceId),
        sql`${persistedOrdersTable.metadata}->>'bookingId' = ${parsed.sourceId}`,
        sql`${persistedOrdersTable.metadata}->>'booking_id' = ${parsed.sourceId}`,
        sql`${persistedOrdersTable.metadata}->>'subscriptionId' = ${parsed.sourceId}`,
        sql`${persistedOrdersTable.metadata}->>'subscription_id' = ${parsed.sourceId}`,
      ),
    ))
    .limit(5);

  let row = persistedRows.find((entry) => isPersistedOrderTypeMatch(entry.type, parsed.type)) ?? null;

  if (persistedRows.length > 0 && !row) {
    throw createHttpError(409, "Invoice cannot be generated for this order state.");
  }

  if (row?.stripeInvoiceId) {
    throw createHttpError(409, "Invoice already exists for this order.");
  }

  let priceSource: "persisted_order" | "snapshot" | "booking_type_fallback" | "admin_order_snapshot" = "persisted_order";
  let metadata = normalizeMetadata(row?.metadata);

  if (!row && parsed.type === "subscription") {
    const amountCents = Math.round(order.amount * 100);
    if (!Number.isInteger(amountCents) || amountCents <= 0) {
      throw createHttpError(400, "Subscription pricing is missing, so an invoice cannot be generated.");
    }
    priceSource = "admin_order_snapshot";

    metadata = {
      subscriptionId: parsed.sourceId,
      subscription_id: parsed.sourceId,
      adminOrderId: input.orderId,
      tier: order.membership_tier,
      billingInterval: order.metadata.billing_cycle,
      billing_interval: order.metadata.billing_cycle,
      invoice_origin: ADMIN_MANUAL_INVOICE_ORIGIN,
      price_snapshot_cents: amountCents,
      price_snapshot_currency: order.currency || "CAD",
      price_source: "admin_order_snapshot",
      invoice_timeline: [],
    };

    const [createdOrder] = await db
      .insert(persistedOrdersTable)
      .values({
        user_id: order.user_id,
        subscription_id: parsed.sourceId,
        type: "subscription",
        label: order.product_name || order.metadata.plan_name || "Premium Member Subscription",
        amount: amountCents,
        currency: order.currency || "CAD",
        status: "pending",
        metadata,
      })
      .returning({
        id: persistedOrdersTable.id,
        userId: persistedOrdersTable.user_id,
        type: persistedOrdersTable.type,
        label: persistedOrdersTable.label,
        amount: persistedOrdersTable.amount,
        currency: persistedOrdersTable.currency,
        stripeInvoiceId: persistedOrdersTable.stripe_invoice_id,
        metadata: persistedOrdersTable.metadata,
      });

    row = {
      ...createdOrder,
      email: order.email,
    };

    logInvoice("info", "admin_order_invoice_persisted_subscription_order_created", {
      orderId: input.orderId,
      persistedOrderId: row.id,
      sourceId: parsed.sourceId,
      userId: row.userId,
      invoiceOrigin: ADMIN_MANUAL_INVOICE_ORIGIN,
      priceSource,
    });
  }

  if (!row) {
    const [booking] = await db
      .select({
        id: bookings.id,
        userId: bookings.user_id,
        fullName: bookings.full_name,
        bookingEmail: bookings.email,
        intakeSnapshot: bookings.intake_snapshot,
        bookingTypeName: bookingTypes.name,
        durationMinutes: bookingTypes.duration_minutes,
        priceCents: bookingTypes.price_cents,
        currency: bookingTypes.currency,
        userEmail: users.email,
      })
      .from(bookings)
      .innerJoin(bookingTypes, eq(bookings.booking_type_id, bookingTypes.id))
      .innerJoin(users, eq(bookings.user_id, users.id))
      .where(eq(bookings.id, parsed.sourceId))
      .limit(1);

    if (!booking) {
      logInvoice("warn", "admin_order_invoice_booking_source_missing", {
        orderId: input.orderId,
        sourceId: parsed.sourceId,
      });
      throw createHttpError(404, "No session source record exists for this order.");
    }

    const price = resolveInvoicePriceSnapshot({
      orderMetadata: order.metadata,
      bookingIntakeSnapshot: booking.intakeSnapshot,
      fallbackAmountCents: booking.priceCents,
      fallbackCurrency: booking.currency,
    });
    priceSource = price.source;

    if (!Number.isInteger(price.amountCents) || price.amountCents <= 0) {
      throw createHttpError(400, "Session pricing is missing, so an invoice cannot be generated.");
    }

    metadata = {
      bookingId: booking.id,
      booking_id: booking.id,
      adminOrderId: input.orderId,
      sessionType: order.metadata.session_type,
      session_type: order.metadata.session_type,
      session_duration_minutes: booking.durationMinutes,
      invoice_origin: ADMIN_MANUAL_INVOICE_ORIGIN,
      price_snapshot_cents: price.amountCents,
      price_snapshot_currency: price.currency,
      price_source: price.source,
      invoice_timeline: [],
    };

    const [createdOrder] = await db
      .insert(persistedOrdersTable)
      .values({
        user_id: booking.userId,
        type: "session",
        label: booking.bookingTypeName || order.metadata.session_type || "Session",
        amount: price.amountCents,
        currency: price.currency,
        status: "pending",
        metadata,
      })
      .returning({
        id: persistedOrdersTable.id,
        userId: persistedOrdersTable.user_id,
        type: persistedOrdersTable.type,
        label: persistedOrdersTable.label,
        amount: persistedOrdersTable.amount,
        currency: persistedOrdersTable.currency,
        stripeInvoiceId: persistedOrdersTable.stripe_invoice_id,
        metadata: persistedOrdersTable.metadata,
      });

    row = {
      ...createdOrder,
      email: booking.bookingEmail ?? booking.userEmail,
    };

    logInvoice("info", "admin_order_invoice_persisted_order_created", {
      orderId: input.orderId,
      persistedOrderId: row.id,
      sourceId: parsed.sourceId,
      userId: row.userId,
      invoiceOrigin: ADMIN_MANUAL_INVOICE_ORIGIN,
      priceSource,
    });
  } else {
    metadata = {
      ...metadata,
      bookingId: parsed.type === "session" ? getString(metadata.bookingId) ?? parsed.sourceId : getString(metadata.bookingId),
      booking_id: parsed.type === "session" ? getString(metadata.booking_id) ?? parsed.sourceId : getString(metadata.booking_id),
      subscriptionId: parsed.type === "subscription" ? getString(metadata.subscriptionId) ?? parsed.sourceId : getString(metadata.subscriptionId),
      subscription_id: parsed.type === "subscription" ? getString(metadata.subscription_id) ?? parsed.sourceId : getString(metadata.subscription_id),
      adminOrderId: getString(metadata.adminOrderId) ?? input.orderId,
      invoice_origin: getString(metadata.invoice_origin) ?? ADMIN_MANUAL_INVOICE_ORIGIN,
      price_snapshot_cents: getNumber(metadata.price_snapshot_cents) ?? row.amount,
      price_snapshot_currency: getString(metadata.price_snapshot_currency) ?? row.currency,
      price_source: getString(metadata.price_source) ?? "persisted_order",
    };
  }

  const email = row.email?.trim();
  if (!email) {
    throw createHttpError(400, "A customer email is required before an invoice can be created.");
  }

  if (!Number.isInteger(row.amount) || row.amount <= 0) {
    throw createHttpError(400, "Order amount must be greater than zero to create an invoice.");
  }

  const stripe = getStripe();
  const currency = row.currency.trim().toLowerCase();
  const sessionDuration = getNumber(metadata.session_duration_minutes);
  const naming = order.type === "subscription"
    ? resolveStripeProductNaming({
      type: "subscription",
      subscriptionType: "membership",
      tier: order.membership_tier ?? getString(metadata.tier),
      billingInterval: getString(metadata.billingInterval) ?? getString(metadata.billing_interval),
    })
    : resolveStripeProductNaming({
      type: "session",
      sessionType: getString(metadata.sessionType) ?? getString(metadata.session_type),
      durationMinutes: sessionDuration,
      fallbackName: row.label,
    });
  const description = naming.description;

  try {
    const customerId = await ensureStripeCustomerId(db, {
      stripe,
      userId: row.userId,
      email,
      name: order.client_name,
      metadata: {
        userId: row.userId,
        email,
      },
    });

    const stripeMetadata = mergeStripeMetadata(naming.metadata, {
      adminOrderId: input.orderId,
      persistedOrderId: row.id,
      type: order.type,
      invoice_origin: ADMIN_MANUAL_INVOICE_ORIGIN,
    });

    const draftInvoice = await stripe.invoices.create({
      customer: customerId,
      auto_advance: true,
      collection_method: "send_invoice",
      days_until_due: 7,
      description,
      metadata: stripeMetadata,
    });

    await stripe.invoiceItems.create({
      customer: customerId,
      invoice: draftInvoice.id,
      amount: row.amount,
      currency,
      description,
      metadata: stripeMetadata,
    });

    const finalizedInvoice = draftInvoice.status === "draft"
      ? await stripe.invoices.finalizeInvoice(draftInvoice.id)
      : draftInvoice;
    const sentInvoice = finalizedInvoice.status === "open"
      ? await stripe.invoices.sendInvoice(finalizedInvoice.id)
      : finalizedInvoice;

    const stripeInvoiceId = sentInvoice.id;
    const stripeInvoiceUrl = sentInvoice.hosted_invoice_url ?? finalizedInvoice.hosted_invoice_url ?? null;
    const stripeInvoiceStatus = normalizeStripeInvoiceStatus(sentInvoice.status);
    const invoiceTimelineEvents = buildInvoiceTimelineEvents({
      timestamp: new Date().toISOString(),
      stripeInvoiceId,
      stripeInvoiceStatus,
      invoiceOrigin: ADMIN_MANUAL_INVOICE_ORIGIN,
      actorLabel: input.adminActorLabel,
      adminUserId: input.adminUserId,
    });
    const nextMetadata = appendInvoiceTimelineEvents({
      ...metadata,
      product_name: naming.productName,
      stripe_invoice_id: stripeInvoiceId,
      stripe_invoice_status: stripeInvoiceStatus,
    }, invoiceTimelineEvents);

    await db
      .update(persistedOrdersTable)
      .set({
        stripe_invoice_id: stripeInvoiceId,
        stripe_invoice_url: stripeInvoiceUrl,
        stripe_invoice_status: stripeInvoiceStatus,
        metadata: nextMetadata,
        updated_at: new Date(),
      })
      .where(eq(persistedOrdersTable.id, row.id));

    logInvoice("info", "admin_order_invoice_create_success", {
      orderId: input.orderId,
      persistedOrderId: row.id,
      sourceId: parsed.sourceId,
      stripeCustomerId: customerId,
      stripeInvoiceId,
      stripeInvoiceStatus,
      invoiceOrigin: ADMIN_MANUAL_INVOICE_ORIGIN,
      priceSource,
    });

    const updatedOrder = await getAdminOrderById(db, input.orderId);
    return {
      success: true,
      invoiceId: stripeInvoiceId,
      invoiceUrl: stripeInvoiceUrl,
      invoiceStatus: stripeInvoiceStatus,
      order: updatedOrder,
    };
  } catch (error) {
    logInvoice("error", "admin_order_invoice_create_failed", {
      orderId: input.orderId,
      persistedOrderId: row.id,
      sourceId: parsed.sourceId,
      invoiceOrigin: ADMIN_MANUAL_INVOICE_ORIGIN,
      priceSource,
      error: error instanceof Error ? error.message : error,
    });

    if (error instanceof Error && "statusCode" in error) {
      throw error;
    }

    throw createHttpError(502, "Unable to create invoice. Please try again.");
  }
}
