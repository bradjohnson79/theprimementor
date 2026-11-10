import { expressAmountCents, expressSessionQuantity, getExpressService, type ExpressCheckoutInput, type ExpressServiceId } from "@wisdom/utils";
import type Stripe from "stripe";
import { getFrontendUrl } from "../../config/membershipBilling.js";
import { createHttpError } from "../booking/errors.js";
import { sendResendEmail } from "../notifications/providers/resendProvider.js";
import { checkoutPaymentMethodTypesParam, createStripeClient } from "../stripe/stripeClientFactory.js";
import { resolveAdminExpressEmail } from "./expressEmail.js";
import { confirmPaidExpressOrder, type NotificationRow } from "./expressFulfillment.js";

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

export async function fulfillPaidExpressCheckout(session: { id: string; created?: number | null; metadata?: Stripe.Metadata | null }) {
  const metadata = session.metadata ?? {};
  const service = getExpressService(metadata.serviceId);
  if (!service) throw new Error("Express checkout is missing its service");
  const customerEmail = metadata.customerEmail?.trim();
  const customerName = metadata.customerName?.trim();
  if (!customerEmail || !customerName) throw new Error("Express checkout is missing the customer");

  const quantity = expressSessionQuantity(service.id, metadata.quantity);
  if (!quantity) throw new Error("Express checkout has an invalid quantity");
  const paidAt = new Date((session.created ?? Math.floor(Date.now() / 1000)) * 1000);
  const notices: NotificationRow[] = [];
  await confirmPaidExpressOrder({
    id: session.id,
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

  for (const notice of notices) {
    const sent = await sendResendEmail({
      to: [notice.recipient],
      subject: notice.subject,
      text: notice.body,
      html: notice.body.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/\n/g, "<br>"),
    });
    if (!sent.success) {
      throw new Error(sent.error || "Express confirmation email failed");
    }
  }
}
