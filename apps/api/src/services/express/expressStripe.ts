import type { Database } from "@wisdom/db";
import { sql } from "drizzle-orm";
import { expressAmountCents, expressSessionQuantity, getExpressService, type ExpressCheckoutInput, type ExpressServiceId } from "@wisdom/utils";
import type Stripe from "stripe";
import { getFrontendUrl } from "../../config/membershipBilling.js";
import { createHttpError } from "../booking/errors.js";
import { sendResendEmail } from "../notifications/providers/resendProvider.js";
import { checkoutPaymentMethodTypesParam, createStripeClient } from "../stripe/stripeClientFactory.js";
import { resolveAdminExpressEmail } from "./expressEmail.js";
import { confirmPaidExpressOrder, type ExpressOrderRecord, type NotificationRow } from "./expressFulfillment.js";

const LIVE_PRICE_ENV: Record<ExpressServiceId, string> = {
  ask: "STRIPE_LIVE_PRICE_EXPRESS_ASK",
  healing: "STRIPE_LIVE_PRICE_EXPRESS_HEALING",
  "past-life": "STRIPE_LIVE_PRICE_EXPRESS_PAST_LIFE",
};

const LIVE_PRICE_FALLBACK: Record<ExpressServiceId, string> = {
  ask: "price_1UZvGHAd5V3LaCqjyY6GLQEJ",
  healing: "price_1UZvJPAd5V3LaCqjG4Q4j5k0",
  "past-life": "price_1UZvHNAd5V3LaCqj4yMnfbem",
};

const TRANSCRIPTION_PRICE_ENV = "STRIPE_LIVE_PRICE_EXPRESS_TRANSCRIPTION";
const TRANSCRIPTION_PRICE_FALLBACK = "price_1UZvY4Ad5V3LaCqjmrqFwrnn";

function clip(value: string, max = 450) {
  return value.trim().slice(0, max);
}

export function expressLivePriceId(serviceId: ExpressServiceId, env: Record<string, string | undefined> = process.env) {
  return env[LIVE_PRICE_ENV[serviceId]]?.trim() || LIVE_PRICE_FALLBACK[serviceId];
}

export function expressTranscriptionPriceId(env: Record<string, string | undefined> = process.env) {
  return env[TRANSCRIPTION_PRICE_ENV]?.trim() || TRANSCRIPTION_PRICE_FALLBACK;
}

export function expressCheckoutSelection(input: Pick<ExpressCheckoutInput, "serviceId" | "transcription" | "quantity">) {
  const service = getExpressService(input.serviceId);
  if (!service) throw createHttpError(400, "Unknown Express service");
  const quantity = expressSessionQuantity(service.id, input.quantity);
  if (!quantity) throw createHttpError(400, "Choose a quantity from 1 to 3.");
  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
    { price: expressLivePriceId(service.id), quantity },
  ];
  if (input.transcription) {
    lineItems.push({ price: expressTranscriptionPriceId(), quantity: 1 });
  }
  return {
    service,
    quantity,
    amountCents: expressAmountCents(service.id, input.transcription, quantity),
    lineItems,
  };
}

export async function createExpressCheckoutSession(input: ExpressCheckoutInput) {
  const secret = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secret) throw createHttpError(503, "Stripe is not configured for Express checkout");

  const selection = expressCheckoutSelection(input);
  const { service, quantity, amountCents, lineItems } = selection;
  const stripe = createStripeClient(secret);
  const frontendUrl = getFrontendUrl();
  const metadata: Record<string, string> = {
    type: "express",
    serviceId: service.id,
    serviceName: service.name,
    customerName: clip(input.name, 200),
    customerEmail: clip(input.email, 200),
    transcription: input.transcription ? "yes" : "no",
    quantity: String(quantity),
    guide: input.guide,
    birthdate: clip(input.birthdate, 40),
    question: clip(input.question),
    focusAreas: clip(input.focusAreas.filter(Boolean).join(" | ")),
    healingContext: clip(input.healingContext),
    pastLifeInterest: clip(input.pastLifeInterest),
    amountCents: String(amountCents),
  };

  return stripe.checkout.sessions.create({
    ...checkoutPaymentMethodTypesParam(),
    mode: "payment",
    customer_email: input.email.trim(),
    client_reference_id: `express:${service.id}:${quantity}`,
    line_items: lineItems,
    metadata,
    payment_intent_data: { metadata },
    success_url: `${frontendUrl}/express/${service.id}?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${frontendUrl}/express/${service.id}?checkout=canceled`,
  });
}

export async function savePaidExpressOrder(db: Database, order: ExpressOrderRecord, intake: Record<string, string>) {
  if (!order.paidAt || !order.deliveryDate || !order.deadlineAt) return;
  await db.execute(sql`
    INSERT INTO express_orders (
      id, service_id, service_name, customer_name, customer_email,
      amount_cents, currency, transcription, quantity, payment_status,
      fulfillment_status, paid_at, timezone, delivery_date, deadline_at, intake
    ) VALUES (
      ${order.id},
      ${order.serviceId},
      ${order.serviceName},
      ${order.customerName},
      ${order.customerEmail},
      ${order.amountCents},
      'CAD',
      ${order.transcription},
      ${order.quantity ?? 1},
      ${order.paymentStatus},
      ${order.fulfillmentStatus},
      ${order.paidAt},
      ${order.timezone},
      ${order.deliveryDate},
      ${order.deadlineAt},
      CAST(${JSON.stringify(intake)} AS jsonb)
    )
    ON CONFLICT (id) DO NOTHING
  `);
}

