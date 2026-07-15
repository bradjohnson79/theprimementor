import Stripe from "stripe";
import type { Database } from "@wisdom/db";
import { getFrontendUrl } from "../config/membershipBilling.js";
import { createHttpError } from "./booking/errors.js";
import { ensureStripeCustomerId } from "./payments/stripeCustomerService.js";

let stripeInstance: Stripe | null = null;

function getStripe() {
  if (!stripeInstance) {
    const key = process.env.STRIPE_SECRET_KEY?.trim();
    if (!key) {
      throw createHttpError(503, "Stripe billing is not configured.");
    }
    stripeInstance = new Stripe(key);
  }
  return stripeInstance;
}

export async function createMemberBillingPortalSession(
  db: Database,
  input: {
    userId: string;
    email: string;
  },
) {
  const stripe = getStripe();
  const stripeCustomerId = await ensureStripeCustomerId(db, {
    stripe,
    userId: input.userId,
    email: input.email,
    metadata: {
      userId: input.userId,
      source: "member_billing_portal",
    },
  });

  const returnUrl = `${getFrontendUrl()}/settings`;
  const session = await stripe.billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: returnUrl,
    flow_data: {
      type: "payment_method_update",
      after_completion: {
        type: "redirect",
        redirect: {
          return_url: returnUrl,
        },
      },
    },
  });

  if (!session.url) {
    throw createHttpError(502, "Stripe did not return a billing portal URL.");
  }

  return {
    url: session.url,
  };
}
