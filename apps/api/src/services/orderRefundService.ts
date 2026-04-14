import Stripe from "stripe";
import {
  bookings,
  clients,
  mentoringCircleRegistrations,
  mentorTrainingOrders,
  orders,
  payments,
  type Database,
} from "@wisdom/db";
import { desc, eq, or } from "drizzle-orm";
import { logger } from "@wisdom/utils";
import { createHttpError } from "./booking/errors.js";
import { getAdminOrderById, type AdminOrder } from "./ordersService.js";

type DbExecutor = Pick<Database, "select" | "insert" | "update" | "transaction">;

export const ADMIN_ORDER_REFUND_REASONS = [
  "requested_by_customer",
  "fraudulent",
  "duplicate",
  "other",
] as const;

export type AdminOrderRefundReason = typeof ADMIN_ORDER_REFUND_REASONS[number];

type StripeRefundReason = Exclude<Stripe.RefundCreateParams.Reason, "expired_uncaptured_charge">;

interface NormalizedRefundInput {
  reason: AdminOrderRefundReason;
  customReason: string | null;
}

interface RefundTarget {
  paymentIntentId: string | null;
  chargeId: string | null;
}

interface PersistedOrderRow {
  id: string;
  paymentReference: string | null;
  stripePaymentIntentId: string | null;
  metadata: unknown;
}

interface PaymentRow {
  id: string;
  status: string;
  providerPaymentIntentId: string | null;
  metadata: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function titleCase(value: string | null) {
  if (!value) return null;
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw createHttpError(503, "Stripe is not configured");
  }
  return new Stripe(key);
}

export function normalizeAdminOrderRefundInput(reason: string, customReason?: string | null): NormalizedRefundInput {
  const normalizedReason = reason.trim().toLowerCase();
  if (!ADMIN_ORDER_REFUND_REASONS.includes(normalizedReason as AdminOrderRefundReason)) {
    throw createHttpError(400, "Refund reason is required.");
  }

  const normalizedCustomReason = customReason?.trim() || null;
  if (normalizedReason === "other" && !normalizedCustomReason) {
    throw createHttpError(400, "Custom refund reason is required when 'Other' is selected.");
  }

  return {
    reason: normalizedReason as AdminOrderRefundReason,
    customReason: normalizedCustomReason,
  };
}

export function mapRefundReasonForStripe(reason: AdminOrderRefundReason): StripeRefundReason | null {
  switch (reason) {
    case "requested_by_customer":
      return "requested_by_customer";
    case "fraudulent":
      return "fraudulent";
    case "duplicate":
      return "duplicate";
    default:
      return null;
  }
}

function canRefundOrder(order: AdminOrder) {
  return order.status === "paid" || order.status === "completed" || order.status === "in_progress" || order.status === "processing";
}

function canRefundReport(order: AdminOrder) {
  return order.type === "report"
    && order.metadata.delivery_status !== "fulfilled"
    && order.execution.state !== "completed";
}

function validateOrderRefundPolicy(order: AdminOrder) {
  if (order.type === "subscription") {
    throw createHttpError(
      400,
      "Subscriptions are non-refundable. They can be canceled before the next billing cycle.",
    );
  }

  if (order.type === "report" && !canRefundReport(order)) {
    throw createHttpError(
      400,
      "Reports are non-refundable after delivery. Admin refunds are only allowed when a report has not been delivered within the projected timeframe.",
    );
  }
}

function buildPersistedOrderLabel(order: AdminOrder) {
  switch (order.type) {
    case "session":
      return order.metadata.session_type ? `${order.metadata.session_type} Session` : "Session";
    case "report":
      return order.metadata.report_type ? `${order.metadata.report_type} Report` : "Report";
    case "subscription":
      return order.metadata.plan_name
        ?? (order.membership_tier ? `${titleCase(order.membership_tier)} Membership` : "Subscription");
    case "webinar":
      return order.metadata.event_name ?? "Webinar";
    case "mentor_training":
      return order.metadata.training_package ?? order.metadata.plan_name ?? "Mentor Training";
    case "custom":
      return order.metadata.invoice_label ?? "Custom";
  }
}

function buildPersistedOrderMetadata(order: AdminOrder) {
  const metadata: Record<string, unknown> = {};

  if (order.type === "session") {
    metadata.bookingId = order.source_id;
    metadata.sessionType = order.metadata.session_type?.toLowerCase() ?? null;
    metadata.scheduledAt = order.metadata.scheduled_at;
    metadata.meetingLink = order.metadata.meeting_link;
  }

  if (order.type === "report") {
    metadata.reportId = order.source_id;
    metadata.reportType = order.metadata.report_type_id ?? order.metadata.report_type;
  }

  if (order.type === "subscription") {
    metadata.subscriptionId = order.source_id;
    metadata.subscription_id = order.source_id;
    metadata.billingInterval = order.metadata.billing_cycle;
  }

  if (order.type === "webinar") {
    metadata.eventKey = order.source_id;
    metadata.event_key = order.source_id;
    metadata.eventName = order.metadata.event_name;
    metadata.eventDate = order.metadata.event_date;
  }

  if (order.type === "mentor_training") {
    metadata.trainingOrderId = order.source_id;
    metadata.training_order_id = order.source_id;
    metadata.packageType = order.metadata.training_package_id ?? order.metadata.training_package;
  }

  if (order.metadata.invoice_id) {
    metadata.invoiceId = order.metadata.invoice_id;
  }

  return metadata;
}

