import { and, eq, sql } from "drizzle-orm";
import {
  orders,
  payments,
  users,
  webinarRecordingEntitlements,
  type Database,
} from "@wisdom/db";
import { getOnDemandWebinarById, logger } from "@wisdom/utils";
import {
  canAcceptOnDemandPaymentStatus,
  resolveOnDemandWebinarStripePriceId,
} from "../../config/onDemandWebinarBilling.js";
import { createHttpError } from "../booking/errors.js";
import { sendNotification } from "../notifications/notificationService.js";

export interface OnDemandWebinarCheckoutSessionLike {
  id: string;
  payment_status?: string | null;
  amount_total?: number | null;
  currency?: string | null;
  payment_intent?: string | { id?: string | null } | null;
  metadata?: Record<string, string | undefined> | null;
}

export interface FulfillOnDemandWebinarPurchaseResult {
  entitlementId: string;
  paymentId: string;
  orderId: string | null;
  webinarId: string;
  userId: string;
  duplicatePayment: boolean;
  notificationQueued: boolean;
}

function stripeRef(value: string | { id?: string | null } | null | undefined) {
  if (!value) return null;
  if (typeof value === "string") return value;
  return value.id ?? null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function mergeMetadata(
  ...parts: Array<Record<string, unknown> | null | undefined>
): Record<string, unknown> {
  return Object.assign({}, ...parts.filter((part) => part && Object.keys(part).length > 0));
}

async function resolveUserContact(db: Database, userId: string) {
  const [user] = await db
    .select({
      email: users.email,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const email = user?.email?.trim() || null;
  const firstName = email ? email.split("@")[0] : null;
  return { email, firstName };
}

export async function persistOnDemandWebinarOrder(
  db: Database,
  input: {
    userId: string;
    webinarId: string;
    title: string;
    amountCents: number;
    currency: string;
    paymentReference: string;
    stripePaymentIntentId?: string | null;
    stripeCheckoutSessionId?: string | null;
    entitlementId?: string | null;
    paymentId?: string | null;
    duplicatePayment?: boolean;
  },
) {
  const [existing] = await db
    .select()
    .from(orders)
    .where(eq(orders.payment_reference, input.paymentReference))
    .limit(1);
  if (existing) {
    return existing;
  }

  const [created] = await db
    .insert(orders)
    .values({
      user_id: input.userId,
      type: "on_demand_webinar",
      label: input.title,
      amount: input.amountCents,
      currency: input.currency,
      status: "completed",
      payment_reference: input.paymentReference,
      stripe_payment_intent_id: input.stripePaymentIntentId ?? null,
      metadata: {
        source: "on_demand_webinar_purchase",
        webinarId: input.webinarId,
        product_name: input.title,
        event_name: input.title,
        entitlementId: input.entitlementId ?? null,
        paymentId: input.paymentId ?? null,
        stripeCheckoutSessionId: input.stripeCheckoutSessionId ?? null,
        duplicatePayment: input.duplicatePayment === true,
        grant_source: "stripe_checkout",
      },
    })
    .onConflictDoNothing()
    .returning();

  return created
    ?? (await db.select().from(orders).where(eq(orders.payment_reference, input.paymentReference)).limit(1))[0]
    ?? null;
}

export async function sendOnDemandWebinarConfirmedNotification(
  db: Database,
  input: {
    entitlementId: string;
    userId: string;
    webinarId: string;
    title: string;
    amountCents: number;
    currency: string;
    orderId?: string | null;
    purchasedAt?: Date | null;
  },
) {
  const webinar = getOnDemandWebinarById(input.webinarId);
  const contact = await resolveUserContact(db, input.userId);
  return sendNotification(db, {
    event: "on_demand_webinar.confirmed",
    userId: input.userId,
    payload: {
      entityId: input.entitlementId,
      webinarId: input.webinarId,
      eventTitle: input.title,
      firstName: contact.firstName,
      email: contact.email,
      amountCents: input.amountCents,
      currency: input.currency,
      purchasedAt: (input.purchasedAt ?? new Date()).toISOString(),
      orderRef: input.orderId ?? input.entitlementId,
      watchPath: webinar?.playerPath ?? `/dashboard/webinars/${input.webinarId}`,
    },
  });
}

export async function fulfillOnDemandWebinarPurchase(
  db: Database,
  input: {
    userId: string;
    session: OnDemandWebinarCheckoutSessionLike;
    webinarId?: string | null;
  },
): Promise<FulfillOnDemandWebinarPurchaseResult> {
  const metadata = input.session.metadata ?? {};
  const webinarId = (input.webinarId ?? metadata.webinarId ?? metadata.entityId ?? "").trim();
  const webinar = getOnDemandWebinarById(webinarId);
  if (!webinar) {
    throw createHttpError(404, "On-demand webinar was not found.");
  }

  if (!canAcceptOnDemandPaymentStatus({
    paymentStatus: input.session.payment_status,
    amountTotal: input.session.amount_total,
    metadata,
  })) {
    throw createHttpError(409, "On-demand webinar fulfillment requires a paid Stripe checkout.");
  }

  const expectedPrice = resolveOnDemandWebinarStripePriceId(webinar);
  const sessionPriceId = metadata.stripePriceId?.trim() || metadata.stripe_price_id?.trim() || "";
  if (sessionPriceId && sessionPriceId !== expectedPrice.priceId) {
    throw createHttpError(409, "On-demand webinar checkout used an unexpected Stripe price.");
  }

  const paymentIntentId = stripeRef(input.session.payment_intent);
  const amountCents = typeof input.session.amount_total === "number"
    ? input.session.amount_total
    : webinar.priceCents;
  const currency = (input.session.currency ?? webinar.currency).toUpperCase();

  const persisted = await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('on_demand_webinar'), hashtext(${`${input.userId}:${webinar.webinarId}`}))`);

    const [existingEntitlement] = await tx
      .select()
      .from(webinarRecordingEntitlements)
      .where(and(
        eq(webinarRecordingEntitlements.user_id, input.userId),
        eq(webinarRecordingEntitlements.webinar_id, webinar.webinarId),
      ))
      .limit(1);

    const [existingPayment] = await tx
      .select()
      .from(payments)
      .where(and(
        eq(payments.entity_type, "on_demand_webinar"),
        eq(payments.entity_id, input.session.id),
      ))
      .limit(1);

    const alreadyEntitled = Boolean(existingEntitlement?.purchased_at && !existingEntitlement.revoked_at);
    const duplicatePayment = alreadyEntitled
      && existingEntitlement?.stripe_checkout_session_id !== input.session.id;

    let paymentId = existingPayment?.id ?? null;
    if (!paymentId) {
      const [createdPayment] = await tx
        .insert(payments)
        .values({
          user_id: input.userId,
          entity_type: "on_demand_webinar",
          entity_id: input.session.id,
          amount_cents: amountCents,
          currency,
          status: "paid",
          provider: "stripe",
          provider_payment_intent_id: paymentIntentId,
          metadata: {
            source: "on_demand_webinar_fulfillment",
            webinarId: webinar.webinarId,
            stripeCheckoutSessionId: input.session.id,
            stripePriceId: expectedPrice.priceId,
            purchase_type: "on_demand_webinar",
            duplicatePayment,
          },
        })
        .returning({ id: payments.id });
      paymentId = createdPayment.id;
    } else {
      await tx
        .update(payments)
        .set({
          status: "paid",
          amount_cents: amountCents,
          currency,
          provider_payment_intent_id: paymentIntentId ?? existingPayment?.provider_payment_intent_id ?? null,
          metadata: mergeMetadata(
            isRecord(existingPayment?.metadata) ? existingPayment.metadata : null,
            {
              source: "on_demand_webinar_fulfillment",
              webinarId: webinar.webinarId,
              stripeCheckoutSessionId: input.session.id,
              stripePriceId: expectedPrice.priceId,
              purchase_type: "on_demand_webinar",
              duplicatePayment,
            },
          ),
          updated_at: new Date(),
        })
        .where(eq(payments.id, paymentId));
    }

    const order = await persistOnDemandWebinarOrder(tx as unknown as Database, {
      userId: input.userId,
      webinarId: webinar.webinarId,
      title: webinar.title,
      amountCents,
      currency,
      paymentReference: input.session.id,
      stripePaymentIntentId: paymentIntentId,
      stripeCheckoutSessionId: input.session.id,
      entitlementId: existingEntitlement?.id ?? null,
      paymentId,
      duplicatePayment,
    });

    let entitlementId = existingEntitlement?.id ?? null;
    let purchasedAt = existingEntitlement?.purchased_at ?? null;
    if (!alreadyEntitled) {
      const now = existingEntitlement?.purchased_at ?? new Date();
      if (existingEntitlement) {
        await tx
          .update(webinarRecordingEntitlements)
          .set({
            stripe_checkout_session_id: input.session.id,
            stripe_payment_intent_id: paymentIntentId,
            stripe_price_id: expectedPrice.priceId,
            amount_cents: amountCents,
            currency,
            grant_source: "stripe_checkout",
            purchased_at: now,
            revoked_at: null,
            order_id: order?.id ?? existingEntitlement.order_id,
            payment_id: paymentId,
            updated_at: new Date(),
          })
          .where(eq(webinarRecordingEntitlements.id, existingEntitlement.id));
        entitlementId = existingEntitlement.id;
        purchasedAt = now;
      } else {
        const [created] = await tx
          .insert(webinarRecordingEntitlements)
          .values({
            user_id: input.userId,
            webinar_id: webinar.webinarId,
            stripe_checkout_session_id: input.session.id,
            stripe_payment_intent_id: paymentIntentId,
            stripe_price_id: expectedPrice.priceId,
            amount_cents: amountCents,
            currency,
            grant_source: "stripe_checkout",
            purchased_at: now,
            order_id: order?.id ?? null,
            payment_id: paymentId,
          })
          .onConflictDoNothing()
          .returning();
        if (created) {
          entitlementId = created.id;
          purchasedAt = created.purchased_at;
        } else {
          const [reread] = await tx
            .select()
            .from(webinarRecordingEntitlements)
            .where(and(
              eq(webinarRecordingEntitlements.user_id, input.userId),
              eq(webinarRecordingEntitlements.webinar_id, webinar.webinarId),
            ))
            .limit(1);
          entitlementId = reread?.id ?? null;
          purchasedAt = reread?.purchased_at ?? now;
        }
      }
    }

    if (!entitlementId || !paymentId) {
      throw createHttpError(500, "On-demand webinar purchase could not be persisted.");
    }

    if (order && entitlementId) {
      await tx
        .update(webinarRecordingEntitlements)
        .set({ order_id: order.id, updated_at: new Date() })
        .where(eq(webinarRecordingEntitlements.id, entitlementId));
    }

    return {
      entitlementId,
      paymentId,
      orderId: order?.id ?? null,
      webinarId: webinar.webinarId,
      userId: input.userId,
      duplicatePayment,
      purchasedAt,
      amountCents,
      currency,
      title: webinar.title,
    };
  });

  let notificationQueued = false;
  try {
    const sendResult = await sendOnDemandWebinarConfirmedNotification(db, {
      entitlementId: persisted.entitlementId,
      userId: persisted.userId,
      webinarId: persisted.webinarId,
      title: persisted.title,
      amountCents: persisted.amountCents,
      currency: persisted.currency,
      orderId: persisted.orderId,
      purchasedAt: persisted.purchasedAt,
    });
    notificationQueued = sendResult.success !== false;
  } catch (error) {
    logger.error("on_demand_webinar_confirmation_notification_failed", {
      entitlementId: persisted.entitlementId,
      userId: persisted.userId,
      webinarId: persisted.webinarId,
      error: error instanceof Error ? error.message : error,
    });
  }

  return {
    entitlementId: persisted.entitlementId,
    paymentId: persisted.paymentId,
    orderId: persisted.orderId,
    webinarId: persisted.webinarId,
    userId: persisted.userId,
    duplicatePayment: persisted.duplicatePayment,
    notificationQueued,
  };
}
