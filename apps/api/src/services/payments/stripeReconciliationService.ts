import { desc, eq } from "drizzle-orm";
import { payments, type Database } from "@wisdom/db";
import type Stripe from "stripe";
import { markPaymentPaidFromWebhook } from "./paymentsService.js";
import { parseStripeReferenceMetadata, type StripeReferenceEntityType } from "./stripeReferenceMetadata.js";

type DbExecutor = Pick<Database, "select" | "update">;

export type ReconciliationOutcome =
  | "paid"
  | "already_paid"
  | "failed"
  | "refunded"
  | "disputed"
  | "missing_reference"
  | "missing_local_payment"
  | "ignored_entity_type"
  | "invalid_state";

interface PaymentLookupRow {
  id: string;
  entityType: string;
  entityId: string;
  bookingId: string | null;
  status: string;
  providerPaymentIntentId: string | null;
  metadata: unknown;
}

export interface StripePaymentReconciliationResult {
  outcome: ReconciliationOutcome;
  paymentId: string | null;
  entityType: StripeReferenceEntityType | null;
  entityId: string | null;
  bookingId: string | null;
  providerPaymentIntentId: string | null;
  reason?: string;
}

function stripeRef(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "id" in value && typeof value.id === "string") {
    return value.id;
  }
  return null;
}