function extractStripeChargeId(...sources: unknown[]) {
  for (const source of sources) {
    if (typeof source === "string" && source.startsWith("ch_")) {
      return source;
    }
    if (!isRecord(source)) {
      continue;
    }
    const chargeId = getString(source.chargeId)
      ?? getString(source.charge_id)
      ?? getString(source.stripeChargeId)
      ?? getString(source.stripe_charge_id)
      ?? getString(source.latestChargeId)
      ?? getString(source.latest_charge_id);
    if (chargeId) {
      return chargeId;
    }
  }
  return null;
}

async function getLatestClientIdForUser(db: DbExecutor, userId: string) {
  const [client] = await db
    .select({ id: clients.id })
    .from(clients)
    .where(eq(clients.user_id, userId))
    .orderBy(desc(clients.created_at))
    .limit(1);

  return client?.id ?? null;
}

async function getPaymentRowForOrder(db: DbExecutor, order: AdminOrder) {
  if (order.payment_id) {
    const [byId] = await db
      .select({
        id: payments.id,
        status: payments.status,
        providerPaymentIntentId: payments.provider_payment_intent_id,
        metadata: payments.metadata,
      })
      .from(payments)
      .where(eq(payments.id, order.payment_id))
      .limit(1);

    if (byId) {
      return byId satisfies PaymentRow;
    }
  }

  if (!order.stripe_payment_id) {
    return null;
  }

  const [byIntent] = await db
    .select({
      id: payments.id,
      status: payments.status,
      providerPaymentIntentId: payments.provider_payment_intent_id,
      metadata: payments.metadata,
    })
    .from(payments)
    .where(eq(payments.provider_payment_intent_id, order.stripe_payment_id))
    .orderBy(desc(payments.created_at))
    .limit(1);

  return byIntent ?? null;
}

async function findPersistedOrderRecord(db: DbExecutor, order: AdminOrder) {
  const conditions = [
    eq(orders.id, order.source_id),
    order.payment_id ? eq(orders.payment_reference, order.payment_id) : null,
    order.stripe_payment_id ? eq(orders.stripe_payment_intent_id, order.stripe_payment_id) : null,
  ].filter((condition): condition is NonNullable<typeof condition> => Boolean(condition));

  if (conditions.length === 0) {
    return null;
  }

  const [existing] = await db
    .select({
      id: orders.id,
      paymentReference: orders.payment_reference,
      stripePaymentIntentId: orders.stripe_payment_intent_id,
      metadata: orders.metadata,
    })
    .from(orders)
    .where(conditions.length === 1 ? conditions[0]! : or(...conditions));

  return existing ?? null;
}

async function ensurePersistedOrderRecord(
  db: DbExecutor,
  order: AdminOrder,
  payment: PaymentRow | null,
) {
  const existing = await findPersistedOrderRecord(db, order);
  if (existing) {
    return existing;
  }

  const clientId = await getLatestClientIdForUser(db, order.user_id);
  const paymentReference = order.payment_id ?? order.stripe_payment_id ?? order.source_id;

  const [created] = await db
    .insert(orders)
    .values({
      id: order.source_id,
      user_id: order.user_id,
      client_id: clientId,
      invoice_id: order.metadata.invoice_id,
      subscription_id: order.type === "subscription" ? order.source_id : null,
      type: order.type,
      label: buildPersistedOrderLabel(order),
      amount: Math.round(order.amount * 100),
      currency: order.currency || "CAD",
      status: order.status === "failed" ? "failed" : order.status === "refunded" ? "refunded" : "completed",
      payment_reference: paymentReference,
      stripe_payment_intent_id: order.stripe_payment_id ?? payment?.providerPaymentIntentId ?? null,
      stripe_subscription_id: order.metadata.stripe_subscription_id,
      refunded_at: order.refunded_at ? new Date(order.refunded_at) : null,
      refund_reason: order.refund_reason as AdminOrderRefundReason | null,
      refund_note: order.refund_note,
      metadata: buildPersistedOrderMetadata(order),
    })
    .onConflictDoNothing({ target: orders.payment_reference })
    .returning({
      id: orders.id,
      paymentReference: orders.payment_reference,
      stripePaymentIntentId: orders.stripe_payment_intent_id,
      metadata: orders.metadata,
    });

  if (created) {
    return created satisfies PersistedOrderRow;
  }

  const duplicate = await findPersistedOrderRecord(db, order);
  if (duplicate) {
    return duplicate;
  }

  throw new Error(`Persisted order could not be created for ${order.id}`);
}

