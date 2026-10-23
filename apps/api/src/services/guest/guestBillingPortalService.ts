import { createHttpError } from "../booking/errors.js";
import { ensureStripeCustomerId } from "../payments/stripeCustomerService.js";
import { createStripeClient } from "../stripe/stripeClientFactory.js";
import type { Database } from "@wisdom/db";

function getFrontendUrl(): string {
  return (process.env.FRONTEND_URL || process.env.APP_URL || "http://localhost:3000").trim().replace(/\/$/, "");
}

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) {
    throw createHttpError(503, "Stripe billing is not configured.");
  }
  return createStripeClient(key);
}

/**
 * Billing Portal session for a guest buyer, created fresh from their signed order-page link
 * (never a static portal URL — Stripe requires a freshly created session per visit anyway).
 * Returns to the same order page token rather than a member dashboard, since guests don't have
 * one.
 */
export async function createGuestBillingPortalSession(
  db: Database,
  input: { userId: string; email: string; orderPageToken: string },
) {
  const stripe = getStripe();
  const stripeCustomerId = await ensureStripeCustomerId(db, {
    stripe,
    userId: input.userId,
    email: input.email,
    metadata: { userId: input.userId, source: "guest_order_page_billing_portal" },
  });

  const returnUrl = `${getFrontendUrl()}/order/${encodeURIComponent(input.orderPageToken)}`;
  const session = await stripe.billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: returnUrl,
  });

  if (!session.url) {
    throw createHttpError(502, "Stripe did not return a billing portal URL.");
  }

  return { url: session.url };
}
