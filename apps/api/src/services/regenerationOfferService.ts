import Stripe from "stripe";
import { and, desc, eq, sql } from "drizzle-orm";
import { bookings, clients, orders, payments, type Database } from "@wisdom/db";
import {
  REGENERATION_OFFER_BOOKING_TYPE_ID,
  REGENERATION_OFFER_CODE,
  REGENERATION_OFFER_CURRENCY,
  REGENERATION_OFFER_PRICE_CENTS,
  REGENERATION_OFFER_TITLE,
  getRegenerationOfferPackageMetadata,
} from "@wisdom/utils";
import { createHttpError } from "./booking/errors.js";
import { createPaymentRecordForEntity, markPaymentPaidFromWebhook } from "./payments/paymentsService.js";

type DbExecutor = Pick<Database, "select" | "insert" | "update">;

type WebhookLogger = {
  info: (payload: unknown, message?: string) => void;
  warn: (payload: unknown, message?: string) => void;
  error: (payload: unknown, message?: string) => void;
};

export interface PendingRegenerationOfferOrder {
  orderId: string;
  paymentId: string;
}

function stripeRef(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "id" in value && typeof value.id === "string") {
    return value.id;
  }
  return null;
}

function parseObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
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

export function buildRegenerationOfferOrderMetadata(extra: Record<string, unknown> = {}) {
  const packageTerms = getRegenerationOfferPackageMetadata();
  return {
    source: "regeneration_offer_checkout",
    product_name: REGENERATION_OFFER_TITLE,
    invoice_label: REGENERATION_OFFER_TITLE,
    order_variant: "regeneration_offer",
    packageTerms,
    ...packageTerms,
    ...extra,
  };
}

export async function getRegenerationOfferIntakeBooking(
  db: DbExecutor,
  input: {
    userId: string;
    bookingId: string;
  },
) {
  const [booking] = await db
    .select({
      id: bookings.id,
      userId: bookings.user_id,
      sessionType: bookings.session_type,
      bookingTypeId: bookings.booking_type_id,
      status: bookings.status,
    })
    .from(bookings)
    .where(eq(bookings.id, input.bookingId))
    .limit(1);

  if (!booking || booking.userId !== input.userId) {
    throw createHttpError(404, "Regeneration Q&A Package intake record was not found.");
  }

  if (booking.sessionType !== "regeneration" || booking.bookingTypeId !== REGENERATION_OFFER_BOOKING_TYPE_ID) {
    throw createHttpError(400, "Checkout requires a Regeneration Q&A Package intake record.");
  }

  if (!["pending_payment", "paid"].includes(booking.status)) {
    throw createHttpError(400, "This Regeneration Q&A Package intake is no longer in a payable state.");
  }

  return booking;
}

export async function createPendingRegenerationOfferOrder(
  db: Database,
  input: {
    userId: string;
    userEmail: string;
    bookingId?: string | null;
  },
): Promise<PendingRegenerationOfferOrder> {
  return db.transaction(async (tx) => {
    const clientId = await getLatestClientIdForUser(tx, input.userId);
    const [order] = await tx
      .insert(orders)
      .values({
        user_id: input.userId,
        client_id: clientId,
        invoice_id: null,
        subscription_id: null,
        type: "regeneration_offer",
        label: REGENERATION_OFFER_TITLE,
        amount: REGENERATION_OFFER_PRICE_CENTS,
        currency: REGENERATION_OFFER_CURRENCY.toUpperCase(),
        status: "pending",
        payment_reference: null,
        stripe_payment_intent_id: null,
        stripe_subscription_id: null,
        metadata: buildRegenerationOfferOrderMetadata({
          userEmail: input.userEmail,
          bookingId: input.bookingId ?? null,
          createdForCheckoutAt: new Date().toISOString(),
        }),
      })
      .returning({ id: orders.id });

    const payment = await createPaymentRecordForEntity(tx, {
      userId: input.userId,
      entityType: "regeneration_offer",
      entityId: order.id,
      bookingId: input.bookingId ?? null,
      amountCents: REGENERATION_OFFER_PRICE_CENTS,
      currency: REGENERATION_OFFER_CURRENCY.toUpperCase(),
      status: "pending",
      metadata: {
        source: "regeneration_offer_checkout_create",
        orderId: order.id,
        bookingId: input.bookingId ?? null,
        offerCode: REGENERATION_OFFER_CODE,
        product_name: REGENERATION_OFFER_TITLE,
        packageTerms: getRegenerationOfferPackageMetadata(),
      },
    });

    return {
      orderId: order.id,
      paymentId: payment.id,
    };
  });
}