function resolveRefundTarget(
  order: AdminOrder,
  persistedOrder: PersistedOrderRow | null,
  payment: PaymentRow | null,
): RefundTarget {
  const paymentIntentId = order.stripe_payment_id
    ?? persistedOrder?.stripePaymentIntentId
    ?? payment?.providerPaymentIntentId
    ?? null;
  const chargeId = extractStripeChargeId(
    persistedOrder?.paymentReference,
    persistedOrder?.metadata,
    payment?.metadata,
  );

  return { paymentIntentId, chargeId };
}

function buildRefundMetadata(
  metadata: unknown,
  input: NormalizedRefundInput,
  stripeRefundId: string,
  refundedAt: string,
) {
  const base = isRecord(metadata) ? metadata : {};
  return {
    ...base,
    refunded: true,
    refundReason: input.reason,
    refundNote: input.customReason,
    stripeRefundId,
    refundedAt,
  };
}

async function markSourceOrderCancelled(tx: DbExecutor, order: AdminOrder, now: Date) {
  if (order.type === "session") {
    await tx
      .update(bookings)
      .set({ status: "cancelled", updated_at: now })
      .where(eq(bookings.id, order.source_id));
    return;
  }

  if (order.type === "mentor_training") {
    await tx
      .update(mentorTrainingOrders)
      .set({ status: "cancelled", updated_at: now })
      .where(eq(mentorTrainingOrders.id, order.source_id));
    return;
  }

  if (order.type === "webinar") {
    await tx
      .update(mentoringCircleRegistrations)
      .set({ status: "cancelled", updated_at: now })
      .where(eq(mentoringCircleRegistrations.id, order.source_id));
  }
}

export async function refundAdminOrder(
  db: Database,
  input: {
    orderId: string;
    actorUserId: string;
    actorRole: string;
    reason: string;
    customReason?: string | null;
  },
) {
  if (input.actorRole !== "admin") {
    throw createHttpError(403, "Admin access required");
  }

  const normalizedInput = normalizeAdminOrderRefundInput(input.reason, input.customReason);
  const order = await getAdminOrderById(db, input.orderId);

  if (order.status === "refunded" || order.payment_status === "refunded") {
    throw createHttpError(400, "Order has already been refunded.");
  }

  validateOrderRefundPolicy(order);

  if (!canRefundOrder(order)) {
    throw createHttpError(400, "Only paid orders can be refunded.");
  }

  const payment = await getPaymentRowForOrder(db, order);
  const persistedOrder = await findPersistedOrderRecord(db, order);
  const target = resolveRefundTarget(order, persistedOrder, payment);

  if (!target.paymentIntentId && !target.chargeId) {
    throw createHttpError(400, "Order is missing a Stripe payment reference.");
  }

  const stripe = getStripe();
  const stripeReason = mapRefundReasonForStripe(normalizedInput.reason);
  const refund = await stripe.refunds.create({
    ...(target.paymentIntentId ? { payment_intent: target.paymentIntentId } : { charge: target.chargeId! }),
    ...(stripeReason ? { reason: stripeReason } : {}),
    metadata: {
      adminOrderId: order.id,
      actorUserId: input.actorUserId,
      refundReason: normalizedInput.reason,
      ...(normalizedInput.customReason ? { refundNote: normalizedInput.customReason } : {}),
    },
  });

  const now = new Date();
  const refundedAt = now.toISOString();

  await db.transaction(async (tx) => {
    const ensuredOrder = await ensurePersistedOrderRecord(tx, order, payment);

    await tx
      .update(orders)
      .set({
        status: "refunded",
        stripe_payment_intent_id: target.paymentIntentId ?? ensuredOrder.stripePaymentIntentId ?? null,
        refunded_at: now,
        refund_reason: normalizedInput.reason,
        refund_note: normalizedInput.customReason,
        updated_at: now,
      })
      .where(eq(orders.id, ensuredOrder.id));

    if (payment) {
      await tx
        .update(payments)
        .set({
          status: "refunded",
          metadata: buildRefundMetadata(payment.metadata, normalizedInput, refund.id, refundedAt),
          updated_at: now,
        })
        .where(eq(payments.id, payment.id));
    }

    await markSourceOrderCancelled(tx, order, now);
  });

  logger.info("admin_order_refunded", {
    orderId: order.id,
    sourceId: order.source_id,
    orderType: order.type,
    adminUserId: input.actorUserId,
    refundId: refund.id,
    reason: normalizedInput.reason,
    customReason: normalizedInput.customReason,
    refundedAt,
  });

  return getAdminOrderById(db, input.orderId);
}