function mergeMetadata(...parts: Array<Record<string, unknown> | null | undefined>) {
  const merged = Object.assign({}, ...parts.filter(Boolean));
  return Object.keys(merged).length > 0 ? merged : null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function paymentIntentMetadata(paymentIntent: Stripe.PaymentIntent) {
  return parseStripeReferenceMetadata(paymentIntent.metadata);
}

async function findPaymentByReference(
  db: DbExecutor,
  input: {
    providerPaymentIntentId: string | null;
    entityType: StripeReferenceEntityType | null;
    entityId: string | null;
    bookingId: string | null;
  },
): Promise<PaymentLookupRow | null> {
  if (input.providerPaymentIntentId) {
    const [byIntent] = await db
      .select({
        id: payments.id,
        entityType: payments.entity_type,
        entityId: payments.entity_id,
        bookingId: payments.booking_id,
        status: payments.status,
        providerPaymentIntentId: payments.provider_payment_intent_id,
        metadata: payments.metadata,
      })
      .from(payments)
      .where(eq(payments.provider_payment_intent_id, input.providerPaymentIntentId))
      .limit(1);
    if (byIntent) return byIntent;
  }

  if (input.entityType && input.entityId) {
    const [byEntity] = await db
      .select({
        id: payments.id,
        entityType: payments.entity_type,
        entityId: payments.entity_id,
        bookingId: payments.booking_id,
        status: payments.status,
        providerPaymentIntentId: payments.provider_payment_intent_id,
        metadata: payments.metadata,
      })
      .from(payments)
      .where(eq(payments.entity_id, input.entityId))
      .orderBy(desc(payments.created_at))
      .limit(1);
    if (byEntity?.entityType === input.entityType) return byEntity;
  }

  if (input.bookingId) {
    const [byBooking] = await db
      .select({
        id: payments.id,
        entityType: payments.entity_type,
        entityId: payments.entity_id,
        bookingId: payments.booking_id,
        status: payments.status,
        providerPaymentIntentId: payments.provider_payment_intent_id,
        metadata: payments.metadata,
      })
      .from(payments)
      .where(eq(payments.booking_id, input.bookingId))
      .orderBy(desc(payments.created_at))
      .limit(1);
    if (byBooking) return byBooking;
  }

  return null;
}

async function setPendingPaymentFailed(
  db: DbExecutor,
  input: {
    providerPaymentIntentId: string | null;
    checkoutSessionId?: string | null;
    entityType: StripeReferenceEntityType | null;
    entityId: string | null;
    bookingId: string | null;
    reason: string;
    metadata?: Record<string, unknown> | null;
  },
) {
  const payment = await findPaymentByReference(db, input);
  if (!payment) return null;
  if (payment.status === "paid" || payment.status === "refunded") return payment;

  await db
    .update(payments)
    .set({
      status: "failed",
      provider_payment_intent_id: input.providerPaymentIntentId,
      metadata: mergeMetadata(asRecord(payment.metadata), input.metadata, {
        source: "stripe_webhook",
        failureCode: input.reason,
        stripeCheckoutSessionId: input.checkoutSessionId,
        stripePaymentIntentId: input.providerPaymentIntentId,
      }),
      updated_at: new Date(),
    })
    .where(eq(payments.id, payment.id));

  return payment;
}

async function updatePaymentByIntent(
  db: DbExecutor,
  input: {
    providerPaymentIntentId: string | null;
    status?: "refunded";
    metadata: Record<string, unknown>;
  },
) {
  if (!input.providerPaymentIntentId) return null;
  const payment = await findPaymentByReference(db, {
    providerPaymentIntentId: input.providerPaymentIntentId,
    entityType: null,
    entityId: null,
    bookingId: null,
  });
  if (!payment) return null;
  if (payment.status === "refunded" && input.status === "refunded") return payment;

  await db
    .update(payments)
    .set({
      ...(input.status ? { status: input.status } : {}),
      metadata: mergeMetadata(asRecord(payment.metadata), input.metadata),
      updated_at: new Date(),
    })
    .where(eq(payments.id, payment.id));

  return payment;
}

export async function reconcileSucceededSessionPaymentIntent(
  db: Database,
  paymentIntent: Stripe.PaymentIntent,
): Promise<StripePaymentReconciliationResult> {
  const metadata = paymentIntentMetadata(paymentIntent);
  if (metadata.entityType !== "session") {
    return {
      outcome: "ignored_entity_type",
      paymentId: null,
      entityType: metadata.entityType,
      entityId: metadata.entityId,
      bookingId: metadata.bookingId,
      providerPaymentIntentId: paymentIntent.id,
    };
  }

  const bookingId = metadata.bookingId ?? metadata.entityId;
  const entityId = metadata.entityId ?? bookingId;
  if (!entityId && !bookingId) {
    return {
      outcome: "missing_reference",
      paymentId: null,
      entityType: metadata.entityType,
      entityId,
      bookingId,
      providerPaymentIntentId: paymentIntent.id,
      reason: "Session payment intent did not include entityId or bookingId.",
    };
  }

  const payment = await findPaymentByReference(db, {
    providerPaymentIntentId: paymentIntent.id,
    entityType: "session",
    entityId,
    bookingId,
  });
  if (!payment) {
    return {
      outcome: "missing_local_payment",
      paymentId: null,
      entityType: "session",
      entityId,
      bookingId,
      providerPaymentIntentId: paymentIntent.id,
    };
  }

  if (payment.status === "paid") {
    if (!payment.providerPaymentIntentId) {
      await db
        .update(payments)
        .set({
          provider_payment_intent_id: paymentIntent.id,
          provider_customer_id: stripeRef(paymentIntent.customer),
          metadata: mergeMetadata(asRecord(payment.metadata), metadata.raw, {
            source: "stripe_webhook",
            stripePaymentIntentId: paymentIntent.id,
            stripePaymentIntentBackfilledAt: new Date().toISOString(),
          }),
          updated_at: new Date(),
        })
        .where(eq(payments.id, payment.id));
    }
    return {
      outcome: "already_paid",
      paymentId: payment.id,
      entityType: "session",
      entityId,
      bookingId: payment.bookingId ?? bookingId,
      providerPaymentIntentId: paymentIntent.id,
    };
  }

  if (payment.status === "refunded") {
    return {
      outcome: "invalid_state",
      paymentId: payment.id,
      entityType: "session",
      entityId,
      bookingId: payment.bookingId ?? bookingId,
      providerPaymentIntentId: paymentIntent.id,
      reason: "Refunded session payment cannot be promoted to paid.",
    };
  }

  await markPaymentPaidFromWebhook(db, {
    paymentId: payment.id,
    providerPaymentIntentId: paymentIntent.id,
    providerCustomerId: stripeRef(paymentIntent.customer),
    metadata: mergeMetadata(asRecord(payment.metadata), metadata.raw, {
      source: "stripe_webhook",
      stripePaymentIntentId: paymentIntent.id,
      stripePaymentIntentSucceededAt: new Date().toISOString(),
    }),
  });

  return {
    outcome: "paid",
    paymentId: payment.id,
    entityType: "session",
    entityId,
    bookingId: payment.bookingId ?? bookingId,
    providerPaymentIntentId: paymentIntent.id,
  };
}

export async function reconcileCheckoutSessionExpired(
  db: Database,
  session: Stripe.Checkout.Session,
): Promise<StripePaymentReconciliationResult> {
  const metadata = parseStripeReferenceMetadata(session.metadata);
  const payment = await setPendingPaymentFailed(db, {
    providerPaymentIntentId: stripeRef(session.payment_intent),
    checkoutSessionId: session.id,
    entityType: metadata.entityType,
    entityId: metadata.entityId,
    bookingId: metadata.bookingId,
    reason: "checkout_session_expired",
    metadata: metadata.raw,
  });

  return {
    outcome: payment ? "failed" : "missing_local_payment",
    paymentId: payment?.id ?? null,
    entityType: metadata.entityType,
    entityId: metadata.entityId,
    bookingId: payment?.bookingId ?? metadata.bookingId,
    providerPaymentIntentId: stripeRef(session.payment_intent),
    reason: "checkout_session_expired",
  };
}

export async function reconcileCanceledPaymentIntent(
  db: Database,
  paymentIntent: Stripe.PaymentIntent,
): Promise<StripePaymentReconciliationResult> {
  const metadata = paymentIntentMetadata(paymentIntent);
  const payment = await setPendingPaymentFailed(db, {
    providerPaymentIntentId: paymentIntent.id,
    entityType: metadata.entityType,
    entityId: metadata.entityId,
    bookingId: metadata.bookingId,
    reason: "payment_intent_canceled",
    metadata: metadata.raw,
  });

  return {
    outcome: payment ? "failed" : "missing_local_payment",
    paymentId: payment?.id ?? null,
    entityType: metadata.entityType,
    entityId: metadata.entityId,
    bookingId: payment?.bookingId ?? metadata.bookingId,
    providerPaymentIntentId: paymentIntent.id,
    reason: "payment_intent_canceled",
  };
}

export async function reconcileChargeRefunded(
  db: Database,
  charge: Stripe.Charge,
): Promise<StripePaymentReconciliationResult> {
  const providerPaymentIntentId = stripeRef(charge.payment_intent);
  const payment = await updatePaymentByIntent(db, {
    providerPaymentIntentId,
    status: "refunded",
    metadata: {
      source: "stripe_webhook",
      stripeChargeId: charge.id,
      stripePaymentIntentId: providerPaymentIntentId,
      stripeRefundedAt: new Date().toISOString(),
      stripeAmountRefunded: charge.amount_refunded ?? null,
      stripeAmountCaptured: charge.amount_captured ?? charge.amount ?? null,
    },
  });

  return {
    outcome: payment ? "refunded" : "missing_local_payment",
    paymentId: payment?.id ?? null,
    entityType: payment?.entityType as StripeReferenceEntityType | null ?? null,
    entityId: payment?.entityId ?? null,
    bookingId: payment?.bookingId ?? null,
    providerPaymentIntentId,
  };
}

export async function reconcileChargeDispute(
  db: Database,
  dispute: Stripe.Dispute,
  eventType: string,
): Promise<StripePaymentReconciliationResult> {
  const disputeObject = dispute as Stripe.Dispute & { payment_intent?: unknown };
  const providerPaymentIntentId = stripeRef(disputeObject.payment_intent);
  const payment = await updatePaymentByIntent(db, {
    providerPaymentIntentId,
    metadata: {
      source: "stripe_webhook",
      stripeDisputeId: dispute.id,
      stripeDisputeStatus: dispute.status,
      stripeDisputeReason: dispute.reason,
      stripeDisputeEventType: eventType,
      stripePaymentIntentId: providerPaymentIntentId,
      stripeDisputeUpdatedAt: new Date().toISOString(),
    },
  });

  return {
    outcome: payment ? "disputed" : "missing_local_payment",
    paymentId: payment?.id ?? null,
    entityType: payment?.entityType as StripeReferenceEntityType | null ?? null,
    entityId: payment?.entityId ?? null,
    bookingId: payment?.bookingId ?? null,
    providerPaymentIntentId,
  };
}