export async function attachRegenerationOfferCheckoutSession(
  db: DbExecutor,
  input: {
    orderId: string;
    paymentId: string;
    checkoutSessionId: string;
    checkoutUrl: string | null;
    stripePriceId: string;
    stripePriceEnvKey: string;
    stripeCustomerId: string | null;
  },
) {
  const now = new Date();
  const [payment] = await db
    .select({ metadata: payments.metadata })
    .from(payments)
    .where(eq(payments.id, input.paymentId))
    .limit(1);
  const [order] = await db
    .select({ metadata: orders.metadata })
    .from(orders)
    .where(eq(orders.id, input.orderId))
    .limit(1);

  await db
    .update(payments)
    .set({
      provider_customer_id: input.stripeCustomerId,
      metadata: {
        ...parseObject(payment?.metadata),
        source: "regeneration_offer_checkout_create",
        orderId: input.orderId,
        stripeCheckoutSessionId: input.checkoutSessionId,
        stripeCheckoutUrl: input.checkoutUrl,
        stripePriceId: input.stripePriceId,
        stripePriceEnvKey: input.stripePriceEnvKey,
      },
      updated_at: now,
    })
    .where(eq(payments.id, input.paymentId));

  await db
    .update(orders)
    .set({
      payment_reference: input.checkoutSessionId,
      metadata: buildRegenerationOfferOrderMetadata({
        ...parseObject(order?.metadata),
        stripeCheckoutSessionId: input.checkoutSessionId,
        stripeCheckoutUrl: input.checkoutUrl,
        stripePriceId: input.stripePriceId,
        stripePriceEnvKey: input.stripePriceEnvKey,
      }),
      updated_at: now,
    })
    .where(eq(orders.id, input.orderId));
}

export async function getRegenerationOfferPurchaseStatus(
  db: DbExecutor,
  input: {
    userId: string;
    checkoutSessionId: string;
  },
) {
  const [order] = await db
    .select({
      id: orders.id,
      status: orders.status,
      paymentReference: orders.payment_reference,
      stripePaymentIntentId: orders.stripe_payment_intent_id,
      metadata: orders.metadata,
      createdAt: orders.created_at,
      updatedAt: orders.updated_at,
    })
    .from(orders)
    .where(and(
      eq(orders.user_id, input.userId),
      eq(orders.type, "regeneration_offer"),
      sql`(${orders.payment_reference} = ${input.checkoutSessionId} or ${orders.metadata}->>'stripeCheckoutSessionId' = ${input.checkoutSessionId})`,
    ))
    .orderBy(desc(orders.created_at))
    .limit(1);

  if (!order) {
    return null;
  }

  return {
    orderId: order.id,
    status: order.status,
    completed: order.status === "completed",
    paymentReference: order.paymentReference,
    stripePaymentIntentId: order.stripePaymentIntentId,
    metadata: order.metadata,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt?.toISOString() ?? null,
  };
}

export async function handleRegenerationOfferCheckoutSessionCompleted(
  db: Database,
  session: Stripe.Checkout.Session,
  logger: WebhookLogger,
) {
  const metadata = session.metadata ?? {};
  if (metadata.type !== "regeneration_offer") {
    return false;
  }

  const orderId = metadata.orderId?.trim() || metadata.entityId?.trim();
  if (!orderId) {
    logger.warn({ checkoutSessionId: session.id }, "regeneration_offer_checkout_missing_order_id");
    return true;
  }

  if (session.payment_status !== "paid" && session.payment_status !== "no_payment_required") {
    logger.info({
      checkoutSessionId: session.id,
      orderId,
      paymentStatus: session.payment_status,
    }, "regeneration_offer_checkout_not_paid_ignored");
    return true;
  }

  const providerPaymentIntentId = stripeRef(session.payment_intent);
  const stripeCustomerId = stripeRef(session.customer);
  const [payment] = await db
    .select({
      id: payments.id,
      status: payments.status,
      metadata: payments.metadata,
    })
    .from(payments)
    .where(and(
      eq(payments.entity_type, "regeneration_offer"),
      eq(payments.entity_id, orderId),
    ))
    .orderBy(desc(payments.created_at))
    .limit(1);

  if (!payment) {
    logger.warn({ checkoutSessionId: session.id, orderId }, "regeneration_offer_payment_missing");
    return true;
  }

  const nextPaymentMetadata = {
    ...parseObject(payment.metadata),
    ...metadata,
    source: "stripe_webhook",
    stripeCheckoutSessionId: session.id,
    stripeCheckoutMode: session.mode,
    stripePaymentStatus: session.payment_status,
  };

  if (payment.status !== "paid") {
    await markPaymentPaidFromWebhook(db, {
      paymentId: payment.id,
      providerPaymentIntentId,
      providerCustomerId: stripeCustomerId,
      metadata: nextPaymentMetadata,
    });
  }

  const [order] = await db
    .select({ metadata: orders.metadata, status: orders.status })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);
  const orderMetadata = parseObject(order?.metadata);

  await db
    .update(orders)
    .set({
      status: "completed",
      payment_reference: session.id,
      stripe_payment_intent_id: providerPaymentIntentId,
      metadata: buildRegenerationOfferOrderMetadata({
        ...orderMetadata,
        source: "stripe_webhook",
        orderId,
        stripeCheckoutSessionId: session.id,
        stripeCheckoutMode: session.mode,
        stripePaymentStatus: session.payment_status,
        stripePaymentIntentId: providerPaymentIntentId,
        stripeCustomerId,
        completedAt: new Date().toISOString(),
      }),
      updated_at: new Date(),
    })
    .where(eq(orders.id, orderId));

  logger.info({
    checkoutSessionId: session.id,
    orderId,
    paymentId: payment.id,
    alreadyPaid: payment.status === "paid",
  }, "regeneration_offer_order_completed");

  return true;
}