function expressPaymentIntentId(session: {
  id: string;
  payment_intent?: string | { id?: string | null } | null;
}) {
  const paymentIntent = session.payment_intent;
  if (typeof paymentIntent === "string" && paymentIntent.trim()) return paymentIntent.trim();
  if (paymentIntent && typeof paymentIntent === "object" && typeof paymentIntent.id === "string") {
    return paymentIntent.id.trim() || null;
  }
  return session.id.startsWith("pi_") ? session.id : null;
}

function sqlRows(result: unknown) {
  if (Array.isArray(result)) return result;
  if (result && typeof result === "object" && "rows" in result && Array.isArray(result.rows)) {
    return result.rows;
  }
  return [];
}

export async function fulfillPaidExpressCheckout(
  session: {
    id: string;
    created?: number | null;
    metadata?: Stripe.Metadata | null;
    payment_intent?: string | { id?: string | null } | null;
  },
  db?: Database,
) {
  const metadata = session.metadata ?? {};
  const service = getExpressService(metadata.serviceId);
  if (!service) throw new Error("Express checkout is missing its service");
  const customerEmail = metadata.customerEmail?.trim();
  const customerName = metadata.customerName?.trim();
  if (!customerEmail || !customerName) throw new Error("Express checkout is missing the customer");

  const quantity = expressSessionQuantity(service.id, metadata.quantity);
  if (!quantity) throw new Error("Express checkout has an invalid quantity");
  const paidAt = new Date((session.created ?? Math.floor(Date.now() / 1000)) * 1000);
  const orderId = expressPaymentIntentId(session) ?? session.id;
  if (db) {
    const existing = await db.execute(sql`select id from express_orders where id = ${orderId} limit 1`);
    if (sqlRows(existing).length > 0) return;
  }

  const notices: NotificationRow[] = [];
  const confirmed = await confirmPaidExpressOrder({
    id: orderId,
    serviceId: service.id,
    customerName,
    transcription: metadata.transcription === "yes",
    quantity,
    paidAt,
    customerEmail,
    adminEmail: resolveAdminExpressEmail(),
    orders: [],
    notices,
  });
  const intake = {
    birthdate: metadata.birthdate ?? "",
    guide: metadata.guide ?? "",
    question: metadata.question ?? "",
    focusAreas: metadata.focusAreas ?? "",
    healingContext: metadata.healingContext ?? "",
    pastLifeInterest: metadata.pastLifeInterest ?? "",
  };
  if (db) {
    await savePaidExpressOrder(db, confirmed.order, intake);
    await recordExpressAdminOrder(db, confirmed.order, intake);
  }

  for (const notice of notices) {
    try {
      const sent = await sendResendEmail({
        to: [notice.recipient],
        subject: notice.subject,
        text: notice.body,
        html: notice.body.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/\n/g, "<br>"),
      });
      if (!sent.success) {
        console.warn("express_confirmation_email_failed", notice.recipient, sent.error);
      }
    } catch (error) {
      console.warn("express_confirmation_email_failed", notice.recipient, error);
    }
  }
}

async function recordExpressAdminOrder(
  db: Database,
  order: ExpressOrderRecord,
  intake: Record<string, string>,
) {
  const paymentIntentId = order.id.startsWith("pi_") ? order.id : null;
  const metadata = JSON.stringify({
    sessionType: "express",
    session_type: "express",
    product_name: order.serviceName,
    serviceId: order.serviceId,
    customerName: order.customerName,
    price_snapshot_cents: order.amountCents,
    price_snapshot_currency: "CAD",
    intake,
  });
  await db.execute(sql`
    insert into clients (user_id, full_birth_name, birth_date)
    select users.id, ${order.customerName}, nullif(${intake.birthdate ?? ""}, '')
    from users
    where lower(users.email) = lower(${order.customerEmail})
      and not exists (select 1 from clients where clients.user_id = users.id)
  `);
  await db.execute(sql`
    insert into orders (
      user_id, type, label, amount, currency, status,
      payment_reference, stripe_payment_intent_id, metadata, created_at, updated_at
    )
    select
      users.id,
      'session',
      ${order.serviceName},
      ${order.amountCents},
      'CAD',
      'completed',
      ${paymentIntentId ?? order.id},
      ${paymentIntentId},
      cast(${metadata} as jsonb),
      ${order.paidAt ? new Date(order.paidAt) : new Date()},
      now()
    from users
    where lower(users.email) = lower(${order.customerEmail})
      and not exists (
        select 1 from orders existing
        where existing.stripe_payment_intent_id = ${paymentIntentId}
          or existing.payment_reference = ${order.id}
      )
  `);
}
