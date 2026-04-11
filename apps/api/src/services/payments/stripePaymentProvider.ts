import Stripe from "stripe";
import type {
  ConfirmPaymentInput,
  CreatePaymentIntentInput,
  PaymentProvider,
  PaymentProviderResult,
  RefundPaymentInput,
} from "./paymentProvider.js";
import { createHttpError } from "./errors.js";

let stripeInstance: Stripe | null = null;

function getStripe(): Stripe {
  if (!stripeInstance) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw createHttpError(503, "Stripe is not configured");
    }
    stripeInstance = new Stripe(key);
  }
  return stripeInstance;
}

function stringifyMetadata(metadata?: Record<string, unknown> | null): Record<string, string> | undefined {
  if (!metadata) return undefined;
  return Object.fromEntries(Object.entries(metadata).map(([key, value]) => [key, String(value)]));
}

export class StripePaymentProvider implements PaymentProvider {
  async createPaymentIntent(input: CreatePaymentIntentInput): Promise<PaymentProviderResult> {
    const stripe = getStripe();
    const intent = await stripe.paymentIntents.create({
      amount: input.amountCents,
      currency: input.currency.toLowerCase(),
      metadata: stringifyMetadata({
        paymentId: input.paymentId,
        ...(input.metadata ?? {}),
      }),
      automatic_payment_methods: { enabled: true },
    });

    return {
      providerPaymentIntentId: intent.id,
      providerCustomerId: typeof intent.customer === "string" ? intent.customer : null,
      metadata: {
        providerStatus: intent.status,
      },
    };
  }

  async confirmPayment(input: ConfirmPaymentInput): Promise<PaymentProviderResult> {
    if (!input.providerPaymentIntentId) {
      throw createHttpError(400, "Payment is missing a Stripe payment intent");
    }

    const stripe = getStripe();
    const intent = await stripe.paymentIntents.retrieve(input.providerPaymentIntentId);

    return {
      providerPaymentIntentId: intent.id,
      providerCustomerId: typeof intent.customer === "string" ? intent.customer : null,
      metadata: {
        providerStatus: intent.status,
      },
    };
  }

  async refundPayment(input: RefundPaymentInput): Promise<PaymentProviderResult> {
    if (!input.providerPaymentIntentId) {
      throw createHttpError(400, "Payment is missing a Stripe payment intent");
    }

    const stripe = getStripe();
    const refund = await stripe.refunds.create({
      payment_intent: input.providerPaymentIntentId,
      metadata: stringifyMetadata({
        paymentId: input.paymentId,
        ...(input.metadata ?? {}),
      }),
    });

    return {
      providerPaymentIntentId: input.providerPaymentIntentId,
      metadata: {
        refundId: refund.id,
        providerStatus: refund.status,
      },
    };
  }
}
